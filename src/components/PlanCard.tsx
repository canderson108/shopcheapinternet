import { connectionLabel, formatDate, formatPrice, formatSpeed } from "@/lib/format";

export type PlanCardData = {
  id: string;
  name: string;
  providerName: string;
  connectionType: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPriceCents: number;
  regularPriceCents: number | null;
  priceTermMonths: number | null;
  priceConditions: string | null;
  installationFeeCents: number | null;
  installationNotes: string | null;
  equipmentFeeCents: number | null;
  equipmentIncluded: string | null;
  promoDescription: string | null;
  promoExpiresAt: string | null;
  promoExpirationNote: string | null;
  contractRequired: boolean;
  contractTerms: string | null;
  dataCap: string | null;
  disclosures: string | null;
  sourceName: string;
  sourceCheckedAt: string;
  availabilityLabel?: string;
  availability?: string;
};

export function priceFootnote(p: PlanCardData): string {
  const parts: string[] = [];
  if (p.priceTermMonths) parts.push(`for ${p.priceTermMonths} months`);
  if (p.priceConditions) parts.push(p.priceConditions);
  parts.push("plus taxes & fees");
  return parts.join(" · ");
}

export function PlanFacts({ p }: { p: PlanCardData }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <div>
        <dt className="text-xs text-slate-500">Download</dt>
        <dd className="font-semibold text-slate-900">{formatSpeed(p.downloadMbps)}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Upload</dt>
        <dd className="font-semibold text-slate-900">{formatSpeed(p.uploadMbps)}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Installation</dt>
        <dd className="font-medium text-slate-800">{p.installationFeeCents === null ? "Confirmed at order" : formatPrice(p.installationFeeCents, { free: "$0" })}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Equipment</dt>
        <dd className="font-medium text-slate-800">{p.equipmentFeeCents === null ? "Confirmed at order" : p.equipmentFeeCents === 0 ? "Included" : `${formatPrice(p.equipmentFeeCents)}/mo`}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Data cap</dt>
        <dd className="font-medium text-slate-800">{p.dataCap ?? "See provider terms"}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Contract</dt>
        <dd className="font-medium text-slate-800">{p.contractRequired ? (p.contractTerms ?? "Required") : "None required"}</dd>
      </div>
    </dl>
  );
}

export function PlanCardStatic({ p, href }: { p: PlanCardData; href?: string }) {
  return (
    <article className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.providerName}</p>
          <h3 className="mt-0.5 text-lg font-bold text-navy-900">{p.name}</h3>
        </div>
        <span className="badge bg-navy-50 text-navy-800">{connectionLabel(p.connectionType)}</span>
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-extrabold text-navy-900">{formatPrice(p.monthlyPriceCents)}</span>
        <span className="text-sm text-slate-500">/mo</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{priceFootnote(p)}</p>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <PlanFacts p={p} />
      </div>
      {p.promoDescription && <p className="mt-4 rounded-lg bg-mint-50 px-3 py-2 text-xs font-medium text-mint-700">{p.promoDescription}</p>}
      <p className="mt-auto pt-4 text-[11px] leading-4 text-slate-400">
        Advertised offer · Source: {p.sourceName}, checked {formatDate(p.sourceCheckedAt)}
      </p>
      {href && (
        <a href={href} className="btn-outline mt-3 w-full">Check availability</a>
      )}
    </article>
  );
}

export function toCardData(p: {
  id: string;
  name: string;
  provider: { name: string };
  connectionType: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPriceCents: number;
  regularPriceCents: number | null;
  priceTermMonths: number | null;
  priceConditions: string | null;
  installationFeeCents: number | null;
  installationNotes: string | null;
  equipmentFeeCents: number | null;
  equipmentIncluded: string | null;
  promoDescription: string | null;
  promoExpiresAt: Date | null;
  promoExpirationNote: string | null;
  contractRequired: boolean;
  contractTerms: string | null;
  dataCap: string | null;
  disclosures: string | null;
  sourceName: string;
  sourceCheckedAt: Date;
  availabilityLabel?: string;
  availability?: string;
}): PlanCardData {
  return {
    id: p.id,
    name: p.name,
    providerName: p.provider.name,
    connectionType: p.connectionType,
    downloadMbps: p.downloadMbps,
    uploadMbps: p.uploadMbps,
    monthlyPriceCents: p.monthlyPriceCents,
    regularPriceCents: p.regularPriceCents,
    priceTermMonths: p.priceTermMonths,
    priceConditions: p.priceConditions,
    installationFeeCents: p.installationFeeCents,
    installationNotes: p.installationNotes,
    equipmentFeeCents: p.equipmentFeeCents,
    equipmentIncluded: p.equipmentIncluded,
    promoDescription: p.promoDescription,
    promoExpiresAt: p.promoExpiresAt?.toISOString() ?? null,
    promoExpirationNote: p.promoExpirationNote,
    contractRequired: p.contractRequired,
    contractTerms: p.contractTerms,
    dataCap: p.dataCap,
    disclosures: p.disclosures,
    sourceName: p.sourceName,
    sourceCheckedAt: p.sourceCheckedAt.toISOString(),
    availabilityLabel: p.availabilityLabel,
    availability: p.availability,
  };
}
