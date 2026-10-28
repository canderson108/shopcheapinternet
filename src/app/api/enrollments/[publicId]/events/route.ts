import type { NextRequest } from "next/server";
import { customerEnrollmentId } from "@/lib/customer-access";
import { channels, sseResponse } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const id = await customerEnrollmentId(publicId);
  if (!id) return new Response("Unauthorized", { status: 401 });
  return sseResponse(req, [channels.enrollment(id)]);
}
