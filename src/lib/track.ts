// Client-side funnel events. Pushed to the GTM dataLayer and sent to GA4/Meta when present.
// Purchases are NOT tracked client-side: confirmed orders are reported server-side only after an
// agent verifies the provider's confirmation (src/lib/services/conversions.ts).

export type FunnelEvent =
  | "address_search"
  | "plans_displayed"
  | "plan_selected"
  | "enrollment_started"
  | "enrollment_submitted";

type W = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

const META_EVENTS: Partial<Record<FunnelEvent, string>> = {
  address_search: "Search",
  plan_selected: "AddToCart",
  enrollment_started: "InitiateCheckout",
  enrollment_submitted: "Lead",
};

export function track(event: FunnelEvent, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as W;
  try {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params });
    w.gtag?.("event", event, params);
    const meta = META_EVENTS[event];
    if (meta) w.fbq?.("track", meta, params);
  } catch {
    /* never break the funnel for analytics */
  }
}

/** GA4 client id from the _ga cookie, used to tie verified server-side conversions to the visit. */
export function gaClientId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
  return m ? m[1] : null;
}
