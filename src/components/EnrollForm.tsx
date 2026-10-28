"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, uuid } from "@/lib/api-client";
import { gaClientId, track } from "@/lib/track";
import type { Draft } from "@/lib/validation";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

type Billing = { street: string; unit: string; city: string; state: string; zip: string };

function minDate(): string {
  const d = new Date(Date.now() + 86400_000);
  return d.toISOString().slice(0, 10);
}
function maxDate(): string {
  return new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
}

export function EnrollForm({
  draft,
  serviceUnit,
  propertyUnit,
  consent,
  providerName,
  blocked,
}: {
  draft: Draft;
  serviceUnit: string;
  propertyUnit: boolean;
  consent: { terms: string; contact: string; marketing: string };
  providerName: string;
  blocked: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    firstName: draft.firstName ?? "",
    lastName: draft.lastName ?? "",
    email: draft.email ?? "",
    phone: draft.phone ?? "",
    unit: draft.unit ?? serviceUnit,
    billingSameAsService: draft.billingSameAsService ?? true,
    billing: { street: "", unit: "", city: "", state: "", zip: "", ...(draft.billing ?? {}) } as Billing,
    preferredInstallDate: draft.preferredInstallDate ?? "",
    preferredInstallTime: draft.preferredInstallTime ?? "any",
    notes: draft.notes ?? "",
    consentMarketing: draft.consentMarketing ?? false,
    consentTerms: false,
    consentContact: false,
  });
  const [key] = useState(() => draft.idempotencyKey ?? uuid());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  // Autosave (debounced). Consent checkboxes are never pre-filled from a draft.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!started.current) {
      started.current = true;
      track("enrollment_started");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await api("/api/session/draft", {
          method: "PUT",
          body: {
            firstName: f.firstName,
            lastName: f.lastName,
            email: f.email,
            phone: f.phone,
            unit: f.unit,
            billingSameAsService: f.billingSameAsService,
            billing: f.billingSameAsService ? null : f.billing,
            preferredInstallDate: f.preferredInstallDate || null,
            preferredInstallTime: f.preferredInstallTime,
            notes: f.notes,
            consentMarketing: f.consentMarketing,
            idempotencyKey: key,
          },
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.firstName, f.lastName, f.email, f.phone, f.unit, f.billingSameAsService, f.billing, f.preferredInstallDate, f.preferredInstallTime, f.notes, f.consentMarketing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    setMessage(null);
    try {
      const r = await api<{ next: string; publicId: string }>("/api/enrollments", {
        body: {
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email,
          phone: f.phone,
          unit: f.unit || null,
          billingSameAsService: f.billingSameAsService,
          billing: f.billingSameAsService ? null : { ...f.billing, unit: f.billing.unit || null },
          preferredInstallDate: f.preferredInstallDate || null,
          preferredInstallTime: f.preferredInstallTime || null,
          notes: f.notes || null,
          consentTerms: f.consentTerms,
          consentContact: f.consentContact,
          consentMarketing: f.consentMarketing,
          idempotencyKey: key,
          gaClientId: gaClientId(),
        },
      });
      track("enrollment_submitted", { reference: r.publicId, provider: providerName });
      router.push(r.next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "validation" && err.details && typeof err.details === "object") setErrors(err.details as Record<string, string>);
        setMessage(err.message);
        if (err.code === "price_changed" || err.code === "plan_unavailable") router.refresh();
      } else setMessage("We couldn't submit your request. Check your connection and try again — you won't be charged or enrolled twice.");
      setSubmitting(false);
    }
  }

  const input = (k: string) => `input ${errors[k] ? "input-error" : ""}`;
  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="field-error" id={`${k}-err`}>{errors[k]}</p> : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset className="card p-5 sm:p-6">
        <legend className="px-1 text-base font-bold text-navy-900">Contact information</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" className={input("firstName")} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} aria-invalid={!!errors.firstName} required />
            <Err k="firstName" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input id="lastName" className={input("lastName")} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} aria-invalid={!!errors.lastName} required />
            <Err k="lastName" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className={input("email")} autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errors.email} required />
            <Err k="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile phone</label>
            <input id="phone" type="tel" className={input("phone")} autoComplete="tel-national" inputMode="tel" placeholder="(555) 555-5555" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-invalid={!!errors.phone} required />
            <Err k="phone" />
          </div>
        </div>
      </fieldset>

      <fieldset className="card p-5 sm:p-6">
        <legend className="px-1 text-base font-bold text-navy-900">Service details</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="unit">Apartment / unit</label>
            <input id="unit" className={input("unit")} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} readOnly={propertyUnit && !!serviceUnit} placeholder="Leave blank for a house" />
            <Err k="unit" />
          </div>
          <div>
            <label className="label" htmlFor="installDate">Preferred installation / activation date <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="installDate" type="date" className={input("preferredInstallDate")} min={minDate()} max={maxDate()} value={f.preferredInstallDate} onChange={(e) => setF({ ...f, preferredInstallDate: e.target.value })} />
            <Err k="preferredInstallDate" />
          </div>
          <div>
            <label className="label" htmlFor="installTime">Preferred time of day</label>
            <select id="installTime" className="input" value={f.preferredInstallTime} onChange={(e) => setF({ ...f, preferredInstallTime: e.target.value })}>
              <option value="any">Any time</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <p className="self-end text-xs text-slate-500">
            Installation dates depend on {providerName}&apos;s availability. Your specialist will confirm the earliest options.
          </p>
        </div>
        <div className="mt-5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-mint-600" checked={f.billingSameAsService} onChange={(e) => setF({ ...f, billingSameAsService: e.target.checked })} />
            Billing address is the same as my service address
          </label>
        </div>
        {!f.billingSameAsService && (
          <div className="mt-4 grid gap-4 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <label className="label" htmlFor="b-street">Billing street address</label>
              <input id="b-street" className={input("billing.street")} autoComplete="billing address-line1" value={f.billing.street} onChange={(e) => setF({ ...f, billing: { ...f.billing, street: e.target.value } })} />
              <Err k="billing.street" />
              <Err k="billing" />
            </div>
            <div className="sm:col-span-4">
              <label className="label" htmlFor="b-unit">Unit</label>
              <input id="b-unit" className="input" autoComplete="billing address-line2" value={f.billing.unit} onChange={(e) => setF({ ...f, billing: { ...f.billing, unit: e.target.value } })} />
            </div>
            <div className="sm:col-span-5">
              <label className="label" htmlFor="b-city">City</label>
              <input id="b-city" className={input("billing.city")} autoComplete="billing address-level2" value={f.billing.city} onChange={(e) => setF({ ...f, billing: { ...f.billing, city: e.target.value } })} />
              <Err k="billing.city" />
            </div>
            <div className="sm:col-span-3">
              <label className="label" htmlFor="b-state">State</label>
              <select id="b-state" className={input("billing.state")} value={f.billing.state} onChange={(e) => setF({ ...f, billing: { ...f.billing, state: e.target.value } })}>
                <option value="">—</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <Err k="billing.state" />
            </div>
            <div className="sm:col-span-4">
              <label className="label" htmlFor="b-zip">ZIP</label>
              <input id="b-zip" className={input("billing.zip")} inputMode="numeric" autoComplete="billing postal-code" value={f.billing.zip} onChange={(e) => setF({ ...f, billing: { ...f.billing, zip: e.target.value } })} />
              <Err k="billing.zip" />
            </div>
          </div>
        )}
        <div className="mt-5">
          <label className="label" htmlFor="notes">Anything your specialist should know? <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="notes" rows={3} maxLength={1000} className={input("notes")} placeholder="Gate code, best time to call, current provider…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Please don&apos;t include Social Security, driver&apos;s license, or card numbers.</p>
        </div>
      </fieldset>

      <fieldset className="card space-y-3 p-5 sm:p-6">
        <legend className="px-1 text-base font-bold text-navy-900">Authorization</legend>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-mint-600" checked={f.consentTerms} onChange={(e) => setF({ ...f, consentTerms: e.target.checked })} aria-invalid={!!errors.consentTerms} />
          <span>
            {consent.terms.replace("Terms of Service and Privacy Policy", "")}{" "}
            <a href="/legal/terms" target="_blank" className="font-semibold text-mint-700 underline">Terms of Service</a> ·{" "}
            <a href="/legal/privacy" target="_blank" className="font-semibold text-mint-700 underline">Privacy Policy</a>
          </span>
        </label>
        <Err k="consentTerms" />
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-mint-600" checked={f.consentContact} onChange={(e) => setF({ ...f, consentContact: e.target.checked })} aria-invalid={!!errors.consentContact} />
          <span>{consent.contact}</span>
        </label>
        <Err k="consentContact" />
        <label className="flex items-start gap-3 text-sm text-slate-500">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-mint-600" checked={f.consentMarketing} onChange={(e) => setF({ ...f, consentMarketing: e.target.checked })} />
          <span>{consent.marketing} (optional)</span>
        </label>
      </fieldset>

      {message && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}

      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Progress saved" : "Your progress saves automatically."}
        </p>
        <button type="submit" className="btn-primary w-full py-3.5 text-base sm:w-auto" disabled={submitting || blocked}>
          {submitting ? "Submitting…" : "Complete Enrollment Request"}
        </button>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Submitting creates an enrollment request. It is not a completed {providerName} order — a specialist will verify availability and pricing and
        place the order with {providerName}. You&apos;ll be able to message your specialist and track progress on the next page.
      </p>
    </form>
  );
}
