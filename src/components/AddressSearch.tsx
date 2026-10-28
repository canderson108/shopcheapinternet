"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { track } from "@/lib/track";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

type Addr = { street: string; unit: string; city: string; state: string; zip: string };
type Suggestion = { street: string; unit: string | null; city: string; state: string; zip: string; entries: number };

export function AddressSearch({
  propertySlug,
  fixedAddress,
  units,
  initial,
  dark = false,
  cta = "Check Internet Plans",
}: {
  propertySlug?: string;
  fixedAddress?: { street: string; city: string; state: string; zip: string };
  units?: string[];
  initial?: Partial<Addr>;
  dark?: boolean;
  cta?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [a, setA] = useState<Addr>({
    street: fixedAddress?.street ?? initial?.street ?? "",
    unit: initial?.unit ?? "",
    city: fixedAddress?.city ?? initial?.city ?? "",
    state: fixedAddress?.state ?? initial?.state ?? "",
    zip: fixedAddress?.zip ?? initial?.zip ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [allowUnverified, setAllowUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [acEnabled, setAcEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fixed = Boolean(fixedAddress);

  async function fetchSuggestions(q: string, selected?: string) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const params = new URLSearchParams({ q });
      if (selected) params.set("selected", selected);
      const r = await api<{ enabled: boolean; suggestions: Suggestion[] }>(`/api/address/autocomplete?${params}`, { signal: ctrl.signal });
      setAcEnabled(r.enabled);
      setSuggestions(r.suggestions);
      setOpen(r.suggestions.length > 0);
      setActive(-1);
    } catch {
      /* aborted or offline: manual entry still works */
    }
  }

  function onStreet(v: string) {
    setA((p) => ({ ...p, street: v }));
    if (!acEnabled || fixed) return;
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 4) {
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => fetchSuggestions(v), 220);
  }

  function choose(s: Suggestion) {
    if (s.entries > 1) {
      // Multi-unit building: expand to its unit list.
      const selected = `${s.street} ${s.unit ?? ""} (${s.entries}) ${s.city} ${s.state} ${s.zip}`;
      fetchSuggestions(s.street, selected);
      return;
    }
    setA({ street: s.street, unit: s.unit?.replace(/^(apt|unit|ste|#)\s*/i, "") ?? "", city: s.city, state: s.state, zip: s.zip });
    setOpen(false);
  }

  useEffect(() => () => abort.current?.abort(), []);

  async function submit(e: React.FormEvent, acceptUnverified = false) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const r = await api<{ next: string; verified: boolean }>("/api/session/address", {
        body: { address: { ...a, unit: a.unit || null }, propertySlug: propertySlug ?? null, acceptUnverified },
      });
      track("address_search", { zip: a.zip, state: a.state, verified: r.verified, property: propertySlug ?? null });
      router.push(r.next);
    } catch (err) {
      if (err instanceof ApiError) {
        const d = (err.details ?? {}) as Record<string, string>;
        setErrors(d);
        setMessage(err.message);
        if (err.status === 422 && err.message.includes("couldn't verify")) setAllowUnverified(true);
        if (err.message.includes("unit number")) setErrors({ unit: "Enter your apartment or unit number" });
      } else setMessage("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const labelCls = dark ? "label text-slate-200" : "label";
  const err = (k: string) => errors[k] ?? errors[`address.${k}`];

  return (
    <form onSubmit={(e) => submit(e)} className="w-full" noValidate aria-label="Check internet plans at your address">
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-8">
          <label htmlFor={`${uid}-street`} className={labelCls}>Street address</label>
          <input
            id={`${uid}-street`}
            className={`input ${err("street") ? "input-error" : ""}`}
            autoComplete="address-line1"
            placeholder="123 Main St"
            value={a.street}
            disabled={fixed}
            onChange={(e) => onStreet(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(suggestions[active]); }
              if (e.key === "Escape") setOpen(false);
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${uid}-suggestions`}
            aria-autocomplete="list"
            required
          />
          {open && (
            <ul id={`${uid}-suggestions`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-left text-sm text-slate-800 shadow-xl">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.street}-${s.unit}-${s.zip}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`cursor-pointer px-3 py-2 ${i === active ? "bg-mint-50" : "hover:bg-slate-50"}`}
                  onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                >
                  <span className="font-medium">{s.street}{s.unit ? ` ${s.unit}` : ""}</span>
                  <span className="text-slate-500">, {s.city}, {s.state} {s.zip}</span>
                  {s.entries > 1 && <span className="ml-1 text-xs font-semibold text-mint-700">({s.entries} units)</span>}
                </li>
              ))}
            </ul>
          )}
          {err("street") && <p className="field-error">{err("street")}</p>}
        </div>
        <div className="sm:col-span-4">
          <label htmlFor={`${uid}-unit`} className={labelCls}>Apt / unit <span className="font-normal text-slate-400">{units?.length ? "" : "(optional)"}</span></label>
          {units && units.length > 0 ? (
            <select id={`${uid}-unit`} className={`input ${err("unit") ? "input-error" : ""}`} value={a.unit} onChange={(e) => setA({ ...a, unit: e.target.value })} required>
              <option value="">Select your unit</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <input id={`${uid}-unit`} className={`input ${err("unit") ? "input-error" : ""}`} autoComplete="address-line2" placeholder="Apt 4B" value={a.unit} onChange={(e) => setA({ ...a, unit: e.target.value })} />
          )}
          {err("unit") && <p className="field-error">{err("unit")}</p>}
        </div>
        <div className="sm:col-span-5">
          <label htmlFor={`${uid}-city`} className={labelCls}>City</label>
          <input id={`${uid}-city`} className={`input ${err("city") ? "input-error" : ""}`} autoComplete="address-level2" value={a.city} disabled={fixed} onChange={(e) => setA({ ...a, city: e.target.value })} required />
          {err("city") && <p className="field-error">{err("city")}</p>}
        </div>
        <div className="sm:col-span-3">
          <label htmlFor={`${uid}-state`} className={labelCls}>State</label>
          <select id={`${uid}-state`} className={`input ${err("state") ? "input-error" : ""}`} autoComplete="address-level1" value={a.state} disabled={fixed} onChange={(e) => setA({ ...a, state: e.target.value })} required>
            <option value="">—</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {err("state") && <p className="field-error">{err("state")}</p>}
        </div>
        <div className="sm:col-span-4">
          <label htmlFor={`${uid}-zip`} className={labelCls}>ZIP code</label>
          <input id={`${uid}-zip`} className={`input ${err("zip") ? "input-error" : ""}`} inputMode="numeric" autoComplete="postal-code" maxLength={10} value={a.zip} disabled={fixed} onChange={(e) => setA({ ...a, zip: e.target.value })} required />
          {err("zip") && <p className="field-error">{err("zip")}</p>}
        </div>
      </div>
      {message && (
        <div role="alert" className={`mt-3 rounded-xl px-3 py-2 text-sm ${dark ? "bg-white/10 text-amber-200" : "bg-amber-50 text-amber-900"}`}>
          {message}
          {allowUnverified && (
            <button type="button" className="ml-2 font-semibold underline" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>
              Continue with this address
            </button>
          )}
        </div>
      )}
      <button type="submit" className="btn-primary mt-4 w-full py-3.5 text-base sm:w-auto" disabled={busy}>
        {busy ? "Checking…" : cta}
        {!busy && <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
