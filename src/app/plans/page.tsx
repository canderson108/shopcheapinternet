import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/SiteChrome";
import { FunnelSteps } from "@/components/FunnelSteps";
import { PlanBrowser } from "@/components/PlanBrowser";
import { toCardData } from "@/components/PlanCard";
import { getCurrentFunnelSession } from "@/lib/funnel-cookie";
import { sessionAddress } from "@/lib/services/funnel";
import { getPlanOffersForZip } from "@/lib/services/plans";
import { formatFullAddress } from "@/lib/address/normalize";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare plans at your address", robots: { index: false } };

export default async function PlansPage() {
  const session = await getCurrentFunnelSession();
  const address = session ? sessionAddress(session) : null;
  if (!session || !address) redirect("/#check");
  if (session.enrollmentId) {
    const e = await prisma.enrollment.findUnique({ where: { id: session.enrollmentId }, select: { publicId: true } });
    if (e) redirect(`/enrollment/${e.publicId}`);
  }
  const offers = await getPlanOffersForZip(address.zip);
  const property = session.propertyId ? await prisma.property.findUnique({ where: { id: session.propertyId }, select: { name: true } }) : null;

  return (
    <SiteShell>
      <FunnelSteps current={1} />
      <div className="container-page py-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Plans for your address</p>
            <h1 className="mt-1 text-2xl font-extrabold text-navy-900 sm:text-3xl">Compare internet plans</h1>
            <p className="mt-2 text-sm text-slate-600">
              {property ? <><span className="font-semibold">{property.name}</span> · </> : null}
              {formatFullAddress(address)}
              {!session.addressVerified && <span className="ml-2 badge bg-amber-50 text-amber-ink">Address will be confirmed by your specialist</span>}
            </p>
          </div>
          <Link href="/#check" className="btn-outline btn-sm">Change address</Link>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-ink">
          <strong>About availability:</strong> these are provider-advertised offers. We don&apos;t yet have a confirmed serviceability check for your exact
          address, so your specialist verifies availability and final pricing with the provider before placing your order.
        </div>

        {offers.length === 0 ? (
          <div className="card mt-8 p-8 text-center">
            <h2 className="text-xl font-bold text-navy-900">No orderable plans for this ZIP code yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-600">
              We don&apos;t currently have advertised plans from the providers we enroll with at {address.zip}. Coverage data is updated regularly.
            </p>
            <Link href="/#check" className="btn-primary mt-5">Try another address</Link>
          </div>
        ) : (
          <PlanBrowser plans={offers.map(toCardData)} selectedPlanId={session.selectedPlanId} zip={address.zip} />
        )}
      </div>
    </SiteShell>
  );
}
