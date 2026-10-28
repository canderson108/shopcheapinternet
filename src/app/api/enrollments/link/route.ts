import { z } from "zod";
import { prisma } from "@/lib/db";
import { lookupHash, decrypt } from "@/lib/crypto";
import { createAccessLink } from "@/lib/auth/customer";
import { sendEmail } from "@/lib/email/send";
import { accessLinkEmail } from "@/lib/email/templates";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// "Email me a secure link" — always returns the same response so emails can't be enumerated.
export const POST = route(async (req) => {
  const { email } = await readBody(req, z.object({ email: z.string().trim().toLowerCase().email().max(254) }));
  await rateLimit(`link-ip:${ipHash(req)}`, 10, 3600);
  await rateLimit(`link-email:${lookupHash(email)}`, 3, 3600);
  const enrollment = await prisma.enrollment.findFirst({
    where: { customer: { emailHash: lookupHash(email), deletedAt: null }, piiDeletedAt: null },
    orderBy: { submittedAt: "desc" },
    include: { customer: true },
  });
  if (enrollment) {
    const url = await createAccessLink(prisma, enrollment.id);
    const r = accessLinkEmail({ firstName: enrollment.customer.firstName, publicId: enrollment.publicId, statusUrl: url });
    await sendEmail({ to: decrypt(enrollment.customer.emailEnc), ...r, template: "access_link", enrollmentId: enrollment.id });
  }
  return json({ ok: true, message: "If we have an enrollment for that email, we just sent a secure link to it." });
});
