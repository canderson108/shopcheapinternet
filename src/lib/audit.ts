import type { ActorType, Prisma } from "@prisma/client";
import type { Db } from "./db";

export type Actor =
  | { type: "SYSTEM" }
  | { type: "CUSTOMER" }
  | { type: "STAFF"; staffId: string; name?: string; role?: string };

export const SYSTEM_ACTOR: Actor = { type: "SYSTEM" };

export async function audit(
  db: Db,
  entry: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId?: string | null;
    enrollmentId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorType: entry.actor.type as ActorType,
      actorStaffId: entry.actor.type === "STAFF" ? entry.actor.staffId : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      enrollmentId: entry.enrollmentId ?? null,
      metadata: entry.metadata,
      ipHash: entry.ipHash ?? null,
    },
  });
}
