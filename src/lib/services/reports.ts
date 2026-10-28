import type { EnrollmentStatus } from "@prisma/client";
import { prisma } from "../db";
import { ACTIVE_AGENT_STATUSES } from "../status";

export type ReportRange = { from: Date; to: Date };

export function rangeFromDays(days: number): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - Math.max(1, days) * 86400_000);
  return { from, to };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export async function getDashboardMetrics(range: ReportRange) {
  const created = { gte: range.from, lte: range.to };
  const [leads, statusCounts, confirmedInRange, failedInRange, avgRow, byProperty, byProvider, byPlan, agents, trend, openPending, openActive] = await Promise.all([
    prisma.enrollmentSession.count({ where: { addressEnteredAt: created } }),
    prisma.enrollment.groupBy({ by: ["status"], where: { submittedAt: created }, _count: { _all: true } }),
    prisma.enrollment.count({ where: { confirmedAt: created } }),
    prisma.enrollment.count({ where: { status: "UNABLE_TO_COMPLETE", completedAt: created } }),
    prisma.$queryRaw<{ avg_minutes: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "submittedAt")) / 60)::float AS avg_minutes
        FROM "Enrollment" WHERE "confirmedAt" BETWEEN ${range.from} AND ${range.to}`,
    prisma.$queryRaw<{ id: string | null; name: string | null; leads: bigint; requests: bigint; confirmed: bigint }[]>`
      WITH l AS (SELECT "propertyId", COUNT(*) AS n FROM "EnrollmentSession" WHERE "addressEnteredAt" BETWEEN ${range.from} AND ${range.to} GROUP BY 1),
           r AS (SELECT "propertyId", COUNT(*) AS n, COUNT(*) FILTER (WHERE "status" = 'PROVIDER_ORDER_CONFIRMED') AS c
                   FROM "Enrollment" WHERE "submittedAt" BETWEEN ${range.from} AND ${range.to} GROUP BY 1)
      SELECT p."id", p."name", COALESCE(l.n, 0) AS leads, COALESCE(r.n, 0) AS requests, COALESCE(r.c, 0) AS confirmed
        FROM "Property" p LEFT JOIN l ON l."propertyId" = p."id" LEFT JOIN r ON r."propertyId" = p."id"
       WHERE COALESCE(l.n, 0) + COALESCE(r.n, 0) > 0
      UNION ALL
      SELECT NULL, 'No property (direct / web)', COALESCE((SELECT n FROM l WHERE "propertyId" IS NULL), 0),
             COALESCE((SELECT n FROM r WHERE "propertyId" IS NULL), 0), COALESCE((SELECT c FROM r WHERE "propertyId" IS NULL), 0)
      ORDER BY requests DESC`,
    prisma.$queryRaw<{ name: string; requests: bigint; confirmed: bigint }[]>`
      SELECT pr."name", COUNT(*) AS requests, COUNT(*) FILTER (WHERE e."status" = 'PROVIDER_ORDER_CONFIRMED') AS confirmed
        FROM "Enrollment" e JOIN "Provider" pr ON pr."id" = e."providerId"
       WHERE e."submittedAt" BETWEEN ${range.from} AND ${range.to}
       GROUP BY pr."name" ORDER BY requests DESC`,
    prisma.$queryRaw<{ name: string; provider: string; requests: bigint; confirmed: bigint }[]>`
      SELECT pl."name", pr."name" AS provider, COUNT(*) AS requests, COUNT(*) FILTER (WHERE e."status" = 'PROVIDER_ORDER_CONFIRMED') AS confirmed
        FROM "Enrollment" e JOIN "Plan" pl ON pl."id" = e."planId" JOIN "Provider" pr ON pr."id" = e."providerId"
       WHERE e."submittedAt" BETWEEN ${range.from} AND ${range.to}
       GROUP BY pl."name", pr."name" ORDER BY requests DESC`,
    prisma.$queryRaw<{ id: string; name: string; availability: string | null; assigned: bigint; confirmed: bigint; unable: bigint; active: bigint; avg_minutes: number | null }[]>`
      SELECT su."id", su."name", ap."availability"::text AS availability,
             (SELECT COUNT(*) FROM "AgentAssignment" aa WHERE aa."agentId" = su."id" AND aa."assignedAt" BETWEEN ${range.from} AND ${range.to}) AS assigned,
             (SELECT COUNT(*) FROM "Enrollment" e WHERE e."confirmedById" = su."id" AND e."confirmedAt" BETWEEN ${range.from} AND ${range.to}) AS confirmed,
             (SELECT COUNT(*) FROM "Enrollment" e WHERE e."assignedAgentId" = su."id" AND e."status" = 'UNABLE_TO_COMPLETE' AND e."completedAt" BETWEEN ${range.from} AND ${range.to}) AS unable,
             (SELECT COUNT(*) FROM "Enrollment" e WHERE e."assignedAgentId" = su."id" AND e."status" IN ('AGENT_ASSIGNED','AGENT_PROCESSING','ADDITIONAL_INFO_REQUIRED','SUBMITTED_TO_PROVIDER')) AS active,
             (SELECT AVG(EXTRACT(EPOCH FROM (e."confirmedAt" - e."assignedAt")) / 60)::float FROM "Enrollment" e WHERE e."confirmedById" = su."id" AND e."confirmedAt" BETWEEN ${range.from} AND ${range.to}) AS avg_minutes
        FROM "StaffUser" su LEFT JOIN "AgentProfile" ap ON ap."staffUserId" = su."id"
       WHERE su."active" = true AND ap."id" IS NOT NULL
       ORDER BY confirmed DESC, su."name"`,
    prisma.$queryRaw<{ day: Date; leads: bigint; requests: bigint; confirmed: bigint }[]>`
      WITH days AS (SELECT generate_series(date_trunc('day', ${range.from}::timestamp), date_trunc('day', ${range.to}::timestamp), interval '1 day') AS day)
      SELECT d.day,
             (SELECT COUNT(*) FROM "EnrollmentSession" s WHERE date_trunc('day', s."addressEnteredAt") = d.day) AS leads,
             (SELECT COUNT(*) FROM "Enrollment" e WHERE date_trunc('day', e."submittedAt") = d.day) AS requests,
             (SELECT COUNT(*) FROM "Enrollment" e WHERE date_trunc('day', e."confirmedAt") = d.day) AS confirmed
        FROM days d ORDER BY d.day`,
    prisma.enrollment.count({ where: { status: "WAITING_FOR_AGENT" } }),
    prisma.enrollment.count({ where: { status: { in: [...ACTIVE_AGENT_STATUSES, "INFORMATION_SUBMITTED"] } } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Partial<Record<EnrollmentStatus, number>>;
  const requests = statusCounts.reduce((a, s) => a + s._count._all, 0);
  const confirmedOfCohort = byStatus.PROVIDER_ORDER_CONFIRMED ?? 0;

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      leads,
      requests,
      pending: openPending,
      active: openActive,
      confirmed: confirmedInRange,
      failed: failedInRange,
      canceled: byStatus.CUSTOMER_CANCELED ?? 0,
      leadToRequestRate: pct(requests, leads),
      requestToConfirmedRate: pct(confirmedOfCohort, requests),
      leadToConfirmedRate: pct(confirmedOfCohort, leads),
      avgProcessingMinutes: avgRow[0]?.avg_minutes ? Math.round(avgRow[0].avg_minutes) : null,
    },
    byStatus,
    byProperty: byProperty.map((r) => ({ id: r.id, name: r.name ?? "—", leads: Number(r.leads), requests: Number(r.requests), confirmed: Number(r.confirmed), conversion: pct(Number(r.confirmed), Number(r.requests)) })),
    byProvider: byProvider.map((r) => ({ name: r.name, requests: Number(r.requests), confirmed: Number(r.confirmed) })),
    byPlan: byPlan.map((r) => ({ name: r.name, provider: r.provider, requests: Number(r.requests), confirmed: Number(r.confirmed) })),
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      availability: a.availability,
      assigned: Number(a.assigned),
      confirmed: Number(a.confirmed),
      unable: Number(a.unable),
      active: Number(a.active),
      avgMinutes: a.avg_minutes ? Math.round(a.avg_minutes) : null,
    })),
    trend: trend.map((t) => ({ day: t.day.toISOString().slice(0, 10), leads: Number(t.leads), requests: Number(t.requests), confirmed: Number(t.confirmed) })),
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
