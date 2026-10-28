import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runMaintenance } from "@/lib/services/retention";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Invoked daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = env.cronSecret;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: "Unauthorized" }, 401);
  const results = await runMaintenance();
  return json({ ok: true, results });
}
