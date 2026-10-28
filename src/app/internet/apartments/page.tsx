import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "Internet for Apartments — Setup Made Simple",
  description: "How to get internet in an apartment: checking what your building supports, unit numbers, move-in timing, and letting a specialist handle setup.",
  alternates: { canonical: "/internet/apartments" },
};

export default function ApartmentsPage() {
  return (
    <ContentPage
      eyebrow="Apartments & communities"
      title="Internet for Apartments"
      intro="Moving into an apartment? We help residents choose a plan for their unit and handle enrollment with the provider."
      breadcrumbs={[{ name: "Internet for Apartments", href: "/internet/apartments" }]}
    >
      <h2>Getting internet set up in an apartment</h2>
      <ul>
        <li><strong>Use your exact unit number.</strong> Providers check service by unit — including it avoids delays.</li>
        <li><strong>Order 1–2 weeks before move-in.</strong> This gives the provider time to schedule activation or installation.</li>
        <li><strong>Ask your leasing office about wiring.</strong> Many buildings are pre-wired for fiber or have a preferred provider.</li>
        <li><strong>Check for a community link.</strong> If your property shared a Shop Cheap Internet link, use it — your address is filled in for you.</li>
      </ul>
      <h2>For property managers</h2>
      <p>
        Shop Cheap Internet works with apartment communities and property management companies to give residents a simple way to set up internet.
        Each community gets its own enrollment page with the property address pre-filled and a unit selector, plus reporting on resident enrollments.
        Contact us to set up a page for your property.
      </p>
      <h2>Do I need a credit check?</h2>
      <p>
        Some providers run a credit check or require identity verification. We never collect Social Security numbers ourselves — your specialist will explain
        the provider&apos;s secure process if it&apos;s required.
      </p>
    </ContentPage>
  );
}
