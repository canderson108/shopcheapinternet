import { getCurrentFunnelSession } from "@/lib/funnel-cookie";
import { saveDraft } from "@/lib/services/funnel";
import { draftSchema } from "@/lib/validation";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

// Autosave for the enrollment form. Stored encrypted on the funnel session.
export const PUT = route(async (req) => {
  await rateLimit(`draft:${ipHash(req)}`, 120, 60);
  const draft = await readBody(req, draftSchema);
  const session = await getCurrentFunnelSession();
  if (!session) throw new AppError("Session expired", 400, "no_session");
  if (session.enrollmentId) return json({ ok: true, submitted: true });
  await saveDraft(session.id, draft);
  return json({ ok: true, savedAt: new Date().toISOString() });
});
