import Link from "next/link";
import { SiteShell } from "./SiteChrome";
import { AddressSearch } from "./AddressSearch";

export function ContentPage({
  eyebrow,
  title,
  intro,
  children,
  breadcrumbs,
  jsonLd,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
  breadcrumbs: { name: string; href: string }[];
  jsonLd?: object;
}) {
  const crumbs = [{ name: "Home", href: "/" }, ...breadcrumbs];
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `https://shopcheapinternet.com${c.href}` })),
            },
            ...(jsonLd ? [jsonLd] : []),
          ]),
        }}
      />
      <section className="bg-navy-900">
        <div className="container-page py-12 md:py-16">
          <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
            {crumbs.map((c, i) => (
              <span key={c.href}>
                {i > 0 && <span className="mx-1.5">/</span>}
                {i < crumbs.length - 1 ? <Link href={c.href} className="hover:text-white">{c.name}</Link> : <span className="text-slate-300">{c.name}</span>}
              </span>
            ))}
          </nav>
          <p className="eyebrow mt-4 text-mint-300">{eyebrow}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{intro}</p>
        </div>
      </section>
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_340px]">
        <article className="prose-sci min-w-0">{children}</article>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-navy-900">Check plans at your address</h2>
            <div className="mt-4">
              <AddressSearch />
            </div>
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}
