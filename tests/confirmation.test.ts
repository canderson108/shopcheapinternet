import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { memoryOutbox } from "@/lib/email/send";
import { submitEnrollment } from "@/lib/services/enrollment";
import { addAgentNote, changeStatus, confirmOrder, recordPortalOpened, startProcessing, updateChecklist } from "@/lib/services/orders";
import { listMessages, postAgentMessage, postCustomerMessage } from "@/lib/services/messages";
import { getAgentOrderView, getCustomerView } from "@/lib/services/views";
import { anonymizeEnrollment } from "@/lib/services/retention";
import { createAgent, readySession, resetDb, seedProviderAndPlan, submitInput } from "./helpers";

async function assignedOrder(portal?: string | null) {
  const { plan } = await seedProviderAndPlan({ portal });
  const agent = await createAgent("AVAILABLE");
  const s = await readySession(plan.id);
  const { enrollment } = await submitEnrollment(s.id, submitInput());
  memoryOutbox.length = 0;
  return { enrollment, agent, plan };
}

const confirmation = {
  confirmationNumber: "att-55512345",
  confirmedPlanName: "AT&T Fiber 500",
  confirmedPriceCents: 6000,
  confirmedInstallDate: "2026-11-04",
  orderSubmittedAt: new Date(Date.now() - 60_000).toISOString(),
  notes: "SPOC accepted",
};

describe("order processing and confirmation", () => {
  beforeEach(resetDb);

  it("walks the full agent workflow and only emails a confirmation after it is verified", async () => {
    const { enrollment: e, agent } = await assignedOrder();

    // Opening the portal returns the configured URL, logs it, ticks the checklist and starts processing.
    const url = await recordPortalOpened(agent.actor, e.id);
    expect(url).toBe("https://www.attspoc.com/");
    let cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("AGENT_PROCESSING");
    expect((cur.checklist as Record<string, { done: boolean }>).portal_opened.done).toBe(true);

    await updateChecklist(agent.actor, e.id, "address_verified", true);
    await updateChecklist(agent.actor, e.id, "availability_confirmed", true);
    cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.addressVerified).toBe(true);
    expect(cur.availabilityStatus).toBe("AGENT_VERIFIED");

    await addAgentNote(agent.actor, e.id, "Customer prefers morning install");
    await postAgentMessage(agent.actor, e.id, { kind: "INSTALL_OPTIONS", body: "Pick an install window", options: ["Tue 8–12", "Wed 1–5"] });
    const msgs = await listMessages(e.id, "customer");
    await postCustomerMessage(e.id, { body: "I'd like: Tue 8–12", responseToId: msgs[0].id, option: "Tue 8–12" });

    await changeStatus(agent.actor, e.id, "SUBMITTED_TO_PROVIDER", { note: "Entered in SPOC" });
    expect(memoryOutbox.map((m) => m.template)).toContain("submitted_to_provider");
    expect(memoryOutbox.map((m) => m.template)).not.toContain("order_confirmed");
    cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("SUBMITTED_TO_PROVIDER");
    expect(cur.confirmationNumber).toBeNull();

    await confirmOrder(agent.actor, e.id, confirmation);
    cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("PROVIDER_ORDER_CONFIRMED");
    expect(cur.confirmationNumber).toBe("ATT-55512345");
    expect(cur.confirmedById).toBe(agent.user.id);
    expect(cur.confirmedInstallDate?.toISOString().slice(0, 10)).toBe("2026-11-04");
    expect(cur.completedAt).not.toBeNull();

    const confirmEmails = memoryOutbox.filter((m) => m.template === "order_confirmed");
    expect(confirmEmails).toHaveLength(1);
    expect(confirmEmails[0].text).toContain("ATT-55512345");

    const view = await getCustomerView(e.id);
    expect(view.confirmation?.number).toBe("ATT-55512345");
    const agentView = await getAgentOrderView(e.id);
    expect(agentView.notes[0].body).toContain("morning install");
    expect(agentView.history.map((h) => h.to)).toEqual(
      expect.arrayContaining(["AGENT_ASSIGNED", "AGENT_PROCESSING", "SUBMITTED_TO_PROVIDER", "PROVIDER_ORDER_CONFIRMED"]),
    );
    // Every status change records actor, previous and new status.
    for (const h of await prisma.enrollmentStatusHistory.findMany({ where: { enrollmentId: e.id } })) {
      expect(h.toStatus).toBeTruthy();
      expect(h.actorType).toBeTruthy();
    }
    expect(await prisma.auditLog.count({ where: { enrollmentId: e.id, action: "order.confirmed" } })).toBe(1);
  });

  it("only the assigned agent (or a manager) can confirm", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await startProcessing(agent.actor, e.id);
    const other = await createAgent("BUSY");
    await expect(confirmOrder(other.actor, e.id, confirmation)).rejects.toMatchObject({ status: 403 });
    const mgr = await createAgent("OFFLINE", { role: "MANAGER" });
    await expect(confirmOrder(mgr.actor, e.id, confirmation)).resolves.toBeTypeOf("number");
  });

  it("cannot confirm before the order is being processed, and validates the confirmation", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await expect(confirmOrder(agent.actor, e.id, confirmation)).rejects.toMatchObject({ code: "invalid_transition" });
    await startProcessing(agent.actor, e.id);
    await expect(confirmOrder(agent.actor, e.id, { ...confirmation, confirmationNumber: "x" })).rejects.toMatchObject({ code: "validation" });
    await expect(confirmOrder(agent.actor, e.id, { ...confirmation, orderSubmittedAt: new Date(Date.now() + 86400_000).toISOString() })).rejects.toMatchObject({ code: "validation" });
    expect(memoryOutbox.filter((m) => m.template === "order_confirmed")).toHaveLength(0);
  });

  it("rejects stale updates (optimistic concurrency)", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    const v = await startProcessing(agent.actor, e.id);
    await changeStatus(agent.actor, e.id, "ADDITIONAL_INFO_REQUIRED", { expectedVersion: v });
    await expect(changeStatus(agent.actor, e.id, "SUBMITTED_TO_PROVIDER", { expectedVersion: v })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects invalid status transitions and requires a reason for unable-to-complete", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await expect(changeStatus(agent.actor, e.id, "SUBMITTED_TO_PROVIDER", {})).rejects.toMatchObject({ code: "invalid_transition" });
    await startProcessing(agent.actor, e.id);
    await expect(changeStatus(agent.actor, e.id, "UNABLE_TO_COMPLETE", {})).rejects.toMatchObject({ code: "note_required" });
    await changeStatus(agent.actor, e.id, "UNABLE_TO_COMPLETE", { note: "No fiber at this address" });
    expect(memoryOutbox.map((m) => m.template)).toContain("unable_to_complete");
    await expect(confirmOrder(agent.actor, e.id, confirmation)).rejects.toBeTruthy();
  });

  it("requests information from the customer and records their reply", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await startProcessing(agent.actor, e.id);
    await postAgentMessage(agent.actor, e.id, { kind: "INFO_REQUEST", body: "Is there a gate code?" });
    let cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("ADDITIONAL_INFO_REQUIRED");
    expect(memoryOutbox.map((m) => m.template)).toContain("info_requested");
    await postCustomerMessage(e.id, { body: "Yes, #4521" });
    cur = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.unreadForAgent).toBe(1);
    const events = await prisma.realtimeEvent.findMany({ where: { channel: `agent:${agent.user.id}`, type: "message.created" } });
    expect(events.length).toBeGreaterThan(0);
  });

  it("price changes require explicit customer approval", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await startProcessing(agent.actor, e.id);
    const m = await postAgentMessage(agent.actor, e.id, { kind: "PRICE_CHANGE", body: "Fiber 500 is $65 at your address", newPriceCents: 6500 });
    await expect(postCustomerMessage(e.id, { body: "ok", responseToId: m.id })).rejects.toMatchObject({ status: 422 });
    await postCustomerMessage(e.id, { body: "I approve", responseToId: m.id, decision: "approve" });
    const msgs = await listMessages(e.id, "staff");
    expect(msgs.at(-1)?.payload).toMatchObject({ decision: "approve", newPriceCents: 6500 });
  });

  it("blocks SSNs and card numbers in chat and notes", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await expect(postCustomerMessage(e.id, { body: "my ssn is 123-45-6789" })).rejects.toMatchObject({ code: "sensitive_data" });
    await expect(postCustomerMessage(e.id, { body: "card 4111 1111 1111 1111" })).rejects.toMatchObject({ code: "sensitive_data" });
    await expect(addAgentNote(agent.actor, e.id, "SSN 123-45-6789")).rejects.toMatchObject({ code: "sensitive_data" });
    await expect(postCustomerMessage(e.id, { body: "My phone is 214-555-0142" })).resolves.toBeTruthy();
  });

  it("refuses to open the portal when no portal URL is configured", async () => {
    const { enrollment: e, agent } = await assignedOrder(null);
    await expect(recordPortalOpened(agent.actor, e.id)).rejects.toMatchObject({ code: "portal_missing" });
  });

  it("erases customer PII on a deletion request", async () => {
    const { enrollment: e, agent } = await assignedOrder();
    await startProcessing(agent.actor, e.id);
    await confirmOrder(agent.actor, e.id, confirmation);
    await anonymizeEnrollment(e.id, { type: "STAFF", staffId: agent.user.id }, "customer request");
    const v = await getAgentOrderView(e.id);
    expect(v.piiDeleted).toBe(true);
    expect(v.customer.email).toBe("[deleted]");
    expect(v.confirmation?.number).toBe("ATT-55512345");
    await expect(getCustomerView(e.id)).rejects.toMatchObject({ status: 404 });
  });
});
