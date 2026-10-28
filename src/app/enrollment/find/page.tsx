import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteChrome";
import { RequestLinkForm } from "@/components/RequestLinkForm";

export const metadata: Metadata = { title: "Find my enrollment", robots: { index: false } };

export default async function FindEnrollmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <SiteShell>
      <div className="container-page max-w-lg py-16">
        <h1 className="text-2xl font-extrabold text-navy-900">Check on my enrollment</h1>
        {error === "expired" && (
          <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-ink">
            That link has expired or was already replaced. Request a new one below.
          </p>
        )}
        {error === "rate" && (
          <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-ink">Too many attempts. Please wait a few minutes.</p>
        )}
        <p className="mt-2 text-slate-600">Enter the email you enrolled with and we&apos;ll send you a secure link to your status page.</p>
        <div className="mt-6">
          <RequestLinkForm />
        </div>
      </div>
    </SiteShell>
  );
}
