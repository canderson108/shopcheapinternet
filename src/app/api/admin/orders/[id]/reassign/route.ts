import { z } from "zod";
import { requireStaffApi } from "@/lib/auth/staff";
import { reassignEnrollment } from "@/lib/services/assignment";
import { json, readBody, route } from "@/lib/http";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const staff = await requireStaffApi(["MANAGER", "ADMIN"]);
  const body = await readBody(req, z.object({ agentId: z.string().max(40).nullable(), note: z.string().max(500).optional() }));
  await reassignEnrollment(id, body.agentId, staff.actor, body.note);
  return json({ ok: true });
});
