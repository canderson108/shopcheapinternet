import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/staff/AuthShell";
import { LogoutButton, MfaSetupForm } from "@/components/staff/AuthForms";
import { getStaffContext } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up two-factor authentication", robots: { index: false } };

export default async function MfaSetupPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/staff/login");
  if (ctx.user.mfaEnabled) redirect(ctx.mfaVerified ? "/agent" : "/staff/mfa");
  return (
    <AuthShell title="Set up two-factor authentication" subtitle="Required for all staff accounts because you'll access customer information.">
      <MfaSetupForm />
      <div className="mt-4 text-center"><LogoutButton /></div>
    </AuthShell>
  );
}
