import { requireCustomerEnrollment } from "@/lib/customer-access";
import { getCustomerView } from "@/lib/services/views";
import { json, route } from "@/lib/http";

export const GET = route<{ publicId: string }>(async (_req, ctx) => {
  const { publicId } = await ctx.params;
  const id = await requireCustomerEnrollment(publicId);
  return json(await getCustomerView(id));
});
