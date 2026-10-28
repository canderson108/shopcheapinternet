"use client";

import { useState } from "react";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${copied ? "border-mint-500 bg-mint-50 text-mint-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"} ${className}`}
      aria-label={`Copy ${label}`}
      disabled={!value}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function CopyField({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  const v = value ?? "";
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`truncate text-sm text-slate-900 ${mono ? "font-mono" : "font-medium"}`} title={v}>{v || <span className="text-slate-300">—</span>}</p>
      </div>
      {v && <CopyButton value={v} label={label} />}
    </div>
  );
}

export function CopyGroupButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${copied ? "border-mint-500 bg-mint-50 text-mint-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
    >
      {copied ? "Copied ✓" : `Copy ${label}`}
    </button>
  );
}
