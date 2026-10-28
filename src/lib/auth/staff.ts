import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { StaffRole, StaffUser } from "@prisma/client";
import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";
import { env } from "../env";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { Actor } from "../audit";

export const STAFF_COOKIE = "sci_staff";
const SESSION_HOURS = 12;

export type StaffContext = {
  user: Pick<StaffUser, "id" | "email" | "name" | "role" | "mfaEnabled">;
  sessionId: string;
  mfaVerified: boolean;
  actor: Actor;
};

/** Creates a session row and sets the cookie. MFA state starts unverified when MFA applies. */
export async function startStaffSession(user: StaffUser, meta: { ipHash?: string; userAgent?: string }) {
  const token = randomToken();
  const mfaApplies = user.mfaEnabled || env.staffMfaRequired;
  await prisma.staffSession.create({
    data: {
      tokenHash: sha256(token),
      staffUserId: user.id,
      mfaVerified: !mfaApplies,
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
      ipHash: meta.ipHash,
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });
  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { mfaPending: mfaApplies };
}

export async function endStaffSession() {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(STAFF_COOKIE);
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { staffUser: { select: { id: true, email: true, name: true, role: true, mfaEnabled: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.staffUser.active) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const { active: _active, ...user } = session.staffUser;
  return {
    user,
    sessionId: session.id,
    mfaVerified: session.mfaVerified,
    actor: { type: "STAFF", staffId: user.id, name: user.name, role: user.role },
  };
}

export async function markSessionMfaVerified(sessionId: string) {
  await prisma.staffSession.update({ where: { id: sessionId }, data: { mfaVerified: true } });
}

function roleAllowed(role: StaffRole, roles?: StaffRole[]) {
  return !roles || roles.includes(role);
}

/** For server components/pages: redirects instead of throwing. */
export async function requireStaffPage(roles?: StaffRole[]): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/staff/login");
  if (!ctx.mfaVerified) redirect(ctx.user.mfaEnabled ? "/staff/mfa" : "/staff/mfa/setup");
  if (!roleAllowed(ctx.user.role, roles)) redirect(ctx.user.role === "AGENT" ? "/agent" : "/admin");
  return ctx;
}

/** For route handlers and server actions: throws AppErrors. */
export async function requireStaffApi(roles?: StaffRole[]): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.mfaVerified) throw new UnauthorizedError();
  if (!roleAllowed(ctx.user.role, roles)) throw new ForbiddenError();
  return ctx;
}

export function isManager(role: StaffRole) {
  return role === "MANAGER" || role === "ADMIN";
}
