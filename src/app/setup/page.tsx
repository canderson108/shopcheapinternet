import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/staff/AuthShell";
import { SetupForm } from "@/components/staff/AuthForms";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "First-time setup", robots: { index: false } };

export default async function SetupPage() {
  const count = await prisma.staffUser.count();
  if (count > 0) redirect("/staff/login");
  if (!env.setupToken) {
    return (
      <AuthShell title="Setup is disabled">
        <p className="text-sm text-slate-600">
          Set the <code>SETUP_TOKEN</code> environment variable to a long random value and redeploy, then return here to create the first administrator.
          Alternatively run <code>npm run create-admin</code> against the production database.
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create the first administrator" subtitle="This page works only until the first staff account exists.">
      <SetupForm />
    </AuthShell>
  );
}
