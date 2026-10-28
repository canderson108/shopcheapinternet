import Link from "next/link";
import { Logo } from "./Logo";
import { env } from "@/lib/env";

export function SiteHeader() {
  const phone = env.supportPhone;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Shop Cheap Internet home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex" aria-label="Main">
          <Link href="/internet/cheap-internet-plans" className="hover:text-navy-900">Cheap plans</Link>
          <Link href="/providers/att" className="hover:text-navy-900">AT&amp;T plans</Link>
          <Link href="/internet/apartments" className="hover:text-navy-900">Apartments</Link>
          <Link href="/internet/speed-guide" className="hover:text-navy-900">Speed guide</Link>
        </nav>
        <div className="flex items-center gap-2">
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hidden text-sm font-semibold text-navy-900 sm:inline">
              {phone}
            </a>
          )}
          <Link href="/#check" className="btn-primary px-4 py-2.5">
            Check plans
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy-950 text-slate-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            Shop Cheap Internet is an independent internet shopping and enrollment service. Compare plans at your address, choose
            one, and our enrollment specialists place your order with the provider.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Questions? <a className="text-mint-300 hover:underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>
            {env.supportPhone ? <> · {env.supportPhone}</> : null}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/internet/cheap-internet-plans">Cheap internet plans</Link></li>
            <li><Link className="hover:text-white" href="/providers/att">AT&amp;T internet plans</Link></li>
            <li><Link className="hover:text-white" href="/internet/fiber">Fiber internet</Link></li>
            <li><Link className="hover:text-white" href="/internet/apartments">Internet for apartments</Link></li>
            <li><Link className="hover:text-white" href="/internet/speed-guide">Internet speed guide</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Company</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/enrollment/find">Check my enrollment</Link></li>
            <li><Link className="hover:text-white" href="/legal/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-white" href="/legal/terms">Terms of service</Link></li>
            <li><Link className="hover:text-white" href="/legal/disclosures">Advertising disclosures</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page space-y-2 py-6 text-xs leading-5 text-slate-500">
          <p>
            Shop Cheap Internet is not an internet service provider and is not affiliated with, endorsed by, or the official website of
            AT&amp;T or any other provider. Provider names and trademarks belong to their respective owners and are used only to identify
            the services offered.
          </p>
          <p>
            Advertised prices, speeds, and promotions come from provider-published offers and are labeled with their source and the date
            we last checked them. Availability, final pricing, taxes, fees, and terms are determined by the provider when your order is
            placed. Wired speeds; Wi-Fi speeds vary.
          </p>
          <p>© {new Date().getFullYear()} Shop Cheap Internet. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
