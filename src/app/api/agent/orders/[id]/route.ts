import { staffForOrder } from "@/lib/agent-api";
import { getAgentOrderView } from "@/lib/services/views";
import { listMessages, markRead } from "@/lib/services/messages";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { ctx: staff, mine } = await staffForOrder(id, { allowUnassignedView: true });
  const [order, messages] = await Promise.all([getAgentOrderView(id), listMessages(id, "staff")]);
  if (mine && order.unreadForAgent > 0) await markRead(id, "agent");
  // Viewing decrypted PII is audited.
  await audit(prisma, { actor: staff.actor, action: "enrollment.viewed", entityType: "Enrollment", entityId: id, enrollmentId: id });
  return json({ order, messages, viewer: { id: staff.user.id, role: staff.user.role, canWork: mine || staff.user.role !== "AGENT" } });
});
