import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/AdminUi";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ staff?: string; action?: string; page?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.staff) where.actorStaffId = sp.staff;
  if (sp.action) where.action = { startsWith: sp.action };
  const [logs, staff] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actorStaff: { select: { name: true } }, enrollment: { select: { publicId: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100 }),
    prisma.staffUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every sign-in, PII view, status change, assignment, message, export and configuration change." />
      <form className="card mb-4 flex flex-wrap gap-2 p-3" method="get">
        <select name="staff" className="input w-auto" defaultValue={sp.staff ?? ""} aria-label="Staff member">
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="action" className="input w-auto" defaultValue={sp.action ?? ""} aria-label="Action">
          <option value="">All actions</option>
          {["staff.", "enrollment.", "order.", "message.", "note.", "checklist.", "portal.", "plan.", "provider.", "property.", "enrollments.exported", "agent."].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-dark btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[860px]">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                <td className="text-xs">{l.actorStaff?.name ?? l.actorType.toLowerCase()}</td>
                <td className="text-xs font-semibold">{l.action}</td>
                <td className="text-xs">{l.enrollmentId ? <Link className="font-mono hover:underline" href={`/admin/enrollments/${l.enrollmentId}`}>{l.enrollment?.publicId ?? l.enrollmentId}</Link> : `${l.entityType}${l.entityId ? ` ${l.entityId.slice(0, 10)}…` : ""}`}</td>
                <td className="max-w-md truncate font-mono text-[11px] text-slate-500">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2">
        {page > 1 && <Link className="btn-outline btn-sm" href={`/admin/audit?${new URLSearchParams({ ...(sp.staff ? { staff: sp.staff } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(page - 1) })}`}>Newer</Link>}
        {logs.length === 100 && <Link className="btn-outline btn-sm" href={`/admin/audit?${new URLSearchParams({ ...(sp.staff ? { staff: sp.staff } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(page + 1) })}`}>Older</Link>}
      </div>
    </div>
  );
}
