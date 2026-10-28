import { z } from "zod";
import { prisma } from "@/lib/db";
import { getStaffContext, markSessionMfaVerified } from "@/lib/auth/staff";
import { verifyMfaCode } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, UnauthorizedError } from "@/lib/errors";

export const POST = route(async (req) => {
  const ctx = await getStaffContext();
  if (!ctx) throw new UnauthorizedError();
  await rateLimit(`mfa:${ctx.sessionId}`, 8, 900);
  const { code } = await readBody(req, z.object({ code: z.string().max(10) }));
  const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!user.mfaEnabled || !user.mfaSecretEnc) throw new AppError("Set up two-factor authentication first.", 400, "mfa_not_setup");
  if (!verifyMfaCode(user.mfaSecretEnc, code)) {
    await audit(prisma, { actor: ctx.actor, action: "staff.mfa_failed", entityType: "StaffUser", entityId: user.id });
    throw new AppError("That code didn't work. Check your authenticator app and try again.", 401, "bad_code");
  }
  await markSessionMfaVerified(ctx.sessionId);
  await audit(prisma, { actor: ctx.actor, action: "staff.mfa_verified", entityType: "StaffUser", entityId: user.id });
  return json({ ok: true, next: user.role === "AGENT" ? "/agent" : "/admin" });
});
