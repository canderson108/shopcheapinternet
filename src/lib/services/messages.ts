import type { MessageKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { decrypt, encrypt } from "../crypto";
import { audit } from "../audit";
import { AppError, NotFoundError } from "../errors";
import { channels, publish } from "../realtime";
import { containsSensitiveNumber } from "../validation";
import { TERMINAL_STATUSES } from "../status";
import { lockEnrollment, transitionStatus } from "./status-service";
import { assertCanWork, staffActor, type StaffActor } from "./orders";
import { Effects } from "./effects";
import { notifyAgentCustomerReply, notifyCustomerStatus } from "./notify";

const SENSITIVE_MSG = "For your security, please don't send Social Security or payment card numbers in chat. Your specialist will explain how the provider collects that information securely.";

export const agentMessageSchema = z.object({
  kind: z.enum(["TEXT", "QUESTION", "INFO_REQUEST", "INSTALL_OPTIONS", "PRICE_CHANGE", "PROGRESS"]),
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
  options: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  newPriceCents: z.number().int().min(0).max(100_000).optional(),
  newPlanName: z.string().trim().max(120).optional(),
  requireInfo: z.boolean().optional(),
});

export type AgentMessageInput = z.input<typeof agentMessageSchema>;

export async function postAgentMessage(staff: StaffActor, enrollmentId: string, input: AgentMessageInput) {
  const d = agentMessageSchema.parse(input);
  if (containsSensitiveNumber(d.body)) throw new AppError("Messages must not contain Social Security or payment card numbers.", 422, "sensitive_data");
  if (d.kind === "INSTALL_OPTIONS" && (!d.options || d.options.length < 1)) throw new AppError("Add at least one installation option.", 422);
  if (d.kind === "PRICE_CHANGE" && d.newPriceCents === undefined) throw new AppError("Enter the revised monthly price.", 422);

  const payload: Prisma.InputJsonValue | undefined =
    d.kind === "INSTALL_OPTIONS"
      ? { options: d.options ?? [] }
      : d.kind === "PRICE_CHANGE"
        ? { newPriceCents: d.newPriceCents ?? 0, newPlanName: d.newPlanName ?? null }
        : undefined;

  const effects = new Effects();
  const msg = await prisma.$transaction(async (tx) => {
    const e = await lockEnrollment(tx, enrollmentId);
    assertCanWork(e, staff);
    if (TERMINAL_STATUSES.includes(e.status) && e.status !== "PROVIDER_ORDER_CONFIRMED") throw new AppError("This order is closed.", 422);
    const m = await tx.message.create({
      data: { enrollmentId: e.id, senderType: "AGENT", staffAuthorId: staff.id, kind: d.kind as MessageKind, bodyEnc: encrypt(d.body), payload },
    });
    await tx.enrollment.update({ where: { id: e.id }, data: { unreadForCustomer: { increment: 1 }, unreadForAgent: 0 } });
    const wantsInfo = d.kind === "INFO_REQUEST" || d.requireInfo;
    if (wantsInfo && ["AGENT_ASSIGNED", "AGENT_PROCESSING"].includes(e.status)) {
      await transitionStatus(tx, e, "ADDITIONAL_INFO_REQUIRED", staffActor(staff), { note: "Agent requested information from customer" });
      effects.add(() => notifyCustomerStatus(e.id, "ADDITIONAL_INFO_REQUIRED", { question: d.body }));
    }
    await audit(tx, { actor: staffActor(staff), action: "message.sent", entityType: "Message", entityId: m.id, enrollmentId: e.id, metadata: { kind: d.kind } });
    const chans = [channels.enrollment(e.id), channels.staff];
    if (e.assignedAgentId) chans.push(channels.agent(e.assignedAgentId));
    await publish(tx, chans, "message.created", { enrollmentId: e.id, messageId: m.id, sender: "AGENT" });
    return m;
  });
  await effects.run();
  return msg;
}

export const customerMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
  responseToId: z.string().max(40).optional().nullable(),
  decision: z.enum(["approve", "decline"]).optional(),
  option: z.string().max(120).optional(),
});

export async function postCustomerMessage(enrollmentId: string, input: z.input<typeof customerMessageSchema>) {
  const d = customerMessageSchema.parse(input);
  if (containsSensitiveNumber(d.body)) throw new AppError(SENSITIVE_MSG, 422, "sensitive_data");
  const effects = new Effects();
  const msg = await prisma.$transaction(async (tx) => {
    const e = await lockEnrollment(tx, enrollmentId);
    if (e.status === "CUSTOMER_CANCELED" || e.status === "UNABLE_TO_COMPLETE") throw new AppError("This enrollment is closed. Please contact us if you need help.", 422);
    let payload: Prisma.InputJsonValue | undefined;
    if (d.responseToId) {
      const original = await tx.message.findFirst({ where: { id: d.responseToId, enrollmentId: e.id, senderType: "AGENT" } });
      if (!original) throw new NotFoundError("Original message not found");
      if (original.kind === "PRICE_CHANGE") {
        if (!d.decision) throw new AppError("Choose approve or decline.", 422);
        payload = { decision: d.decision, ...(original.payload as object) };
      } else if (original.kind === "INSTALL_OPTIONS") {
        const options = ((original.payload as { options?: string[] } | null)?.options ?? []) as string[];
        if (!d.option || !options.includes(d.option)) throw new AppError("Choose one of the offered options.", 422);
        payload = { option: d.option };
      }
    }
    const m = await tx.message.create({
      data: {
        enrollmentId: e.id,
        senderType: "CUSTOMER",
        kind: d.responseToId ? "RESPONSE" : "TEXT",
        bodyEnc: encrypt(d.body),
        payload,
        responseToId: d.responseToId ?? null,
      },
    });
    await tx.enrollment.update({ where: { id: e.id }, data: { unreadForAgent: { increment: 1 }, unreadForCustomer: 0, lastCustomerMessageAt: new Date() } });
    await audit(tx, { actor: { type: "CUSTOMER" }, action: "message.received", entityType: "Message", entityId: m.id, enrollmentId: e.id });
    const chans = [channels.enrollment(e.id), channels.staff];
    if (e.assignedAgentId) chans.push(channels.agent(e.assignedAgentId));
    await publish(tx, chans, "message.created", { enrollmentId: e.id, messageId: m.id, sender: "CUSTOMER" });
    effects.add(() => notifyAgentCustomerReply(e.id));
    return m;
  });
  await effects.run();
  return msg;
}

export type ChatMessage = {
  id: string;
  sender: "CUSTOMER" | "AGENT" | "SYSTEM";
  authorName: string | null;
  kind: MessageKind;
  body: string;
  payload: unknown;
  responseToId: string | null;
  createdAt: string;
};

export async function listMessages(enrollmentId: string, audience: "customer" | "staff"): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: "asc" },
    include: { staffAuthor: { select: { name: true } } },
    take: 500,
  });
  return rows.map((m) => ({
    id: m.id,
    sender: m.senderType,
    // Customers only see the agent's first name.
    authorName: m.staffAuthor ? (audience === "customer" ? m.staffAuthor.name.split(" ")[0] : m.staffAuthor.name) : null,
    kind: m.kind,
    body: decrypt(m.bodyEnc),
    payload: m.payload,
    responseToId: m.responseToId,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function markRead(enrollmentId: string, audience: "customer" | "agent") {
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: audience === "customer" ? { unreadForCustomer: 0 } : { unreadForAgent: 0 },
  });
}
