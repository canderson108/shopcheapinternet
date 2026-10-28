import { cookies } from "next/headers";
import { getCurrentFunnelSession } from "@/lib/funnel-cookie";
import { submitEnrollment } from "@/lib/services/enrollment";
import { CUSTOMER_COOKIE, customerCookieOptions } from "@/lib/auth/customer";
import { ipHash, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import type { EnrollmentSubmitInput } from "@/lib/validation";

export const POST = route(async (req) => {
  const ip = ipHash(req);
  await rateLimit(`submit:${ip}`, 10, 3600);
  const session = await getCurrentFunnelSession();
  if (!session) throw new AppError("Your session expired. Please enter your address again.", 400, "no_session");
  let body: EnrollmentSubmitInput;
  try {
    body = (await req.json()) as EnrollmentSubmitInput;
  } catch {
    throw new AppError("Invalid request body", 400);
  }
  const result = await submitEnrollment(session.id, body, { ipHash: ip, userAgent: req.headers.get("user-agent") });
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, result.customerToken, customerCookieOptions);
  return json({
    ok: true,
    duplicate: result.duplicate,
    publicId: result.enrollment.publicId,
    status: result.enrollment.status,
    next: `/enrollment/${result.enrollment.publicId}`,
  });
});
