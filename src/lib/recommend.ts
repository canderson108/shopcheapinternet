// Speed recommendation used on the plan comparison page. Deliberately simple and explainable.

export type Household = {
  people: number;
  devices: number;
  streaming4k: boolean;
  gaming: boolean;
  workFromHome: boolean;
  largeUploads: boolean;
};

export const DEFAULT_HOUSEHOLD: Household = { people: 2, devices: 8, streaming4k: true, gaming: false, workFromHome: false, largeUploads: false };

/** Returns the minimum download speed (Mbps) we'd suggest for the household. */
export function recommendedMbps(h: Household): number {
  let mbps = 25 * Math.max(1, h.people) + 5 * Math.max(0, h.devices);
  if (h.streaming4k) mbps += 25 * Math.max(1, Math.ceil(h.people / 2));
  if (h.gaming) mbps += 75;
  if (h.workFromHome) mbps += 50 * Math.max(1, Math.ceil(h.people / 2));
  if (h.largeUploads) mbps += 100;
  return Math.round(mbps);
}

export function householdSummary(h: Household): string {
  const uses = [h.streaming4k && "4K streaming", h.gaming && "online gaming", h.workFromHome && "working from home", h.largeUploads && "large uploads"].filter(Boolean);
  return `${h.people} ${h.people === 1 ? "person" : "people"}, ~${h.devices} devices${uses.length ? `, ${uses.join(", ")}` : ""}`;
}

type Rankable = { id: string; downloadMbps: number; uploadMbps: number; monthlyPriceCents: number };

/** Picks the cheapest plan that meets the recommended speed (and upload needs), else the fastest. */
export function pickRecommended<T extends Rankable>(plans: T[], h: Household): { recommendedId: string | null; bestValueId: string | null; targetMbps: number } {
  const target = recommendedMbps(h);
  const minUpload = h.largeUploads || h.workFromHome ? 50 : 0;
  const byPrice = [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents || b.downloadMbps - a.downloadMbps);
  const fit = byPrice.find((p) => p.downloadMbps >= target && p.uploadMbps >= minUpload);
  const fastest = [...plans].sort((a, b) => b.downloadMbps - a.downloadMbps)[0];
  const bestValue = [...plans].sort((a, b) => a.monthlyPriceCents / a.downloadMbps - b.monthlyPriceCents / b.downloadMbps)[0];
  return { recommendedId: (fit ?? fastest)?.id ?? null, bestValueId: bestValue?.id ?? null, targetMbps: target };
}
