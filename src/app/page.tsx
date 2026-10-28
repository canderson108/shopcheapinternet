import Link from "next/link";
import { SiteShell } from "@/components/SiteChrome";
import { AddressSearch } from "@/components/AddressSearch";
import { PlanCardStatic, toCardData } from "@/components/PlanCard";
import { prisma } from "@/lib/db";
import { getFeaturedPlans, type PlanWithProvider } from "@/lib/services/plans";

export const revalidate = 300;

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Shop Cheap Internet an internet provider?",
    a: "No. We're an independent shopping and enrollment service. You compare plans here, and our enrollment specialists place your order with the provider you choose. Your service, bill, and installation come from the provider.",
  },
  {
    q: "Does it cost anything to use Shop Cheap Internet?",
    a: "No. Comparing plans and having a specialist place your order is free. You pay the provider for your internet service under the provider's terms.",
  },
  {
    q: "Are the prices I see guaranteed?",
    a: "Prices shown are the provider's advertised offers, labeled with where they came from and when we last checked. Final pricing, taxes, fees, and availability are confirmed by the provider when your order is placed. If anything changes, your specialist tells you and asks for your approval before submitting.",
  },
  {
    q: "How do I know a plan is available at my address?",
    a: "Advertised plans aren't always available at every address. After you request a plan, your specialist checks serviceability for your exact address in the provider's ordering system before placing the order.",
  },
  {
    q: "Will you ask for my Social Security number or card number?",
    a: "Never through our forms or chat. If the provider needs identity verification, a credit check, or payment, your specialist will explain how to complete it directly through the provider's secure process.",
  },
  {
    q: "How long does enrollment take?",
    a: "Most requests are picked up by a specialist during business hours, usually the same day. You'll get email updates and can message your specialist from your status page at any time.",
  },
];

const SPEED_TIERS = [
  { label: "Up to 300 Mbps", fit: "1–3 people", uses: "HD streaming, video calls, browsing, a few smart devices" },
  { label: "500 Mbps", fit: "3–5 people", uses: "Multiple 4K streams, working from home, online gaming" },
  { label: "1 Gig", fit: "5+ people or heavy use", uses: "Many simultaneous 4K streams, large downloads, creators, smart homes" },
  { label: "2–5 Gig", fit: "Power users", uses: "Huge file transfers, home labs, multi-gig wired devices" },
];

async function loadHome(): Promise<{ plans: PlanWithProvider[]; providers: { name: string; orderable: boolean }[] }> {
  try {
    const [plans, providers] = await Promise.all([
      getFeaturedPlans(4),
      prisma.provider.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { name: true, orderable: true } }),
    ]);
    return { plans, providers };
  } catch (e) {
    console.error("Homepage data unavailable", e);
    return { plans: [], providers: [] };
  }
}

export default async function HomePage() {
  const { plans, providers } = await loadHome();
  const orderable = providers.filter((p) => p.orderable);
  const comingSoon = providers.filter((p) => !p.orderable);

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "Organization", name: "Shop Cheap Internet", url: "https://shopcheapinternet.com", logo: "https://shopcheapinternet.com/icon.svg" },
              {
                "@type": "FAQPage",
                mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
              },
            ],
          }),
        }}
      />

      {/* Hero */}
      <section id="check" className="relative overflow-hidden bg-navy-900">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-mint-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-navy-700/60 blur-3xl" />
        <div className="container-page relative grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow text-mint-300">Independent internet marketplace</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl">
              Find Cheap Internet Plans at Your Address
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Compare internet speeds, pricing, and available offers. Choose your plan and let our enrollment specialists handle the setup.
            </p>
            <ul className="mt-6 grid max-w-lg gap-2 text-sm text-slate-200 sm:grid-cols-2">
              {["Free to compare and enroll", "Real specialists place your order", "No SSN or card numbers collected", "Updates by email and chat"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-mint-500/20 text-mint-300">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <h2 className="text-xl font-bold text-navy-900">Check plans at your address</h2>
            <p className="mt-1 text-sm text-slate-500">Takes about 30 seconds. No account needed.</p>
            <div className="mt-5">
              <AddressSearch />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16 md:py-20" aria-labelledby="how">
        <p className="eyebrow">How it works</p>
        <h2 id="how" className="mt-2 text-3xl font-extrabold text-navy-900">How Shop Cheap Internet Works</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {[
            ["Enter your address", "We show internet plans advertised for your area, with clear prices and speeds."],
            ["Compare & choose", "See speeds, fees, and promotions side by side. Pick the plan that fits your home."],
            ["Request enrollment", "Share your contact details once. No Social Security or card numbers here."],
            ["We place the order", "A specialist verifies availability and places your order with the provider, then sends your confirmation."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 font-display text-lg font-extrabold text-mint-400">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold text-navy-900">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Providers */}
      <section className="bg-navy-50 py-14" aria-labelledby="providers">
        <div className="container-page">
          <h2 id="providers" className="text-2xl font-extrabold text-navy-900">Available internet providers</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            We currently enroll customers with the providers marked available. More providers are being added.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {orderable.map((p) => (
              <span key={p.name} className="card flex items-center gap-2 px-5 py-3 text-base font-bold text-navy-900">
                {p.name}
                <span className="badge bg-mint-50 text-mint-700">Enrolling now</span>
              </span>
            ))}
            {comingSoon.map((p) => (
              <span key={p.name} className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-5 py-3 text-base font-semibold text-slate-500">
                {p.name}
                <span className="badge bg-slate-100 text-slate-500">Coming soon</span>
              </span>
            ))}
            {providers.length === 0 && <p className="text-sm text-slate-500">Provider list is being updated.</p>}
          </div>
        </div>
      </section>

      {/* Featured plans */}
      <section className="container-page py-16 md:py-20" aria-labelledby="featured">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured offers</p>
            <h2 id="featured" className="mt-2 text-3xl font-extrabold text-navy-900">Featured internet plans</h2>
          </div>
          <Link href="/internet/cheap-internet-plans" className="text-sm font-semibold text-mint-700 hover:underline">See all plans →</Link>
        </div>
        {plans.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCardStatic key={p.id} p={toCardData(p)} href="#check" />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-slate-500">Plan pricing is being updated. Enter your address above to request current offers.</p>
        )}
        <p className="mt-4 text-xs text-slate-500">Advertised offers are not available at every address. Your specialist confirms availability and pricing before ordering.</p>
      </section>

      {/* Speed comparison */}
      <section className="bg-white py-4" aria-labelledby="speeds">
        <div className="container-page">
          <h2 id="speeds" className="text-3xl font-extrabold text-navy-900">Internet speed comparison</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Not sure how much speed you need? Here&apos;s a quick guide based on household size and how you use the internet.</p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="table-base min-w-[560px]">
              <thead>
                <tr><th>Speed</th><th>Good for</th><th>Typical use</th></tr>
              </thead>
              <tbody>
                {SPEED_TIERS.map((t) => (
                  <tr key={t.label}>
                    <td className="font-bold text-navy-900">{t.label}</td>
                    <td>{t.fit}</td>
                    <td className="text-slate-600">{t.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/internet/speed-guide" className="mt-3 inline-block text-sm font-semibold text-mint-700 hover:underline">Read the full speed guide →</Link>
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-16 md:py-20" aria-labelledby="why">
        <h2 id="why" className="text-3xl font-extrabold text-navy-900">Why Shop Cheap Internet</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ["Honest pricing", "Every price shows its source, the date we checked it, and the conditions attached — like AutoPay discounts and promo periods."],
            ["A real person handles it", "A specialist verifies your address, explains installation options, and places the order for you. No hold music."],
            ["Your data, protected", "We collect only what's needed to place your order, encrypt it, and never ask for SSNs or card numbers in our forms."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-navy-900 p-6 text-white">
              <h3 className="text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-navy-50 py-16" aria-labelledby="faq">
        <div className="container-page max-w-3xl">
          <h2 id="faq" className="text-3xl font-extrabold text-navy-900">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900">
                  {f.q}
                  <span aria-hidden className="text-xl text-mint-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-page py-16" aria-labelledby="final-cta">
        <div className="rounded-3xl bg-navy-900 p-6 sm:p-10">
          <h2 id="final-cta" className="text-2xl font-extrabold text-white sm:text-3xl">Ready to see what&apos;s available at your address?</h2>
          <p className="mt-2 text-slate-300">Enter your address and compare plans in under a minute.</p>
          <div className="mt-6">
            <AddressSearch dark />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
