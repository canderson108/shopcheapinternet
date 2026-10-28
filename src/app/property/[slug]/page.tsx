import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteChrome";
import { AddressSearch } from "@/components/AddressSearch";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return prisma.property.findFirst({
    where: { slug, active: true },
    include: { units: { where: { active: true }, orderBy: { unitNumber: "asc" }, select: { unitNumber: true } }, defaultProvider: { select: { name: true } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Property not found", robots: { index: false } };
  return {
    title: `Internet for residents of ${p.name}`,
    description: `Residents of ${p.name} in ${p.city}, ${p.state}: compare internet plans for your unit and let our specialists handle setup.`,
    robots: { index: false },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const units = p.units.map((u) => u.unitNumber).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <SiteShell>
      <section className="bg-navy-900">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow text-mint-300">Resident internet setup</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white">Welcome, {p.name} residents</h1>
            <p className="mt-4 text-lg text-slate-300">
              Pick your unit, compare internet plans{p.defaultProvider ? ` from ${p.defaultProvider.name}` : ""}, and our enrollment specialists will set up service for
              your apartment.
            </p>
            <p className="mt-4 text-sm text-slate-400">
              {p.street}, {p.city}, {p.state} {p.zip}
              {p.managementCompany ? ` · Managed by ${p.managementCompany}` : ""}
            </p>
            <p className="mt-6 text-xs text-slate-500">
              Shop Cheap Internet is an independent enrollment service. Plans and availability are confirmed with the provider for your unit before ordering.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-navy-900">Select your unit to see plans</h2>
            <div className="mt-5">
              <AddressSearch propertySlug={p.slug} fixedAddress={{ street: p.street, city: p.city, state: p.state, zip: p.zip }} units={units} cta="See Plans for My Unit" />
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
