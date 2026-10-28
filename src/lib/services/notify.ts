import type { EnrollmentStatus } from "@prisma/client";
import { prisma } from "../db";
import { decrypt } from "../crypto";
import { env } from "../env";
import { createAccessLink } from "../auth/customer";
import { sendEmail } from "../email/send";
import * as T from "../email/templates";

async function loadForEmail(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { customer: true, provider: true, plan: true, assignedAgent: { select: { name: true, email: true } } },
  });
  if (!e || e.piiDeletedAt || e.customer.deletedAt) return null;
  const statusUrl = await createAccessLink(prisma, e.id);
  return {
    e,
    to: decrypt(e.customer.emailEnc),
    base: {
      firstName: e.customer.firstName,
      publicId: e.publicId,
      statusUrl,
      providerName: e.provider.name,
      planName: e.plan.name,
    },
  };
}

/** Customer-facing email for a status. Only verified events trigger confirmation emails. */
export async function notifyCustomerStatus(enrollmentId: string, status: EnrollmentStatus, extra: { question?: string; reason?: string | null } = {}) {
  const d = await loadForEmail(enrollmentId);
  if (!d) return;
  const { e, to, base } = d;
  let rendered: { subject: string; html: string; text: string } | null = null;
  let template: string = status;
  switch (status) {
    case "AGENT_ASSIGNED":
      if (!e.assignedAgent) return;
      rendered = T.agentAssignedEmail({ ...base, agentFirstName: e.assignedAgent.name.split(" ")[0] });
      template = "agent_assigned";
      break;
    case "ADDITIONAL_INFO_REQUIRED":
      rendered = T.infoRequestedEmail({ ...base, question: extra.question ?? "Please check your status page for your specialist's question." });
      template = "info_requested";
      break;
    case "SUBMITTED_TO_PROVIDER":
      rendered = T.submittedToProviderEmail(base);
      template = "submitted_to_provider";
      break;
    case "PROVIDER_ORDER_CONFIRMED":
      // Guard: never send a confirmation unless the agent recorded a verified confirmation.
      if (!e.confirmationNumber || !e.confirmedAt || !e.confirmedById) return;
      rendered = T.orderConfirmedEmail({
        ...base,
        confirmationNumber: e.confirmationNumber,
        confirmationLabel: e.provider.confirmationNumberLabel,
        confirmedPlanName: e.confirmedPlanName ?? e.plan.name,
        confirmedPriceCents: e.confirmedPriceCents ?? e.advertisedPriceCents,
        installDate: e.confirmedInstallDate,
      });
      template = "order_confirmed";
      break;
    case "UNABLE_TO_COMPLETE":
      rendered = T.unableToCompleteEmail({ ...base, reason: extra.reason });
      template = "unable_to_complete";
      break;
    default:
      return;
  }
  await sendEmail({ to, ...rendered, template, enrollmentId });
}

export async function notifyEnrollmentReceived(enrollmentId: string, queued: boolean) {
  const d = await loadForEmail(enrollmentId);
  if (!d) return;
  const rendered = T.enrollmentReceivedEmail({ ...d.base, priceCents: d.e.advertisedPriceCents, queued });
  await sendEmail({ to: d.to, ...rendered, template: "enrollment_received", enrollmentId });
}

export async function notifyAgentAssigned(enrollmentId: string, agentId: string) {
  const [e, agent] = await Promise.all([
    prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { provider: true, plan: true } }),
    prisma.staffUser.findUnique({ where: { id: agentId } }),
  ]);
  if (!e || !agent) return;
  const rendered = T.agentNewOrderEmail({
    agentName: agent.name,
    publicId: e.publicId,
    planLabel: `${e.provider.name} ${e.plan.name}`,
    city: e.serviceCity,
    state: e.serviceState,
    url: `${env.appUrl}/agent/orders/${e.id}`,
    queued: false,
  });
  await sendEmail({ to: agent.email, ...rendered, template: "agent_new_order", enrollmentId });
}

export async function notifyQueueWaiting(enrollmentId: string) {
  if (!env.agentNotifyEmail) return;
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { provider: true, plan: true } });
  if (!e) return;
  const rendered = T.agentNewOrderEmail({
    agentName: "team",
    publicId: e.publicId,
    planLabel: `${e.provider.name} ${e.plan.name}`,
    city: e.serviceCity,
    state: e.serviceState,
    url: `${env.appUrl}/agent`,
    queued: true,
  });
  await sendEmail({ to: env.agentNotifyEmail, ...rendered, template: "agent_queue_waiting", enrollmentId });
}

export async function notifyAgentCustomerReply(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { assignedAgent: { include: { agentProfile: true } } },
  });
  const agent = e?.assignedAgent;
  // Online agents get the real-time notification; email only when they are offline.
  if (!e || !agent || agent.agentProfile?.availability !== "OFFLINE") return;
  const rendered = T.agentCustomerReplyEmail({ agentName: agent.name, publicId: e.publicId, url: `${env.appUrl}/agent/orders/${e.id}` });
  await sendEmail({ to: agent.email, ...rendered, template: "agent_customer_reply", enrollmentId });
}
