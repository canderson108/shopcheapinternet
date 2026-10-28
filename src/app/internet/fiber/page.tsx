import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";
import { PlanTable } from "@/components/PlanTable";
import { getOrderablePlans } from "@/lib/services/plans";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Fiber Internet Plans — Symmetrical Speeds Compared",
  description: "What fiber internet is, why upload speed matters, and the fiber plans we can enroll you in today.",
  alternates: { canonical: "/internet/fiber" },
};

export default async function FiberPage() {
  const plans = (await getOrderablePlans().catch(() => [])).filter((p) => p.connectionType === "FIBER");
  return (
    <ContentPage
      eyebrow="Fiber internet"
      title="Fiber Internet Plans"
      intro="Fiber delivers the fastest, most consistent home internet — with upload speeds that match download speeds on most plans."
      breadcrumbs={[{ name: "Fiber Internet", href: "/internet/fiber" }]}
    >
      <h2>What makes fiber different</h2>
      <p>
        Fiber-optic internet carries data as light through glass strands all the way to your home. Compared with cable or DSL, fiber typically offers
        much faster upload speeds, lower latency, and more consistent performance during busy evening hours.
      </p>
      <ul>
        <li><strong>Symmetrical speeds:</strong> fast uploads for video calls, cloud backups, and creators.</li>
        <li><strong>Low latency:</strong> better for gaming and real-time apps.</li>
        <li><strong>Room to grow:</strong> multi-gig tiers are available in many fiber areas.</li>
      </ul>
      <h2>Fiber plans we enroll today</h2>
      <PlanTable plans={plans} />
      <h2>Is fiber available at my address?</h2>
      <p>
        Fiber availability is street-by-street. Enter your address to see advertised plans for your area; your specialist confirms fiber serviceability at
        your exact address before ordering. If fiber isn&apos;t available, they can tell you about alternatives like 5G home internet.
      </p>
    </ContentPage>
  );
}
