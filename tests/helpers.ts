import { prisma } from "@/lib/db";
import { memoryOutbox } from "@/lib/email/send";
import { createFunnelSession, selectPlan, setSessionAddress } from "@/lib/services/funnel";
import { createStaffUser } from "@/lib/services/admin";
import type { AgentAvailability, StaffRole } from "@prisma/client";
import type { EnrollmentSubmitInput } from "@/lib/validation";
import type { StaffActor } from "@/lib/services/orders";

const TABLES = [
  "AuditLog", "EmailLog", "RealtimeEvent", "RateLimitBucket", "CustomerSession", "CustomerAccessToken", "AgentNote", "Message",
  "AgentAssignment", "EnrollmentStatusHistory", "ConsentRecord", "EnrollmentSession", "Enrollment", "Customer", "PropertyUnit",
  "Property", "Campaign", "ReferralSource", "ServiceArea", "PlanPriceHistory", "Plan", "Provider", "StaffSession", "AgentProfile", "StaffUser",
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  memoryOutbox.length = 0;
}

export async function seedProviderAndPlan(opts: { orderable?: boolean; priceCents?: number; portal?: string | null } = {}) {
  const provider = await prisma.provider.create({
    data: {
      slug: "att",
      name: "AT&T",
      active: true,
      orderable: opts.orderable ?? true,
      portalName: "AT&T SPOC",
      orderPortalUrl: opts.portal === undefined ? "https://www.attspoc.com/" : opts.portal,
      confirmationNumberLabel: "Order number",
    },
  });
  const plan = await prisma.plan.create({
    data: {
      providerId: provider.id,
      slug: "fiber-500",
      name: "Fiber 500",
      connectionType: "FIBER",
      downloadMbps: 500,
      uploadMbps: 500,
      monthlyPriceCents: opts.priceCents ?? 6000,
      regularPriceCents: 7500,
      priceTermMonths: 12,
      priceConditions: "w/ AutoPay & paperless billing",
      installationFeeCents: 0,
      equipmentFeeCents: 0,
      dataCap: "Unlimited",
      sourceName: "test source",
      sourceCheckedAt: new Date("2026-10-28T12:00:00Z"),
    },
  });
  return { provider, plan };
}

let agentCounter = 0;
export async function createAgent(availability: AgentAvailability = "AVAILABLE", opts: { role?: StaffRole; max?: number } = {}) {
  agentCounter++;
  const u = await createStaffUser(null, {
    name: `Agent ${agentCounter} Test`,
    email: `agent${agentCounter}-${Date.now()}@example.com`,
    role: opts.role ?? "AGENT",
    password: "correct-horse-battery-9",
    maxActiveOrders: opts.max ?? 5,
  });
  await prisma.agentProfile.update({ where: { staffUserId: u.id }, data: { availability } });
  const actor: StaffActor = { id: u.id, role: u.role, name: u.name };
  return { user: u, actor };
}

/** Runs the customer funnel up to (not including) submission. */
export async function readySession(planId: string, address = { street: "123 Main St", unit: "4B", city: "Dallas", state: "TX", zip: "75201" }) {
  const { session } = await createFunnelSession({ utmSource: "google", utmCampaign: "fall", gclid: "test-gclid" });
  await setSessionAddress(session.id, address, { verified: false, source: "customer_entered" });
  await selectPlan(session.id, planId);
  return session;
}

let keyCounter = 0;
export function submitInput(overrides: Partial<EnrollmentSubmitInput> = {}): EnrollmentSubmitInput {
  keyCounter++;
  return {
    firstName: "Jordan",
    lastName: "Rivera",
    email: `jordan.rivera+${keyCounter}@example.com`,
    phone: "(214) 555-0142",
    unit: "4B",
    billingSameAsService: true,
    billing: null,
    preferredInstallDate: null,
    preferredInstallTime: "morning",
    notes: "Gate code 1234",
    consentTerms: true,
    consentContact: true,
    consentMarketing: false,
    idempotencyKey: `test-key-${keyCounter}-${Date.now()}-abcdef`,
    ...overrides,
  } as EnrollmentSubmitInput;
}
