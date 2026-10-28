"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>(url, { body });
      router.push(r.next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function LoginForm() {
  const { busy, error, run } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run("/api/staff/login", { email, password }); }}>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-dark w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function MfaForm() {
  const { busy, error, run } = useSubmit();
  const [code, setCode] = useState("");
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run("/api/staff/mfa/verify", { code }); }}>
      <div>
        <label className="label" htmlFor="code">6-digit code from your authenticator app</label>
        <input id="code" className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-dark w-full" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify"}</button>
    </form>
  );
}

export function MfaSetupForm() {
  const { busy, error, run } = useSubmit();
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    api<{ qr: string; secret: string }>("/api/staff/mfa/setup").then(setQr).catch((e) => setLoadError(e instanceof ApiError ? e.message : "Couldn't start setup."));
  }, []);
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator).</li>
        <li>Scan this QR code, or enter the setup key manually.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      {qr ? (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qr} alt="Authenticator QR code" width={220} height={220} className="rounded-xl border border-slate-200" />
          <code className="select-all break-all rounded bg-slate-100 px-2 py-1 text-xs">{qr.secret}</code>
        </div>
      ) : (
        <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-xl bg-slate-100" />
      )}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run("/api/staff/mfa/setup", { code }); }}>
        <input aria-label="6-digit code" className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="btn-dark w-full" disabled={busy || code.length !== 6 || !qr}>{busy ? "Enabling…" : "Enable two-factor authentication"}</button>
      </form>
    </div>
  );
}

export function SetupForm() {
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({ token: "", name: "", email: "", password: "" });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run("/api/setup", f); }}>
      <div>
        <label className="label" htmlFor="token">Setup token (SETUP_TOKEN environment variable)</label>
        <input id="token" type="password" className="input" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input id="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (12+ characters, letters and numbers)</label>
        <input id="password" type="password" className="input" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-dark w-full" disabled={busy}>{busy ? "Creating…" : "Create administrator"}</button>
    </form>
  );
}

export function LogoutButton({ className = "btn-ghost btn-sm" }: { className?: string }) {
  const { busy, run } = useSubmit();
  return (
    <button className={className} disabled={busy} onClick={() => run("/api/staff/logout", {})}>
      Sign out
    </button>
  );
}
