import { z } from "zod";
import { staffForOrder } from "@/lib/agent-api";
import { updateChecklist } from "@/lib/services/orders";
import { json, readBody, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const { key, done } = await readBody(req, z.object({ key: z.string().max(40), done: z.boolean() }));
  const checklist = await updateChecklist(staff, id, key, done);
  return json({ ok: true, checklist });
});
