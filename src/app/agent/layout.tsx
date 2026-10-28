import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage, isManager } from "@/lib/auth/staff";
import { prisma } from "@/lib/db";
import { LogoMark } from "@/components/Logo";
import { LogoutButton } from "@/components/staff/AuthForms";
import { AgentRealtimeProvider, EnableNotifications, LiveDot } from "@/components/agent/AgentRealtime";
import { AvailabilityToggle } from "@/components/agent/AvailabilityToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Agent workspace", template: "%s · Agent" }, robots: { index: false } };

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  const profile = await prisma.agentProfile.upsert({
    where: { staffUserId: ctx.user.id },
    create: { staffUserId: ctx.user.id },
    update: {},
  });
  return (
    <AgentRealtimeProvider agentId={ctx.user.id}>
      <div className="min-h-screen bg-slate-100">
        <header className="sticky top-0 z-40 bg-navy-950 text-white">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <Link href="/agent" className="flex items-center gap-2 font-display text-sm font-extrabold">
                <LogoMark className="h-7 w-7" /> <span className="hidden sm:inline">Agent workspace</span>
              </Link>
              <LiveDot />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <EnableNotifications />
              <AvailabilityToggle initial={profile.availability} />
              {isManager(ctx.user.role) && (
                <Link href="/admin" className="hidden rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white sm:inline">
                  Admin
                </Link>
              )}
              <span className="hidden text-xs text-slate-400 md:inline">{ctx.user.name}</span>
              <LogoutButton className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white" />
            </div>
          </div>
        </header>
        {children}
      </div>
    </AgentRealtimeProvider>
  );
}
