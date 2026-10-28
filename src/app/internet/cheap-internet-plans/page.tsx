import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";
import { PlanTable } from "@/components/PlanTable";
import { getOrderablePlans } from "@/lib/services/plans";
import { formatPrice } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cheap Internet Plans — Compare Low-Cost Internet",
  description: "Compare the cheapest internet plans we can enroll you in, with prices, speeds, fees, and promotion terms clearly labeled.",
  alternates: { canonical: "/internet/cheap-internet-plans" },
};

export default async function CheapPlansPage() {
  const plans = await getOrderablePlans().catch(() => []);
  const sorted = [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
  const cheapest = sorted[0];
  return (
    <ContentPage
      eyebrow="Save on internet"
      title="Cheap Internet Plans"
      intro="The lowest advertised prices from the providers we enroll with — with every fee, condition, and promo period spelled out."
      breadcrumbs={[{ name: "Cheap Internet Plans", href: "/internet/cheap-internet-plans" }]}
    >
      <h2>Lowest-priced plans right now</h2>
      <p>
        {cheapest
          ? `Advertised plans currently start at ${formatPrice(cheapest.monthlyPriceCents)}/mo (${cheapest.provider.name} ${cheapest.name}). `
          : ""}
        These are the providers&apos; advertised prices. Many require AutoPay and paperless billing and apply for an introductory period, so we show those conditions next to every price.
      </p>
      <PlanTable plans={sorted} />
      <h2>How to keep your internet bill low</h2>
      <ul>
        <li><strong>Buy the speed you need, not the fastest tier.</strong> Most 1–3 person homes are comfortable on 300 Mbps.</li>
        <li><strong>Check what the price includes.</strong> Equipment rental, installation, and data overage fees can add up.</li>
        <li><strong>Know when promotions end.</strong> Note the regular price and set a reminder for the end of the promo period.</li>
        <li><strong>Use discounts you qualify for.</strong> AutoPay/paperless discounts and mobile bundle discounts can lower the monthly price.</li>
        <li><strong>Ask about low-income programs.</strong> Many providers offer discounted plans for qualifying households.</li>
      </ul>
      <h2>Is the cheapest plan available at my address?</h2>
      <p>
        Advertised prices and availability vary by address. Enter your address to see the plans advertised for your area, then request enrollment.
        Your specialist confirms what&apos;s actually available at your address — and the final price — before placing the order.
      </p>
    </ContentPage>
  );
}
