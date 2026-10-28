import type { Enrollment, EnrollmentStatus, StaffRole } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import { audit, type Actor } from "../audit";
import { encrypt } from "../crypto";
import { AppError, ConflictError, ForbiddenError } from "../errors";
import { AGENT_SETTABLE, CHECKLIST_ITEMS, CUSTOMER_CANCELABLE, type ChecklistState } from "../status";
import { channels, publish } from "../realtime";
import { containsSensitiveNumber } from "../validation";
import { lockEnrollment, transitionStatus } from "./status-service";
import { Effects } from "./effects";
import { notifyCustomerStatus } from "./notify";
import { serverConversion } from "./conversions";
import { drainQueue } from "./assignment";

export type StaffActor = { id: string; role: StaffRole; name: string };

export function staffActor(s: StaffActor): Actor {
  return { type: "STAFF", staffId: s.id, name: s.name, role: s.role };
}

/** Agents may only act on orders assigned to them; managers and admins may act on any. */
export function assertCanWork(enrollment: Pick<Enrollment, "assignedAgentId">, staff: StaffActor) {
  if (staff.role === "AGENT" && enrollment.assignedAgentId !== staff.id) {
    throw new ForbiddenError("This order is assigned to another agent.");
  }
}

async function withOrder<T>(enrollmentId: string, staff: StaffActor, fn: (tx: Tx, e: Enrollment, effects: Effects) => Promise<T>): Promise<T> {
  const effects = new Effects();
  const out = await prisma.$transaction(async (tx) => {
    const e = await lockEnrollment(tx, enrollmentId);
    assertCanWork(e, staff);
    return fn(tx, e, effects);
  });
  await effects.run();
  return out;
}

/** Agent opens an assigned order to work it: AGENT_ASSIGNED -> AGENT_PROCESSING. */
export async function startProcessing(staff: StaffActor, enrollmentId: string) {
  return withOrder(enrollmentId, staff, async (tx, e) => {
    if (e.status !== "AGENT_ASSIGNED") return e.statusVersion;
    const r = await transitionStatus(tx, e, "AGENT_PROCESSING", staffActor(staff), { note: "Agent started processing" });
    return r.statusVersion;
  });
}

export async function changeStatus(
  staff: StaffActor,
  enrollmentId: string,
  to: EnrollmentStatus,
  opts: { note?: string | null; expectedVersion?: number },
) {
  if (!AGENT_SETTABLE.includes(to) && !(to === "AGENT_PROCESSING")) {
    throw new AppError("Use the confirmation form to confirm an order.", 422, "invalid_transition");
  }
  if (to === "UNABLE_TO_COMPLETE" && !opts.note?.trim()) {
    throw new AppError("Add a note explaining why the order can't be completed.", 422, "note_required");
  }
  let freedCapacity = false;
  const r = await withOrder(enrollmentId, staff, async (tx, e, effects) => {
    // Reopening a closed order is an administrator action.
    if (e.status === "UNABLE_TO_COMPLETE" && staff.role !== "ADMIN") throw new ForbiddenError("Only administrators can reopen closed orders.");
    const res = await transitionStatus(tx, e, to, staffActor(staff), {
      note: opts.note,
      expectedVersion: opts.expectedVersion,
      data: {
        ...(to === "SUBMITTED_TO_PROVIDER" ? { orderSubmittedAt: e.orderSubmittedAt ?? new Date() } : {}),
        ...(to === "UNABLE_TO_COMPLETE" || to === "CUSTOMER_CANCELED" ? { completedAt: new Date() } : {}),
      },
    });
    if (to === "SUBMITTED_TO_PROVIDER") {
      await setChecklistKeys(tx, e, ["order_submitted"], staff);
      effects.add(() => notifyCustomerStatus(e.id, "SUBMITTED_TO_PROVIDER"));
    }
    if (to === "UNABLE_TO_COMPLETE") effects.add(() => notifyCustomerStatus(e.id, "UNABLE_TO_COMPLETE", { reason: opts.note }));
    if (to === "UNABLE_TO_COMPLETE" || to === "CUSTOMER_CANCELED") freedCapacity = true;
    if (opts.note && to !== "UNABLE_TO_COMPLETE") {
      // Status notes are internal unless sent as a message.
      await tx.agentNote.create({ data: { enrollmentId: e.id, authorId: staff.id, bodyEnc: encrypt(`[Status → ${to}] ${opts.note}`) } });
    }
    return res.statusVersion;
  });
  if (freedCapacity) await drainQueue();
  return r;
}

async function setChecklistKeys(tx: Tx, e: Enrollment, keys: string[], staff: StaffActor) {
  const state = { ...((e.checklist as ChecklistState | null) ?? {}) };
  for (const k of keys) state[k] = { done: true, by: staff.name, at: new Date().toISOString() };
  await tx.enrollment.update({ where: { id: e.id }, data: { checklist: state } });
}

export async function updateChecklist(staff: StaffActor, enrollmentId: string, key: string, done: boolean) {
  if (!CHECKLIST_ITEMS.some((i) => i.key === key)) throw new AppError("Unknown checklist item", 400);
  return withOrder(enrollmentId, staff, async (tx, e) => {
    const state = { ...((e.checklist as ChecklistState | null) ?? {}) };
    state[key] = done ? { done: true, by: staff.name, at: new Date().toISOString() } : { done: false };
    await tx.enrollment.update({ where: { id: e.id }, data: { checklist: state } });
    await audit(tx, { actor: staffActor(staff), action: "checklist.updated", entityType: "Enrollment", entityId: e.id, enrollmentId: e.id, metadata: { key, done } });
    if (key === "availability_confirmed" && done && e.availabilityStatus !== "AGENT_VERIFIED") {
      await tx.enrollment.update({ where: { id: e.id }, data: { availabilityStatus: "AGENT_VERIFIED" } });
    }
    if (key === "address_verified" && done) await tx.enrollment.update({ where: { id: e.id }, data: { addressVerified: true } });
    await publish(tx, [channels.enrollment(e.id), channels.staff], "enrollment.updated", { enrollmentId: e.id });
    return state;
  });
}

export async function recordPortalOpened(staff: StaffActor, enrollmentId: string): Promise<string> {
  return withOrder(enrollmentId, staff, async (tx, e) => {
    const provider = await tx.provider.findUniqueOrThrow({ where: { id: e.providerId } });
    if (!provider.orderPortalUrl) throw new AppError(`No order portal URL is configured for ${provider.name}. An administrator can set it under Providers.`, 422, "portal_missing");
    await setChecklistKeys(tx, e, ["portal_opened"], staff);
    await audit(tx, { actor: staffActor(staff), action: "portal.opened", entityType: "Enrollment", entityId: e.id, enrollmentId: e.id, metadata: { provider: provider.slug } });
    if (e.status === "AGENT_ASSIGNED") await transitionStatus(tx, e, "AGENT_PROCESSING", staffActor(staff), { note: "Agent opened provider portal" });
    return provider.orderPortalUrl;
  });
}

export async function addAgentNote(staff: StaffActor, enrollmentId: string, body: string) {
  const text = body.trim();
  if (!text) throw new AppError("Note can't be empty", 422);
  if (text.length > 4000) throw new AppError("Note is too long", 422);
  if (containsSensitiveNumber(text)) throw new AppError("Notes must not contain Social Security or payment card numbers.", 422, "sensitive_data");
  return withOrder(enrollmentId, staff, async (tx, e) => {
    const note = await tx.agentNote.create({ data: { enrollmentId: e.id, authorId: staff.id, bodyEnc: encrypt(text) } });
    await audit(tx, { actor: staffActor(staff), action: "note.added", entityType: "AgentNote", entityId: note.id, enrollmentId: e.id });
    const chans = [channels.staff];
    if (e.assignedAgentId) chans.push(channels.agent(e.assignedAgentId));
    await publish(tx, chans, "enrollment.updated", { enrollmentId: e.id });
    return note;
  });
}

export const confirmationSchema = z.object({
  confirmationNumber: z.string().trim().min(4, "Enter the provider's confirmation number").max(40).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  confirmedPlanName: z.string().trim().min(2).max(120),
  confirmedPriceCents: z.number().int().min(0).max(100_000),
  confirmedInstallDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(`${s}T00:00:00.000Z`) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date"),
  orderSubmittedAt: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null))
    .refine((d) => d === null || (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 60_000), "Submission date can't be in the future"),
  notes: z.string().max(2000).optional().nullable(),
  expectedVersion: z.number().int().optional(),
});

export type ConfirmationInput = z.input<typeof confirmationSchema>;

/**
 * Records a verified provider confirmation. Only the assigned agent, a manager, or an admin can do
 * this, and only after the order was actually submitted through the provider portal.
 * The customer confirmation email is sent only after this transaction commits.
 */
export async function confirmOrder(staff: StaffActor, enrollmentId: string, input: ConfirmationInput) {
  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid confirmation", 422, "validation");
  const d = parsed.data;
  return withOrder(enrollmentId, staff, async (tx, e, effects) => {
    if (!["AGENT_PROCESSING", "SUBMITTED_TO_PROVIDER"].includes(e.status)) {
      throw new AppError("Only orders that are being processed or were submitted to the provider can be confirmed.", 422, "invalid_transition");
    }
    if (d.expectedVersion !== undefined && d.expectedVersion !== e.statusVersion) throw new ConflictError();
    const actor = staffActor(staff);
    let current: Pick<Enrollment, "id" | "status" | "statusVersion" | "assignedAgentId"> = e;
    if (e.status === "AGENT_PROCESSING") {
      const r = await transitionStatus(tx, e, "SUBMITTED_TO_PROVIDER", actor, {
        note: "Order submitted through provider portal",
        data: { orderSubmittedAt: d.orderSubmittedAt ?? new Date() },
      });
      current = { ...e, status: "SUBMITTED_TO_PROVIDER", statusVersion: r.statusVersion };
    }
    const now = new Date();
    const res = await transitionStatus(tx, current, "PROVIDER_ORDER_CONFIRMED", actor, {
      note: d.notes ?? `Confirmation ${d.confirmationNumber} recorded`,
      data: {
        confirmationNumber: d.confirmationNumber.toUpperCase(),
        confirmedPlanName: d.confirmedPlanName,
        confirmedPriceCents: d.confirmedPriceCents,
        confirmedInstallDate: d.confirmedInstallDate,
        orderSubmittedAt: d.orderSubmittedAt ?? e.orderSubmittedAt ?? now,
        confirmationNotes: d.notes ?? null,
        confirmedById: staff.id,
        confirmedAt: now,
        completedAt: now,
        availabilityStatus: "AGENT_VERIFIED",
      },
    });
    const fresh = await tx.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    await setChecklistKeys(tx, fresh, ["availability_confirmed", "order_submitted", "confirmation_received", "customer_notified"], staff);
    await audit(tx, {
      actor,
      action: "order.confirmed",
      entityType: "Enrollment",
      entityId: e.id,
      enrollmentId: e.id,
      metadata: { confirmationNumber: d.confirmationNumber, confirmedPriceCents: d.confirmedPriceCents, advertisedPriceCents: e.advertisedPriceCents },
    });
    await tx.message.create({
      data: {
        enrollmentId: e.id,
        senderType: "SYSTEM",
        kind: "PROGRESS",
        bodyEnc: encrypt(`Your order is confirmed. Confirmation number: ${d.confirmationNumber.toUpperCase()}.`),
      },
    });
    effects.add(() => notifyCustomerStatus(e.id, "PROVIDER_ORDER_CONFIRMED"));
    effects.add(() => serverConversion(e.id, "order_confirmed"));
    effects.add(() => drainQueue());
    return res.statusVersion;
  });
}

/** Customer-initiated cancellation from the status page. */
export async function cancelByCustomer(enrollmentId: string, reason?: string | null) {
  await prisma.$transaction(async (tx) => {
    const e = await lockEnrollment(tx, enrollmentId);
    if (!CUSTOMER_CANCELABLE.includes(e.status)) {
      throw new AppError("This order can no longer be canceled online. Please message your specialist or contact us.", 422, "not_cancelable");
    }
    await transitionStatus(tx, e, "CUSTOMER_CANCELED", { type: "CUSTOMER" }, { note: reason?.slice(0, 500) || "Canceled by customer", data: { completedAt: new Date() }, force: true });
  });
  await drainQueue();
}
