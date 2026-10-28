import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { LogoMark } from "@/components/Logo";
import { LogoutButton } from "@/components/staff/AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/enrollments", label: "Enrollments" },
  { href: "/agent", label: "Agent workspace" },
  { href: "/admin/agents", label: "Staff & agents", adminOnly: true },
  { href: "/admin/properties", label: "Properties", adminOnly: true },
  { href: "/admin/providers", label: "Providers", adminOnly: true },
  { href: "/admin/plans", label: "Plans & pricing", adminOnly: true },
  { href: "/admin/campaigns", label: "Referrals & campaigns", adminOnly: true },
  { href: "/admin/audit", label: "Audit log", adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage(["MANAGER", "ADMIN"]);
  const isAdmin = ctx.user.role === "ADMIN";
  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="bg-navy-950 text-slate-300 lg:min-h-screen">
        <div className="flex items-center justify-between gap-2 px-4 py-4 lg:block">
          <Link href="/admin" className="flex items-center gap-2 font-display text-sm font-extrabold text-white">
            <LogoMark className="h-7 w-7" /> Admin
          </Link>
          <p className="mt-0 text-xs text-slate-500 lg:mt-3">{ctx.user.name} · {ctx.user.role.toLowerCase()}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:pb-0" aria-label="Admin">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
          <div className="px-1 pt-2 lg:pt-6">
            <LogoutButton className="rounded-lg px-2 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white" />
          </div>
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
