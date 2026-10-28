import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { CUSTOMER_COOKIE, createCustomerSessionToken, customerCookieOptions, redeemAccessToken } from "@/lib/auth/customer";
import { rateLimit } from "@/lib/rate-limit";
import { ipHash } from "@/lib/http";

// Exchanges an emailed, expiring access token for a customer session cookie, then redirects
// to the status page. The token is removed from the URL by the redirect.
export async function GET(req: NextRequest) {
  const base = new URL("/", req.url);
  try {
    await rateLimit(`access:${ipHash(req)}`, 30, 600);
  } catch {
    return NextResponse.redirect(new URL("/enrollment/find?error=rate", base));
  }
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const redeemed = await redeemAccessToken(token);
  if (!redeemed) return NextResponse.redirect(new URL("/enrollment/find?error=expired", base));
  const sessionToken = await createCustomerSessionToken(prisma, redeemed.enrollmentId);
  const res = NextResponse.redirect(new URL(`/enrollment/${redeemed.publicId}`, base));
  res.cookies.set(CUSTOMER_COOKIE, sessionToken, customerCookieOptions);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
