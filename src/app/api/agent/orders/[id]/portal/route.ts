import { staffForOrder } from "@/lib/agent-api";
import { recordPortalOpened } from "@/lib/services/orders";
import { json, route } from "@/lib/http";

// Returns the provider's order portal URL (e.g. AT&T SPOC) and records that it was opened.
// The URL is configured by admins per provider — never a hard-coded session URL. We do not
// automate the portal in any way; the agent signs in and enters the order manually.
export const POST = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { staff } = await staffForOrder(id);
  const url = await recordPortalOpened(staff, id);
  return json({ ok: true, url });
});
