import { requireStaffApi } from "@/lib/auth/staff";
import { claimEnrollment } from "@/lib/services/assignment";
import { json, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const staff = await requireStaffApi();
  await claimEnrollment(staff.user.id, id, staff.actor);
  return json({ ok: true });
});
