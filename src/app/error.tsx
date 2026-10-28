"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold text-navy-900">Something went wrong</h1>
      <p className="mt-3 text-slate-600">Please try again. If you were submitting an enrollment, it won&apos;t be submitted twice.</p>
      <button className="btn-primary mt-6" onClick={() => reset()}>Try again</button>
    </div>
  );
}
