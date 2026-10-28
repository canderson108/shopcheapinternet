import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { decrypt, decryptOptional } from "../crypto";
import { NotFoundError } from "../errors";
import { ACTIVE_AGENT_STATUSES, type ChecklistState } from "../status";
import type { PlanSnapshot } from "./plans";
import type { Address } from "../address/normalize";

function billingFrom(enc: string | null): Address | null {
  if (!enc) return null;
  try {
    return JSON.parse(decrypt(enc)) as Address;
  } catch {
    return null;
  }
}

/** Full decrypted record for the agent workspace. Callers must enforce permissions first. */
export async function getAgentOrderView(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: true,
      provider: true,
      plan: true,
      property: true,
      referralSource: true,
      campaign: true,
      assignedAgent: { select: { id: true, name: true } },
      confirmedBy: { select: { name: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actorStaff: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!e) throw new NotFoundError("Enrollment not found");
  const deleted = Boolean(e.piiDeletedAt);
  return {
    id: e.id,
    publicId: e.publicId,
    status: e.status,
    statusVersion: e.statusVersion,
    submittedAt: e.submittedAt.toISOString(),
    piiDeleted: deleted,
    customer: {
      firstName: e.customer.firstName,
      lastName: e.customer.lastName,
      email: deleted ? "[deleted]" : decrypt(e.customer.emailEnc),
      phone: deleted ? "[deleted]" : decrypt(e.customer.phoneEnc),
    },
    service: {
      street: deleted ? "[deleted]" : decrypt(e.serviceStreetEnc),
      unit: deleted ? null : decryptOptional(e.serviceUnitEnc),
      city: e.serviceCity,
      state: e.serviceState,
      zip: e.serviceZip,
      verified: e.addressVerified,
    },
    billingSameAsService: e.billingSameAsService,
    billing: deleted ? null : billingFrom(e.billingAddressEnc),
    plan: e.planSnapshot as unknown as PlanSnapshot,
    planId: e.planId,
    advertisedPriceCents: e.advertisedPriceCents,
    pricingSource: e.pricingSource,
    pricingCheckedAt: e.pricingCheckedAt.toISOString(),
    availabilityStatus: e.availabilityStatus,
    preferredInstallDate: e.preferredInstallDate?.toISOString().slice(0, 10) ?? null,
    preferredInstallTime: e.preferredInstallTime,
    customerNotes: deleted ? null : decryptOptional(e.customerNotesEnc),
    provider: {
      id: e.provider.id,
      name: e.provider.name,
      portalName: e.provider.portalName,
      hasPortal: Boolean(e.provider.orderPortalUrl),
      orderInstructions: e.provider.orderInstructions,
      enrollmentRequirements: e.provider.enrollmentRequirements,
      confirmationWorkflow: e.provider.confirmationWorkflow,
      confirmationNumberLabel: e.provider.confirmationNumberLabel,
    },
    property: e.property ? { id: e.property.id, name: e.property.name, slug: e.property.slug, externalId: e.property.externalId } : null,
    unitNumber: e.unitNumber,
    referralSource: e.referralSource?.name ?? null,
    campaign: e.campaign?.name ?? null,
    utm: { source: e.utmSource, medium: e.utmMedium, campaign: e.utmCampaign },
    assignedAgent: e.assignedAgent,
    checklist: (e.checklist as ChecklistState | null) ?? {},
    confirmation: e.confirmationNumber
      ? {
          number: e.confirmationNumber,
          planName: e.confirmedPlanName,
          priceCents: e.confirmedPriceCents,
          installDate: e.confirmedInstallDate?.toISOString().slice(0, 10) ?? null,
          submittedAt: e.orderSubmittedAt?.toISOString() ?? null,
          confirmedAt: e.confirmedAt?.toISOString() ?? null,
          confirmedBy: e.confirmedBy?.name ?? null,
          notes: e.confirmationNotes,
        }
      : null,
    orderSubmittedAt: e.orderSubmittedAt?.toISOString() ?? null,
    history: e.statusHistory.map((h) => ({
      id: h.id,
      from: h.fromStatus,
      to: h.toStatus,
      actor: h.actorType === "STAFF" ? (h.actorStaff?.name ?? "Staff") : h.actorType === "CUSTOMER" ? "Customer" : "System",
      note: h.note,
      at: h.createdAt.toISOString(),
    })),
    notes: e.notes.map((n) => ({ id: n.id, author: n.author.name, body: decrypt(n.bodyEnc), at: n.createdAt.toISOString() })),
    unreadForAgent: e.unreadForAgent,
  };
}

export type AgentOrderView = Awaited<ReturnType<typeof getAgentOrderView>>;

export type QueueItem = {
  id: string;
  publicId: string;
  status: EnrollmentStatus;
  customerName: string;
  city: string;
  state: string;
  planLabel: string;
  providerName: string;
  priceCents: number;
  propertyName: string | null;
  submittedAt: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  unreadForAgent: number;
  lastCustomerMessageAt: string | null;
};

function toQueueItem(e: Prisma.EnrollmentGetPayload<{ include: { customer: true; provider: true; plan: true; property: true; assignedAgent: { select: { name: true } } } }>): QueueItem {
  return {
    id: e.id,
    publicId: e.publicId,
    status: e.status,
    customerName: `${e.customer.firstName} ${e.customer.lastName}`,
    city: e.serviceCity,
    state: e.serviceState,
    planLabel: e.plan.name,
    providerName: e.provider.name,
    priceCents: e.advertisedPriceCents,
    propertyName: e.property?.name ?? null,
    submittedAt: e.submittedAt.toISOString(),
    assignedAgentId: e.assignedAgentId,
    assignedAgentName: e.assignedAgent?.name ?? null,
    unreadForAgent: e.unreadForAgent,
    lastCustomerMessageAt: e.lastCustomerMessageAt?.toISOString() ?? null,
  };
}

const queueInclude = { customer: true, provider: true, plan: true, property: true, assignedAgent: { select: { name: true } } } as const;

export async function getAgentQueues(agentId: string, includeAllActive: boolean) {
  const [mine, waiting, team, recentClosed] = await Promise.all([
    prisma.enrollment.findMany({
      where: { assignedAgentId: agentId, status: { in: ACTIVE_AGENT_STATUSES } },
      include: queueInclude,
      orderBy: [{ unreadForAgent: "desc" }, { submittedAt: "asc" }],
    }),
    prisma.enrollment.findMany({ where: { status: "WAITING_FOR_AGENT" }, include: queueInclude, orderBy: { submittedAt: "asc" }, take: 100 }),
    includeAllActive
      ? prisma.enrollment.findMany({
          where: { status: { in: ACTIVE_AGENT_STATUSES }, NOT: { assignedAgentId: agentId } },
          include: queueInclude,
          orderBy: { submittedAt: "asc" },
          take: 200,
        })
      : Promise.resolve([]),
    prisma.enrollment.findMany({
      where: { assignedAgentId: agentId, status: { in: ["PROVIDER_ORDER_CONFIRMED", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"] } },
      include: queueInclude,
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
  ]);
  return { mine: mine.map(toQueueItem), waiting: waiting.map(toQueueItem), team: team.map(toQueueItem), recentClosed: recentClosed.map(toQueueItem) };
}

/** What the customer may see. Excludes internal notes, agent emails, audit data. */
export async function getCustomerView(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: true,
      provider: true,
      property: { select: { name: true } },
      assignedAgent: { select: { name: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!e || e.piiDeletedAt) throw new NotFoundError("Enrollment not found");
  const snapshot = e.planSnapshot as unknown as PlanSnapshot;
  return {
    id: e.id,
    publicId: e.publicId,
    status: e.status,
    providerName: e.provider.name,
    confirmationNumberLabel: e.provider.confirmationNumberLabel,
    firstName: e.customer.firstName,
    plan: snapshot,
    advertisedPriceCents: e.advertisedPriceCents,
    serviceAddress: {
      street: decrypt(e.serviceStreetEnc),
      unit: decryptOptional(e.serviceUnitEnc),
      city: e.serviceCity,
      state: e.serviceState,
      zip: e.serviceZip,
    },
    propertyName: e.property?.name ?? null,
    preferredInstallDate: e.preferredInstallDate?.toISOString().slice(0, 10) ?? null,
    agentFirstName: e.assignedAgent?.name.split(" ")[0] ?? null,
    submittedAt: e.submittedAt.toISOString(),
    confirmation:
      e.status === "PROVIDER_ORDER_CONFIRMED" && e.confirmationNumber
        ? {
            number: e.confirmationNumber,
            planName: e.confirmedPlanName ?? snapshot.name,
            priceCents: e.confirmedPriceCents ?? e.advertisedPriceCents,
            installDate: e.confirmedInstallDate?.toISOString().slice(0, 10) ?? null,
            confirmedAt: e.confirmedAt?.toISOString() ?? null,
          }
        : null,
    timeline: e.statusHistory.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString() })),
    unreadForCustomer: e.unreadForCustomer,
  };
}

export type CustomerView = Awaited<ReturnType<typeof getCustomerView>>;
