"use client";

import { useEffect, useRef, useState } from "react";

export type StreamEvent = { type: string; data: Record<string, unknown> };

const EVENT_TYPES = [
  "enrollment.created",
  "enrollment.updated",
  "enrollment.assigned",
  "enrollment.unassigned",
  "message.created",
  "queue.changed",
  "agent.availability",
];

/**
 * Subscribes to a server-sent-event stream. EventSource reconnects automatically and resumes
 * from Last-Event-ID; a slow fallback poll covers networks/proxies that block streaming.
 */
export function useEventStream(url: string | null, onEvent: (e: StreamEvent) => void, fallbackPollMs = 30_000) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    const listeners: [string, (ev: MessageEvent) => void][] = [];
    es.addEventListener("ready", () => setConnected(true));
    es.onerror = () => setConnected(false);
    for (const t of EVENT_TYPES) {
      const fn = (ev: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(ev.data);
        } catch {
          /* ignore */
        }
        handler.current({ type: t, data });
      };
      es.addEventListener(t, fn as EventListener);
      listeners.push([t, fn]);
    }
    const poll = setInterval(() => handler.current({ type: "poll", data: {} }), fallbackPollMs);
    return () => {
      clearInterval(poll);
      for (const [t, fn] of listeners) es.removeEventListener(t, fn as EventListener);
      es.close();
    };
  }, [url, fallbackPollMs]);

  return { connected };
}

export function useTitleBadge(count: number, base: string) {
  useEffect(() => {
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, base]);
}

/** Short notification chime via WebAudio (no asset needed). */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio unavailable */
  }
}

export function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
    new Notification(title, { body, icon: "/icon.svg" });
  } catch {
    /* ignore */
  }
}
