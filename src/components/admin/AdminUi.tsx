import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <p role={err ? "alert" : "status"} className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${err ? "bg-red-50 text-red-700" : "bg-mint-50 text-mint-700"}`}>
      {err ?? ok}
    </p>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-navy-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:border-mint-500">{inner}</Link>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}

export function Field({ label, name, defaultValue, type = "text", required, placeholder, help, step, min, max }: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  step?: string;
  min?: string | number;
  max?: string | number;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} step={step} min={min} max={max} />
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 3, help, placeholder }: { label: string; name: string; defaultValue?: string | null; rows?: number; help?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input" name={name} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

export function Check({ label, name, defaultChecked, help }: { label: string; name: string; defaultChecked?: boolean; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-mint-600" />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        {help && <span className="block text-xs text-slate-500">{help}</span>}
      </span>
    </label>
  );
}

export function Select({ label, name, defaultValue, options, required }: { label: string; name: string; defaultValue?: string | null; options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ""} required={required}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Minimal accessible bar chart (no chart library needed). */
export function Bars({ data, max: maxOverride }: { data: { label: string; value: number; sub?: string }[]; max?: number }) {
  const max = maxOverride ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between gap-2"><span className="truncate text-slate-700">{d.label}</span><span className="font-semibold text-navy-900">{d.value}{d.sub ? <span className="ml-1 font-normal text-slate-400">{d.sub}</span> : null}</span></div>
          <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-mint-500" style={{ width: `${(d.value / max) * 100}%` }} /></div>
        </li>
      ))}
      {data.length === 0 && <li className="text-sm text-slate-500">No data in this period.</li>}
    </ul>
  );
}
