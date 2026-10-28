import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { Flash, PageHeader } from "@/components/admin/AdminUi";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const sp = await searchParams;
  const properties = await prisma.property.findMany({
    include: { _count: { select: { units: true, enrollments: true, sessions: true } }, referralSource: true, campaign: true },
    orderBy: { name: "asc" },
  });
  const confirmed = await prisma.enrollment.groupBy({ by: ["propertyId"], where: { status: "PROVIDER_ORDER_CONFIRMED", propertyId: { not: null } }, _count: { _all: true } });
  const confirmedMap = new Map(confirmed.map((c) => [c.propertyId, c._count._all]));
  return (
    <div>
      <PageHeader title="Properties" subtitle="Apartment communities with their own enrollment pages." actions={<Link href="/admin/properties/new" className="btn-primary btn-sm">Add property</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead><tr><th>Property</th><th>Enrollment link</th><th>Units</th><th>Leads</th><th>Requests</th><th>Confirmed</th><th>Conversion</th><th>Attribution</th></tr></thead>
          <tbody>
            {properties.map((p) => {
              const conf = confirmedMap.get(p.id) ?? 0;
              return (
                <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                  <td><Link href={`/admin/properties/${p.id}`} className="font-semibold text-navy-900 hover:underline">{p.name}</Link><p className="text-xs text-slate-500">{p.city}, {p.state}{p.externalId ? ` · ID ${p.externalId}` : ""}</p></td>
                  <td className="font-mono text-xs">/property/{p.slug}</td>
                  <td>{p._count.units}</td>
                  <td>{p._count.sessions}</td>
                  <td>{p._count.enrollments}</td>
                  <td>{conf}</td>
                  <td>{p._count.enrollments ? `${Math.round((conf / p._count.enrollments) * 100)}%` : "—"}</td>
                  <td className="text-xs">{[p.referralSource?.name, p.campaign?.name].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              );
            })}
            {properties.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">No properties yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
