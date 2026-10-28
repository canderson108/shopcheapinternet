import { Prisma, type Enrollment } from "@prisma/client";
import { prisma } from "../db";
import { encrypt, encryptOptional, generatePublicId, lookupHash } from "../crypto";
import { audit } from "../audit";
import { AppError, NotFoundError } from "../errors";
import { createCustomerSessionToken } from "../auth/customer";
import { CONSENT_TEXT, CONSENT_VERSION, enrollmentSubmitSchema, zodFieldErrors, type EnrollmentSubmitInput } from "../validation";
import { addressSchema } from "../address/normalize";
import { channels, publish } from "../realtime";
import { planSnapshot } from "./plans";
import { sessionAddress } from "./funnel";
import { autoAssign } from "./assignment";
import { Effects } from "./effects";
import { notifyEnrollmentReceived, notifyQueueWaiting } from "./notify";
import { serverConversion } from "./conversions";

/** Runs the submit transaction; a concurrent duplicate that loses the unique-key race returns the winner. */
async function runSubmitTransaction(
  fn: (tx: Prisma.TransactionClient) => Promise<{ enrollment: Enrollment; duplicate: boolean }>,
  idempotencyKey: string,
): Promise<{ enrollment: Enrollment; duplicate: boolean }> {
  try {
    return await prisma.$transaction(fn, { timeout: 20_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await prisma.enrollment.findUnique({ where: { idempotencyKey } });
      if (winner) return { enrollment: winner, duplicate: true };
      // Same session submitted twice with different keys: session.enrollmentId is unique.
    }
    throw e;
  }
}

export type SubmitContext ={ ipHash?: string | null; userAgent?: string | null };

export type SubmitResult = { enrollment: Enrollment; customerToken: string; duplicate: boolean };

/**
 * Turns a completed funnel session into a permanent enrollment request:
 * creates the customer + enrollment, records consent and status history, and attempts automatic
 * agent assignment — all in one transaction. Duplicate submissions (double clicks, retries,
 * a second tab) return the existing enrollment instead of creating another.
 */
export async function submitEnrollment(sessionId: string, input: EnrollmentSubmitInput, ctx: SubmitContext = {}): Promise<SubmitResult> {
  const parsed = enrollmentSubmitSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Please correct the highlighted fields.", 422, "validation", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const session = await prisma.enrollmentSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError("Your session expired. Please start again.");

  // Idempotency: same key or same session => return what already exists.
  const existing = await prisma.enrollment.findFirst({
    where: { OR: [{ idempotencyKey: data.idempotencyKey }, ...(session.enrollmentId ? [{ id: session.enrollmentId }] : [])] },
  });
  if (existing) {
    const customerToken = await createCustomerSessionToken(prisma, existing.id);
    return { enrollment: existing, customerToken, duplicate: true };
  }

  const address = sessionAddress(session);
  if (!address) throw new AppError("Please enter your service address first.", 400, "address_required");
  if (!session.selectedPlanId) throw new AppError("Please choose a plan first.", 400, "plan_required");

  const plan = await prisma.plan.findUnique({ where: { id: session.selectedPlanId }, include: { provider: true } });
  if (!plan || !plan.active || !plan.provider.active || !plan.provider.orderable) {
    throw new AppError("The plan you selected is no longer available. Please choose another plan.", 409, "plan_unavailable");
  }
  if (session.selectedPriceCents !== null && session.selectedPriceCents !== plan.monthlyPriceCents) {
    throw new AppError("The advertised price for this plan changed since you selected it. Please review the updated price.", 409, "price_changed", {
      previousPriceCents: session.selectedPriceCents,
      currentPriceCents: plan.monthlyPriceCents,
    });
  }

  const unit = data.unit !== undefined ? (data.unit ? addressSchema.shape.unit.parse(data.unit) : null) : address.unit;
  const billing = data.billingSameAsService ? null : data.billing ?? null;
  const emailHash = lookupHash(data.email);
  const effects = new Effects();

  const result = await runSubmitTransaction(async (tx) => {
    // Re-check idempotency inside the transaction; the unique index is the final guard.
    const dup = await tx.enrollment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (dup) return { enrollment: dup, duplicate: true };

    let customer = await tx.customer.findFirst({ where: { emailHash, deletedAt: null }, orderBy: { createdAt: "desc" } });
    if (customer) {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: { firstName: data.firstName, lastName: data.lastName, phoneEnc: encrypt(data.phone), phoneHash: lookupHash(data.phone) },
      });
    } else {
      customer = await tx.customer.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          emailEnc: encrypt(data.email),
          emailHash,
          phoneEnc: encrypt(data.phone),
          phoneHash: lookupHash(data.phone),
        },
      });
    }

    const enrollment = await tx.enrollment.create({
      data: {
        publicId: generatePublicId(),
        idempotencyKey: data.idempotencyKey,
        customerId: customer.id,
        providerId: plan.providerId,
        planId: plan.id,
        status: "INFORMATION_SUBMITTED",
        serviceStreetEnc: encrypt(address.street),
        serviceUnitEnc: encryptOptional(unit),
        serviceCity: address.city,
        serviceState: address.state,
        serviceZip: address.zip,
        addressVerified: session.addressVerified && (unit ?? null) === (address.unit ?? null),
        billingSameAsService: data.billingSameAsService,
        billingAddressEnc: billing ? encrypt(JSON.stringify(billing)) : null,
        planSnapshot: planSnapshot(plan) as Prisma.InputJsonValue,
        advertisedPriceCents: plan.monthlyPriceCents,
        pricingSource: plan.sourceName,
        pricingCheckedAt: plan.sourceCheckedAt,
        availabilityStatus: "INDICATIVE",
        preferredInstallDate: data.preferredInstallDate,
        preferredInstallTime: data.preferredInstallTime ?? null,
        customerNotesEnc: encryptOptional(data.notes),
        propertyId: session.propertyId,
        unitNumber: unit ?? session.unitNumber,
        referralSourceId: session.referralSourceId,
        campaignId: session.campaignId,
        utmSource: session.utmSource,
        utmMedium: session.utmMedium,
        utmCampaign: session.utmCampaign,
        gclid: session.gclid,
        fbclid: session.fbclid,
        gaClientId: data.gaClientId ?? null,
      },
    });

    // ZIP coverage data upgrades the label from "indicative" to "advertised in ZIP" (never "verified").
    const advertised = await tx.serviceArea.findUnique({ where: { providerId_zip: { providerId: plan.providerId, zip: address.zip } } });
    if (advertised) await tx.enrollment.update({ where: { id: enrollment.id }, data: { availabilityStatus: "ADVERTISED_IN_ZIP" } });

    await tx.enrollmentStatusHistory.createMany({
      data: [
        { enrollmentId: enrollment.id, fromStatus: null, toStatus: "ENROLLMENT_STARTED", actorType: "CUSTOMER", note: "Customer started enrollment", createdAt: session.createdAt },
        { enrollmentId: enrollment.id, fromStatus: "ENROLLMENT_STARTED", toStatus: "INFORMATION_SUBMITTED", actorType: "CUSTOMER", note: "Enrollment request submitted" },
      ],
    });

    const consents = [
      { consentType: "terms_and_order_authorization", consentText: CONSENT_TEXT.terms, granted: true },
      { consentType: "contact", consentText: CONSENT_TEXT.contact, granted: true },
      { consentType: "marketing_email", consentText: CONSENT_TEXT.marketing, granted: Boolean(data.consentMarketing) },
    ];
    await tx.consentRecord.createMany({
      data: consents.map((c) => ({
        ...c,
        customerId: customer!.id,
        enrollmentId: enrollment.id,
        consentVersion: CONSENT_VERSION,
        ipHash: ctx.ipHash ?? null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      })),
    });

    await tx.enrollmentSession.update({ where: { id: session.id }, data: { enrollmentId: enrollment.id, draftEnc: null } });
    await audit(tx, {
      actor: { type: "CUSTOMER" },
      action: "enrollment.submitted",
      entityType: "Enrollment",
      entityId: enrollment.id,
      enrollmentId: enrollment.id,
      ipHash: ctx.ipHash,
      metadata: { planId: plan.id, propertyId: session.propertyId },
    });
    await publish(tx, [channels.staff], "enrollment.created", { enrollmentId: enrollment.id });

    const agentId = await autoAssign(tx, enrollment.id, effects);
    effects.add(() => notifyEnrollmentReceived(enrollment.id, agentId === null));
    if (!agentId) effects.add(() => notifyQueueWaiting(enrollment.id));
    effects.add(() => serverConversion(enrollment.id, "enrollment_submitted"));
    if (agentId) effects.add(() => serverConversion(enrollment.id, "agent_assigned"));

    const fresh = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    return { enrollment: fresh, duplicate: false };
  }, data.idempotencyKey);

  await effects.run();
  const customerToken = await createCustomerSessionToken(prisma, result.enrollment.id);
  return { ...result, customerToken };
}
