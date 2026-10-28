import Link from "next/link";
import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lookupHash } from "@/lib/crypto";
import { ALL_STATUSES, statusLabel } from "@/lib/status";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/admin/AdminUi";
import { StatusPill } from "@/components/agent/AgentConsole";
import { getStaffContext } from "@/lib/auth/staff";

export const metadata = { title: "Enrollments" };

const PAGE = 50;

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStaffContext();
  const q = (sp.q ?? "").trim();
  const status = ALL_STATUSES.includes(sp.status as EnrollmentStatus) ? (sp.status as EnrollmentStatus) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where: Prisma.EnrollmentWhereInput = {};
  if (status) where.status = status;
  if (sp.property) where.propertyId = sp.property;
  if (sp.agent) where.assignedAgentId = sp.agent;
  if (sp.provider) where.providerId = sp.provider;
  if (sp.from || sp.to) where.submittedAt = { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59Z`) } : {}) };
  if (q) {
    // Encrypted fields are searchable by exact email/phone via keyed hashes; names and references by text.
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { publicId: { contains: q.toUpperCase() } },
      { confirmationNumber: { contains: q.toUpperCase() } },
      { customer: { emailHash: lookupHash(q) } },
      ...(digits.length >= 10 ? [{ customer: { phoneHash: lookupHash(digits.slice(-10)) } }] : []),
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { serviceZip: q },
    ];
  }
  const [rows, total, agents, properties, providers] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: { customer: true, provider: true, plan: true, property: true, assignedAgent: { select: { name: true } } },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.enrollment.count({ where }),
    prisma.staffUser.findMany({ where: { agentProfile: { isNot: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.provider.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const exportQs = new URLSearchParams({ ...(status ? { status } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) });

  return (
    <div>
      <PageHeader
        title="Enrollments"
        subtitle={`${total} matching`}
        actions={
          <>
            <a className="btn-outline btn-sm" href={`/api/admin/export?${exportQs}`}>Export CSV</a>
            {ctx?.user.role === "ADMIN" && <a className="btn-outline btn-sm" href={`/api/admin/export?${exportQs}&pii=1`}>Export CSV with contact info</a>}
            <a className="btn-outline btn-sm" href={`/api/admin/export?type=conversions&${exportQs}`}>Offline conversions CSV</a>
          </>
        }
      />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7" method="get">
        <input className="input lg:col-span-2" name="q" placeholder="Name, exact email or phone, reference, ZIP…" defaultValue={q} aria-label="Search" />
        <select className="input" name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, "Provider")}</option>)}
        </select>
        <select className="input" name="agent" defaultValue={sp.agent ?? ""} aria-label="Agent">
          <option value="">All agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input" name="property" defaultValue={sp.property ?? ""} aria-label="Property">
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" name="provider" defaultValue={sp.provider ?? ""} aria-label="Provider">
          <option value="">All providers</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="input" type="date" name="from" defaultValue={sp.from ?? ""} aria-label="From date" />
          <input className="input" type="date" name="to" defaultValue={sp.to ?? ""} aria-label="To date" />
        </div>
        <div className="flex gap-2 lg:col-span-7">
          <button className="btn-dark btn-sm">Filter</button>
          <Link href="/admin/enrollments" className="btn-ghost btn-sm">Reset</Link>
        </div>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead><tr><th>Reference</th><th>Customer</th><th>Status</th><th>Plan</th><th>Location</th><th>Agent</th><th>Submitted</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/enrollments/${r.id}`} className="font-mono text-xs font-semibold text-navy-900 hover:underline">{r.publicId}</Link></td>
                <td className="font-medium">{r.customer.firstName} {r.customer.lastName}</td>
                <td><StatusPill status={r.status} provider={r.provider.name} /></td>
                <td className="text-xs">{r.provider.name} {r.plan.name}<br /><span className="text-slate-500">{formatPrice(r.advertisedPriceCents)}/mo</span></td>
                <td className="text-xs">{r.serviceCity}, {r.serviceState} {r.serviceZip}{r.property ? <><br /><span className="text-slate-500">{r.property.name}</span></> : null}</td>
                <td className="text-xs">{r.assignedAgent?.name ?? "—"}</td>
                <td className="text-xs text-slate-500">{formatDateTime(r.submittedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">No enrollments match.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE)}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-outline btn-sm" href={`/admin/enrollments?${qs}&page=${page - 1}`}>Previous</Link>}
            {page * PAGE < total && <Link className="btn-outline btn-sm" href={`/admin/enrollments?${qs}&page=${page + 1}`}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
