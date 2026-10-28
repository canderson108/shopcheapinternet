import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { connectionLabel, formatDate, formatPrice, formatSpeed } from "@/lib/format";
import { Flash, PageHeader } from "@/components/admin/AdminUi";

export const metadata = { title: "Plans & pricing" };

const STALE_DAYS = 30;

export default async function PlansAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const sp = await searchParams;
  const plans = await prisma.plan.findMany({ include: { provider: true }, orderBy: [{ provider: { sortOrder: "asc" } }, { sortOrder: "asc" }] });
  const staleCutoff = Date.now() - STALE_DAYS * 86400_000;
  return (
    <div>
      <PageHeader
        title="Plans & pricing"
        subtitle={`Internal pricing database. Every price records its source and the date it was verified. Prices older than ${STALE_DAYS} days are flagged.`}
        actions={<Link href="/admin/plans/new" className="btn-primary btn-sm">Add plan</Link>}
      />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead><tr><th>Plan</th><th>Price</th><th>Speed</th><th>Promo</th><th>Source</th><th>Checked</th><th>Status</th></tr></thead>
          <tbody>
            {plans.map((p) => {
              const stale = p.sourceCheckedAt.getTime() < staleCutoff;
              const promoExpired = p.promoExpiresAt && p.promoExpiresAt.getTime() < Date.now();
              return (
                <tr key={p.id}>
                  <td><Link href={`/admin/plans/${p.id}`} className="font-semibold text-navy-900 hover:underline">{p.provider.name} {p.name}</Link><p className="text-xs text-slate-500">{connectionLabel(p.connectionType)}</p></td>
                  <td className="font-semibold">{formatPrice(p.monthlyPriceCents)}/mo{p.regularPriceCents ? <span className="block text-xs font-normal text-slate-500">then {formatPrice(p.regularPriceCents)}</span> : null}</td>
                  <td className="text-xs">{formatSpeed(p.downloadMbps)} / {formatSpeed(p.uploadMbps)}</td>
                  <td className="max-w-[220px] text-xs">{p.promoDescription ?? "—"}{promoExpired && <span className="block font-semibold text-red-600">Promo expired {formatDate(p.promoExpiresAt)}</span>}</td>
                  <td className="max-w-[180px] truncate text-xs">{p.sourceName}</td>
                  <td className={`text-xs ${stale ? "font-semibold text-amber-ink" : ""}`}>{formatDate(p.sourceCheckedAt)}{stale ? " · re-verify" : ""}</td>
                  <td className="text-xs">{p.active ? "Active" : "Hidden"}{p.featured ? " · Featured" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
