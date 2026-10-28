import type { NextRequest } from "next/server";
import { getStaffContext } from "@/lib/auth/staff";
import { channels, sseResponse } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Staff event stream: the agent's own channel plus the shared staff channel (queue changes,
// new enrollments, status updates for the team view).
export async function GET(req: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.mfaVerified) return new Response("Unauthorized", { status: 401 });
  return sseResponse(req, [channels.agent(ctx.user.id), channels.staff]);
}
