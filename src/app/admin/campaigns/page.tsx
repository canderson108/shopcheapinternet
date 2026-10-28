import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireStaffPage } from "@/lib/auth/staff";
import { Check, Field, Flash, PageHeader } from "@/components/admin/AdminUi";
import { saveCampaign, saveReferral } from "../actions";

export const metadata = { title: "Referrals & campaigns" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const sp = await searchParams;
  const [referrals, campaigns, refCounts, campCounts] = await Promise.all([
    prisma.referralSource.findMany({ orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" } }),
    prisma.enrollment.groupBy({ by: ["referralSourceId"], _count: { _all: true } }),
    prisma.enrollment.groupBy({ by: ["campaignId"], _count: { _all: true } }),
  ]);
  const rc = new Map(refCounts.map((r) => [r.referralSourceId, r._count._all]));
  const cc = new Map(campCounts.map((r) => [r.campaignId, r._count._all]));
  return (
    <div className="max-w-5xl">
      <PageHeader title="Referrals & campaigns" subtitle="Attribution is captured from ?ref= and ?campaign= (or utm_campaign) on any link and kept through enrollment." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold text-navy-900">Referral sources</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {referrals.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex justify-between"><span className="font-medium">{r.name}{!r.active && " (inactive)"}</span><span className="text-slate-500">{rc.get(r.id) ?? 0} enrollments</span></div>
                <p className="font-mono text-xs text-slate-500">{env.appUrl}/?ref={r.code}</p>
              </li>
            ))}
          </ul>
          <form action={saveReferral} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Field label="Code" name="code" required placeholder="greenleaf-pm" />
            <Field label="Name" name="name" required placeholder="Greenleaf Property Mgmt" />
            <Field label="Type" name="type" placeholder="property manager, partner…" />
            <div className="self-end"><Check label="Active" name="active" defaultChecked /></div>
            <button className="btn-outline sm:col-span-2 sm:justify-self-start">Add referral source</button>
          </form>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-navy-900">Campaigns</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {campaigns.map((c) => (
              <li key={c.id} className="py-2">
                <div className="flex justify-between"><span className="font-medium">{c.name}{!c.active && " (inactive)"}</span><span className="text-slate-500">{cc.get(c.id) ?? 0} enrollments</span></div>
                <p className="font-mono text-xs text-slate-500">?campaign={c.code}{c.utmCampaign ? ` · utm_campaign=${c.utmCampaign}` : ""}</p>
              </li>
            ))}
          </ul>
          <form action={saveCampaign} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Field label="Code" name="code" required placeholder="fall-2026-mailer" />
            <Field label="Name" name="name" required />
            <Field label="utm_source" name="utmSource" />
            <Field label="utm_medium" name="utmMedium" />
            <Field label="utm_campaign (matches incoming links)" name="utmCampaign" />
            <div className="self-end"><Check label="Active" name="active" defaultChecked /></div>
            <button className="btn-outline sm:col-span-2 sm:justify-self-start">Add campaign</button>
          </form>
        </section>
      </div>
    </div>
  );
}
