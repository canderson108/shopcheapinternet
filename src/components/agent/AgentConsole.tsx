"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { QueueItem } from "@/lib/services/views";
import { api, ApiError } from "@/lib/api-client";
import { formatPrice, relativeTime } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { useTitleBadge } from "@/lib/use-event-stream";
import { useAgentRealtime } from "./AgentRealtime";

type QueueResponse = {
  me: { id: string; name: string; role: string; availability: string; maxActiveOrders: number };
  agents: { id: string; name: string; availability: string }[];
  mine: QueueItem[];
  waiting: QueueItem[];
  team: QueueItem[];
  recentClosed: QueueItem[];
};

const STATUS_STYLE: Record<string, string> = {
  WAITING_FOR_AGENT: "bg-amber-100 text-amber-ink",
  AGENT_ASSIGNED: "bg-navy-100 text-navy-800",
  AGENT_PROCESSING: "bg-blue-100 text-blue-800",
  ADDITIONAL_INFO_REQUIRED: "bg-orange-100 text-orange-800",
  SUBMITTED_TO_PROVIDER: "bg-violet-100 text-violet-800",
  PROVIDER_ORDER_CONFIRMED: "bg-mint-50 text-mint-700",
  UNABLE_TO_COMPLETE: "bg-red-50 text-red-700",
  CUSTOMER_CANCELED: "bg-slate-100 text-slate-600",
};

export function StatusPill({ status, provider }: { status: string; provider: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700"}`}>{statusLabel(status as never, provider)}</span>;
}

function Row({ item, action }: { item: QueueItem; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <Link href={`/agent/orders/${item.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-navy-900">{item.customerName}</span>
          <StatusPill status={item.status} provider={item.providerName} />
          {item.unreadForAgent > 0 && <span className="badge bg-red-600 text-white">{item.unreadForAgent} new message{item.unreadForAgent > 1 ? "s" : ""}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.publicId} · {item.providerName} {item.planLabel} · {formatPrice(item.priceCents)}/mo · {item.city}, {item.state}
          {item.propertyName ? ` · ${item.propertyName}` : ""}
          {item.assignedAgentName && item.status !== "WAITING_FOR_AGENT" ? ` · ${item.assignedAgentName}` : ""}
        </p>
      </Link>
      <span className="text-xs text-slate-400" title={item.submittedAt}>{relativeTime(item.submittedAt)}</span>
      {action}
    </li>
  );
}

export function AgentConsole() {
  const router = useRouter();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<QueueResponse>("/api/agent/queue"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load the queue.");
      if (e instanceof ApiError && e.status === 401) router.push("/staff/login");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);
  useAgentRealtime(() => load());

  const unread = data?.mine.reduce((a, m) => a + m.unreadForAgent, 0) ?? 0;
  useTitleBadge((data?.waiting.length ?? 0) + unread, "Agent workspace · Shop Cheap Internet");

  async function claim(id: string) {
    setClaiming(id);
    try {
      await api(`/api/agent/orders/${id}/claim`, { body: {} });
      router.push(`/agent/orders/${id}`);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Couldn't claim this order.");
      setClaiming(null);
      load();
    }
  }

  if (!data) {
    return <div className="p-6 text-sm text-slate-500">{error ?? "Loading queue…"}</div>;
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h1 className="font-bold text-navy-900">My active orders <span className="text-slate-400">({data.mine.length}/{data.me.maxActiveOrders})</span></h1>
            {data.me.availability !== "AVAILABLE" && <span className="text-xs text-amber-ink">You&apos;re {data.me.availability.toLowerCase()} — new orders won&apos;t be auto-assigned.</span>}
          </div>
          {data.mine.length ? (
            <ul className="divide-y divide-slate-100">{data.mine.map((i) => <Row key={i.id} item={i} />)}</ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No active orders. Set yourself to Available to receive new enrollments automatically.</p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-bold text-navy-900">Waiting queue <span className="text-slate-400">({data.waiting.length})</span></h2>
            <p className="text-xs text-slate-500">Oldest first. Orders here weren&apos;t auto-assigned because no agent had capacity.</p>
          </div>
          {data.waiting.length ? (
            <ul className="divide-y divide-slate-100">
              {data.waiting.map((i) => (
                <Row key={i.id} item={i} action={<button className="btn-primary btn-sm" disabled={claiming !== null} onClick={() => claim(i.id)}>{claiming === i.id ? "Claiming…" : "Claim"}</button>} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Queue is empty.</p>
          )}
        </section>

        {data.team.length > 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-bold text-navy-900">Team orders in progress <span className="text-slate-400">({data.team.length})</span></h2>
            </div>
            <ul className="divide-y divide-slate-100">{data.team.map((i) => <Row key={i.id} item={i} />)}</ul>
          </section>
        )}
      </div>

      <aside className="space-y-5">
        <section className="card p-4">
          <h2 className="text-sm font-bold text-navy-900">Agents</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className={a.id === data.me.id ? "font-semibold" : ""}>{a.name}</span>
                <span className={`badge ${a.availability === "AVAILABLE" ? "bg-mint-50 text-mint-700" : a.availability === "BUSY" ? "bg-amber-100 text-amber-ink" : "bg-slate-100 text-slate-500"}`}>{a.availability.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
        {data.recentClosed.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-navy-900">Recently closed</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recentClosed.map((i) => (
                <li key={i.id} className="px-4 py-2">
                  <Link href={`/agent/orders/${i.id}`} className="font-medium text-navy-900 hover:underline">{i.customerName}</Link>
                  <div className="mt-0.5"><StatusPill status={i.status} provider={i.providerName} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
