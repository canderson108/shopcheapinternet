import { staffForOrder } from "@/lib/agent-api";
import { startProcessing } from "@/lib/services/orders";
import { json, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const statusVersion = await startProcessing(staff, id);
  return json({ ok: true, statusVersion });
});
