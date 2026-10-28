import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/SiteChrome";
import { FunnelSteps } from "@/components/FunnelSteps";
import { EnrollForm } from "@/components/EnrollForm";
import { getCurrentFunnelSession } from "@/lib/funnel-cookie";
import { sessionAddress, sessionDraft } from "@/lib/services/funnel";
import { prisma } from "@/lib/db";
import { connectionLabel, formatDate, formatPrice, formatSpeed } from "@/lib/format";
import { formatFullAddress } from "@/lib/address/normalize";
import { CONSENT_TEXT } from "@/lib/validation";
import { availabilityLabel } from "@/lib/services/plans";
import { priceFootnote, toCardData } from "@/components/PlanCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enrollment details", robots: { index: false } };

export default async function EnrollPage() {
  const session = await getCurrentFunnelSession();
  const address = session ? sessionAddress(session) : null;
  if (!session || !address) redirect("/#check");
  if (session.enrollmentId) {
    const e = await prisma.enrollment.findUnique({ where: { id: session.enrollmentId }, select: { publicId: true } });
    if (e) redirect(`/enrollment/${e.publicId}`);
  }
  if (!session.selectedPlanId) redirect("/plans");
  const plan = await prisma.plan.findUnique({ where: { id: session.selectedPlanId }, include: { provider: true } });
  if (!plan || !plan.active || !plan.provider.orderable) redirect("/plans");
  const priceChanged = session.selectedPriceCents !== null && session.selectedPriceCents !== plan.monthlyPriceCents;
  const card = toCardData(plan);
  const property = session.propertyId ? await prisma.property.findUnique({ where: { id: session.propertyId }, select: { name: true } }) : null;
  const zipAdvertised = await prisma.serviceArea.findUnique({ where: { providerId_zip: { providerId: plan.providerId, zip: address.zip } } });

  return (
    <SiteShell>
      <FunnelSteps current={2} />
      <div className="container-page grid gap-8 py-8 md:py-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="eyebrow">Almost done</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy-900 sm:text-3xl">Your enrollment details</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Tell us how to reach you. An enrollment specialist will use this to place your {plan.provider.name} order — you won&apos;t need to enter it again.
          </p>
          {priceChanged && (
            <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-ink">
              The advertised price for this plan changed from {formatPrice(session.selectedPriceCents)} to {formatPrice(plan.monthlyPriceCents)}/mo since you selected it.{" "}
              <Link href="/plans" className="font-semibold underline">Review plans</Link> to continue.
            </div>
          )}
          <div className="mt-6">
            <EnrollForm
              draft={sessionDraft(session)}
              serviceUnit={address.unit ?? ""}
              propertyUnit={Boolean(session.propertyId)}
              consent={CONSENT_TEXT}
              providerName={plan.provider.name}
              blocked={priceChanged}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your selection</h2>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{plan.provider.name}</p>
            <p className="text-lg font-bold text-navy-900">{plan.name}</p>
            <p className="mt-1 text-sm text-slate-600">
              {connectionLabel(plan.connectionType)} · {formatSpeed(plan.downloadMbps)} down / {formatSpeed(plan.uploadMbps)} up
            </p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl font-extrabold text-navy-900">{formatPrice(plan.monthlyPriceCents)}</span>
              <span className="text-sm text-slate-500">/mo</span>
            </p>
            <p className="text-xs text-slate-500">{priceFootnote(card)}</p>
            <Link href="/plans" className="mt-2 inline-block text-xs font-semibold text-mint-700 hover:underline">Change plan</Link>
            <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
              <p className="font-semibold text-slate-700">Service address</p>
              {property && <p className="text-slate-600">{property.name}</p>}
              <p className="text-slate-600">{formatFullAddress(address)}</p>
              <Link href="/#check" className="mt-1 inline-block text-xs font-semibold text-mint-700 hover:underline">Change address</Link>
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-ink">
              {availabilityLabel(zipAdvertised ? "ADVERTISED_IN_ZIP" : "INDICATIVE", plan.provider.name)}.
            </p>
            <p className="mt-3 text-[11px] text-slate-400">Pricing source: {plan.sourceName}, checked {formatDate(plan.sourceCheckedAt)}.</p>
          </div>
          <div className="mt-4 rounded-2xl bg-navy-50 p-4 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-navy-900">🔒 Your information is protected</p>
            <p className="mt-1">
              We encrypt your contact details and never ask for Social Security or payment card numbers here. If {plan.provider.name} requires a credit
              check or payment, your specialist will guide you through {plan.provider.name}&apos;s own secure process.
            </p>
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}
