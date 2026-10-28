import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteChrome";
import { env } from "@/lib/env";

// NOTE: These policies describe how this application actually handles data. Have them reviewed by
// counsel before launch and update the effective date when they change.

const EFFECTIVE = "October 28, 2026";

const DOCS: Record<string, { title: string; body: React.ReactNode }> = {
  privacy: {
    title: "Privacy Policy",
    body: (
      <>
        <p>Effective {EFFECTIVE}. This policy explains what Shop Cheap Internet (&quot;we&quot;) collects and how we use it.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Address information</strong> you enter to see plans (street, unit, city, state, ZIP).</li>
          <li><strong>Enrollment information</strong>: name, email, mobile phone, billing address if different, preferred installation date, and notes you provide.</li>
          <li><strong>Messages</strong> you exchange with your enrollment specialist.</li>
          <li><strong>Consent records</strong>: what you agreed to, when, and a hashed form of your IP address.</li>
          <li><strong>Marketing attribution</strong>: campaign parameters (such as UTM tags and ad click IDs) present in the link you used to visit us.</li>
        </ul>
        <p>We do not collect Social Security numbers, driver&apos;s license numbers, or payment card numbers through our forms or chat.</p>
        <h2>How we use it</h2>
        <ul>
          <li>To place your internet order with the provider you selected, which requires sharing your enrollment information with that provider.</li>
          <li>To contact you about your enrollment by email, phone, or text as you authorized.</li>
          <li>To measure and improve our service and advertising. Analytics and advertising cookies are used only if you accept them.</li>
        </ul>
        <h2>How we protect it</h2>
        <p>
          Contact details, addresses, notes, and messages are encrypted at rest. Access is limited to authorized staff who use multi-factor authentication, and
          access to customer records is logged.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          We keep enrollment records as long as needed to complete and support your order and meet legal obligations, then delete personal information.
          To request access to or deletion of your information, contact <a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
        </p>
        <h2>We don&apos;t sell your information</h2>
        <p>We do not sell your personal information. We share it with the provider you choose solely to place your order.</p>
      </>
    ),
  },
  terms: {
    title: "Terms of Service",
    body: (
      <>
        <p>Effective {EFFECTIVE}.</p>
        <h2>Our service</h2>
        <p>
          Shop Cheap Internet is an independent internet shopping and enrollment service. We are not an internet service provider. When you submit an enrollment
          request, you authorize us to submit an order for the selected service to the provider on your behalf.
        </p>
        <h2>Requests are not orders</h2>
        <p>
          Submitting an enrollment request does not guarantee service. Availability, pricing, installation dates, credit or identity requirements, and terms are
          set by the provider. Your order is placed only when our specialist submits it to the provider, and is confirmed only when the provider issues a
          confirmation number that we send to you.
        </p>
        <h2>Pricing information</h2>
        <p>
          Prices and promotions shown are advertised offers from the providers, labeled with their source and the date we last checked them. They can change
          without notice. If the price changes before your order is placed, we will ask for your approval first.
        </p>
        <h2>Your service relationship</h2>
        <p>Your internet service, billing, equipment, and support are provided by the provider under its terms of service.</p>
        <h2>Cost</h2>
        <p>Using Shop Cheap Internet is free for consumers. We may be compensated by providers or their authorized partners.</p>
        <h2>Contact</h2>
        <p><a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a></p>
      </>
    ),
  },
  disclosures: {
    title: "Advertising Disclosures",
    body: (
      <>
        <p>
          Shop Cheap Internet is independent and is not affiliated with, endorsed by, or the official website of AT&amp;T or any other provider listed on this
          site. Provider names and marks are the property of their respective owners and are used to identify the services we help customers order.
        </p>
        <p>
          We may receive compensation from providers or their authorized sales partners for orders we place. This does not change the price you pay the provider.
        </p>
        <p>
          Plan prices, speeds, and promotions are taken from provider-published offers and labeled with the source and date. Speeds are maximum wired speeds;
          actual and Wi-Fi speeds vary. Offers may require AutoPay, paperless billing, or other conditions shown next to the price, and exclude taxes and fees
          unless stated. Availability varies by address and is confirmed by the provider.
        </p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Not found", alternates: { canonical: `/legal/${doc}` } };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <SiteShell>
      <div className="container-page max-w-3xl py-12">
        <h1 className="text-3xl font-extrabold text-navy-900">{d.title}</h1>
        <div className="prose-sci mt-6">{d.body}</div>
      </div>
    </SiteShell>
  );
}
