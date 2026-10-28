import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/staff/AuthShell";
import { LogoutButton, MfaForm } from "@/components/staff/AuthForms";
import { getStaffContext } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Two-factor verification", robots: { index: false } };

export default async function MfaPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/staff/login");
  if (ctx.mfaVerified) redirect(ctx.user.role === "AGENT" ? "/agent" : "/admin");
  if (!ctx.user.mfaEnabled) redirect("/staff/mfa/setup");
  return (
    <AuthShell title="Two-factor verification" subtitle={`Signed in as ${ctx.user.email}`}>
      <MfaForm />
      <div className="mt-4 text-center"><LogoutButton /></div>
    </AuthShell>
  );
}
