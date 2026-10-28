import { staffForOrder } from "@/lib/agent-api";
import { confirmOrder, type ConfirmationInput } from "@/lib/services/orders";
import { json, route } from "@/lib/http";
import { AppError } from "@/lib/errors";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  let body: ConfirmationInput;
  try {
    body = (await req.json()) as ConfirmationInput;
  } catch {
    throw new AppError("Invalid request body", 400);
  }
  // confirmOrder validates the payload (schema in services/orders.ts).
  const statusVersion = await confirmOrder(staff, id, body);
  return json({ ok: true, statusVersion });
});
