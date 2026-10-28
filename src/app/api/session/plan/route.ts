import { z } from "zod";
import { getCurrentFunnelSession } from "@/lib/funnel-cookie";
import { selectPlan } from "@/lib/services/funnel";
import { json, readBody, route } from "@/lib/http";
import { AppError } from "@/lib/errors";

export const POST = route(async (req) => {
  const { planId } = await readBody(req, z.object({ planId: z.string().min(1).max(40) }));
  const session = await getCurrentFunnelSession();
  if (!session || !session.zip) throw new AppError("Enter your address to see plans.", 400, "address_required");
  await selectPlan(session.id, planId);
  return json({ ok: true, next: "/enroll" });
});
