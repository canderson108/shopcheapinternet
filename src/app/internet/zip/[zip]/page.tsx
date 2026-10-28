import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/ContentPage";
import { PlanTable } from "@/components/PlanTable";
import { prisma } from "@/lib/db";
import { getOrderablePlans } from "@/lib/services/plans";

export const revalidate = 86400;

// ZIP pages exist only for ZIPs where a provider has configured advertised coverage, and they say
// exactly that: advertised in the ZIP, not confirmed at any address. No coverage data => 404.
async function load(zip: string) {
  if (!/^\d{5}$/.test(zip)) return null;
  const areas = await prisma.serviceArea.findMany({ where: { zip, provider: { active: true } }, include: { provider: true } });
  if (!areas.length) return null;
  const providerIds = new Set(areas.map((a) => a.providerId));
  const plans = (await getOrderablePlans()).filter((p) => providerIds.has(p.providerId));
  return { zip, providers: areas.map((a) => a.provider), plans };
}

export async function generateMetadata({ params }: { params: Promise<{ zip: string }> }): Promise<Metadata> {
  const { zip } = await params;
  const d = await load(zip).catch(() => null);
  if (!d) return { title: "ZIP code not found", robots: { index: false } };
  return {
    title: `Internet Plans in ZIP Code ${zip}`,
    description: `Internet plans advertised in ${zip} from ${d.providers.map((p) => p.name).join(", ")}. Compare prices and speeds; availability is confirmed for your address.`,
    alternates: { canonical: `/internet/zip/${zip}` },
  };
}

export default async function ZipPage({ params }: { params: Promise<{ zip: string }> }) {
  const { zip } = await params;
  const d = await load(zip).catch(() => null);
  if (!d) notFound();
  return (
    <ContentPage
      eyebrow={`ZIP code ${zip}`}
      title={`Internet Plans in ${zip}`}
      intro={`Providers we enroll with advertise service in ${zip}. Availability varies street by street — enter your address to check yours.`}
      breadcrumbs={[{ name: `Internet in ${zip}`, href: `/internet/zip/${zip}` }]}
    >
      <h2>Providers advertising service in {zip}</h2>
      <ul>
        {d.providers.map((p) => (
          <li key={p.id}>{p.name}{p.orderable ? " — enrolling now" : " — information only"}</li>
        ))}
      </ul>
      <h2>Plans and advertised prices</h2>
      <PlanTable plans={d.plans} />
      <p>
        Being advertised in a ZIP code doesn&apos;t guarantee service at every address in it. When you request enrollment, your specialist confirms serviceability
        and pricing for your exact address before placing an order.
      </p>
    </ContentPage>
  );
}
