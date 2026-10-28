/* Idempotent reference-data seed. Creates providers and starter plan pricing ONLY if they don't
 * exist yet, so it never overwrites prices your team has edited in the admin dashboard.
 * Pricing below was taken from AT&T's published offers on 2026-10-28 and must be re-verified
 * by your team before launch (Admin → Plans & pricing shows the verification date on every plan). */

import { PrismaClient, type ConnectionType } from "@prisma/client";

const prisma = new PrismaClient();

const CHECKED = new Date("2026-10-28T12:00:00.000Z");
const ATT_FIBER_SOURCE = "att.com — AT&T Fiber plans page";
const ATT_FIBER_URL = "https://www.att.com/internet/fiber/";

const ATT_INSTRUCTIONS = `1. Click "Open AT&T SPOC" and sign in with YOUR OWN authorized SPOC credentials. Never share credentials.
2. Run the address/serviceability check using the Service Address fields (copy each field from the left panel). Include the unit number.
3. If the selected plan is not available, message the customer with the available alternatives and get approval before changing plans.
4. Enter customer contact details exactly as provided. Do NOT collect SSN, DOB, or card numbers in Shop Cheap Internet — if SPOC requires a credit check or payment, follow AT&T's approved customer process.
5. Review installation/activation options in SPOC and offer them to the customer with "Present install options".
6. Submit the order in SPOC, then set status to "Submitted to AT&T".
7. Record the AT&T order/confirmation number using "Record AT&T confirmation" only after SPOC shows the order as accepted.`;

type SeedPlan = {
  slug: string;
  name: string;
  connectionType: ConnectionType;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPriceCents: number;
  regularPriceCents: number | null;
  priceTermMonths: number | null;
  priceConditions: string | null;
  installationFeeCents: number | null;
  installationNotes: string | null;
  equipmentFeeCents: number | null;
  equipmentIncluded: string | null;
  dataCap: string | null;
  disclosures: string | null;
  featured: boolean;
  sortOrder: number;
  sourceName: string;
  sourceUrl: string | null;
};

const FIBER_DISCLOSURE =
  "Price after $10/mo AutoPay & paperless bill discount (starts within 2 bills; requires bank-account or eligible card AutoPay and a valid email). Plus taxes & fees. Promotional price for 12 months for new customers, then the regular price applies. Wired speeds; Wi-Fi speeds vary. Online-only offers on att.com (such as reward cards) may not apply to orders placed by our specialists. Availability varies by address.";

const ATT_PLANS: SeedPlan[] = [
  {
    slug: "fiber-300",
    name: "Fiber 300",
    connectionType: "FIBER",
    downloadMbps: 300,
    uploadMbps: 300,
    monthlyPriceCents: 5000,
    regularPriceCents: 6000,
    priceTermMonths: 12,
    priceConditions: "w/ AutoPay & paperless billing",
    installationFeeCents: 0,
    installationNotes: "Self-install or professional install; AT&T is currently waiving its installation fee (up to $99).",
    equipmentFeeCents: 0,
    equipmentIncluded: "AT&T Wi-Fi gateway included",
    dataCap: "Unlimited",
    disclosures: FIBER_DISCLOSURE,
    featured: true,
    sortOrder: 10,
    sourceName: ATT_FIBER_SOURCE,
    sourceUrl: ATT_FIBER_URL,
  },
  {
    slug: "fiber-500",
    name: "Fiber 500",
    connectionType: "FIBER",
    downloadMbps: 500,
    uploadMbps: 500,
    monthlyPriceCents: 6000,
    regularPriceCents: 7500,
    priceTermMonths: 12,
    priceConditions: "w/ AutoPay & paperless billing",
    installationFeeCents: 0,
    installationNotes: "Self-install or professional install; AT&T is currently waiving its installation fee (up to $99).",
    equipmentFeeCents: 0,
    equipmentIncluded: "AT&T Wi-Fi gateway included",
    dataCap: "Unlimited",
    disclosures: FIBER_DISCLOSURE,
    featured: true,
    sortOrder: 20,
    sourceName: ATT_FIBER_SOURCE,
    sourceUrl: ATT_FIBER_URL,
  },
  {
    slug: "fiber-1-gig",
    name: "Fiber 1 Gig",
    connectionType: "FIBER",
    downloadMbps: 1000,
    uploadMbps: 1000,
    monthlyPriceCents: 7000,
    regularPriceCents: 9000,
    priceTermMonths: 12,
    priceConditions: "w/ AutoPay & paperless billing",
    installationFeeCents: 0,
    installationNotes: "Professional installation may be required; AT&T is currently waiving its installation fee (up to $99).",
    equipmentFeeCents: 0,
    equipmentIncluded: "AT&T Wi-Fi gateway included",
    dataCap: "Unlimited",
    disclosures: FIBER_DISCLOSURE,
    featured: true,
    sortOrder: 30,
    sourceName: ATT_FIBER_SOURCE,
    sourceUrl: ATT_FIBER_URL,
  },
  {
    slug: "fiber-5-gig",
    name: "Fiber 5 Gig",
    connectionType: "FIBER",
    downloadMbps: 5000,
    uploadMbps: 5000,
    monthlyPriceCents: 11000,
    regularPriceCents: 13500,
    priceTermMonths: 12,
    priceConditions: "w/ AutoPay & paperless billing",
    installationFeeCents: 0,
    installationNotes: "Professional installation; AT&T is currently waiving its installation fee (up to $99).",
    equipmentFeeCents: 0,
    equipmentIncluded: "AT&T multi-gig Wi-Fi gateway included",
    dataCap: "Unlimited",
    disclosures: `${FIBER_DISCLOSURE} Max wired speed to a single device is about 4.7 Gbps; requires compatible multi-gig equipment.`,
    featured: true,
    sortOrder: 40,
    sourceName: ATT_FIBER_SOURCE,
    sourceUrl: ATT_FIBER_URL,
  },
  {
    slug: "internet-air",
    name: "Internet Air",
    connectionType: "FIXED_WIRELESS",
    downloadMbps: 300,
    uploadMbps: 30,
    monthlyPriceCents: 5500,
    regularPriceCents: null,
    priceTermMonths: null,
    priceConditions: "w/ AutoPay & paperless billing ($10/mo discount)",
    installationFeeCents: null,
    installationNotes: "Plug-and-play 5G receiver; available in select areas only.",
    equipmentFeeCents: null,
    equipmentIncluded: null,
    dataCap: null,
    disclosures:
      "5G home internet in select cities. Price after $10/mo AutoPay discount, plus taxes; a State Cost Recovery Charge applies in TX, OH and NV. Speeds vary by location, signal and network congestion; 'up to' speeds shown are not guaranteed. Equipment, data, and term details are confirmed by your specialist at order time.",
    featured: false,
    sortOrder: 50,
    sourceName: "allconnect.com AT&T page (updated 2026-10-20); speeds per cabletv.com AT&T plans (updated 2026-06-07)",
    sourceUrl: "https://www.allconnect.com/providers/att/internet",
  },
];

const OTHER_PROVIDERS = [
  { slug: "spectrum", name: "Spectrum", sortOrder: 20 },
  { slug: "frontier", name: "Frontier", sortOrder: 30 },
  { slug: "xfinity", name: "Xfinity", sortOrder: 40 },
  { slug: "verizon", name: "Verizon", sortOrder: 50 },
  { slug: "t-mobile", name: "T-Mobile", sortOrder: 60 },
];

async function main() {
  const portalUrl = process.env.ATT_SPOC_PORTAL_URL || "https://www.attspoc.com/";
  let att = await prisma.provider.findUnique({ where: { slug: "att" } });
  if (!att) {
    att = await prisma.provider.create({
      data: {
        slug: "att",
        name: "AT&T",
        websiteUrl: "https://www.att.com",
        active: true,
        orderable: true,
        portalName: "AT&T SPOC",
        orderPortalUrl: portalUrl,
        orderInstructions: ATT_INSTRUCTIONS,
        enrollmentRequirements:
          "AT&T may require identity verification and/or a credit check. These are completed through AT&T's own process — never collect SSN, DOB, or payment card numbers in Shop Cheap Internet chat or notes.",
        confirmationWorkflow: "The order is confirmed only when SPOC returns an AT&T order/confirmation number. Record that number exactly as shown.",
        confirmationNumberLabel: "Order number",
        disclosure:
          "AT&T and the AT&T logo are trademarks of AT&T Intellectual Property. Shop Cheap Internet is an independent enrollment service and is not AT&T.",
        sortOrder: 10,
      },
    });
    console.log("Created provider AT&T");
  }

  for (const p of ATT_PLANS) {
    const exists = await prisma.plan.findUnique({ where: { providerId_slug: { providerId: att.id, slug: p.slug } } });
    if (exists) continue;
    const plan = await prisma.plan.create({ data: { ...p, providerId: att.id, contractRequired: false, sourceCheckedAt: CHECKED, active: true } });
    await prisma.planPriceHistory.create({
      data: {
        planId: plan.id,
        monthlyPriceCents: plan.monthlyPriceCents,
        regularPriceCents: plan.regularPriceCents,
        promoDescription: plan.promoDescription,
        sourceName: plan.sourceName,
        sourceUrl: plan.sourceUrl,
        sourceCheckedAt: plan.sourceCheckedAt,
        note: "Initial seed",
      },
    });
    console.log(`Created plan AT&T ${p.name}`);
  }

  for (const o of OTHER_PROVIDERS) {
    const exists = await prisma.provider.findUnique({ where: { slug: o.slug } });
    if (!exists) {
      await prisma.provider.create({ data: { ...o, active: true, orderable: false } });
      console.log(`Created provider ${o.name} (not orderable)`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
