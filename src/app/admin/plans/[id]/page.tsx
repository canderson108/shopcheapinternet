import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { formatDate, formatDateTime, formatPrice, toDateInput } from "@/lib/format";
import { Check, Field, Flash, PageHeader, Select, TextArea } from "@/components/admin/AdminUi";
import { savePlan } from "../../actions";

export const metadata = { title: "Plan" };

const dollars = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));

export default async function PlanEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const [p, providers] = await Promise.all([
    isNew ? null : prisma.plan.findUnique({ where: { id }, include: { priceHistory: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } } } }),
    prisma.provider.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !p) notFound();

  return (
    <div className="max-w-5xl">
      <PageHeader title={p ? p.name : "Add plan"} subtitle="Enter the provider's advertised offer exactly as published, with its source and the date you verified it." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={savePlan} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Select label="Provider" name="providerId" defaultValue={p?.providerId} required options={providers.map((x) => ({ value: x.id, label: x.name }))} />
        <Field label="Plan name" name="name" defaultValue={p?.name} required placeholder="Fiber 500" />
        <Field label="URL slug" name="slug" defaultValue={p?.slug} required placeholder="fiber-500" />
        <Select
          label="Connection type"
          name="connectionType"
          defaultValue={p?.connectionType ?? "FIBER"}
          options={[
            { value: "FIBER", label: "Fiber" },
            { value: "FIXED_WIRELESS", label: "5G / fixed wireless" },
            { value: "CABLE", label: "Cable" },
            { value: "DSL", label: "DSL" },
            { value: "SATELLITE", label: "Satellite" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Field label="Download (Mbps)" name="downloadMbps" type="number" defaultValue={p?.downloadMbps} required min={1} />
        <Field label="Upload (Mbps)" name="uploadMbps" type="number" defaultValue={p?.uploadMbps} required min={1} />
        <Field label="Advertised monthly price ($)" name="monthlyPrice" defaultValue={dollars(p?.monthlyPriceCents)} required placeholder="50.00" />
        <Field label="Regular price after promo ($)" name="regularPrice" defaultValue={dollars(p?.regularPriceCents)} />
        <Field label="Price term (months)" name="priceTermMonths" type="number" defaultValue={p?.priceTermMonths} help="Blank if the price isn't time-limited" />
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Price conditions" name="priceConditions" defaultValue={p?.priceConditions} placeholder="w/ AutoPay & paperless billing ($10/mo discount)" /></div>
        <Field label="Installation fee ($)" name="installationFee" defaultValue={dollars(p?.installationFeeCents)} help="Blank = confirmed at order" />
        <div className="lg:col-span-2"><Field label="Installation notes" name="installationNotes" defaultValue={p?.installationNotes} /></div>
        <Field label="Equipment fee ($/mo)" name="equipmentFee" defaultValue={dollars(p?.equipmentFeeCents)} help="0 = included" />
        <div className="lg:col-span-2"><Field label="Included equipment" name="equipmentIncluded" defaultValue={p?.equipmentIncluded} placeholder="Wi-Fi gateway included" /></div>
        <div className="lg:col-span-2"><Field label="Promotion" name="promoDescription" defaultValue={p?.promoDescription} /></div>
        <Field label="Promotion expires" name="promoExpiresAt" type="date" defaultValue={toDateInput(p?.promoExpiresAt)} />
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Promotion expiration details" name="promoExpirationNote" defaultValue={p?.promoExpirationNote} placeholder="Offer may change without notice" /></div>
        <Field label="Data cap" name="dataCap" defaultValue={p?.dataCap} placeholder="Unlimited" />
        <div className="lg:col-span-2"><Field label="Contract terms" name="contractTerms" defaultValue={p?.contractTerms} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><TextArea label="Additional disclosures" name="disclosures" defaultValue={p?.disclosures} /></div>
        <Field label="Pricing source" name="sourceName" defaultValue={p?.sourceName} required placeholder="att.com — AT&T Fiber plans page" />
        <Field label="Source URL" name="sourceUrl" defaultValue={p?.sourceUrl} />
        <Field label="Date verified" name="sourceCheckedAt" type="date" defaultValue={toDateInput(p?.sourceCheckedAt ?? new Date())} required />
        <Field label="Sort order" name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
        <div className="lg:col-span-2"><Field label="Change note (for price history)" name="changeNote" placeholder="e.g. AT&T raised price $5" /></div>
        <div className="flex flex-wrap gap-6 sm:col-span-2 lg:col-span-3">
          <Check label="Active" name="active" defaultChecked={p?.active ?? true} />
          <Check label="Featured on homepage" name="featured" defaultChecked={p?.featured ?? false} />
          <Check label="Contract required" name="contractRequired" defaultChecked={p?.contractRequired ?? false} />
        </div>
        <button className="btn-primary sm:justify-self-start">Save plan</button>
      </form>

      {p && (
        <section className="card mt-6 overflow-x-auto p-5">
          <h2 className="mb-3 font-bold text-navy-900">Pricing history</h2>
          <table className="table-base min-w-[640px]">
            <thead><tr><th>Changed</th><th>Price</th><th>Regular</th><th>Promo</th><th>Source (verified)</th><th>By</th><th>Note</th></tr></thead>
            <tbody>
              {p.priceHistory.map((h) => (
                <tr key={h.id}>
                  <td className="text-xs">{formatDateTime(h.changedAt)}</td>
                  <td className="font-semibold">{formatPrice(h.monthlyPriceCents)}</td>
                  <td>{formatPrice(h.regularPriceCents)}</td>
                  <td className="max-w-[200px] text-xs">{h.promoDescription ?? "—"}</td>
                  <td className="text-xs">{h.sourceName} ({formatDate(h.sourceCheckedAt)})</td>
                  <td className="text-xs">{h.changedBy?.name ?? "System"}</td>
                  <td className="text-xs">{h.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
