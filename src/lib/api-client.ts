// Small fetch wrapper for client components.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    signal: init.signal,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; details?: unknown };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code, data.details);
  return data as T;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
