"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";

export function RequestLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMsg(null);
    try {
      const r = await api<{ message: string }>("/api/enrollments/link", { body: { email } });
      setMsg(r.message);
      setState("sent");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <label className="label" htmlFor="link-email">Email address</label>
      <input id="link-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <button className="btn-primary w-full" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a secure link"}</button>
      {msg && <p role="status" className="text-sm text-slate-600">{msg}</p>}
    </form>
  );
}
