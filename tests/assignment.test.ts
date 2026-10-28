import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitEnrollment } from "@/lib/services/enrollment";
import { claimEnrollment, drainQueue, reassignEnrollment, setAvailability } from "@/lib/services/assignment";
import { changeStatus, cancelByCustomer } from "@/lib/services/orders";
import { ACTIVE_AGENT_STATUSES } from "@/lib/status";
import { createAgent, readySession, resetDb, seedProviderAndPlan, submitInput } from "./helpers";

async function submitN(planId: string, n: number) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = await readySession(planId);
    out.push((await submitEnrollment(s.id, submitInput())).enrollment);
  }
  return out;
}

async function activeCount(agentId: string) {
  return prisma.enrollment.count({ where: { assignedAgentId: agentId, status: { in: ACTIVE_AGENT_STATUSES } } });
}

describe("agent assignment", () => {
  beforeEach(resetDb);

  it("distributes orders fairly across available agents", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE");
    const b = await createAgent("AVAILABLE");
    const enrollments = await submitN(plan.id, 6);
    expect(enrollments.every((e) => e.status === "AGENT_ASSIGNED")).toBe(true);
    expect(await activeCount(a.user.id)).toBe(3);
    expect(await activeCount(b.user.id)).toBe(3);
    // Consecutive orders alternate between agents.
    expect(enrollments[0].assignedAgentId).not.toBe(enrollments[1].assignedAgentId);
  });

  it("never assigns to busy, offline, or deactivated agents", async () => {
    const { plan } = await seedProviderAndPlan();
    await createAgent("BUSY");
    await createAgent("OFFLINE");
    const gone = await createAgent("AVAILABLE");
    await prisma.staffUser.update({ where: { id: gone.user.id }, data: { active: false } });
    const [e] = await submitN(plan.id, 1);
    expect(e.status).toBe("WAITING_FOR_AGENT");
    expect(e.assignedAgentId).toBeNull();
  });

  it("respects agent capacity and queues the overflow", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE", { max: 2 });
    const es = await submitN(plan.id, 4);
    expect(es.filter((e) => e.status === "AGENT_ASSIGNED")).toHaveLength(2);
    expect(es.filter((e) => e.status === "WAITING_FOR_AGENT")).toHaveLength(2);
    expect(await activeCount(a.user.id)).toBe(2);
  });

  it("never over-assigns under concurrent submissions", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE", { max: 3 });
    const b = await createAgent("AVAILABLE", { max: 3 });
    const sessions = [];
    for (let i = 0; i < 10; i++) sessions.push(await readySession(plan.id));
    const results = await Promise.all(sessions.map((s) => submitEnrollment(s.id, submitInput())));
    expect(results).toHaveLength(10);
    expect(await activeCount(a.user.id)).toBe(3);
    expect(await activeCount(b.user.id)).toBe(3);
    expect(await prisma.enrollment.count({ where: { status: "WAITING_FOR_AGENT" } })).toBe(4);
    // Each order has exactly one active assignment record.
    const multi = await prisma.agentAssignment.groupBy({ by: ["enrollmentId"], where: { active: true }, _count: { _all: true } });
    expect(multi.every((m) => m._count._all === 1)).toBe(true);
  });

  it("drains the queue oldest-first when an agent becomes available", async () => {
    const { plan } = await seedProviderAndPlan();
    const es = await submitN(plan.id, 3);
    expect(es.every((e) => e.status === "WAITING_FOR_AGENT")).toBe(true);
    const a = await createAgent("OFFLINE", { max: 2 });
    await setAvailability(a.user.id, "AVAILABLE", { type: "STAFF", staffId: a.user.id });
    const after = await prisma.enrollment.findMany({ orderBy: { submittedAt: "asc" } });
    expect(after[0].assignedAgentId).toBe(a.user.id);
    expect(after[1].assignedAgentId).toBe(a.user.id);
    expect(after[2].status).toBe("WAITING_FOR_AGENT");
  });

  it("frees capacity and pulls the next queued order when an order closes", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE", { max: 1 });
    const [first, second] = await submitN(plan.id, 2);
    expect(second.status).toBe("WAITING_FOR_AGENT");
    await cancelByCustomer(first.id, "changed my mind");
    const s2 = await prisma.enrollment.findUniqueOrThrow({ where: { id: second.id } });
    expect(s2.assignedAgentId).toBe(a.user.id);
    expect(s2.status).toBe("AGENT_ASSIGNED");
  });

  it("lets exactly one agent claim a queued order", async () => {
    const { plan } = await seedProviderAndPlan();
    const [e] = await submitN(plan.id, 1);
    const a = await createAgent("BUSY");
    const b = await createAgent("BUSY");
    const results = await Promise.allSettled([
      claimEnrollment(a.user.id, e.id, { type: "STAFF", staffId: a.user.id }),
      claimEnrollment(b.user.id, e.id, { type: "STAFF", staffId: b.user.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(409);
    const final = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect([a.user.id, b.user.id]).toContain(final.assignedAgentId);
    expect(final.status).toBe("AGENT_ASSIGNED");
  });

  it("prevents an agent from working another agent's order", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE");
    const [e] = await submitN(plan.id, 1);
    const other = await createAgent("BUSY");
    await expect(changeStatus(other.actor, e.id, "AGENT_PROCESSING", {})).rejects.toMatchObject({ status: 403 });
    await expect(changeStatus(a.actor, e.id, "AGENT_PROCESSING", {})).resolves.toBeTypeOf("number");
  });

  it("lets managers reassign or return orders to the queue, with history", async () => {
    const { plan } = await seedProviderAndPlan();
    const a = await createAgent("AVAILABLE");
    const [e] = await submitN(plan.id, 1);
    const b = await createAgent("BUSY");
    const mgr = await createAgent("OFFLINE", { role: "MANAGER" });
    const actor = { type: "STAFF" as const, staffId: mgr.user.id };

    await reassignEnrollment(e.id, b.user.id, actor, "coverage");
    let cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.assignedAgentId).toBe(b.user.id);
    expect(await prisma.agentAssignment.count({ where: { enrollmentId: e.id, active: true } })).toBe(1);
    expect(await prisma.agentAssignment.count({ where: { enrollmentId: e.id } })).toBe(2);

    await reassignEnrollment(e.id, null, actor, "back to queue");
    cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("WAITING_FOR_AGENT");
    expect(cur.assignedAgentId).toBeNull();

    const notes = await prisma.enrollmentStatusHistory.findMany({ where: { enrollmentId: e.id, actorStaffId: mgr.user.id } });
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(a.user.id).not.toBe(b.user.id);

    // drainQueue is safe to call with nobody available.
    await prisma.agentProfile.updateMany({ data: { availability: "OFFLINE" } });
    expect(await drainQueue()).toBe(0);
  });
});
