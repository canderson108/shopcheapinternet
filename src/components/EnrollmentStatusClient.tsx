"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomerView } from "@/lib/services/views";
import type { ChatMessage } from "@/lib/services/messages";
import { api, ApiError } from "@/lib/api-client";
import { useEventStream } from "@/lib/use-event-stream";
import { CUSTOMER_CANCELABLE, CUSTOMER_MILESTONES, customerStatusDescription, milestoneIndex, statusLabel } from "@/lib/status";
import { connectionLabel, formatDate, formatDateTime, formatPrice, formatSpeed } from "@/lib/format";

export function EnrollmentStatusClient({ initialView, initialMessages }: { initialView: CustomerView; initialMessages: ChatMessage[] }) {
  const [view, setView] = useState(initialView);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const pid = view.publicId;

  const refresh = useCallback(async () => {
    try {
      const [v, m] = await Promise.all([api<CustomerView>(`/api/enrollments/${pid}`), api<{ messages: ChatMessage[] }>(`/api/enrollments/${pid}/messages`)]);
      setView(v);
      setMessages(m.messages);
    } catch {
      /* transient */
    }
  }, [pid]);

  const { connected } = useEventStream(`/api/enrollments/${pid}/events`, () => refresh());

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function send(body: string, extra: Record<string, unknown> = {}) {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/enrollments/${pid}/messages`, { body: { body, ...extra } });
      setDraft("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Message failed to send.");
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    const reason = window.prompt("Cancel this enrollment request? You can tell us why (optional):");
    if (reason === null) return;
    setCanceling(true);
    try {
      await api(`/api/enrollments/${pid}/cancel`, { body: { reason } });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't cancel. Please message your specialist.");
    } finally {
      setCanceling(false);
    }
  }

  const step = milestoneIndex(view.status);
  const closed = ["CUSTOMER_CANCELED", "UNABLE_TO_COMPLETE"].includes(view.status);
  const answered = new Set(messages.filter((m) => m.responseToId).map((m) => m.responseToId));

  return (
    <div className="container-page grid gap-8 py-8 md:py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div>
          <p className="eyebrow">Reference {view.publicId}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy-900 sm:text-3xl">
            {view.status === "PROVIDER_ORDER_CONFIRMED" ? `Your ${view.providerName} order is confirmed` : `Thanks, ${view.firstName}. Here's your enrollment status.`}
          </h1>
        </div>

        {/* Status card */}
        <section className="card p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`badge ${closed ? "bg-slate-100 text-slate-700" : view.status === "PROVIDER_ORDER_CONFIRMED" ? "bg-mint-600 text-white" : view.status === "ADDITIONAL_INFO_REQUIRED" ? "bg-amber-100 text-amber-ink" : "bg-navy-900 text-white"}`}>
              {statusLabel(view.status, view.providerName)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-mint-500" : "bg-slate-300"}`} aria-hidden />
              {connected ? "Live updates on" : "Reconnecting…"}
            </span>
          </div>
          <p className="mt-3 text-slate-700">{customerStatusDescription(view.status, view.providerName)}</p>
          {view.agentFirstName && !closed && view.status !== "PROVIDER_ORDER_CONFIRMED" && (
            <p className="mt-2 text-sm text-slate-600">Your specialist: <span className="font-semibold text-navy-900">{view.agentFirstName}</span></p>
          )}
          {!closed && (
            <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Progress">
              {CUSTOMER_MILESTONES.map((m, i) => (
                <li key={m.key} className="text-center">
                  <div className={`h-1.5 rounded-full ${i <= step ? "bg-mint-500" : "bg-slate-200"}`} />
                  <p className={`mt-2 text-[11px] font-semibold sm:text-xs ${i <= step ? "text-navy-900" : "text-slate-400"}`}>{m.label}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Confirmation */}
        {view.confirmation && (
          <section className="rounded-2xl border-2 border-mint-500 bg-mint-50 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-navy-900">{view.providerName} confirmation</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">{view.confirmationNumberLabel}</dt><dd className="font-mono text-lg font-bold text-navy-900">{view.confirmation.number}</dd></div>
              <div><dt className="text-slate-500">Plan</dt><dd className="font-semibold">{view.confirmation.planName}</dd></div>
              <div><dt className="text-slate-500">Monthly price</dt><dd className="font-semibold">{formatPrice(view.confirmation.priceCents)}/mo</dd></div>
              <div><dt className="text-slate-500">Installation / activation</dt><dd className="font-semibold">{view.confirmation.installDate ? formatDate(view.confirmation.installDate) : `${view.providerName} will schedule with you`}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-600">Confirmed {formatDateTime(view.confirmation.confirmedAt)}. A copy was emailed to you. Taxes and fees may apply per {view.providerName}&apos;s terms.</p>
          </section>
        )}

        {/* Messages */}
        <section className="card flex flex-col" aria-labelledby="msgs">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="msgs" className="font-bold text-navy-900">Messages with your specialist</h2>
            <p className="text-xs text-slate-500">You can leave this page — we&apos;ll email you when there&apos;s an update.</p>
          </div>
          <div className="max-h-[28rem] min-h-40 space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet. Your specialist will reach out here if they need anything.</p>}
            {messages.map((m) => {
              const mine = m.sender === "CUSTOMER";
              const payload = (m.payload ?? {}) as { options?: string[]; newPriceCents?: number; newPlanName?: string | null; decision?: string; option?: string };
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-navy-900 text-white" : m.sender === "SYSTEM" ? "bg-mint-50 text-mint-700" : "bg-slate-100 text-slate-800"}`}>
                    {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.sender === "SYSTEM" ? "Shop Cheap Internet" : `${m.authorName ?? "Specialist"} · Specialist`}</p>}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.kind === "INSTALL_OPTIONS" && !answered.has(m.id) && !closed && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(payload.options ?? []).map((o) => (
                          <button key={o} className="rounded-full border border-mint-600 bg-white px-3 py-1 text-xs font-semibold text-mint-700 hover:bg-mint-50" disabled={sending} onClick={() => send(`I'd like: ${o}`, { responseToId: m.id, option: o })}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.kind === "PRICE_CHANGE" && (
                      <p className="mt-1 text-xs font-semibold">
                        Revised price: {formatPrice(payload.newPriceCents ?? 0)}/mo{payload.newPlanName ? ` · ${payload.newPlanName}` : ""}
                      </p>
                    )}
                    {m.kind === "PRICE_CHANGE" && !answered.has(m.id) && !closed && (
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary btn-sm" disabled={sending} onClick={() => send("I approve the revised price.", { responseToId: m.id, decision: "approve" })}>Approve</button>
                        <button className="btn-outline btn-sm" disabled={sending} onClick={() => send("I don't approve the revised price.", { responseToId: m.id, decision: "decline" })}>Decline</button>
                      </div>
                    )}
                    <p className={`mt-1 text-[10px] ${mine ? "text-slate-300" : "text-slate-400"}`}>{formatDateTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
          {!closed && (
            <form
              className="border-t border-slate-100 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <label htmlFor="chat" className="sr-only">Message</label>
              <div className="flex gap-2">
                <input id="chat" className="input" placeholder="Type a message…" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="btn-primary" disabled={sending || !draft.trim()}>{sending ? "…" : "Send"}</button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">Never send Social Security or card numbers in chat.</p>
            </form>
          )}
          {error && <p role="alert" className="px-4 pb-4 text-sm text-red-600">{error}</p>}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Requested plan</h2>
          <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{view.providerName}</p>
          <p className="text-lg font-bold text-navy-900">{view.plan.name}</p>
          <p className="text-sm text-slate-600">{connectionLabel(view.plan.connectionType)} · {formatSpeed(view.plan.downloadMbps)} / {formatSpeed(view.plan.uploadMbps)}</p>
          <p className="mt-2 text-sm"><span className="font-bold text-navy-900">{formatPrice(view.advertisedPriceCents)}/mo</span> <span className="text-slate-500">advertised</span></p>
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            {view.propertyName && <p className="font-medium">{view.propertyName}</p>}
            <p>{view.serviceAddress.street}{view.serviceAddress.unit ? `, Unit ${view.serviceAddress.unit}` : ""}</p>
            <p>{view.serviceAddress.city}, {view.serviceAddress.state} {view.serviceAddress.zip}</p>
            {view.preferredInstallDate && <p className="mt-2">Preferred date: {formatDate(view.preferredInstallDate)}</p>}
            <p className="mt-2 text-xs text-slate-500">Submitted {formatDateTime(view.submittedAt)}</p>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {view.timeline.map((t, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-slate-700">{statusLabel(t.status, view.providerName)}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(t.at)}</span>
              </li>
            ))}
          </ol>
        </div>
        {CUSTOMER_CANCELABLE.includes(view.status) && (
          <button className="btn-danger w-full" onClick={cancel} disabled={canceling}>{canceling ? "Canceling…" : "Cancel this request"}</button>
        )}
      </aside>
    </div>
  );
}
