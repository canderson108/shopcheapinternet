import "server-only";
import { cookies } from "next/headers";
import type { EnrollmentSession } from "@prisma/client";
import { env } from "./env";
import { createFunnelSession, FUNNEL_COOKIE, FUNNEL_SESSION_DAYS, getFunnelSessionByToken, type Attribution } from "./services/funnel";

export async function readAttributionCookie(): Promise<Attribution> {
  const jar = await cookies();
  const raw = jar.get("sci_attr")?.value;
  if (!raw) return {};
  try {
    const a = JSON.parse(raw) as Record<string, string>;
    return {
      utmSource: a.utm_source,
      utmMedium: a.utm_medium,
      utmCampaign: a.utm_campaign,
      utmTerm: a.utm_term,
      utmContent: a.utm_content,
      gclid: a.gclid,
      fbclid: a.fbclid,
      ref: a.ref,
      campaign: a.campaign,
      landingPath: a.landing,
    };
  } catch {
    return {};
  }
}

export async function getCurrentFunnelSession(): Promise<EnrollmentSession | null> {
  const jar = await cookies();
  return getFunnelSessionByToken(jar.get(FUNNEL_COOKIE)?.value);
}

/** Returns the current funnel session, creating one (and its cookie) if needed. Route handlers only. */
export async function ensureFunnelSession(extra: Attribution = {}): Promise<EnrollmentSession> {
  const existing = await getCurrentFunnelSession();
  if (existing && !existing.enrollmentId) return existing;
  const attribution = { ...(await readAttributionCookie()), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) };
  const { token, session } = await createFunnelSession(attribution);
  const jar = await cookies();
  jar.set(FUNNEL_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: FUNNEL_SESSION_DAYS * 86400,
  });
  return session;
}
