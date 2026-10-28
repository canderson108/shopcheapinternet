import { z } from "zod";
import { staffForOrder } from "@/lib/agent-api";
import { addAgentNote } from "@/lib/services/orders";
import { json, readBody, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const { body } = await readBody(req, z.object({ body: z.string().max(4000) }));
  const note = await addAgentNote(staff, id, body);
  return json({ ok: true, id: note.id });
});
