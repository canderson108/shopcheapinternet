import Link from "next/link";
import { SiteShell } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container-page max-w-xl py-24 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy-900">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-slate-600">The page may have moved. You can still check internet plans at your address.</p>
        <Link href="/#check" className="btn-primary mt-6">Check internet plans</Link>
      </div>
    </SiteShell>
  );
}
