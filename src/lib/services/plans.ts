import type { AvailabilityStatus, Plan, Provider } from "@prisma/client";
import { prisma } from "../db";

export type PlanWithProvider = Plan & { provider: Provider };

export type PlanOffer = PlanWithProvider & {
  availability: AvailabilityStatus;
  availabilityLabel: string;
};

export function availabilityLabel(status: AvailabilityStatus, providerName: string): string {
  switch (status) {
    case "AGENT_VERIFIED":
      return `Verified available at your address`;
    case "ADVERTISED_IN_ZIP":
      return `Advertised in your ZIP — specialist confirms your address`;
    case "NOT_AVAILABLE":
      return `Not available at this address`;
    default:
      return `Availability not yet confirmed — specialist checks with ${providerName}`;
  }
}

/** Active plans from providers that are currently orderable through Shop Cheap Internet. */
export async function getOrderablePlans(): Promise<PlanWithProvider[]> {
  return prisma.plan.findMany({
    where: { active: true, provider: { active: true, orderable: true } },
    include: { provider: true },
    orderBy: [{ provider: { sortOrder: "asc" } }, { sortOrder: "asc" }, { monthlyPriceCents: "asc" }],
  });
}

/**
 * Plans to show for a ZIP. We have no authorized address-level serviceability feed, so the best
 * we can say is "advertised in this ZIP" (when the provider has ZIP coverage configured) or
 * "indicative". Nothing is shown as verified until an agent confirms it in the provider portal.
 */
export async function getPlanOffersForZip(zip: string): Promise<PlanOffer[]> {
  const [plans, areas] = await Promise.all([
    getOrderablePlans(),
    prisma.serviceArea.findMany({ where: { zip }, select: { providerId: true } }),
  ]);
  const providersWithCoverageData = new Set(
    (
      await prisma.serviceArea.groupBy({ by: ["providerId"], _count: { _all: true } })
    ).map((r) => r.providerId),
  );
  const advertised = new Set(areas.map((a) => a.providerId));
  return plans
    .filter((p) => {
      // If the provider has coverage data and this ZIP isn't in it, hide the provider's plans.
      if (providersWithCoverageData.has(p.providerId) && !advertised.has(p.providerId)) return false;
      return true;
    })
    .map((p) => {
      const availability: AvailabilityStatus = advertised.has(p.providerId) ? "ADVERTISED_IN_ZIP" : "INDICATIVE";
      return { ...p, availability, availabilityLabel: availabilityLabel(availability, p.provider.name) };
    });
}

export async function getFeaturedPlans(limit = 4): Promise<PlanWithProvider[]> {
  const plans = await getOrderablePlans();
  const featured = plans.filter((p) => p.featured);
  return (featured.length ? featured : plans).slice(0, limit);
}

export function planSnapshot(p: PlanWithProvider) {
  return {
    planId: p.id,
    providerId: p.providerId,
    providerName: p.provider.name,
    name: p.name,
    connectionType: p.connectionType,
    downloadMbps: p.downloadMbps,
    uploadMbps: p.uploadMbps,
    monthlyPriceCents: p.monthlyPriceCents,
    regularPriceCents: p.regularPriceCents,
    priceTermMonths: p.priceTermMonths,
    priceConditions: p.priceConditions,
    installationFeeCents: p.installationFeeCents,
    equipmentFeeCents: p.equipmentFeeCents,
    equipmentIncluded: p.equipmentIncluded,
    promoDescription: p.promoDescription,
    promoExpiresAt: p.promoExpiresAt?.toISOString() ?? null,
    contractRequired: p.contractRequired,
    dataCap: p.dataCap,
    disclosures: p.disclosures,
    sourceName: p.sourceName,
    sourceUrl: p.sourceUrl,
    sourceCheckedAt: p.sourceCheckedAt.toISOString(),
  };
}

export type PlanSnapshot = ReturnType<typeof planSnapshot>;
