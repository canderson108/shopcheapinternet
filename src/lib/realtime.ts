import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "./db";

// Real-time delivery is backed by a durable Postgres event log (RealtimeEvent) streamed to
// browsers over Server-Sent Events. This works on Vercel's serverless runtime without a
// separate WebSocket service, survives function restarts, and lets clients resume from the
// last event they saw (Last-Event-ID). Swap in Pusher/Ably later by changing publish().

export const channels = {
  enrollment: (enrollmentId: string) => `enrollment:${enrollmentId}`,
  agent: (agentId: string) => `agent:${agentId}`,
  staff: "staff",
};

export type RealtimeType =
  | "enrollment.created"
  | "enrollment.updated"
  | "enrollment.assigned"
  | "enrollment.unassigned"
  | "message.created"
  | "queue.changed"
  | "agent.availability";

export async function publish(
  db: Db,
  channelList: string[],
  type: RealtimeType,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  const unique = Array.from(new Set(channelList));
  await db.realtimeEvent.createMany({ data: unique.map((channel) => ({ channel, type, payload })) });
}

export async function latestEventId(): Promise<bigint> {
  const last = await prisma.realtimeEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  return last?.id ?? BigInt(0);
}

/**
 * Builds an SSE Response that polls the event log for the given channels.
 * Each connection lives up to ~50s, then closes; EventSource reconnects automatically
 * and resumes from Last-Event-ID, so no events are lost between connections.
 */
export function sseResponse(req: Request, channelList: string[], opts: { pollMs?: number; maxMs?: number } = {}): Response {
  const pollMs = opts.pollMs ?? 1500;
  const maxMs = opts.maxMs ?? 50_000;
  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const lastHeader = req.headers.get("last-event-id") ?? url.searchParams.get("lastEventId");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      req.signal.addEventListener("abort", close);

      let cursor: bigint;
      try {
        cursor = lastHeader && /^\d+$/.test(lastHeader) ? BigInt(lastHeader) : await latestEventId();
      } catch {
        cursor = BigInt(0);
      }
      send(`retry: 2000\n`);
      send(`event: ready\ndata: {}\n\n`);

      const started = Date.now();
      let lastBeat = Date.now();
      while (!closed && Date.now() - started < maxMs) {
        try {
          const events = await prisma.realtimeEvent.findMany({
            where: { channel: { in: channelList }, id: { gt: cursor } },
            orderBy: { id: "asc" },
            take: 100,
          });
          for (const ev of events) {
            cursor = ev.id;
            send(`id: ${ev.id.toString()}\nevent: ${ev.type}\ndata: ${JSON.stringify({ channel: ev.channel, ...(ev.payload as object) })}\n\n`);
          }
        } catch {
          // transient DB error: keep the stream alive and retry on next tick
        }
        if (Date.now() - lastBeat > 15_000) {
          send(`: keep-alive\n\n`);
          lastBeat = Date.now();
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
