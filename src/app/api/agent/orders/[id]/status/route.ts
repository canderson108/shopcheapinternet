import { z } from "zod";
import { staffForOrder } from "@/lib/agent-api";
import { changeStatus } from "@/lib/services/orders";
import { json, readBody, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const body = await readBody(
    req,
    z.object({
      status: z.enum(["AGENT_PROCESSING", "ADDITIONAL_INFO_REQUIRED", "SUBMITTED_TO_PROVIDER", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"]),
      note: z.string().max(2000).optional().nullable(),
      expectedVersion: z.number().int().optional(),
    }),
  );
  const statusVersion = await changeStatus(staff, id, body.status, { note: body.note, expectedVersion: body.expectedVersion });
  return json({ ok: true, statusVersion });
});
