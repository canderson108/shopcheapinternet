import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { CUSTOMER_COOKIE, enrollmentIdForCustomerToken } from "./auth/customer";
import { UnauthorizedError } from "./errors";

/** Returns the enrollment id if the browser's customer session grants access to this public id. */
export async function customerEnrollmentId(publicId: string): Promise<string | null> {
  const jar = await cookies();
  const id = await enrollmentIdForCustomerToken(jar.get(CUSTOMER_COOKIE)?.value);
  if (!id) return null;
  const e = await prisma.enrollment.findUnique({ where: { id }, select: { publicId: true, piiDeletedAt: true } });
  if (!e || e.publicId !== publicId || e.piiDeletedAt) return null;
  return id;
}

export async function requireCustomerEnrollment(publicId: string): Promise<string> {
  const id = await customerEnrollmentId(publicId);
  // Same response whether or not the reference exists, so references can't be probed.
  if (!id) throw new UnauthorizedError("Open the secure link we emailed you to view this enrollment.");
  return id;
}
