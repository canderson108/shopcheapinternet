import type { AgentAvailability, Enrollment } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { audit, SYSTEM_ACTOR, type Actor } from "../audit";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { ACTIVE_AGENT_STATUSES } from "../status";
import { channels, publish } from "../realtime";
import { lockEnrollment, transitionStatus } from "./status-service";
import { Effects } from "./effects";
import { notifyAgentAssigned, notifyCustomerStatus } from "./notify";

const ACTIVE_SQL_LIST = ACTIVE_AGENT_STATUSES.map((s) => `'${s}'`).join(", ");

/**
 * Locks every AVAILABLE agent row (serialising concurrent assigners), then counts each agent's
 * active workload with a fresh snapshot and returns the fairest choice:
 * fewest active orders first, then the agent who has waited longest since their last assignment.
 */
export async function pickAgent(tx: Tx, excludeAgentId?: string): Promise<string | null> {
  const agents = await tx.$queryRawUnsafe<{ staffUserId: string; maxActiveOrders: number; lastAssignedAt: Date | null }[]>(
    `SELECT ap."staffUserId", ap."maxActiveOrders", ap."lastAssignedAt"
       FROM "AgentProfile" ap
       JOIN "StaffUser" su ON su."id" = ap."staffUserId"
      WHERE ap."availability" = 'AVAILABLE' AND su."active" = true
      ORDER BY ap."staffUserId"
      FOR UPDATE OF ap`,
  );
  const candidates = agents.filter((a) => a.staffUserId !== excludeAgentId);
  if (!candidates.length) return null;

  const loads = await tx.$queryRawUnsafe<{ assignedAgentId: string; n: bigint }[]>(
    `SELECT "assignedAgentId", COUNT(*)::bigint AS n FROM "Enrollment"
      WHERE "assignedAgentId" = ANY($1::text[]) AND "status" IN (${ACTIVE_SQL_LIST})
      GROUP BY "assignedAgentId"`,
    candidates.map((a) => a.staffUserId),
  );
  const load = new Map(loads.map((l) => [l.assignedAgentId, Number(l.n)]));

  const eligible = candidates
    .map((a) => ({ ...a, active: load.get(a.staffUserId) ?? 0 }))
    .filter((a) => a.active < a.maxActiveOrders)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active - b.active;
      const at = a.lastAssignedAt ? a.lastAssignedAt.getTime() : 0;
      const bt = b.lastAssignedAt ? b.lastAssignedAt.getTime() : 0;
      return at - bt;
    });
  return eligible[0]?.staffUserId ?? null;
}

/** Points the enrollment at an agent and records the assignment. Caller handles the status change. */
async function recordAssignment(tx: Tx, enrollment: Enrollment, agentId: string, actor: Actor, reason: string) {
  await tx.agentAssignment.updateMany({
    where: { enrollmentId: enrollment.id, active: true },
    data: { active: false, unassignedAt: new Date() },
  });
  await tx.agentAssignment.create({
    data: {
      enrollmentId: enrollment.id,
      agentId,
      assignedById: actor.type === "STAFF" ? actor.staffId : null,
      reason,
    },
  });
  await tx.agentProfile.update({
    where: { staffUserId: agentId },
    data: { lastAssignedAt: new Date(), totalAssigned: { increment: 1 } },
  });
  await audit(tx, {
    actor,
    action: "enrollment.assigned",
    entityType: "Enrollment",
    entityId: enrollment.id,
    enrollmentId: enrollment.id,
    metadata: { agentId, previousAgentId: enrollment.assignedAgentId, reason },
  });
  await publish(tx, [channels.agent(agentId), channels.staff, channels.enrollment(enrollment.id)], "enrollment.assigned", {
    enrollmentId: enrollment.id,
    agentId,
  });
  if (enrollment.assignedAgentId && enrollment.assignedAgentId !== agentId) {
    await publish(tx, [channels.agent(enrollment.assignedAgentId)], "enrollment.unassigned", { enrollmentId: enrollment.id });
  }
}

/**
 * Attempts automatic assignment of an enrollment that is INFORMATION_SUBMITTED or WAITING_FOR_AGENT.
 * Returns the agent id, or null when no agent has capacity (the order then waits in the queue).
 */
export async function autoAssign(tx: Tx, enrollmentId: string, effects: Effects): Promise<string | null> {
  const enrollment = await lockEnrollment(tx, enrollmentId);
  if (enrollment.assignedAgentId || !["INFORMATION_SUBMITTED", "WAITING_FOR_AGENT"].includes(enrollment.status)) {
    return enrollment.assignedAgentId;
  }
  const agentId = await pickAgent(tx);
  if (!agentId) {
    if (enrollment.status === "INFORMATION_SUBMITTED") {
      await transitionStatus(tx, enrollment, "WAITING_FOR_AGENT", SYSTEM_ACTOR, { note: "No agent available — added to queue" });
      await publish(tx, [channels.staff], "queue.changed", { enrollmentId });
    }
    return null;
  }
  await recordAssignment(tx, enrollment, agentId, SYSTEM_ACTOR, "auto");
  await transitionStatus(tx, { ...enrollment, assignedAgentId: agentId }, "AGENT_ASSIGNED", SYSTEM_ACTOR, {
    note: "Automatically assigned",
    data: { assignedAgentId: agentId, assignedAt: new Date() },
  });
  if (enrollment.status === "WAITING_FOR_AGENT") await publish(tx, [channels.staff], "queue.changed", { enrollmentId });
  effects.add(() => notifyAgentAssigned(enrollmentId, agentId));
  effects.add(() => notifyCustomerStatus(enrollmentId, "AGENT_ASSIGNED"));
  return agentId;
}

/** Assigns queued enrollments (oldest first) while any available agent has capacity. */
export async function drainQueue(maxIterations = 50): Promise<number> {
  let assigned = 0;
  for (let i = 0; i < maxIterations; i++) {
    const effects = new Effects();
    const result = await prisma.$transaction(async (tx) => {
      const next = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Enrollment"
         WHERE "status" = 'WAITING_FOR_AGENT' AND "assignedAgentId" IS NULL
         ORDER BY "submittedAt" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`;
      if (!next.length) return "empty" as const;
      const agentId = await autoAssign(tx, next[0].id, effects);
      return agentId ? ("assigned" as const) : ("no_agent" as const);
    });
    await effects.run();
    if (result !== "assigned") break;
    assigned++;
  }
  return assigned;
}

export async function setAvailability(agentId: string, availability: AgentAvailability, actor: Actor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const profile = await tx.agentProfile.upsert({
      where: { staffUserId: agentId },
      create: { staffUserId: agentId, availability },
      update: { availability, availabilityChangedAt: new Date() },
    });
    await audit(tx, { actor, action: "agent.availability", entityType: "AgentProfile", entityId: profile.id, metadata: { availability } });
    await publish(tx, [channels.staff, channels.agent(agentId)], "agent.availability", { agentId, availability });
  });
  if (availability === "AVAILABLE") await drainQueue();
}

/** An agent takes a queued order. Exactly one concurrent claimer can win. */
export async function claimEnrollment(agentId: string, enrollmentId: string, actor: Actor): Promise<void> {
  const effects = new Effects();
  await prisma.$transaction(async (tx) => {
    const enrollment = await lockEnrollment(tx, enrollmentId);
    if (enrollment.status !== "WAITING_FOR_AGENT" || enrollment.assignedAgentId) {
      throw new ConflictError("Another agent already picked up this order.");
    }
    const agent = await tx.staffUser.findUnique({ where: { id: agentId }, include: { agentProfile: true } });
    if (!agent?.active || !agent.agentProfile) throw new ForbiddenError("Your agent profile is not active.");
    await recordAssignment(tx, enrollment, agentId, actor, "claimed");
    await transitionStatus(tx, { ...enrollment, assignedAgentId: agentId }, "AGENT_ASSIGNED", actor, {
      note: "Claimed from queue",
      data: { assignedAgentId: agentId, assignedAt: new Date() },
    });
    await publish(tx, [channels.staff], "queue.changed", { enrollmentId });
    effects.add(() => notifyCustomerStatus(enrollmentId, "AGENT_ASSIGNED"));
  });
  await effects.run();
}

/**
 * Manager/admin reassignment. toAgentId=null returns the order to the queue.
 * Status is preserved when the order is mid-flight (info requested / submitted to provider).
 */
export async function reassignEnrollment(enrollmentId: string, toAgentId: string | null, actor: Actor, note?: string): Promise<void> {
  const effects = new Effects();
  await prisma.$transaction(async (tx) => {
    const enrollment = await lockEnrollment(tx, enrollmentId);
    if (["PROVIDER_ORDER_CONFIRMED", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"].includes(enrollment.status)) {
      throw new AppError("Closed orders cannot be reassigned.", 422, "closed");
    }
    if (toAgentId === enrollment.assignedAgentId) return;

    if (toAgentId === null) {
      await tx.agentAssignment.updateMany({ where: { enrollmentId, active: true }, data: { active: false, unassignedAt: new Date() } });
      await audit(tx, { actor, action: "enrollment.unassigned", entityType: "Enrollment", entityId: enrollmentId, enrollmentId, metadata: { previousAgentId: enrollment.assignedAgentId, note: note ?? null } });
      if (enrollment.assignedAgentId) await publish(tx, [channels.agent(enrollment.assignedAgentId)], "enrollment.unassigned", { enrollmentId });
      await transitionStatus(tx, enrollment, "WAITING_FOR_AGENT", actor, {
        note: note ?? "Returned to queue",
        data: { assignedAgentId: null, assignedAt: null },
        force: enrollment.status === "SUBMITTED_TO_PROVIDER",
      });
      await publish(tx, [channels.staff], "queue.changed", { enrollmentId });
      return;
    }

    const agent = await tx.staffUser.findUnique({ where: { id: toAgentId }, include: { agentProfile: true } });
    if (!agent || !agent.active || !agent.agentProfile) throw new NotFoundError("Agent not found or inactive");

    await recordAssignment(tx, enrollment, toAgentId, actor, note ? `reassigned: ${note}` : "reassigned");
    const keepStatus = enrollment.status === "ADDITIONAL_INFO_REQUIRED" || enrollment.status === "SUBMITTED_TO_PROVIDER";
    if (keepStatus) {
      await tx.enrollment.update({ where: { id: enrollmentId }, data: { assignedAgentId: toAgentId, assignedAt: new Date() } });
      await tx.enrollmentStatusHistory.create({
        data: {
          enrollmentId,
          fromStatus: enrollment.status,
          toStatus: enrollment.status,
          actorType: actor.type,
          actorStaffId: actor.type === "STAFF" ? actor.staffId : null,
          note: `Reassigned to ${agent.name}${note ? `: ${note}` : ""}`,
        },
      });
    } else {
      await transitionStatus(tx, { ...enrollment, assignedAgentId: toAgentId }, "AGENT_ASSIGNED", actor, {
        note: `Reassigned to ${agent.name}${note ? `: ${note}` : ""}`,
        data: { assignedAgentId: toAgentId, assignedAt: new Date() },
        force: enrollment.status === "AGENT_ASSIGNED",
      });
    }
    if (enrollment.status === "WAITING_FOR_AGENT") await publish(tx, [channels.staff], "queue.changed", { enrollmentId });
    effects.add(() => notifyAgentAssigned(enrollmentId, toAgentId));
  });
  await effects.run();
}
