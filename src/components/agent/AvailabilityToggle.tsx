"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";

const OPTS = [
  { v: "AVAILABLE", label: "Available", cls: "bg-mint-500 text-navy-950" },
  { v: "BUSY", label: "Busy", cls: "bg-amber-400 text-navy-950" },
  { v: "OFFLINE", label: "Offline", cls: "bg-slate-500 text-white" },
] as const;

export function AvailabilityToggle({ initial }: { initial: "AVAILABLE" | "BUSY" | "OFFLINE" }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function set(v: (typeof OPTS)[number]["v"]) {
    if (v === value) return;
    setBusy(true);
    try {
      await api("/api/agent/availability", { body: { availability: v } });
      setValue(v);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Couldn't update availability");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="radiogroup" aria-label="Your availability" className="flex rounded-lg bg-white/10 p-0.5">
      {OPTS.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          disabled={busy}
          onClick={() => set(o.v)}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${value === o.v ? o.cls : "text-slate-300 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
