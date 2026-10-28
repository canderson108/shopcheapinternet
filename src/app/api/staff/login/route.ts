import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { startStaffSession } from "@/lib/auth/staff";
import { audit } from "@/lib/audit";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { lookupHash } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

const GENERIC = "Incorrect email or password.";
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
// bcrypt hash of a random throwaway value; used so unknown emails take as long as known ones.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKxGhuF6Cd0tqMoyCqmVJdqySy4ktvH2fIAqK";

export const POST = route(async (req) => {
  const { email, password } = await readBody(req, z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().max(200) }));
  const ip = ipHash(req);
  await rateLimit(`login-ip:${ip}`, 20, 900);
  await rateLimit(`login-email:${lookupHash(email)}`, 10, 900);

  const user = await prisma.staffUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    await verifyPassword(password, DUMMY_HASH).catch(() => false); // equalise timing
    throw new AppError(GENERIC, 401, "invalid_credentials");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(`Account temporarily locked after repeated failed sign-ins. Try again after ${LOCK_MINUTES} minutes.`, 423, "locked");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.staffUser.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await audit(prisma, { actor: { type: "SYSTEM" }, action: "staff.login_failed", entityType: "StaffUser", entityId: user.id, ipHash: ip });
    throw new AppError(GENERIC, 401, "invalid_credentials");
  }
  await prisma.staffUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const { mfaPending } = await startStaffSession(user, { ipHash: ip, userAgent: req.headers.get("user-agent") ?? undefined });
  await audit(prisma, { actor: { type: "STAFF", staffId: user.id }, action: "staff.login", entityType: "StaffUser", entityId: user.id, ipHash: ip });
  const next = mfaPending ? (user.mfaEnabled ? "/staff/mfa" : "/staff/mfa/setup") : user.role === "AGENT" ? "/agent" : "/admin";
  return json({ ok: true, next });
});
