import { prisma } from "@/lib/db";
import { isManager, requireStaffApi } from "@/lib/auth/staff";
import { getAgentQueues } from "@/lib/services/views";
import { json, route } from "@/lib/http";

export const GET = route(async () => {
  const ctx = await requireStaffApi();
  const [queues, profile, agents] = await Promise.all([
    getAgentQueues(ctx.user.id, isManager(ctx.user.role)),
    prisma.agentProfile.findUnique({ where: { staffUserId: ctx.user.id } }),
    prisma.staffUser.findMany({
      where: { active: true, agentProfile: { isNot: null } },
      select: { id: true, name: true, agentProfile: { select: { availability: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return json({
    me: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role, availability: profile?.availability ?? "OFFLINE", maxActiveOrders: profile?.maxActiveOrders ?? 0 },
    agents: agents.map((a) => ({ id: a.id, name: a.name, availability: a.agentProfile?.availability ?? "OFFLINE" })),
    ...queues,
  });
});
