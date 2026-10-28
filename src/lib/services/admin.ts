import type { ConnectionType, StaffRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { audit, type Actor } from "../audit";
import { AppError } from "../errors";
import { hashPassword, validatePasswordStrength } from "../auth/password";
import { channels, publish } from "../realtime";

const optStr = (max = 500) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((s) => (s && s.trim() ? s.trim() : null));

const optCents = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v) * (typeof v === "string" ? 100 : 1))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter a valid amount");

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

const url = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((s) => (s ? s : null))
  .refine((s) => s === null || /^https:\/\/[^\s]+$/i.test(s), "Must be an https:// URL");

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const providerSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(80),
  logoUrl: url,
  websiteUrl: url,
  active: z.boolean(),
  orderable: z.boolean(),
  portalName: optStr(80),
  orderPortalUrl: url,
  orderInstructions: optStr(5000),
  enrollmentRequirements: optStr(5000),
  confirmationWorkflow: optStr(5000),
  confirmationNumberLabel: z.string().trim().min(2).max(60),
  disclosure: optStr(2000),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function upsertProvider(actor: Actor, id: string | null, input: z.input<typeof providerSchema>) {
  const d = providerSchema.parse(input);
  if (d.orderable && !d.orderPortalUrl) throw new AppError("Set an order portal URL before marking a provider orderable.", 422);
  const provider = id ? await prisma.provider.update({ where: { id }, data: d }) : await prisma.provider.create({ data: d });
  await audit(prisma, { actor, action: id ? "provider.updated" : "provider.created", entityType: "Provider", entityId: provider.id, metadata: { orderable: d.orderable, orderPortalUrl: d.orderPortalUrl } });
  return provider;
}

export async function setServiceAreas(actor: Actor, providerId: string, zipsText: string) {
  const zips = Array.from(new Set((zipsText.match(/\b\d{5}\b/g) ?? []).slice(0, 50_000)));
  await prisma.$transaction(async (tx) => {
    await tx.serviceArea.deleteMany({ where: { providerId } });
    if (zips.length) await tx.serviceArea.createMany({ data: zips.map((zip) => ({ providerId, zip })), skipDuplicates: true });
    await audit(tx, { actor, action: "provider.service_areas", entityType: "Provider", entityId: providerId, metadata: { count: zips.length } });
  });
  return zips.length;
}

// ---------------------------------------------------------------------------
// Plans & pricing
// ---------------------------------------------------------------------------

export const planSchema = z.object({
  providerId: z.string().min(1),
  slug,
  name: z.string().trim().min(2).max(80),
  connectionType: z.enum(["FIBER", "FIXED_WIRELESS", "CABLE", "DSL", "SATELLITE", "OTHER"]),
  downloadMbps: z.coerce.number().int().min(1).max(100_000),
  uploadMbps: z.coerce.number().int().min(1).max(100_000),
  monthlyPrice: optCents.refine((v) => v !== null, "Monthly price is required"),
  regularPrice: optCents,
  priceTermMonths: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 60), "Months must be 1–60"),
  priceConditions: optStr(300),
  installationFee: optCents,
  installationNotes: optStr(300),
  equipmentFee: optCents,
  equipmentIncluded: optStr(300),
  promoDescription: optStr(500),
  promoExpiresAt: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(`${s}T23:59:59.000Z`) : null)),
  promoExpirationNote: optStr(300),
  contractRequired: z.boolean(),
  contractTerms: optStr(300),
  dataCap: optStr(100),
  disclosures: optStr(3000),
  featured: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  sourceName: z.string().trim().min(2, "Record where this pricing came from").max(200),
  sourceUrl: url,
  sourceCheckedAt: z
    .string()
    .min(1, "Enter the date you verified this pricing")
    .transform((s) => new Date(s.length === 10 ? `${s}T12:00:00.000Z` : s)),
  changeNote: optStr(300),
});

export async function upsertPlan(actor: Actor, id: string | null, input: z.input<typeof planSchema>) {
  const d = planSchema.parse(input);
  const data = {
    providerId: d.providerId,
    slug: d.slug,
    name: d.name,
    connectionType: d.connectionType as ConnectionType,
    downloadMbps: d.downloadMbps,
    uploadMbps: d.uploadMbps,
    monthlyPriceCents: d.monthlyPrice!,
    regularPriceCents: d.regularPrice,
    priceTermMonths: d.priceTermMonths,
    priceConditions: d.priceConditions,
    installationFeeCents: d.installationFee,
    installationNotes: d.installationNotes,
    equipmentFeeCents: d.equipmentFee,
    equipmentIncluded: d.equipmentIncluded,
    promoDescription: d.promoDescription,
    promoExpiresAt: d.promoExpiresAt,
    promoExpirationNote: d.promoExpirationNote,
    contractRequired: d.contractRequired,
    contractTerms: d.contractTerms,
    dataCap: d.dataCap,
    disclosures: d.disclosures,
    featured: d.featured,
    active: d.active,
    sortOrder: d.sortOrder,
    sourceName: d.sourceName,
    sourceUrl: d.sourceUrl,
    sourceCheckedAt: d.sourceCheckedAt,
  };
  const staffId = actor.type === "STAFF" ? actor.staffId : null;
  return prisma.$transaction(async (tx) => {
    const before = id ? await tx.plan.findUnique({ where: { id } }) : null;
    const plan = id ? await tx.plan.update({ where: { id }, data }) : await tx.plan.create({ data });
    const priceChanged =
      !before ||
      before.monthlyPriceCents !== plan.monthlyPriceCents ||
      before.regularPriceCents !== plan.regularPriceCents ||
      before.promoDescription !== plan.promoDescription ||
      before.sourceCheckedAt.getTime() !== plan.sourceCheckedAt.getTime();
    if (priceChanged) {
      await tx.planPriceHistory.create({
        data: {
          planId: plan.id,
          monthlyPriceCents: plan.monthlyPriceCents,
          regularPriceCents: plan.regularPriceCents,
          promoDescription: plan.promoDescription,
          sourceName: plan.sourceName,
          sourceUrl: plan.sourceUrl,
          sourceCheckedAt: plan.sourceCheckedAt,
          changedById: staffId,
          note: d.changeNote ?? (before ? null : "Plan created"),
        },
      });
    }
    await audit(tx, {
      actor,
      action: id ? "plan.updated" : "plan.created",
      entityType: "Plan",
      entityId: plan.id,
      metadata: { priceChanged, from: before?.monthlyPriceCents ?? null, to: plan.monthlyPriceCents },
    });
    return plan;
  });
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export const propertySchema = z.object({
  slug,
  name: z.string().trim().min(2).max(120),
  externalId: optStr(60),
  street: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().toUpperCase().length(2),
  zip: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP"),
  managementCompany: optStr(120),
  contactName: optStr(120),
  contactEmail: optStr(254),
  notes: optStr(2000),
  active: z.boolean(),
  defaultProviderId: optStr(40),
  referralSourceId: optStr(40),
  campaignId: optStr(40),
});

export async function upsertProperty(actor: Actor, id: string | null, input: z.input<typeof propertySchema>) {
  const d = propertySchema.parse(input);
  const property = id ? await prisma.property.update({ where: { id }, data: d }) : await prisma.property.create({ data: d });
  await audit(prisma, { actor, action: id ? "property.updated" : "property.created", entityType: "Property", entityId: property.id });
  return property;
}

export async function addPropertyUnits(actor: Actor, propertyId: string, unitsText: string) {
  const units = Array.from(
    new Set(
      unitsText
        .split(/[\n,]+/)
        .map((u) => u.trim().replace(/^(apt|unit|#)\s*/i, ""))
        .filter((u) => u && u.length <= 20),
    ),
  );
  const expanded: string[] = [];
  for (const u of units) {
    const range = u.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range && Number(range[2]) - Number(range[1]) <= 2000 && Number(range[2]) >= Number(range[1])) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) expanded.push(String(n));
    } else expanded.push(u);
  }
  const res = await prisma.propertyUnit.createMany({ data: expanded.map((unitNumber) => ({ propertyId, unitNumber })), skipDuplicates: true });
  await audit(prisma, { actor, action: "property.units_added", entityType: "Property", entityId: propertyId, metadata: { added: res.count } });
  return res.count;
}

// ---------------------------------------------------------------------------
// Referral sources & campaigns
// ---------------------------------------------------------------------------

export const referralSchema = z.object({ code: slug, name: z.string().trim().min(2).max(120), type: optStr(60), active: z.boolean() });
export const campaignSchema = z.object({
  code: slug,
  name: z.string().trim().min(2).max(120),
  utmSource: optStr(100),
  utmMedium: optStr(100),
  utmCampaign: optStr(100),
  active: z.boolean(),
});

// ---------------------------------------------------------------------------
// Staff accounts
// ---------------------------------------------------------------------------

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["AGENT", "MANAGER", "ADMIN"]),
  password: z.string().min(1),
  maxActiveOrders: z.coerce.number().int().min(1).max(50),
});

export async function createStaffUser(actor: Actor | null, input: z.input<typeof staffCreateSchema>) {
  const d = staffCreateSchema.parse(input);
  const weak = validatePasswordStrength(d.password);
  if (weak) throw new AppError(weak, 422);
  const exists = await prisma.staffUser.findUnique({ where: { email: d.email } });
  if (exists) throw new AppError("A staff account with that email already exists.", 409);
  const user = await prisma.staffUser.create({
    data: {
      name: d.name,
      email: d.email,
      role: d.role as StaffRole,
      passwordHash: await hashPassword(d.password),
      // Every staff member gets an agent profile so managers/admins can also take orders.
      agentProfile: { create: { maxActiveOrders: d.maxActiveOrders, availability: "OFFLINE" } },
    },
  });
  await audit(prisma, { actor: actor ?? { type: "SYSTEM" }, action: "staff.created", entityType: "StaffUser", entityId: user.id, metadata: { role: d.role } });
  return user;
}

export async function updateStaffUser(
  actor: Actor,
  id: string,
  d: { role?: StaffRole; active?: boolean; maxActiveOrders?: number; resetMfa?: boolean; password?: string },
) {
  if (d.password) {
    const weak = validatePasswordStrength(d.password);
    if (weak) throw new AppError(weak, 422);
  }
  if (actor.type === "STAFF" && actor.staffId === id && (d.active === false || (d.role && d.role !== "ADMIN"))) {
    throw new AppError("You can't deactivate or demote your own account.", 422);
  }
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.staffUser.update({
      where: { id },
      data: {
        ...(d.role ? { role: d.role } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.resetMfa ? { mfaEnabled: false, mfaSecretEnc: null } : {}),
        ...(d.password ? { passwordHash: await hashPassword(d.password), failedLogins: 0, lockedUntil: null } : {}),
      },
    });
    if (d.maxActiveOrders) await tx.agentProfile.upsert({ where: { staffUserId: id }, create: { staffUserId: id, maxActiveOrders: d.maxActiveOrders }, update: { maxActiveOrders: d.maxActiveOrders } });
    if (d.active === false) {
      await tx.agentProfile.updateMany({ where: { staffUserId: id }, data: { availability: "OFFLINE" } });
    }
    if (d.active === false || d.resetMfa || d.password) await tx.staffSession.deleteMany({ where: { staffUserId: id } });
    await audit(tx, {
      actor,
      action: "staff.updated",
      entityType: "StaffUser",
      entityId: id,
      metadata: { role: d.role ?? null, active: d.active ?? null, maxActiveOrders: d.maxActiveOrders ?? null, resetMfa: Boolean(d.resetMfa), passwordReset: Boolean(d.password) },
    });
    await publish(tx, [channels.staff], "agent.availability", { agentId: id });
    return u;
  });
  return user;
}
