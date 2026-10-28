import { NextResponse, type NextRequest } from "next/server";

// Edge middleware: CSRF origin check for state-changing API calls, and first-touch marketing
// attribution capture. No database access here — auth is enforced in route handlers/layouts.

const ATTR_COOKIE = "sci_attr";
const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref", "campaign"];

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!pathname.startsWith("/api/cron/") && !sameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked", code: "csrf" }, { status: 403 });
    }
  }

  const res = NextResponse.next();

  if (req.method === "GET" && !pathname.startsWith("/api/") && ATTR_KEYS.some((k) => searchParams.has(k))) {
    const attr: Record<string, string> = { landing: pathname.slice(0, 200) };
    for (const k of ATTR_KEYS) {
      const v = searchParams.get(k);
      if (v) attr[k] = v.slice(0, 200);
    }
    // Last non-empty campaign touch wins; kept 30 days.
    res.cookies.set(ATTR_COOKIE, JSON.stringify(attr), {
      httpOnly: true,
      sameSite: "lax",
      secure: (process.env.APP_URL ?? "").startsWith("https://"),
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
