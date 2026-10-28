import type { EnrollmentStatus } from "@prisma/client";

export const ALL_STATUSES: EnrollmentStatus[] = [
  "ENROLLMENT_STARTED",
  "INFORMATION_SUBMITTED",
  "WAITING_FOR_AGENT",
  "AGENT_ASSIGNED",
  "AGENT_PROCESSING",
  "ADDITIONAL_INFO_REQUIRED",
  "SUBMITTED_TO_PROVIDER",
  "PROVIDER_ORDER_CONFIRMED",
  "UNABLE_TO_COMPLETE",
  "CUSTOMER_CANCELED",
];

/** Statuses in which an order counts against an agent's active workload. */
export const ACTIVE_AGENT_STATUSES: EnrollmentStatus[] = [
  "AGENT_ASSIGNED",
  "AGENT_PROCESSING",
  "ADDITIONAL_INFO_REQUIRED",
  "SUBMITTED_TO_PROVIDER",
];

export const OPEN_STATUSES: EnrollmentStatus[] = ["INFORMATION_SUBMITTED", "WAITING_FOR_AGENT", ...ACTIVE_AGENT_STATUSES];

export const TERMINAL_STATUSES: EnrollmentStatus[] = ["PROVIDER_ORDER_CONFIRMED", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"];

/** Statuses from which the customer may still cancel online. */
export const CUSTOMER_CANCELABLE: EnrollmentStatus[] = [
  "INFORMATION_SUBMITTED",
  "WAITING_FOR_AGENT",
  "AGENT_ASSIGNED",
  "AGENT_PROCESSING",
  "ADDITIONAL_INFO_REQUIRED",
];

const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  ENROLLMENT_STARTED: ["INFORMATION_SUBMITTED", "CUSTOMER_CANCELED"],
  INFORMATION_SUBMITTED: ["WAITING_FOR_AGENT", "AGENT_ASSIGNED", "CUSTOMER_CANCELED"],
  WAITING_FOR_AGENT: ["AGENT_ASSIGNED", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"],
  AGENT_ASSIGNED: ["AGENT_PROCESSING", "WAITING_FOR_AGENT", "ADDITIONAL_INFO_REQUIRED", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED"],
  AGENT_PROCESSING: [
    "AGENT_ASSIGNED",
    "ADDITIONAL_INFO_REQUIRED",
    "SUBMITTED_TO_PROVIDER",
    "UNABLE_TO_COMPLETE",
    "CUSTOMER_CANCELED",
    "WAITING_FOR_AGENT",
  ],
  ADDITIONAL_INFO_REQUIRED: ["AGENT_PROCESSING", "UNABLE_TO_COMPLETE", "CUSTOMER_CANCELED", "WAITING_FOR_AGENT"],
  SUBMITTED_TO_PROVIDER: ["PROVIDER_ORDER_CONFIRMED", "AGENT_PROCESSING", "UNABLE_TO_COMPLETE"],
  PROVIDER_ORDER_CONFIRMED: [],
  UNABLE_TO_COMPLETE: ["AGENT_PROCESSING"], // administrators only (reopen)
  CUSTOMER_CANCELED: [],
};

export function canTransition(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedNextStatuses(from: EnrollmentStatus): EnrollmentStatus[] {
  return TRANSITIONS[from];
}

/** Statuses an agent may set directly from the status control (confirmation has its own form). */
export const AGENT_SETTABLE: EnrollmentStatus[] = [
  "AGENT_PROCESSING",
  "ADDITIONAL_INFO_REQUIRED",
  "SUBMITTED_TO_PROVIDER",
  "UNABLE_TO_COMPLETE",
  "CUSTOMER_CANCELED",
];

export function statusLabel(status: EnrollmentStatus, providerName = "provider"): string {
  switch (status) {
    case "ENROLLMENT_STARTED":
      return "Enrollment Started";
    case "INFORMATION_SUBMITTED":
      return "Information Submitted";
    case "WAITING_FOR_AGENT":
      return "Waiting for Agent";
    case "AGENT_ASSIGNED":
      return "Agent Assigned";
    case "AGENT_PROCESSING":
      return "Agent Processing";
    case "ADDITIONAL_INFO_REQUIRED":
      return "Additional Information Required";
    case "SUBMITTED_TO_PROVIDER":
      return `Submitted to ${providerName}`;
    case "PROVIDER_ORDER_CONFIRMED":
      return `${providerName} Order Confirmed`;
    case "UNABLE_TO_COMPLETE":
      return "Unable to Complete";
    case "CUSTOMER_CANCELED":
      return "Customer Canceled";
  }
}

/** Plain-language explanation shown on the customer status page. Never over-promises. */
export function customerStatusDescription(status: EnrollmentStatus, providerName: string): string {
  switch (status) {
    case "ENROLLMENT_STARTED":
    case "INFORMATION_SUBMITTED":
      return "We received your enrollment request. This is a request — your service is not ordered yet.";
    case "WAITING_FOR_AGENT":
      return "Your request is in our queue. An enrollment specialist will pick it up as soon as one is available. You can leave this page — we'll email you when there's an update.";
    case "AGENT_ASSIGNED":
      return "An enrollment specialist has been assigned to your request and will begin reviewing it shortly.";
    case "AGENT_PROCESSING":
      return `Your specialist is reviewing your details and checking ${providerName} availability at your address.`;
    case "ADDITIONAL_INFO_REQUIRED":
      return "Your specialist needs a bit more information to continue. Please check the messages below.";
    case "SUBMITTED_TO_PROVIDER":
      return `Your order has been submitted to ${providerName}. We're waiting for ${providerName} to confirm it.`;
    case "PROVIDER_ORDER_CONFIRMED":
      return `${providerName} has confirmed your order. Your confirmation details are below.`;
    case "UNABLE_TO_COMPLETE":
      return "We weren't able to complete this order. See the messages below for details, or contact us for other options.";
    case "CUSTOMER_CANCELED":
      return "This enrollment request was canceled.";
  }
}

/** Ordered milestones used for the customer progress tracker. */
export const CUSTOMER_MILESTONES: { key: string; label: string; statuses: EnrollmentStatus[] }[] = [
  { key: "received", label: "Request received", statuses: ["INFORMATION_SUBMITTED", "WAITING_FOR_AGENT"] },
  { key: "specialist", label: "Specialist assigned", statuses: ["AGENT_ASSIGNED", "AGENT_PROCESSING", "ADDITIONAL_INFO_REQUIRED"] },
  { key: "submitted", label: "Submitted to provider", statuses: ["SUBMITTED_TO_PROVIDER"] },
  { key: "confirmed", label: "Order confirmed", statuses: ["PROVIDER_ORDER_CONFIRMED"] },
];

export function milestoneIndex(status: EnrollmentStatus): number {
  return CUSTOMER_MILESTONES.findIndex((m) => m.statuses.includes(status));
}

export const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "info_reviewed", label: "Customer information reviewed" },
  { key: "address_verified", label: "Service address verified" },
  { key: "availability_confirmed", label: "Plan availability confirmed" },
  { key: "portal_opened", label: "Provider order portal opened" },
  { key: "info_entered", label: "Customer information entered" },
  { key: "install_reviewed", label: "Installation options reviewed" },
  { key: "customer_approval", label: "Customer approval obtained, if needed" },
  { key: "order_submitted", label: "Order submitted through portal" },
  { key: "confirmation_received", label: "Confirmation number received" },
  { key: "customer_notified", label: "Customer notified" },
];

export type ChecklistState = Record<string, { done: boolean; by?: string; at?: string }>;
