import { connectionLabel, formatDate, formatPrice, formatSpeed } from "@/lib/format";
import type { PlanWithProvider } from "@/lib/services/plans";

export function PlanTable({ plans }: { plans: PlanWithProvider[] }) {
  if (!plans.length) return <p>Plan pricing is being updated. Enter your address to request current offers.</p>;
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="table-base min-w-[600px]">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Price</th>
            <th>Download / upload</th>
            <th>Type</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td className="font-semibold text-navy-900">{p.provider.name} {p.name}</td>
              <td>
                <span className="font-bold">{formatPrice(p.monthlyPriceCents)}/mo</span>
                <span className="block text-xs text-slate-500">
                  {[p.priceTermMonths ? `${p.priceTermMonths} mo.` : null, p.priceConditions].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td>{formatSpeed(p.downloadMbps)} / {formatSpeed(p.uploadMbps)}</td>
              <td>{connectionLabel(p.connectionType)}</td>
              <td className="text-xs text-slate-600">{[p.dataCap ? `Data: ${p.dataCap}` : null, p.contractRequired ? "Contract" : "No contract", p.promoDescription].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        Advertised prices plus taxes & fees. Sources: {Array.from(new Set(plans.map((p) => `${p.sourceName} (checked ${formatDate(p.sourceCheckedAt)})`))).join("; ")}. Availability varies by address.
      </p>
    </div>
  );
}
