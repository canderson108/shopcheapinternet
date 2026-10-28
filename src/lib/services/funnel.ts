import type { EnrollmentSession } from "@prisma/client";
import { prisma } from "../db";
import { decryptJson, decryptOptional, encrypt, encryptJson, encryptOptional, randomToken, sha256 } from "../crypto";
import { AppError, NotFoundError } from "../errors";
import type { Address } from "../address/normalize";
import { draftSchema, type Draft } from "../validation";

export const FUNNEL_COOKIE = "sci_fs";
export const FUNNEL_SESSION_DAYS = 30;

export type Attribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ref?: string | null;
  campaign?: string | null;
  landingPath?: string | null;
};

const clip = (s: string | null | undefined, n = 200) => (s ? s.slice(0, n) : null);

async function resolveAttribution(a: Attribution) {
  const referral = a.ref ? await prisma.referralSource.findFirst({ where: { code: a.ref, active: true } }) : null;
  const campaignCode = a.campaign ?? null;
  const campaign = campaignCode
    ? await prisma.campaign.findFirst({ where: { code: campaignCode, active: true } })
    : a.utmCampaign
      ? await prisma.campaign.findFirst({ where: { utmCampaign: a.utmCampaign, active: true } })
      : null;
  return {
    referralSourceId: referral?.id ?? null,
    campaignId: campaign?.id ?? null,
    utmSource: clip(a.utmSource),
    utmMedium: clip(a.utmMedium),
    utmCampaign: clip(a.utmCampaign),
    utmTerm: clip(a.utmTerm),
    utmContent: clip(a.utmContent),
    gclid: clip(a.gclid, 300),
    fbclid: clip(a.fbclid, 300),
    landingPath: clip(a.landingPath, 300),
  };
}

export async function createFunnelSession(attribution: Attribution = {}): Promise<{ token: string; session: EnrollmentSession }> {
  const token = randomToken();
  const session = await prisma.enrollmentSession.create({
    data: {
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + FUNNEL_SESSION_DAYS * 86400_000),
      ...(await resolveAttribution(attribution)),
    },
  });
  return { token, session };
}

export async function getFunnelSessionByToken(token: string | undefined | null): Promise<EnrollmentSession | null> {
  if (!token) return null;
  const s = await prisma.enrollmentSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!s || s.expiresAt < new Date()) return null;
  return s;
}

export async function setSessionAddress(
  sessionId: string,
  address: Address,
  opts: { verified: boolean; source: string; propertyId?: string | null; unitNumber?: string | null; attribution?: Attribution },
): Promise<EnrollmentSession> {
  let propertyAttribution: { referralSourceId?: string | null; campaignId?: string | null } = {};
  if (opts.propertyId) {
    const property = await prisma.property.findUnique({ where: { id: opts.propertyId } });
    if (!property || !property.active) throw new NotFoundError("Property not found");
    propertyAttribution = { referralSourceId: property.referralSourceId, campaignId: property.campaignId };
  }
  const current = await prisma.enrollmentSession.findUniqueOrThrow({ where: { id: sessionId } });
  return prisma.enrollmentSession.update({
    where: { id: sessionId },
    data: {
      streetEnc: encrypt(address.street),
      unitEnc: encryptOptional(address.unit),
      city: address.city,
      state: address.state,
      zip: address.zip,
      addressVerified: opts.verified,
      addressSource: opts.source,
      addressEnteredAt: new Date(),
      propertyId: opts.propertyId ?? current.propertyId,
      unitNumber: opts.unitNumber ?? address.unit ?? null,
      // Property attribution wins over generic attribution, but never erases an existing value.
      referralSourceId: propertyAttribution.referralSourceId ?? current.referralSourceId,
      campaignId: propertyAttribution.campaignId ?? current.campaignId,
      // Address changed: previous plan selection may no longer apply.
      ...(current.zip && current.zip !== address.zip ? { selectedPlanId: null, selectedPriceCents: null, selectedAt: null } : {}),
    },
  });
}

export function sessionAddress(s: EnrollmentSession): Address | null {
  if (!s.streetEnc || !s.city || !s.state || !s.zip) return null;
  return { street: decryptOptional(s.streetEnc)!, unit: decryptOptional(s.unitEnc), city: s.city, state: s.state, zip: s.zip };
}

export async function selectPlan(sessionId: string, planId: string): Promise<EnrollmentSession> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { provider: true } });
  if (!plan || !plan.active || !plan.provider.active || !plan.provider.orderable) {
    throw new AppError("That plan is no longer available to order. Please choose another plan.", 409, "plan_unavailable");
  }
  const session = await prisma.enrollmentSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.zip) throw new AppError("Enter your address first.", 400, "address_required");
  if (session.enrollmentId) throw new AppError("This enrollment was already submitted.", 409, "already_submitted");
  return prisma.enrollmentSession.update({
    where: { id: sessionId },
    data: { selectedPlanId: plan.id, selectedPriceCents: plan.monthlyPriceCents, selectedAt: new Date() },
  });
}

export async function saveDraft(sessionId: string, draft: Draft): Promise<void> {
  const parsed = draftSchema.parse(draft);
  await prisma.enrollmentSession.update({ where: { id: sessionId }, data: { draftEnc: encryptJson(parsed) } });
}

export function sessionDraft(s: EnrollmentSession): Draft {
  try {
    return decryptJson<Draft>(s.draftEnc) ?? {};
  } catch {
    return {};
  }
}
