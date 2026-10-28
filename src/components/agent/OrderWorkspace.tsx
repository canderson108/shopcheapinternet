"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentOrderView } from "@/lib/services/views";
import type { ChatMessage } from "@/lib/services/messages";
import { api, ApiError } from "@/lib/api-client";
import { connectionLabel, formatDate, formatDateTime, formatPhone, formatPrice, formatSpeed } from "@/lib/format";
import { allowedNextStatuses, AGENT_SETTABLE, CHECKLIST_ITEMS, statusLabel, TERMINAL_STATUSES } from "@/lib/status";
import { CopyField, CopyGroupButton } from "./CopyField";
import { StatusPill } from "./AgentConsole";
import { useAgentRealtime } from "./AgentRealtime";

type Viewer = { id: string; role: "AGENT" | "MANAGER" | "ADMIN"; canWork: boolean };
type Payload = { order: AgentOrderView; messages: ChatMessage[]; viewer: Viewer };

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function OrderWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>(`/api/agent/orders/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this order.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useAgentRealtime((e) => {
    if (e.data.enrollmentId === id || e.type === "poll") load();
  });

  async function act(name: string, url: string, body: unknown, ok?: string) {
    setBusy(name);
    setError(null);
    try {
      await api(url, { body });
      if (ok) {
        setFlash(ok);
        setTimeout(() => setFlash(null), 3000);
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.");
      if (e instanceof ApiError && e.status === 409) await load();
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    // Open the tab synchronously (avoids popup blockers), then point it at the configured portal URL.
    const win = window.open("about:blank", "_blank");
    try {
      const r = await api<{ url: string }>(`/api/agent/orders/${id}/portal`, { body: {} });
      if (win) {
        win.opener = null;
        win.location.href = r.url;
      } else window.open(r.url, "_blank", "noopener,noreferrer");
      await load();
    } catch (e) {
      win?.close();
      setError(e instanceof ApiError ? e.message : "Couldn't open the provider portal.");
    }
  }

  if (!data) return <div className="p-6 text-sm text-slate-500">{error ?? "Loading order…"}</div>;
  const { order: o, messages, viewer } = data;
  const closed = TERMINAL_STATUSES.includes(o.status);
  const queued = o.status === "WAITING_FOR_AGENT" && !o.assignedAgent;
  const canWork = viewer.canWork && !closed;

  const fullName = `${o.customer.firstName} ${o.customer.lastName}`;
  const streetLine = o.service.street;
  const addressBlock = `${o.service.street}${o.service.unit ? ` Unit ${o.service.unit}` : ""}\n${o.service.city}, ${o.service.state} ${o.service.zip}`;
  const billingLine = o.billingSameAsService
    ? "Same as service address"
    : o.billing
      ? `${o.billing.street}${o.billing.unit ? ` Unit ${o.billing.unit}` : ""}, ${o.billing.city}, ${o.billing.state} ${o.billing.zip}`
      : "";
  const planLine = `${o.plan.providerName} ${o.plan.name} — ${formatSpeed(o.plan.downloadMbps)}/${formatSpeed(o.plan.uploadMbps)} — ${formatPrice(o.advertisedPriceCents)}/mo`;

  return (
    <div className="mx-auto max-w-[1500px] p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/agent" className="btn-ghost btn-sm">← Queue</Link>
          <h1 className="text-xl font-extrabold text-navy-900">{fullName}</h1>
          <StatusPill status={o.status} provider={o.provider.name} />
          <span className="font-mono text-xs text-slate-500">{o.publicId}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {o.assignedAgent ? <>Assigned to <span className="font-semibold text-slate-700">{o.assignedAgent.name}</span></> : "Unassigned"}
          {queued && (
            <button className="btn-primary btn-sm" disabled={!!busy} onClick={() => act("claim", `/api/agent/orders/${id}/claim`, {}, "Order claimed")}>
              Claim this order
            </button>
          )}
          {o.status === "AGENT_ASSIGNED" && canWork && (
            <button className="btn-dark btn-sm" disabled={!!busy} onClick={() => act("start", `/api/agent/orders/${id}/start`, {}, "Processing started")}>
              Start processing
            </button>
          )}
        </div>
      </div>

      {flash && <p role="status" className="mb-3 rounded-xl bg-mint-50 px-4 py-2 text-sm font-semibold text-mint-700">{flash}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {!viewer.canWork && !queued && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-ink">View only — this order is assigned to another agent.</p>}
      {o.piiDeleted && <p className="mb-3 rounded-xl bg-slate-200 px-4 py-2 text-sm text-slate-700">Customer personal information was deleted on request.</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* LEFT: customer information */}
        <div className="space-y-4">
          <Section
            title="Customer"
            actions={<CopyGroupButton label="contact" value={`${fullName}\n${formatPhone(o.customer.phone)}\n${o.customer.email}`} />}
          >
            <CopyField label="First name" value={o.customer.firstName} />
            <CopyField label="Last name" value={o.customer.lastName} />
            <CopyField label="Phone" value={o.customer.phone} mono />
            <CopyField label="Email" value={o.customer.email} />
          </Section>

          <Section title="Service address" actions={<CopyGroupButton label="address" value={addressBlock} />}>
            <CopyField label="Street address" value={streetLine} />
            <CopyField label="Unit" value={o.service.unit ?? o.unitNumber} />
            <CopyField label="City" value={o.service.city} />
            <CopyField label="State" value={o.service.state} />
            <CopyField label="ZIP code" value={o.service.zip} mono />
            <p className={`mt-2 text-xs font-semibold ${o.service.verified ? "text-mint-700" : "text-amber-ink"}`}>
              {o.service.verified ? "✓ Address verified" : "Address not yet verified — confirm in the provider portal"}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <CopyField label="Billing address" value={billingLine} />
            </div>
          </Section>

          <Section title="Selected plan" actions={<CopyGroupButton label="plan details" value={planLine} />}>
            <CopyField label="Selected plan" value={`${o.plan.providerName} ${o.plan.name}`} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-[10px] font-semibold uppercase text-slate-400">Advertised price</p><p className="font-bold">{formatPrice(o.advertisedPriceCents)}/mo</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-slate-400">Speed</p><p>{formatSpeed(o.plan.downloadMbps)} / {formatSpeed(o.plan.uploadMbps)}</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-slate-400">Type</p><p>{connectionLabel(o.plan.connectionType)}</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-slate-400">Availability</p><p>{o.availabilityStatus.replace(/_/g, " ").toLowerCase()}</p></div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {o.plan.priceConditions ?? ""} {o.plan.promoDescription ? `· ${o.plan.promoDescription}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Pricing source: {o.pricingSource}, checked {formatDate(o.pricingCheckedAt)}</p>
          </Section>

          <Section title="Request details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Requested install</dt><dd className="font-medium">{o.preferredInstallDate ? formatDate(o.preferredInstallDate) : "No preference"}{o.preferredInstallTime && o.preferredInstallTime !== "any" ? ` · ${o.preferredInstallTime}` : ""}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Submitted</dt><dd>{formatDateTime(o.submittedAt)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Property</dt><dd className="text-right">{o.property ? `${o.property.name}${o.property.externalId ? ` (${o.property.externalId})` : ""}` : "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Referral / campaign</dt><dd className="text-right">{[o.referralSource, o.campaign, o.utm.source].filter(Boolean).join(" · ") || "—"}</dd></div>
            </dl>
            {o.customerNotes && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-ink">
                <p className="text-[10px] font-bold uppercase">Customer notes</p>
                <p className="mt-1 whitespace-pre-wrap">{o.customerNotes}</p>
              </div>
            )}
          </Section>

          <Section title="Status history">
            <ol className="space-y-2 text-xs">
              {o.history.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-semibold text-slate-800">
                    {h.from ? `${statusLabel(h.from, o.provider.name)} → ` : ""}{statusLabel(h.to, o.provider.name)}
                  </p>
                  <p className="text-slate-500">{formatDateTime(h.at)} · {h.actor}{h.note ? ` — ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* RIGHT: processing tools */}
        <div className="space-y-4">
          <div className="grid gap-4 2xl:grid-cols-2">
            <Section title={`${o.provider.portalName ?? `${o.provider.name} order portal`}`}>
              <button className="btn-dark w-full py-3 text-base" onClick={openPortal} disabled={!canWork || !o.provider.hasPortal}>
                Open {o.provider.portalName ?? `${o.provider.name} portal`} ↗
              </button>
              {!o.provider.hasPortal && <p className="mt-2 text-xs text-red-600">No portal URL configured. Ask an administrator to set it under Providers.</p>}
              <p className="mt-2 text-xs text-slate-500">Opens in a new tab. Sign in with your own provider credentials and enter the order manually, copying fields from the left panel.</p>
              {o.provider.orderInstructions && (
                <details className="mt-3 text-sm" open>
                  <summary className="cursor-pointer text-xs font-bold uppercase text-slate-500">Order instructions</summary>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{o.provider.orderInstructions}</p>
                </details>
              )}
              {o.provider.enrollmentRequirements && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs font-bold uppercase text-slate-500">Enrollment requirements</summary>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{o.provider.enrollmentRequirements}</p>
                </details>
              )}
            </Section>

            <Section title="Order checklist">
              <ul className="space-y-1">
                {CHECKLIST_ITEMS.map((item) => {
                  const st = o.checklist[item.key];
                  return (
                    <li key={item.key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-mint-600"
                          checked={Boolean(st?.done)}
                          disabled={!canWork || busy === `ck-${item.key}`}
                          onChange={(e) => act(`ck-${item.key}`, `/api/agent/orders/${id}/checklist`, { key: item.key, done: e.target.checked })}
                        />
                        <span className={st?.done ? "text-slate-500 line-through" : "text-slate-800"}>
                          {item.label}
                          {st?.done && st.at && <span className="block text-[10px] text-slate-400 no-underline">{st.by} · {formatDateTime(st.at)}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <StatusControl order={o} canWork={canWork} busy={busy} onSubmit={(status, note) => act("status", `/api/agent/orders/${id}/status`, { status, note, expectedVersion: o.statusVersion }, "Status updated")} />
            <ConfirmationForm order={o} canWork={canWork} busy={busy} onSubmit={(body) => act("confirm", `/api/agent/orders/${id}/confirm`, { ...body, expectedVersion: o.statusVersion }, "Confirmation recorded and customer notified")} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <Messaging messages={messages} canWork={canWork || (viewer.canWork && o.status === "PROVIDER_ORDER_CONFIRMED")} busy={busy} onSend={(body) => act("msg", `/api/agent/orders/${id}/messages`, body)} />
            <Notes notes={o.notes} canWork={viewer.canWork} busy={busy} onAdd={(body) => act("note", `/api/agent/orders/${id}/notes`, { body }, "Note saved")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusControl({ order, canWork, busy, onSubmit }: { order: AgentOrderView; canWork: boolean; busy: string | null; onSubmit: (s: string, note: string) => Promise<boolean> }) {
  const options = allowedNextStatuses(order.status).filter((s) => AGENT_SETTABLE.includes(s) && s !== "PROVIDER_ORDER_CONFIRMED");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  return (
    <Section title="Order status">
      <p className="text-sm">Current: <span className="font-semibold">{statusLabel(order.status, order.provider.name)}</span></p>
      {canWork && options.length > 0 ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSubmit(status, note)) {
              setStatus("");
              setNote("");
            }
          }}
        >
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} required aria-label="New status">
            <option value="">Change status to…</option>
            {options.map((s) => <option key={s} value={s}>{statusLabel(s, order.provider.name)}</option>)}
          </select>
          <textarea className="input" rows={2} placeholder={status === "UNABLE_TO_COMPLETE" ? "Reason (required — shared with the customer)" : "Internal note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          <button className="btn-outline w-full" disabled={!status || busy === "status"}>{busy === "status" ? "Saving…" : "Update status"}</button>
          <p className="text-[11px] text-slate-500">Use the confirmation form to mark an order confirmed.</p>
        </form>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{canWork ? "No manual status changes available." : "Status changes are disabled for this order."}</p>
      )}
    </Section>
  );
}

function ConfirmationForm({ order, canWork, busy, onSubmit }: { order: AgentOrderView; canWork: boolean; busy: string | null; onSubmit: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [f, setF] = useState({
    confirmationNumber: "",
    confirmedPlanName: `${order.plan.name}`,
    confirmedPrice: (order.advertisedPriceCents / 100).toFixed(2),
    confirmedInstallDate: order.preferredInstallDate ?? "",
    orderSubmittedAt: "",
    notes: "",
  });
  if (order.confirmation) {
    const c = order.confirmation;
    return (
      <Section title={`${order.provider.name} confirmation`}>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">{order.provider.confirmationNumberLabel}</dt><dd className="font-mono font-bold">{c.number}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd>{c.planName}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Price</dt><dd>{formatPrice(c.priceCents)}/mo</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Install date</dt><dd>{c.installDate ? formatDate(c.installDate) : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Submitted</dt><dd>{formatDateTime(c.submittedAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Confirmed by</dt><dd>{c.confirmedBy} · {formatDateTime(c.confirmedAt)}</dd></div>
        </dl>
        {c.notes && <p className="mt-2 text-xs text-slate-600">{c.notes}</p>}
      </Section>
    );
  }
  const eligible = canWork && ["AGENT_PROCESSING", "SUBMITTED_TO_PROVIDER"].includes(order.status);
  return (
    <Section title={`Record ${order.provider.name} confirmation`}>
      {!eligible ? (
        <p className="text-xs text-slate-500">Available once the order is being processed or has been submitted to {order.provider.name}.</p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!window.confirm(`Record ${order.provider.name} ${order.provider.confirmationNumberLabel.toLowerCase()} ${f.confirmationNumber}? The customer will be emailed a confirmation.`)) return;
            onSubmit({
              confirmationNumber: f.confirmationNumber,
              confirmedPlanName: f.confirmedPlanName,
              confirmedPriceCents: Math.round(Number(f.confirmedPrice) * 100),
              confirmedInstallDate: f.confirmedInstallDate || null,
              orderSubmittedAt: f.orderSubmittedAt ? new Date(f.orderSubmittedAt).toISOString() : null,
              notes: f.notes || null,
            });
          }}
        >
          <label className="block text-xs font-semibold text-slate-600">{order.provider.confirmationNumberLabel}
            <input className="input mt-1 font-mono" value={f.confirmationNumber} onChange={(e) => setF({ ...f, confirmationNumber: e.target.value.trim() })} required minLength={4} maxLength={40} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">Confirmed plan
              <input className="input mt-1" value={f.confirmedPlanName} onChange={(e) => setF({ ...f, confirmedPlanName: e.target.value })} required />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Confirmed monthly price ($)
              <input className="input mt-1" inputMode="decimal" value={f.confirmedPrice} onChange={(e) => setF({ ...f, confirmedPrice: e.target.value })} required pattern="\d+(\.\d{1,2})?" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Installation date
              <input type="date" className="input mt-1" value={f.confirmedInstallDate} onChange={(e) => setF({ ...f, confirmedInstallDate: e.target.value })} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Order submitted at
              <input type="datetime-local" className="input mt-1" value={f.orderSubmittedAt} onChange={(e) => setF({ ...f, orderSubmittedAt: e.target.value })} />
            </label>
          </div>
          {Number(f.confirmedPrice) * 100 !== order.advertisedPriceCents && f.confirmedPrice && (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-ink">Confirmed price differs from the advertised {formatPrice(order.advertisedPriceCents)}. Make sure the customer approved the revised price.</p>
          )}
          <textarea className="input" rows={2} placeholder="Confirmation notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} />
          <button className="btn-primary w-full" disabled={busy === "confirm"}>{busy === "confirm" ? "Saving…" : "Record verified confirmation"}</button>
          <p className="text-[11px] text-slate-500">Only record a confirmation number you received from {order.provider.name}. This emails the customer.</p>
        </form>
      )}
    </Section>
  );
}

const KINDS = [
  ["TEXT", "Message"],
  ["QUESTION", "Ask a question"],
  ["INFO_REQUEST", "Request missing info"],
  ["INSTALL_OPTIONS", "Present install options"],
  ["PRICE_CHANGE", "Request price approval"],
  ["PROGRESS", "Progress update"],
] as const;

function Messaging({ messages, canWork, busy, onSend }: { messages: ChatMessage[]; canWork: boolean; busy: string | null; onSend: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("TEXT");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState("");
  const [price, setPrice] = useState("");
  const [planName, setPlanName] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages.length]);
  const byId = new Map(messages.map((m) => [m.id, m]));

  return (
    <Section title="Customer messages">
      <div className="max-h-80 min-h-32 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2">
        {messages.length === 0 && <p className="p-2 text-xs text-slate-500">No messages yet.</p>}
        {messages.map((m) => {
          const p = (m.payload ?? {}) as { options?: string[]; newPriceCents?: number; decision?: string; option?: string };
          const original = m.responseToId ? byId.get(m.responseToId) : null;
          return (
            <div key={m.id} className={`flex ${m.sender === "AGENT" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender === "AGENT" ? "bg-navy-900 text-white" : m.sender === "SYSTEM" ? "bg-mint-50 text-mint-700" : "bg-white text-slate-800 shadow-sm"}`}>
                <p className="text-[10px] font-semibold opacity-70">{m.sender === "CUSTOMER" ? "Customer" : m.sender === "SYSTEM" ? "System" : m.authorName} · {m.kind.replace(/_/g, " ").toLowerCase()}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {p.options && <p className="mt-1 text-xs opacity-80">Options: {p.options.join(" | ")}</p>}
                {p.newPriceCents !== undefined && m.kind === "PRICE_CHANGE" && <p className="mt-1 text-xs opacity-80">Revised: {formatPrice(p.newPriceCents)}/mo</p>}
                {p.decision && <p className={`mt-1 text-xs font-bold ${p.decision === "approve" ? "text-mint-700" : "text-red-600"}`}>Customer {p.decision === "approve" ? "APPROVED" : "DECLINED"} revised price</p>}
                {p.option && <p className="mt-1 text-xs font-bold">Selected: {p.option}</p>}
                {original && <p className="mt-1 text-[10px] opacity-60">In reply to: “{original.body.slice(0, 60)}”</p>}
                <p className="mt-0.5 text-[10px] opacity-60">{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {canWork && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const payload: Record<string, unknown> = { kind, body };
            if (kind === "INSTALL_OPTIONS") payload.options = options.split("\n").map((s) => s.trim()).filter(Boolean);
            if (kind === "PRICE_CHANGE") {
              payload.newPriceCents = Math.round(Number(price) * 100);
              payload.newPlanName = planName || undefined;
            }
            if (await onSend(payload)) {
              setBody("");
              setOptions("");
              setPrice("");
              setPlanName("");
              setKind("TEXT");
            }
          }}
        >
          <select className="input py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Message type">
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <textarea className="input text-sm" rows={2} maxLength={2000} required placeholder={kind === "INFO_REQUEST" ? "What do you need from the customer? (status changes to Additional Information Required)" : "Message to the customer"} value={body} onChange={(e) => setBody(e.target.value)} />
          {kind === "INSTALL_OPTIONS" && (
            <textarea className="input text-sm" rows={3} required placeholder={"One option per line, e.g.\nTue Nov 3, 8am–12pm\nWed Nov 4, 1pm–5pm"} value={options} onChange={(e) => setOptions(e.target.value)} />
          )}
          {kind === "PRICE_CHANGE" && (
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" inputMode="decimal" required placeholder="New price $/mo" value={price} onChange={(e) => setPrice(e.target.value)} />
              <input className="input text-sm" placeholder="Plan name (if changed)" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
          )}
          <button className="btn-dark w-full" disabled={busy === "msg"}>{busy === "msg" ? "Sending…" : "Send to customer"}</button>
        </form>
      )}
    </Section>
  );
}

function Notes({ notes, canWork, busy, onAdd }: { notes: AgentOrderView["notes"]; canWork: boolean; busy: string | null; onAdd: (b: string) => Promise<boolean> }) {
  const [body, setBody] = useState("");
  return (
    <Section title="Internal notes (not visible to customer)">
      {canWork && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAdd(body)) setBody("");
          }}
        >
          <textarea className="input text-sm" rows={2} maxLength={4000} required placeholder="Add an internal note…" value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-outline w-full" disabled={busy === "note"}>{busy === "note" ? "Saving…" : "Save note"}</button>
        </form>
      )}
      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {notes.length === 0 && <li className="text-xs text-slate-500">No notes yet.</li>}
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg bg-amber-50/60 p-2 text-sm">
            <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
            <p className="mt-1 text-[10px] text-slate-500">{n.author} · {formatDateTime(n.at)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
