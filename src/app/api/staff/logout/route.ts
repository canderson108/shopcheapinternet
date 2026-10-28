import { endStaffSession, getStaffContext } from "@/lib/auth/staff";
import { setAvailability } from "@/lib/services/assignment";
import { json, route } from "@/lib/http";

export const POST = route(async () => {
  const ctx = await getStaffContext();
  if (ctx?.mfaVerified) await setAvailability(ctx.user.id, "OFFLINE", ctx.actor).catch(() => undefined);
  await endStaffSession();
  return json({ ok: true, next: "/staff/login" });
});
