import type { Enrollment, EnrollmentStatus, Prisma } from "@prisma/client";
import type { Tx } from "../db";
import { audit, type Actor } from "../audit";
import { ConflictError, AppError } from "../errors";
import { canTransition } from "../status";
import { channels, publish } from "../realtime";

/**
 * Moves an enrollment to a new status with optimistic concurrency control.
 * Every change writes an EnrollmentStatusHistory row (timestamp, actor, from, to, note) and an audit entry.
 */
export async function transitionStatus(
  tx: Tx,
  current: Pick<Enrollment, "id" | "status" | "statusVersion" | "assignedAgentId">,
  to: EnrollmentStatus,
  actor: Actor,
  opts: { note?: string | null; data?: Prisma.EnrollmentUncheckedUpdateManyInput; force?: boolean; expectedVersion?: number } = {},
): Promise<{ statusVersion: number }> {
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== current.statusVersion) {
    throw new ConflictError();
  }
  if (!opts.force && !canTransition(current.status, to)) {
    throw new AppError(`Cannot change status from ${current.status} to ${to}`, 422, "invalid_transition");
  }
  const res = await tx.enrollment.updateMany({
    where: { id: current.id, statusVersion: current.statusVersion, status: current.status },
    data: { ...(opts.data ?? {}), status: to, statusVersion: { increment: 1 } },
  });
  if (res.count !== 1) throw new ConflictError();

  await tx.enrollmentStatusHistory.create({
    data: {
      enrollmentId: current.id,
      fromStatus: current.status,
      toStatus: to,
      actorType: actor.type,
      actorStaffId: actor.type === "STAFF" ? actor.staffId : null,
      note: opts.note?.slice(0, 2000) ?? null,
    },
  });
  await audit(tx, {
    actor,
    action: "enrollment.status_changed",
    entityType: "Enrollment",
    entityId: current.id,
    enrollmentId: current.id,
    metadata: { from: current.status, to, note: opts.note ?? null },
  });
  const chans = [channels.enrollment(current.id), channels.staff];
  if (current.assignedAgentId) chans.push(channels.agent(current.assignedAgentId));
  await publish(tx, chans, "enrollment.updated", { enrollmentId: current.id, status: to });
  return { statusVersion: current.statusVersion + 1 };
}

export async function lockEnrollment(tx: Tx, id: string): Promise<Enrollment> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Enrollment" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new AppError("Enrollment not found", 404, "not_found");
  return tx.enrollment.findUniqueOrThrow({ where: { id } });
}
