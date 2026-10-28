import "server-only";
import { requireStaffApi, isManager } from "./auth/staff";
import type { StaffActor } from "./services/orders";
import { prisma } from "./db";
import { ForbiddenError, NotFoundError } from "./errors";

/** Resolves the signed-in staff member and checks they may access this enrollment. */
export async function staffForOrder(enrollmentId: string, opts: { allowUnassignedView?: boolean } = {}) {
  const ctx = await requireStaffApi();
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { id: true, assignedAgentId: true, status: true } });
  if (!e) throw new NotFoundError("Enrollment not found");
  const manager = isManager(ctx.user.role);
  const mine = e.assignedAgentId === ctx.user.id;
  const queued = e.status === "WAITING_FOR_AGENT" && !e.assignedAgentId;
  if (!manager && !mine && !(opts.allowUnassignedView && queued)) throw new ForbiddenError("This order is assigned to another agent.");
  const staff: StaffActor = { id: ctx.user.id, role: ctx.user.role, name: ctx.user.name };
  return { ctx, staff, enrollment: e, manager, mine };
}
