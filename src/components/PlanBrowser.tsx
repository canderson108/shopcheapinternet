"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { track } from "@/lib/track";
import { connectionLabel, formatDate, formatPrice, formatSpeed } from "@/lib/format";
import { DEFAULT_HOUSEHOLD, householdSummary, pickRecommended, type Household } from "@/lib/recommend";
import { PlanFacts, priceFootnote, type PlanCardData } from "./PlanCard";

export function PlanBrowser({ plans, selectedPlanId, zip }: { plans: PlanCardData[]; selectedPlanId: string | null; zip: string }) {
  const router = useRouter();
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD);
  const [showQuiz, setShowQuiz] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"price" | "speed">("price");

  const rec = useMemo(() => pickRecommended(plans, household), [plans, household]);
  const sorted = useMemo(
    () => [...plans].sort((a, b) => (sort === "price" ? a.monthlyPriceCents - b.monthlyPriceCents : b.downloadMbps - a.downloadMbps)),
    [plans, sort],
  );

  useEffect(() => {
    track("plans_displayed", { zip, count: plans.length });
  }, [zip, plans.length]);

  async function select(p: PlanCardData) {
    setSelecting(p.id);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/session/plan", { body: { planId: p.id } });
      track("plan_selected", { plan: p.name, provider: p.providerName, value: p.monthlyPriceCents / 100, currency: "USD" });
      router.push(r.next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't select that plan. Please try again.");
      setSelecting(null);
    }
  }

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  }

  const compared = plans.filter((p) => compare.includes(p.id));

  return (
    <div className="mt-6">
      {/* Recommendation */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-navy-900">Recommended for you:</span> about {formatSpeed(rec.targetMbps)} for {householdSummary(household)}.
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setShowQuiz((s) => !s)} aria-expanded={showQuiz}>
              {showQuiz ? "Done" : "Tell us about your home"}
            </button>
            <label className="sr-only" htmlFor="sort">Sort plans</label>
            <select id="sort" className="input w-auto py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as "price" | "speed")}>
              <option value="price">Lowest price</option>
              <option value="speed">Fastest</option>
            </select>
          </div>
        </div>
        {showQuiz && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="people">People at home</label>
              <input id="people" type="number" min={1} max={12} className="input" value={household.people} onChange={(e) => setHousehold({ ...household, people: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <label className="label" htmlFor="devices">Connected devices</label>
              <input id="devices" type="number" min={1} max={100} className="input" value={household.devices} onChange={(e) => setHousehold({ ...household, devices: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="label">What do you do online?</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["streaming4k", "4K streaming"],
                    ["gaming", "Online gaming"],
                    ["workFromHome", "Work from home"],
                    ["largeUploads", "Large uploads"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${household[k] ? "border-mint-600 bg-mint-50 text-mint-700" : "border-slate-300 text-slate-600"}`}>
                    <input type="checkbox" className="sr-only" checked={household[k]} onChange={(e) => setHousehold({ ...household, [k]: e.target.checked })} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Plan cards */}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((p) => {
          const isRec = p.id === rec.recommendedId;
          const isValue = p.id === rec.bestValueId && !isRec;
          return (
            <article key={p.id} className={`card relative flex flex-col p-5 ${isRec ? "border-mint-500 ring-2 ring-mint-500/40" : ""}`}>
              {(isRec || isValue) && (
                <span className={`badge absolute -top-3 left-5 ${isRec ? "bg-mint-600 text-white" : "bg-navy-900 text-white"}`}>
                  {isRec ? "Best fit for your home" : "Best value per Mbps"}
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.providerName}</p>
                  <h2 className="mt-0.5 text-xl font-bold text-navy-900">{p.name}</h2>
                </div>
                <span className="badge bg-navy-50 text-navy-800">{connectionLabel(p.connectionType)}</span>
              </div>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-navy-900">{formatPrice(p.monthlyPriceCents)}</span>
                <span className="text-sm text-slate-500">/mo</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{priceFootnote(p)}</p>
              {p.regularPriceCents && p.regularPriceCents > p.monthlyPriceCents && (
                <p className="mt-1 text-xs text-slate-500">Regular price {formatPrice(p.regularPriceCents)}/mo after promotional period.</p>
              )}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <PlanFacts p={p} />
              </div>
              {p.equipmentIncluded && <p className="mt-3 text-xs text-slate-600"><span className="font-semibold">Equipment:</span> {p.equipmentIncluded}</p>}
              {p.installationNotes && <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Installation:</span> {p.installationNotes}</p>}
              {p.promoDescription && (
                <p className="mt-3 rounded-lg bg-mint-50 px-3 py-2 text-xs font-medium text-mint-700">
                  {p.promoDescription}
                  {p.promoExpiresAt ? ` Offer ends ${formatDate(p.promoExpiresAt)}.` : p.promoExpirationNote ? ` ${p.promoExpirationNote}` : ""}
                </p>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-ink">
                <span aria-hidden>ⓘ</span>
                {p.availabilityLabel}
              </p>
              {p.disclosures && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium text-slate-600">Important disclosures</summary>
                  <p className="mt-1 leading-5">{p.disclosures}</p>
                </details>
              )}
              <p className="mt-2 text-[11px] text-slate-400">Source: {p.sourceName} · checked {formatDate(p.sourceCheckedAt)}</p>
              <div className="mt-auto flex items-center gap-3 pt-4">
                <button className="btn-primary flex-1" onClick={() => select(p)} disabled={selecting !== null} aria-label={`Select ${p.providerName} ${p.name}`}>
                  {selecting === p.id ? "Selecting…" : p.id === selectedPlanId ? "Continue with this plan" : "Select Plan"}
                </button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                  <input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} disabled={!compare.includes(p.id) && compare.length >= 3} className="h-4 w-4 accent-mint-600" />
                  Compare
                </label>
              </div>
            </article>
          );
        })}
      </div>

      {/* Side-by-side comparison */}
      {compared.length >= 2 && (
        <section className="card mt-8 overflow-x-auto p-0" aria-labelledby="compare-h">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="compare-h" className="text-lg font-bold text-navy-900">Side-by-side comparison</h2>
            <button className="btn-ghost btn-sm" onClick={() => setCompare([])}>Clear</button>
          </div>
          <table className="table-base mt-3 min-w-[560px]">
            <thead>
              <tr>
                <th className="w-40">Feature</th>
                {compared.map((p) => <th key={p.id}>{p.providerName} {p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Monthly price", (p: PlanCardData) => `${formatPrice(p.monthlyPriceCents)}/mo`],
                  ["Price terms", (p: PlanCardData) => priceFootnote(p)],
                  ["Download", (p: PlanCardData) => formatSpeed(p.downloadMbps)],
                  ["Upload", (p: PlanCardData) => formatSpeed(p.uploadMbps)],
                  ["Connection", (p: PlanCardData) => connectionLabel(p.connectionType)],
                  ["Installation", (p: PlanCardData) => (p.installationFeeCents === null ? "Confirmed at order" : formatPrice(p.installationFeeCents, { free: "$0" }))],
                  ["Equipment", (p: PlanCardData) => p.equipmentIncluded ?? (p.equipmentFeeCents === 0 ? "Included" : p.equipmentFeeCents ? `${formatPrice(p.equipmentFeeCents)}/mo` : "Confirmed at order")],
                  ["Data cap", (p: PlanCardData) => p.dataCap ?? "See provider terms"],
                  ["Contract", (p: PlanCardData) => (p.contractRequired ? (p.contractTerms ?? "Required") : "None required")],
                  ["Promotion", (p: PlanCardData) => p.promoDescription ?? "—"],
                ] as const
              ).map(([label, fn]) => (
                <tr key={label}>
                  <td className="font-medium text-slate-600">{label}</td>
                  {compared.map((p) => <td key={p.id}>{fn(p)}</td>)}
                </tr>
              ))}
              <tr>
                <td />
                {compared.map((p) => (
                  <td key={p.id}>
                    <button className="btn-primary btn-sm" onClick={() => select(p)} disabled={selecting !== null}>Select</button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
