import { z } from "zod";
import { requireStaffApi } from "@/lib/auth/staff";
import { setAvailability } from "@/lib/services/assignment";
import { json, readBody, route } from "@/lib/http";

export const POST = route(async (req) => {
  const ctx = await requireStaffApi();
  const { availability } = await readBody(req, z.object({ availability: z.enum(["AVAILABLE", "BUSY", "OFFLINE"]) }));
  await setAvailability(ctx.user.id, availability, ctx.actor);
  return json({ ok: true, availability });
});
