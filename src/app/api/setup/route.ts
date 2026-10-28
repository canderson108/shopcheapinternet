import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { createStaffUser } from "@/lib/services/admin";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, ForbiddenError } from "@/lib/errors";

// One-time bootstrap of the first administrator. Requires SETUP_TOKEN and only works while
// no staff accounts exist. Remove SETUP_TOKEN from the environment after use.
export const POST = route(async (req) => {
  await rateLimit(`setup:${ipHash(req)}`, 10, 3600);
  const body = await readBody(
    req,
    z.object({ token: z.string().max(200), name: z.string(), email: z.string(), password: z.string().max(200) }),
  );
  const expected = env.setupToken;
  if (!expected || !safeEqual(body.token, expected)) throw new ForbiddenError("Invalid setup token.");
  if ((await prisma.staffUser.count()) > 0) throw new AppError("Setup is already complete. Sign in instead.", 409, "already_setup");
  await createStaffUser(null, { name: body.name, email: body.email, password: body.password, role: "ADMIN", maxActiveOrders: 5 });
  return json({ ok: true, next: "/staff/login" });
});
