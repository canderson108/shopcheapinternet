import { prisma, type Db } from "../db";
import { randomToken, sha256 } from "../crypto";
import { env } from "../env";

// Customer access is never granted by the enrollment ID alone. A customer reaches their
// status page either with a browser session cookie (set at submission) or through an
// expiring emailed link containing a 256-bit random token.

export const CUSTOMER_COOKIE = "sci_cust";
export const CUSTOMER_SESSION_DAYS = 30;
export const ACCESS_LINK_DAYS = 14;

export async function createCustomerSessionToken(db: Db, enrollmentId: string): Promise<string> {
  const token = randomToken();
  await db.customerSession.create({
    data: {
      enrollmentId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + CUSTOMER_SESSION_DAYS * 86400_000),
    },
  });
  return token;
}

export async function createAccessLink(db: Db, enrollmentId: string): Promise<string> {
  const token = randomToken();
  await db.customerAccessToken.create({
    data: {
      enrollmentId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ACCESS_LINK_DAYS * 86400_000),
    },
  });
  return `${env.appUrl}/enrollment/access?t=${encodeURIComponent(token)}`;
}

export async function redeemAccessToken(token: string): Promise<{ enrollmentId: string; publicId: string } | null> {
  if (!token || token.length > 200) return null;
  const row = await prisma.customerAccessToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { enrollment: { select: { id: true, publicId: true, piiDeletedAt: true } } },
  });
  if (!row || row.expiresAt < new Date() || row.enrollment.piiDeletedAt) return null;
  await prisma.customerAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return { enrollmentId: row.enrollment.id, publicId: row.enrollment.publicId };
}

/** Resolves which enrollment (if any) a customer session token grants access to. */
export async function enrollmentIdForCustomerToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const s = await prisma.customerSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.enrollmentId;
}

export const customerCookieOptions = {
  httpOnly: true,
  secure: env.secureCookies,
  sameSite: "lax" as const,
  path: "/",
  maxAge: CUSTOMER_SESSION_DAYS * 86400,
};
