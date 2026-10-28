import Link from "next/link";
import { getDashboardMetrics, rangeFromDays } from "@/lib/services/reports";
import { Bars, PageHeader, Stat } from "@/components/admin/AdminUi";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: d } = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(d)) ? Number(d) : 30;
  const m = await getDashboardMetrics(rangeFromDays(days));
  const t = m.totals;
  const trendMax = Math.max(1, ...m.trend.map((x) => Math.max(x.leads, x.requests)));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Last ${days} days`}
        actions={[7, 30, 90, 365].map((n) => (
          <Link key={n} href={`/admin?days=${n}`} className={`btn-sm ${n === days ? "btn-dark" : "btn-outline"}`}>{n === 365 ? "1y" : `${n}d`}</Link>
        ))}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Leads" value={t.leads} hint="Addresses entered" />
        <Stat label="Enrollment requests" value={t.requests} href="/admin/enrollments" />
        <Stat label="Pending (queue)" value={t.pending} hint="Waiting for agent now" href="/admin/enrollments?status=WAITING_FOR_AGENT" />
        <Stat label="Active orders" value={t.active} hint="Being processed now" />
        <Stat label="Confirmed orders" value={t.confirmed} hint="Verified by agents" href="/admin/enrollments?status=PROVIDER_ORDER_CONFIRMED" />
        <Stat label="Failed" value={t.failed} hint={`${t.canceled} canceled by customers`} href="/admin/enrollments?status=UNABLE_TO_COMPLETE" />
        <Stat label="Lead → request" value={`${t.leadToRequestRate}%`} />
        <Stat label="Request → confirmed" value={`${t.requestToConfirmedRate}%`} />
        <Stat label="Lead → confirmed" value={`${t.leadToConfirmedRate}%`} />
        <Stat label="Avg. processing time" value={t.avgProcessingMinutes === null ? "—" : t.avgProcessingMinutes >= 120 ? `${Math.round(t.avgProcessingMinutes / 60)}h` : `${t.avgProcessingMinutes}m`} hint="Submitted → confirmed" />
      </div>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-navy-900">Enrollment trend</h2>
          <p className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />Leads</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-navy-700" />Requests</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-mint-500" />Confirmed</span>
          </p>
        </div>
        <div className="mt-4 flex h-44 items-end gap-[2px] overflow-x-auto" role="img" aria-label="Daily leads, requests and confirmed orders">
          {m.trend.map((x) => (
            <div key={x.day} className="group relative flex h-full min-w-[6px] flex-1 items-end gap-[1px]" title={`${x.day}: ${x.leads} leads, ${x.requests} requests, ${x.confirmed} confirmed`}>
              <div className="w-1/3 rounded-t bg-slate-300" style={{ height: `${(x.leads / trendMax) * 100}%` }} />
              <div className="w-1/3 rounded-t bg-navy-700" style={{ height: `${(x.requests / trendMax) * 100}%` }} />
              <div className="w-1/3 rounded-t bg-mint-500" style={{ height: `${(x.confirmed / trendMax) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{m.trend[0]?.day}</span><span>{m.trend[m.trend.length - 1]?.day}</span></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">By provider</h2>
          <Bars data={m.byProvider.map((p) => ({ label: p.name, value: p.requests, sub: `${p.confirmed} confirmed` }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">By plan</h2>
          <Bars data={m.byPlan.map((p) => ({ label: `${p.provider} ${p.name}`, value: p.requests, sub: `${p.confirmed} confirmed` }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">By status (requests in period)</h2>
          <Bars data={Object.entries(m.byStatus).map(([k, v]) => ({ label: k.replace(/_/g, " ").toLowerCase(), value: v ?? 0 }))} />
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="px-5 pt-4 font-bold text-navy-900">Enrollments by property</h2>
        <table className="table-base mt-3 min-w-[600px]">
          <thead><tr><th>Property</th><th>Leads</th><th>Requests</th><th>Confirmed</th><th>Conversion</th></tr></thead>
          <tbody>
            {m.byProperty.map((p) => (
              <tr key={p.id ?? "none"}>
                <td>{p.id ? <Link className="font-medium text-navy-900 hover:underline" href={`/admin/properties/${p.id}`}>{p.name}</Link> : <span className="text-slate-500">{p.name}</span>}</td>
                <td>{p.leads}</td><td>{p.requests}</td><td>{p.confirmed}</td><td>{p.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="px-5 pt-4 font-bold text-navy-900">Agent productivity</h2>
        <table className="table-base mt-3 min-w-[640px]">
          <thead><tr><th>Agent</th><th>Status</th><th>Assigned</th><th>Confirmed</th><th>Unable</th><th>Active now</th><th>Avg. time to confirm</th></tr></thead>
          <tbody>
            {m.agents.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td>
                <td className="text-xs">{a.availability?.toLowerCase() ?? "—"}</td>
                <td>{a.assigned}</td><td>{a.confirmed}</td><td>{a.unable}</td><td>{a.active}</td>
                <td>{a.avgMinutes === null ? "—" : `${a.avgMinutes}m`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
