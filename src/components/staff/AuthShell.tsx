import { Logo } from "../Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo light /></div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-xl font-bold text-navy-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Authorized Shop Cheap Internet staff only. Activity is logged.</p>
      </div>
    </main>
  );
}
