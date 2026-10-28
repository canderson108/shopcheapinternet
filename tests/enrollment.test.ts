import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decrypt, lookupHash } from "@/lib/crypto";
import { memoryOutbox } from "@/lib/email/send";
import { submitEnrollment } from "@/lib/services/enrollment";
import { getCustomerView } from "@/lib/services/views";
import { enrollmentIdForCustomerToken, createAccessLink, redeemAccessToken } from "@/lib/auth/customer";
import { createFunnelSession, saveDraft, sessionDraft, selectPlan, setSessionAddress } from "@/lib/services/funnel";
import { getPlanOffersForZip } from "@/lib/services/plans";
import { AppError } from "@/lib/errors";
import { createAgent, readySession, resetDb, seedProviderAndPlan, submitInput } from "./helpers";

describe("customer enrollment workflow", () => {
  beforeEach(resetDb);

  it("submits an enrollment, encrypts PII at rest, records history and consent, and queues it when no agent is available", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    const input = submitInput({ email: "Jordan.Rivera@Example.com" });

    const res = await submitEnrollment(session.id, input, { ipHash: "iphash", userAgent: "vitest" });
    expect(res.duplicate).toBe(false);
    const e = res.enrollment;
    expect(e.publicId).toMatch(/^SCI-[2-9A-Z]{10}$/);
    // No agents exist → request waits in the queue; it is NOT marked submitted/confirmed with AT&T.
    expect(e.status).toBe("WAITING_FOR_AGENT");
    expect(e.assignedAgentId).toBeNull();
    expect(e.confirmationNumber).toBeNull();
    expect(e.advertisedPriceCents).toBe(6000);
    expect(e.pricingSource).toBe("test source");
    expect(e.availabilityStatus).toBe("INDICATIVE");
    expect(e.utmSource).toBe("google");
    expect(e.gclid).toBe("test-gclid");

    // PII is encrypted in the database and decrypts correctly.
    const raw = await prisma.$queryRaw<{ serviceStreetEnc: string; emailEnc: string }[]>`
      SELECT e."serviceStreetEnc", c."emailEnc" FROM "Enrollment" e JOIN "Customer" c ON c."id" = e."customerId" WHERE e."id" = ${e.id}`;
    expect(raw[0].serviceStreetEnc).not.toContain("Main");
    expect(raw[0].emailEnc).not.toContain("example.com");
    expect(decrypt(raw[0].emailEnc)).toBe("jordan.rivera@example.com");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: e.customerId } });
    expect(customer.emailHash).toBe(lookupHash("jordan.rivera@example.com"));
    expect(decrypt(customer.phoneEnc)).toBe("2145550142");

    const history = await prisma.enrollmentStatusHistory.findMany({ where: { enrollmentId: e.id }, orderBy: { createdAt: "asc" } });
    expect(history).toHaveLength(3);
    expect(history.map((h) => h.toStatus)).toEqual(expect.arrayContaining(["ENROLLMENT_STARTED", "INFORMATION_SUBMITTED", "WAITING_FOR_AGENT"]));
    for (const h of history) expect(h.createdAt).toBeInstanceOf(Date);
    const queued = history.find((h) => h.toStatus === "WAITING_FOR_AGENT")!;
    expect(queued.fromStatus).toBe("INFORMATION_SUBMITTED");
    expect(queued.actorType).toBe("SYSTEM");

    const consents = await prisma.consentRecord.findMany({ where: { enrollmentId: e.id } });
    expect(consents).toHaveLength(3);
    expect(consents.find((c) => c.consentType === "marketing_email")?.granted).toBe(false);

    // Customer gets a "request received" email (not a confirmation).
    const sent = memoryOutbox.filter((m) => m.enrollmentId === e.id);
    expect(sent.map((m) => m.template)).toContain("enrollment_received");
    expect(sent.map((m) => m.template)).not.toContain("order_confirmed");
    expect(sent[0].to).toBe("jordan.rivera@example.com");

    // The funnel session is linked and its draft cleared.
    const s = await prisma.enrollmentSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(s.enrollmentId).toBe(e.id);
    expect(s.draftEnc).toBeNull();

    // Customer session token grants access to exactly this enrollment.
    expect(await enrollmentIdForCustomerToken(res.customerToken)).toBe(e.id);
    expect(await enrollmentIdForCustomerToken("not-a-real-token")).toBeNull();

    const view = await getCustomerView(e.id);
    expect(view.serviceAddress.street).toBe("123 Main St");
    expect(view.confirmation).toBeNull();
  });

  it("is idempotent: duplicate submissions return the same enrollment", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    const input = submitInput();
    const [a, b] = await Promise.all([submitEnrollment(session.id, input), submitEnrollment(session.id, input)]);
    expect(a.enrollment.id).toBe(b.enrollment.id);
    const again = await submitEnrollment(session.id, submitInput()); // new key, same session
    expect(again.enrollment.id).toBe(a.enrollment.id);
    expect(again.duplicate).toBe(true);
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it("rejects invalid input and never collects sensitive identifiers", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    const err = await submitEnrollment(session.id, submitInput({ email: "nope", phone: "123", consentTerms: false as unknown as true })).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(422);
    const details = (err as AppError).details as Record<string, string>;
    expect(Object.keys(details)).toEqual(expect.arrayContaining(["email", "phone", "consentTerms"]));
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("requires a billing address when billing differs from service", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    const err = await submitEnrollment(session.id, submitInput({ billingSameAsService: false, billing: null })).catch((e) => e);
    expect((err as AppError).details).toHaveProperty("billing");
    const ok = await submitEnrollment(
      session.id,
      submitInput({ billingSameAsService: false, billing: { street: "9 Elm Ave", unit: null, city: "Plano", state: "tx", zip: "75024" } }),
    );
    expect(ok.enrollment.billingAddressEnc).toBeTruthy();
    expect(JSON.parse(decrypt(ok.enrollment.billingAddressEnc!))).toMatchObject({ street: "9 Elm Ave", state: "TX" });
  });

  it("blocks submission when the advertised price changed after selection", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    await prisma.plan.update({ where: { id: plan.id }, data: { monthlyPriceCents: 6500 } });
    const err = await submitEnrollment(session.id, submitInput()).catch((e) => e);
    expect((err as AppError).code).toBe("price_changed");
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("does not offer or accept plans from non-orderable providers", async () => {
    const { plan } = await seedProviderAndPlan({ orderable: false });
    expect(await getPlanOffersForZip("75201")).toHaveLength(0);
    const { session } = await createFunnelSession();
    await setSessionAddress(session.id, { street: "1 A St", unit: null, city: "Dallas", state: "TX", zip: "75201" }, { verified: false, source: "test" });
    await expect(selectPlan(session.id, plan.id)).rejects.toMatchObject({ code: "plan_unavailable" });
  });

  it("labels availability honestly: indicative by default, advertised-in-ZIP with coverage data, never verified", async () => {
    const { provider } = await seedProviderAndPlan();
    expect((await getPlanOffersForZip("75201"))[0].availability).toBe("INDICATIVE");
    await prisma.serviceArea.create({ data: { providerId: provider.id, zip: "75201" } });
    expect((await getPlanOffersForZip("75201"))[0].availability).toBe("ADVERTISED_IN_ZIP");
    // Provider has coverage data and this ZIP isn't in it → hidden.
    expect(await getPlanOffersForZip("10001")).toHaveLength(0);
  });

  it("autosaves drafts encrypted and restores them", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    await saveDraft(session.id, { firstName: "Sam", email: "sam@example.com", notes: "call after 5" });
    const s = await prisma.enrollmentSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(s.draftEnc).not.toContain("sam@example.com");
    expect(sessionDraft(s)).toMatchObject({ firstName: "Sam", email: "sam@example.com" });
  });

  it("preserves property attribution through enrollment", async () => {
    const { plan } = await seedProviderAndPlan();
    const ref = await prisma.referralSource.create({ data: { code: "greenleaf", name: "Greenleaf PM" } });
    const property = await prisma.property.create({
      data: { slug: "the-oaks", name: "The Oaks", street: "500 Oak Ln", city: "Dallas", state: "TX", zip: "75204", referralSourceId: ref.id },
    });
    const { session } = await createFunnelSession({});
    await setSessionAddress(session.id, { street: "500 Oak Ln", unit: "210", city: "Dallas", state: "TX", zip: "75204" }, { verified: false, source: "test", propertyId: property.id, unitNumber: "210" });
    await selectPlan(session.id, plan.id);
    const { enrollment } = await submitEnrollment(session.id, submitInput({ unit: "210" }));
    expect(enrollment.propertyId).toBe(property.id);
    expect(enrollment.referralSourceId).toBe(ref.id);
    expect(enrollment.unitNumber).toBe("210");
  });

  it("issues expiring access links that create a customer session", async () => {
    const { plan } = await seedProviderAndPlan();
    const session = await readySession(plan.id);
    const { enrollment } = await submitEnrollment(session.id, submitInput());
    const url = await createAccessLink(prisma, enrollment.id);
    const token = new URL(url).searchParams.get("t")!;
    expect(await redeemAccessToken(token)).toEqual({ enrollmentId: enrollment.id, publicId: enrollment.publicId });
    await prisma.customerAccessToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await redeemAccessToken(token)).toBeNull();
  });

  it("assigns immediately when an agent is available", async () => {
    const { plan } = await seedProviderAndPlan();
    const { user } = await createAgent("AVAILABLE");
    const session = await readySession(plan.id);
    const { enrollment } = await submitEnrollment(session.id, submitInput());
    expect(enrollment.status).toBe("AGENT_ASSIGNED");
    expect(enrollment.assignedAgentId).toBe(user.id);
    const events = await prisma.realtimeEvent.findMany({ where: { channel: `agent:${user.id}` } });
    expect(events.map((e) => e.type)).toContain("enrollment.assigned");
    expect(memoryOutbox.map((m) => m.template)).toEqual(expect.arrayContaining(["enrollment_received", "agent_new_order", "agent_assigned"]));
  });
});
