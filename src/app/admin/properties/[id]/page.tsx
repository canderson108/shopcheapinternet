import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireStaffPage } from "@/lib/auth/staff";
import { formatDateTime } from "@/lib/format";
import { Check, Field, Flash, PageHeader, Select, TextArea } from "@/components/admin/AdminUi";
import { StatusPill } from "@/components/agent/AgentConsole";
import { addUnits, saveProperty, toggleUnit } from "../../actions";

export const metadata = { title: "Property" };

export default async function PropertyEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const [p, providers, referrals, campaigns] = await Promise.all([
    isNew
      ? null
      : prisma.property.findUnique({
          where: { id },
          include: {
            units: { orderBy: { unitNumber: "asc" } },
            enrollments: { include: { customer: true, plan: true, provider: true, assignedAgent: { select: { name: true } } }, orderBy: { submittedAt: "desc" }, take: 50 },
            _count: { select: { sessions: true } },
          },
        }),
    prisma.provider.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.referralSource.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!isNew && !p) notFound();
  const link = p ? `${env.appUrl}/property/${p.slug}${p.referralSourceId ? "" : ""}` : null;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={p ? p.name : "Add property"}
        subtitle={link ? `Enrollment link: ${link}` : "Creates a resident enrollment page at /property/{slug}."}
        actions={p ? <Link href={`/property/${p.slug}`} target="_blank" className="btn-outline btn-sm">Open page ↗</Link> : undefined}
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveProperty} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Field label="Property name" name="name" defaultValue={p?.name} required />
        <Field label="URL slug" name="slug" defaultValue={p?.slug} required help="/property/{slug}" />
        <Field label="Property ID (your reference)" name="externalId" defaultValue={p?.externalId} />
        <div className="lg:col-span-2"><Field label="Street address" name="street" defaultValue={p?.street} required /></div>
        <Field label="City" name="city" defaultValue={p?.city} required />
        <Field label="State (2 letters)" name="state" defaultValue={p?.state} required />
        <Field label="ZIP" name="zip" defaultValue={p?.zip} required />
        <Field label="Management company" name="managementCompany" defaultValue={p?.managementCompany} />
        <Field label="Contact name" name="contactName" defaultValue={p?.contactName} />
        <Field label="Contact email" name="contactEmail" defaultValue={p?.contactEmail} />
        <Select label="Default provider" name="defaultProviderId" defaultValue={p?.defaultProviderId} options={[{ value: "", label: "None" }, ...providers.map((x) => ({ value: x.id, label: x.name }))]} />
        <Select label="Referral source" name="referralSourceId" defaultValue={p?.referralSourceId} options={[{ value: "", label: "None" }, ...referrals.map((x) => ({ value: x.id, label: x.name }))]} />
        <Select label="Campaign" name="campaignId" defaultValue={p?.campaignId} options={[{ value: "", label: "None" }, ...campaigns.map((x) => ({ value: x.id, label: x.name }))]} />
        <div className="sm:col-span-2 lg:col-span-3"><TextArea label="Internal notes" name="notes" defaultValue={p?.notes} /></div>
        <Check label="Active (page is live)" name="active" defaultChecked={p?.active ?? true} />
        <button className="btn-primary sm:col-span-2 sm:justify-self-start lg:col-span-3">Save property</button>
      </form>

      {p && (
        <>
          <section className="card mt-6 p-5">
            <h2 className="font-bold text-navy-900">Units ({p.units.filter((u) => u.active).length} active)</h2>
            <p className="mt-1 text-sm text-slate-600">Residents choose from this list. With no units, they type their unit number.</p>
            <form action={addUnits} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="propertyId" value={p.id} />
              <textarea name="units" rows={2} className="input font-mono text-xs" placeholder="101, 102, 103 or ranges like 101-124, or one per line (A1, A2…)" required />
              <button className="btn-outline shrink-0">Add units</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.units.map((u) => (
                <form key={u.id} action={toggleUnit}>
                  <input type="hidden" name="propertyId" value={p.id} />
                  <input type="hidden" name="unitId" value={u.id} />
                  <button title={u.active ? "Click to deactivate" : "Click to reactivate"} className={`rounded-md border px-2 py-0.5 font-mono text-xs ${u.active ? "border-slate-300 bg-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-400 line-through"}`}>
                    {u.unitNumber}
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="card mt-6 overflow-x-auto p-5">
            <h2 className="font-bold text-navy-900">Recent enrollments · {p._count.sessions} leads total</h2>
            <table className="table-base mt-3 min-w-[700px]">
              <thead><tr><th>Reference</th><th>Resident</th><th>Unit</th><th>Plan</th><th>Status</th><th>Agent</th><th>Submitted</th></tr></thead>
              <tbody>
                {p.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td><Link className="font-mono text-xs hover:underline" href={`/admin/enrollments/${e.id}`}>{e.publicId}</Link></td>
                    <td>{e.customer.firstName} {e.customer.lastName}</td>
                    <td>{e.unitNumber ?? "—"}</td>
                    <td className="text-xs">{e.provider.name} {e.plan.name}</td>
                    <td><StatusPill status={e.status} provider={e.provider.name} /></td>
                    <td className="text-xs">{e.assignedAgent?.name ?? "—"}</td>
                    <td className="text-xs">{formatDateTime(e.submittedAt)}</td>
                  </tr>
                ))}
                {p.enrollments.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">No enrollments yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
