import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "./errors";
import { lookupHash } from "./crypto";
import { zodFieldErrors } from "./validation";

export function json(data: unknown, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return json({ error: e.message, code: e.code, details: e.details ?? null }, e.status);
  }
  if (e instanceof ZodError) {
    return json({ error: "Please correct the highlighted fields.", code: "validation", details: zodFieldErrors(e) }, 422);
  }
  console.error("[api] unhandled error", e);
  return json({ error: "Something went wrong. Please try again.", code: "server_error" }, 500);
}

type RouteCtx<P> = { params: Promise<P> };

/** Wraps a route handler with uniform error handling. */
export function route<P = Record<string, string>>(fn: (req: NextRequest, ctx: RouteCtx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: RouteCtx<P>) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("Invalid request body", 400, "bad_json");
  }
  return schema.parse(raw);
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export function ipHash(req: Request): string {
  return lookupHash(`ip:${clientIp(req)}`);
}
