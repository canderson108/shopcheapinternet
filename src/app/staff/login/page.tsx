import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/staff/AuthShell";
import { LoginForm } from "@/components/staff/AuthForms";
import { getStaffContext } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function StaffLoginPage() {
  const ctx = await getStaffContext();
  if (ctx?.mfaVerified) redirect(ctx.user.role === "AGENT" ? "/agent" : "/admin");
  return (
    <AuthShell title="Staff sign in" subtitle="Agents, managers, and administrators">
      <LoginForm />
    </AuthShell>
  );
}
