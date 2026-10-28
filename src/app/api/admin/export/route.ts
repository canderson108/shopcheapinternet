import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffApi } from "@/lib/auth/staff";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ALL_STATUSES, statusLabel } from "@/lib/status";
import { errorResponse } from "@/lib/http";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of enrollments. ?type=conversions exports confirmed orders with click IDs for
// Google Ads / Meta offline conversion upload (only verified confirmations count).
export async function GET(req: Request) {
  try {
    const staff = await requireStaffApi(["MANAGER", "ADMIN"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const includePii = url.searchParams.get("pii") === "1" && staff.user.role === "ADMIN";

    const where: Prisma.EnrollmentWhereInput = {};
    if (status && ALL_STATUSES.includes(status as EnrollmentStatus)) where.status = status as EnrollmentStatus;
    if (type === "conversions") where.status = "PROVIDER_ORDER_CONFIRMED";
    if (from || to) where.submittedAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}) };

    const rows = await prisma.enrollment.findMany({
      where,
      include: { customer: true, provider: true, plan: true, property: true, assignedAgent: { select: { name: true } }, referralSource: true, campaign: true },
      orderBy: { submittedAt: "desc" },
      take: 50_000,
    });

    let header: string[];
    let lines: unknown[][];
    if (type === "conversions") {
      header = ["Google Click ID", "Facebook Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency", "Order ID"];
      lines = rows
        .filter((r) => r.confirmedAt && (r.gclid || r.fbclid))
        .map((r) => [r.gclid, r.fbclid, "Confirmed Internet Order", r.confirmedAt, ((r.confirmedPriceCents ?? r.advertisedPriceCents) / 100).toFixed(2), "USD", r.publicId]);
    } else {
      header = [
        "Reference", "Status", "Submitted", "Provider", "Plan", "Advertised price", "Customer first name", "Customer last name",
        ...(includePii ? ["Email", "Phone", "Street", "Unit"] : []),
        "City", "State", "ZIP", "Property", "Unit number", "Assigned agent", "Referral source", "Campaign", "UTM source", "UTM medium", "UTM campaign",
        "Confirmation number", "Confirmed plan", "Confirmed price", "Confirmed at",
      ];
      lines = rows.map((r) => {
        const deleted = Boolean(r.piiDeletedAt);
        return [
          r.publicId, statusLabel(r.status, r.provider.name), r.submittedAt, r.provider.name, r.plan.name, (r.advertisedPriceCents / 100).toFixed(2),
          r.customer.firstName, r.customer.lastName,
          ...(includePii
            ? deleted
              ? ["[deleted]", "[deleted]", "[deleted]", ""]
              : [decrypt(r.customer.emailEnc), decrypt(r.customer.phoneEnc), decrypt(r.serviceStreetEnc), decryptOptional(r.serviceUnitEnc)]
            : []),
          r.serviceCity, r.serviceState, r.serviceZip, r.property?.name, r.unitNumber, r.assignedAgent?.name, r.referralSource?.name, r.campaign?.name,
          r.utmSource, r.utmMedium, r.utmCampaign, r.confirmationNumber, r.confirmedPlanName,
          r.confirmedPriceCents !== null ? (r.confirmedPriceCents / 100).toFixed(2) : "", r.confirmedAt,
        ];
      });
    }

    await audit(prisma, { actor: staff.actor, action: "enrollments.exported", entityType: "Enrollment", metadata: { count: lines.length, type: type ?? "enrollments", includePii, status, from, to } });
    const csv = [header, ...lines].map((l) => l.map(csvCell).join(",")).join("\r\n");
    const name = `${type === "conversions" ? "confirmed-conversions" : "enrollments"}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
