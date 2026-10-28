import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/ContentPage";
import { PlanTable } from "@/components/PlanTable";
import { prisma } from "@/lib/db";
import { formatPrice, formatSpeed } from "@/lib/format";

export const revalidate = 3600;

async function load(slug: string) {
  return prisma.provider.findFirst({
    where: { slug, active: true },
    include: { plans: { where: { active: true }, include: { provider: true }, orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }] } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug).catch(() => null);
  if (!p) return { title: "Provider not found" };
  return {
    title: `${p.name} Internet Plans & Prices`,
    description: `Compare ${p.name} internet plans, advertised prices, speeds, and promotions. Request enrollment and a specialist places your ${p.name} order.`,
    alternates: { canonical: `/providers/${p.slug}` },
  };
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug).catch(() => null);
  if (!p) notFound();
  const plans = p.plans;
  const min = plans.length ? Math.min(...plans.map((x) => x.monthlyPriceCents)) : null;
  const maxSpeed = plans.length ? Math.max(...plans.map((x) => x.downloadMbps)) : null;

  return (
    <ContentPage
      eyebrow={p.orderable ? "Enrolling now" : "Coming soon"}
      title={`${p.name} Internet Plans`}
      intro={
        plans.length
          ? `${p.name} plans advertised from ${formatPrice(min)}/mo with speeds up to ${formatSpeed(maxSpeed ?? 0)}. Compare plans and let our specialists place your order.`
          : `${p.name} plan information is being added.`
      }
      breadcrumbs={[{ name: `${p.name} Internet Plans`, href: `/providers/${p.slug}` }]}
    >
      {!p.orderable && (
        <p className="not-prose rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-ink">
          We don&apos;t enroll customers with {p.name} yet. Plan information is shown for comparison only.
        </p>
      )}
      <h2>{p.name} plans and advertised prices</h2>
      <PlanTable plans={plans} />
      {p.disclosure && <p className="text-sm text-slate-500">{p.disclosure}</p>}
      <h2>How ordering {p.name} through Shop Cheap Internet works</h2>
      <p>
        Enter your address, pick a {p.name} plan, and submit an enrollment request with your contact details. An enrollment specialist checks {p.name}
        &apos;s availability at your exact address, reviews installation options with you, and places the order through {p.name}&apos;s authorized ordering
        system. You&apos;ll receive your {p.name} confirmation number by email once {p.name} confirms the order.
      </p>
      <h2>What we don&apos;t do</h2>
      <p>
        Shop Cheap Internet is not {p.name} and isn&apos;t {p.name}&apos;s website. We never collect Social Security or payment card numbers in our forms;
        if {p.name} needs identity verification, a credit check, or payment, your specialist will explain {p.name}&apos;s own secure process.
      </p>
    </ContentPage>
  );
}
