import { requireCustomerEnrollment } from "@/lib/customer-access";
import { customerMessageSchema, listMessages, markRead, postCustomerMessage } from "@/lib/services/messages";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const GET = route<{ publicId: string }>(async (_req, ctx) => {
  const { publicId } = await ctx.params;
  const id = await requireCustomerEnrollment(publicId);
  const messages = await listMessages(id, "customer");
  await markRead(id, "customer");
  return json({ messages });
});

export const POST = route<{ publicId: string }>(async (req, ctx) => {
  const { publicId } = await ctx.params;
  const id = await requireCustomerEnrollment(publicId);
  await rateLimit(`cmsg:${ipHash(req)}`, 30, 300);
  const body = await readBody(req, customerMessageSchema);
  const m = await postCustomerMessage(id, body);
  return json({ ok: true, id: m.id });
});
