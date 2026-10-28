import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { Flash, PageHeader } from "@/components/admin/AdminUi";

export const metadata = { title: "Providers" };

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const sp = await searchParams;
  const providers = await prisma.provider.findMany({ include: { _count: { select: { plans: true, serviceAreas: true, enrollments: true } } }, orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <PageHeader title="Providers" subtitle="Only providers marked orderable appear in the enrollment funnel." actions={<Link href="/admin/providers/new" className="btn-primary btn-sm">Add provider</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead><tr><th>Provider</th><th>Shown</th><th>Orderable</th><th>Order portal</th><th>Plans</th><th>ZIPs</th><th>Enrollments</th></tr></thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/providers/${p.id}`} className="font-semibold text-navy-900 hover:underline">{p.name}</Link><p className="text-xs text-slate-500">/{p.slug}</p></td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td>{p.orderable ? <span className="badge bg-mint-50 text-mint-700">Orderable</span> : <span className="badge bg-slate-100 text-slate-500">Not orderable</span>}</td>
                <td className="max-w-xs truncate text-xs">{p.orderPortalUrl ?? <span className="text-red-600">Not configured</span>}</td>
                <td>{p._count.plans}</td><td>{p._count.serviceAreas}</td><td>{p._count.enrollments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
