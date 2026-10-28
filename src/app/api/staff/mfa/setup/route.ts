import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getStaffContext, markSessionMfaVerified } from "@/lib/auth/staff";
import { generateMfaSecret, mfaOtpauthUrl, verifyMfaCode } from "@/lib/auth/password";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, UnauthorizedError } from "@/lib/errors";

// GET: issue (or re-issue) a pending TOTP secret and QR code. Only allowed until MFA is enabled.
export const GET = route(async () => {
  const ctx = await getStaffContext();
  if (!ctx) throw new UnauthorizedError();
  const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (user.mfaEnabled) throw new AppError("Two-factor authentication is already enabled. Ask an administrator to reset it.", 409);
  let secret: string;
  if (user.mfaSecretEnc) secret = decrypt(user.mfaSecretEnc);
  else {
    const g = generateMfaSecret();
    secret = g.secret;
    await prisma.staffUser.update({ where: { id: user.id }, data: { mfaSecretEnc: g.secretEnc } });
  }
  const otpauth = mfaOtpauthUrl(user.email, secret);
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
  return json({ qr, secret });
});

// POST: confirm the first code to enable MFA.
export const POST = route(async (req) => {
  const ctx = await getStaffContext();
  if (!ctx) throw new UnauthorizedError();
  await rateLimit(`mfa-setup:${ctx.sessionId}`, 10, 900);
  const { code } = await readBody(req, z.object({ code: z.string().max(10) }));
  const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (user.mfaEnabled) throw new AppError("Already enabled", 409);
  if (!user.mfaSecretEnc || !verifyMfaCode(user.mfaSecretEnc, code)) throw new AppError("That code didn't work. Try the current code from your app.", 401, "bad_code");
  await prisma.staffUser.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  await markSessionMfaVerified(ctx.sessionId);
  await audit(prisma, { actor: ctx.actor, action: "staff.mfa_enabled", entityType: "StaffUser", entityId: user.id });
  return json({ ok: true, next: user.role === "AGENT" ? "/agent" : "/admin" });
});
