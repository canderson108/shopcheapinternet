import { staffForOrder } from "@/lib/agent-api";
import { agentMessageSchema, listMessages, postAgentMessage } from "@/lib/services/messages";
import { json, readBody, route } from "@/lib/http";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  await staffForOrder(id, { allowUnassignedView: true });
  return json({ messages: await listMessages(id, "staff") });
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const body = await readBody(req, agentMessageSchema);
  const m = await postAgentMessage(staff, id, body);
  return json({ ok: true, id: m.id });
});
