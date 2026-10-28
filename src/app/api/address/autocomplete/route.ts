import { addressVerificationConfigured, autocomplete } from "@/lib/address/smarty";
import { ipHash, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const GET = route(async (req) => {
  if (!addressVerificationConfigured()) return json({ enabled: false, suggestions: [] });
  await rateLimit(`ac:${ipHash(req)}`, 120, 60);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const selected = url.searchParams.get("selected")?.slice(0, 200) ?? undefined;
  if (q.trim().length < 3) return json({ enabled: true, suggestions: [] });
  try {
    return json({ enabled: true, suggestions: await autocomplete(q, selected) });
  } catch {
    // Degrade gracefully to manual entry.
    return json({ enabled: true, suggestions: [], degraded: true });
  }
});
