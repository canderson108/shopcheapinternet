"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { browserNotify, chime, useEventStream, type StreamEvent } from "@/lib/use-event-stream";

type Listener = (e: StreamEvent) => void;
type Ctx = { subscribe: (fn: Listener) => () => void; connected: boolean };

const RealtimeContext = createContext<Ctx>({ subscribe: () => () => undefined, connected: false });

/**
 * One SSE connection per agent tab, shared by every component on the page.
 * Also raises notifications for new assignments and customer replies.
 */
export function AgentRealtimeProvider({ agentId, children }: { agentId: string; children: React.ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [toast, setToast] = useState<string | null>(null);

  const onEvent = useCallback(
    (e: StreamEvent) => {
      if (e.type === "enrollment.assigned" && e.data.agentId === agentId) {
        chime();
        browserNotify("New enrollment assigned", "A new customer enrollment is waiting for you.");
        setToast("New enrollment assigned to you");
      }
      if (e.type === "message.created" && e.data.sender === "CUSTOMER" && e.data.channel === `agent:${agentId}`) {
        chime();
        browserNotify("Customer replied", "A customer sent you a new message.");
        setToast("New customer message");
      }
      if (e.type === "enrollment.created") browserNotify("New enrollment request", "A new enrollment was submitted.");
      for (const fn of listeners.current) fn(e);
    },
    [agentId],
  );

  const { connected } = useEventStream("/api/agent/events", onEvent, 20_000);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe, connected }}>
      {children}
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-50 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          🔔 {toast}
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

export function useAgentRealtime(fn: Listener) {
  const ctx = useContext(RealtimeContext);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => ctx.subscribe((e) => ref.current(e)), [ctx]);
  return ctx.connected;
}

export function LiveDot() {
  const { connected } = useContext(RealtimeContext);
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-mint-400" : "bg-slate-500"}`} aria-hidden />
      {connected ? "Live" : "Reconnecting"}
    </span>
  );
}

export function EnableNotifications() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);
  if (perm !== "default") return null;
  return (
    <button className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20" onClick={() => Notification.requestPermission().then(setPerm)}>
      Enable desktop alerts
    </button>
  );
}
