import { prisma } from "./db";
import { RateLimitError } from "./errors";

/**
 * Fixed-window rate limiter stored in Postgres so it works across serverless instances.
 * Returns the current count; throws RateLimitError when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::double precision))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" < now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" < now()
        THEN now() + make_interval(secs => ${windowSeconds}::double precision)
        ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) throw new RateLimitError();
  return count;
}
