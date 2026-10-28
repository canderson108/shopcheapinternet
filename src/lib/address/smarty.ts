import { env } from "../env";
import type { Address } from "./normalize";

// Smarty (smarty.com) US Address Autocomplete Pro + US Street Address API.
// Secret-key auth is used server-side only; keys are never sent to the browser.

export function addressVerificationConfigured(): boolean {
  return Boolean(env.smartyAuthId && env.smartyAuthToken);
}

export type Suggestion = { street: string; unit: string | null; city: string; state: string; zip: string; entries: number };

export async function autocomplete(search: string, selected?: string): Promise<Suggestion[]> {
  if (!addressVerificationConfigured()) return [];
  const params = new URLSearchParams({
    "auth-id": env.smartyAuthId!,
    "auth-token": env.smartyAuthToken!,
    search,
    max_results: "8",
  });
  if (selected) params.set("selected", selected);
  const res = await fetch(`https://us-autocomplete-pro.api.smarty.com/lookup?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Address autocomplete failed (HTTP ${res.status})`);
  const body = (await res.json()) as {
    suggestions?: { street_line: string; secondary: string; city: string; state: string; zipcode: string; entries: number }[];
  };
  return (body.suggestions ?? []).map((s) => ({
    street: s.street_line,
    unit: s.secondary || null,
    city: s.city,
    state: s.state,
    zip: s.zipcode,
    entries: s.entries,
  }));
}

export type VerificationResult =
  | { status: "verified"; address: Address; needsUnit: false }
  | { status: "needs_unit"; address: Address; needsUnit: true }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

/** Verifies deliverability via USPS DPV and returns the standardized address. */
export async function verifyAddress(a: Address): Promise<VerificationResult> {
  if (!addressVerificationConfigured()) return { status: "unavailable", reason: "not_configured" };
  const params = new URLSearchParams({
    "auth-id": env.smartyAuthId!,
    "auth-token": env.smartyAuthToken!,
    street: a.street,
    city: a.city,
    state: a.state,
    zipcode: a.zip,
    candidates: "1",
    match: "invalid",
  });
  if (a.unit) params.set("secondary", a.unit);
  try {
    const res = await fetch(`https://us-street.api.smarty.com/street-address?${params}`, { cache: "no-store" });
    if (!res.ok) return { status: "unavailable", reason: `HTTP ${res.status}` };
    const body = (await res.json()) as {
      delivery_line_1: string;
      components: { secondary_number?: string; city_name: string; state_abbreviation: string; zipcode: string; default_city_name?: string };
      analysis: { dpv_match_code?: string };
    }[];
    const c = body[0];
    if (!c || !c.analysis.dpv_match_code || c.analysis.dpv_match_code === "N") return { status: "not_found" };
    const unit = c.components.secondary_number ?? a.unit ?? null;
    // Strip the secondary designator from delivery_line_1 so street and unit are stored separately.
    const street = unit ? c.delivery_line_1.replace(new RegExp(`\\s+(apt|unit|ste|#|bldg|lot|fl)?\\s*#?\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim() : c.delivery_line_1;
    const address: Address = {
      street,
      unit,
      city: c.components.city_name,
      state: c.components.state_abbreviation,
      zip: c.components.zipcode,
    };
    if (c.analysis.dpv_match_code === "D") return { status: "needs_unit", address, needsUnit: true };
    return { status: "verified", address, needsUnit: false };
  } catch (e) {
    return { status: "unavailable", reason: e instanceof Error ? e.message : "error" };
  }
}
