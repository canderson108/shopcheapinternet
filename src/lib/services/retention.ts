import { prisma, Prisma } from "../db";
import { audit, SYSTEM_ACTOR, type Actor } from "../audit";
import { env } from "../env";
import { encrypt } from "../crypto";
import { TERMINAL_STATUSES } from "../status";
import { AppError } from "../errors";
import { drainQueue } from "./assignment";

const DELETED = "[deleted]";

/**
 * Erases customer PII on an enrollment (privacy / deletion requests and retention policy).
 * Operational facts (status, plan, timestamps, confirmation number, property) are kept for reporting.
 */
export async function anonymizeEnrollment(enrollmentId: string, actor: Actor, reason: string) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    if (!TERMINAL_STATUSES.includes(e.status) && actor.type === "SYSTEM") throw new AppError("Open orders are not purged automatically.", 422);
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        serviceStreetEnc: encrypt(DELETED),
        serviceUnitEnc: null,
        billingAddressEnc: null,
        customerNotesEnc: null,
        gclid: null,
        fbclid: null,
        gaClientId: null,
        piiDeletedAt: new Date(),
      },
    });
    await tx.message.updateMany({ where: { enrollmentId }, data: { bodyEnc: encrypt(DELETED), payload: Prisma.DbNull } });
    await tx.agentNote.updateMany({ where: { enrollmentId }, data: { bodyEnc: encrypt(DELETED) } });
    await tx.customerAccessToken.deleteMany({ where: { enrollmentId } });
    await tx.customerSession.deleteMany({ where: { enrollmentId } });
    // Erase the customer record if no other un-erased enrollment uses it.
    const others = await tx.enrollment.count({ where: { customerId: e.customerId, piiDeletedAt: null, NOT: { id: enrollmentId } } });
    if (others === 0) {
      await tx.customer.update({
        where: { id: e.customerId },
        data: { firstName: "Deleted", lastName: "Customer", emailEnc: encrypt(DELETED), emailHash: `deleted:${e.customerId}`, phoneEnc: encrypt(DELETED), phoneHash: `deleted:${e.customerId}`, deletedAt: new Date() },
      });
    }
    await audit(tx, { actor, action: "enrollment.pii_deleted", entityType: "Enrollment", entityId: enrollmentId, enrollmentId, metadata: { reason } });
  });
  if (!TERMINAL_STATUSES.includes((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).status)) {
    // A deleted open order cannot be processed; close it.
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "CUSTOMER_CANCELED", statusVersion: { increment: 1 }, completedAt: new Date() } });
    await prisma.enrollmentStatusHistory.create({ data: { enrollmentId, toStatus: "CUSTOMER_CANCELED", actorType: actor.type, actorStaffId: actor.type === "STAFF" ? actor.staffId : null, note: "Closed due to data deletion request" } });
    await drainQueue();
  }
}

/** Periodic housekeeping, run by the Vercel cron (and safe to run any time). */
export async function runMaintenance() {
  const now = new Date();
  const results: Record<string, number> = {};
  results.realtimeEvents = (await prisma.realtimeEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 86400_000) } } })).count;
  results.rateLimits = (await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  results.staffSessions = (await prisma.staffSession.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  results.customerSessions = (await prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  results.accessTokens = (await prisma.customerAccessToken.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  // Abandoned funnel sessions: erase the entered address and draft once expired (lead counts are kept).
  results.abandonedSessions = (
    await prisma.enrollmentSession.updateMany({
      where: { expiresAt: { lt: now }, enrollmentId: null, OR: [{ streetEnc: { not: null } }, { draftEnc: { not: null } }] },
      data: { streetEnc: null, unitEnc: null, draftEnc: null },
    })
  ).count;

  const days = env.dataRetentionDays;
  results.purgedEnrollments = 0;
  if (days > 0) {
    const cutoff = new Date(now.getTime() - days * 86400_000);
    const old = await prisma.enrollment.findMany({
      where: { piiDeletedAt: null, status: { in: TERMINAL_STATUSES }, completedAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    for (const o of old) {
      await anonymizeEnrollment(o.id, SYSTEM_ACTOR, `retention_${days}_days`);
      results.purgedEnrollments++;
    }
  }
  results.queueAssigned = await drainQueue();
  return results;
}
