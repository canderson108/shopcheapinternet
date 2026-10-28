import { z } from "zod";
import { requireCustomerEnrollment } from "@/lib/customer-access";
import { cancelByCustomer } from "@/lib/services/orders";
import { json, readBody, route } from "@/lib/http";

export const POST = route<{ publicId: string }>(async (req, ctx) => {
  const { publicId } = await ctx.params;
  const id = await requireCustomerEnrollment(publicId);
  const { reason } = await readBody(req, z.object({ reason: z.string().max(500).optional().nullable() }));
  await cancelByCustomer(id, reason);
  return json({ ok: true });
});
