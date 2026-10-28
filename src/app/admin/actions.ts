"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { StaffRole } from "@prisma/client";
import { requireStaffApi } from "@/lib/auth/staff";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import {
  addPropertyUnits,
  campaignSchema,
  createStaffUser,
  referralSchema,
  setServiceAreas,
  updateStaffUser,
  upsertPlan,
  upsertProperty,
  upsertProvider,
} from "@/lib/services/admin";
import { reassignEnrollment } from "@/lib/services/assignment";
import { anonymizeEnrollment } from "@/lib/services/retention";

// All admin mutations are server actions: Next.js enforces same-origin POST for these, and each
// one re-checks the caller's role. Results are reported via ?ok= / ?err= on redirect.

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

function errMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ");
  if (e instanceof AppError) return e.message;
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return "That value is already in use (must be unique).";
  console.error("[admin action]", e);
  return "Something went wrong.";
}

async function attempt(back: string, fn: () => Promise<string | void>, okMsg: string): Promise<never> {
  let target: string;
  try {
    const next = await fn();
    target = `${next ?? back}${(next ?? back).includes("?") ? "&" : "?"}ok=${encodeURIComponent(okMsg)}`;
  } catch (e) {
    target = `${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent(errMessage(e))}`;
  }
  revalidatePath("/admin", "layout");
  redirect(target);
}

// ---------------- Providers ----------------
export async function saveProvider(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "id") || null;
  await attempt(id ? `/admin/providers/${id}` : "/admin/providers/new", async () => {
    const p = await upsertProvider(ctx.actor, id, {
      slug: str(fd, "slug"),
      name: str(fd, "name"),
      logoUrl: str(fd, "logoUrl"),
      websiteUrl: str(fd, "websiteUrl"),
      active: bool(fd, "active"),
      orderable: bool(fd, "orderable"),
      portalName: str(fd, "portalName"),
      orderPortalUrl: str(fd, "orderPortalUrl"),
      orderInstructions: str(fd, "orderInstructions"),
      enrollmentRequirements: str(fd, "enrollmentRequirements"),
      confirmationWorkflow: str(fd, "confirmationWorkflow"),
      confirmationNumberLabel: str(fd, "confirmationNumberLabel") || "Confirmation number",
      disclosure: str(fd, "disclosure"),
      sortOrder: Number(str(fd, "sortOrder") || 0),
    });
    return `/admin/providers/${p.id}`;
  }, "Provider saved");
}

export async function saveServiceAreas(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "providerId");
  await attempt(`/admin/providers/${id}`, async () => {
    await setServiceAreas(ctx.actor, id, str(fd, "zips"));
  }, "Service area ZIP codes saved");
}

// ---------------- Plans ----------------
export async function savePlan(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "id") || null;
  await attempt(id ? `/admin/plans/${id}` : "/admin/plans/new", async () => {
    const p = await upsertPlan(ctx.actor, id, {
      providerId: str(fd, "providerId"),
      slug: str(fd, "slug"),
      name: str(fd, "name"),
      connectionType: str(fd, "connectionType") as "FIBER",
      downloadMbps: Number(str(fd, "downloadMbps")),
      uploadMbps: Number(str(fd, "uploadMbps")),
      monthlyPrice: str(fd, "monthlyPrice"),
      regularPrice: str(fd, "regularPrice"),
      priceTermMonths: str(fd, "priceTermMonths"),
      priceConditions: str(fd, "priceConditions"),
      installationFee: str(fd, "installationFee"),
      installationNotes: str(fd, "installationNotes"),
      equipmentFee: str(fd, "equipmentFee"),
      equipmentIncluded: str(fd, "equipmentIncluded"),
      promoDescription: str(fd, "promoDescription"),
      promoExpiresAt: str(fd, "promoExpiresAt"),
      promoExpirationNote: str(fd, "promoExpirationNote"),
      contractRequired: bool(fd, "contractRequired"),
      contractTerms: str(fd, "contractTerms"),
      dataCap: str(fd, "dataCap"),
      disclosures: str(fd, "disclosures"),
      featured: bool(fd, "featured"),
      active: bool(fd, "active"),
      sortOrder: Number(str(fd, "sortOrder") || 0),
      sourceName: str(fd, "sourceName"),
      sourceUrl: str(fd, "sourceUrl"),
      sourceCheckedAt: str(fd, "sourceCheckedAt"),
      changeNote: str(fd, "changeNote"),
    });
    return `/admin/plans/${p.id}`;
  }, "Plan saved");
}

// ---------------- Properties ----------------
export async function saveProperty(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "id") || null;
  await attempt(id ? `/admin/properties/${id}` : "/admin/properties/new", async () => {
    const p = await upsertProperty(ctx.actor, id, {
      slug: str(fd, "slug"),
      name: str(fd, "name"),
      externalId: str(fd, "externalId"),
      street: str(fd, "street"),
      city: str(fd, "city"),
      state: str(fd, "state"),
      zip: str(fd, "zip"),
      managementCompany: str(fd, "managementCompany"),
      contactName: str(fd, "contactName"),
      contactEmail: str(fd, "contactEmail"),
      notes: str(fd, "notes"),
      active: bool(fd, "active"),
      defaultProviderId: str(fd, "defaultProviderId"),
      referralSourceId: str(fd, "referralSourceId"),
      campaignId: str(fd, "campaignId"),
    });
    return `/admin/properties/${p.id}`;
  }, "Property saved");
}

export async function addUnits(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "propertyId");
  await attempt(`/admin/properties/${id}`, async () => {
    await addPropertyUnits(ctx.actor, id, str(fd, "units"));
  }, "Units added");
}

export async function toggleUnit(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const propertyId = str(fd, "propertyId");
  await attempt(`/admin/properties/${propertyId}`, async () => {
    const u = await prisma.propertyUnit.findFirstOrThrow({ where: { id: str(fd, "unitId"), propertyId } });
    await prisma.propertyUnit.update({ where: { id: u.id }, data: { active: !u.active } });
    await audit(prisma, { actor: ctx.actor, action: "property.unit_toggled", entityType: "PropertyUnit", entityId: u.id, metadata: { active: !u.active } });
  }, "Unit updated");
}

// ---------------- Referral sources & campaigns ----------------
export async function saveReferral(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  await attempt("/admin/campaigns", async () => {
    const d = referralSchema.parse({ code: str(fd, "code"), name: str(fd, "name"), type: str(fd, "type"), active: bool(fd, "active") });
    const id = str(fd, "id");
    const r = id ? await prisma.referralSource.update({ where: { id }, data: d }) : await prisma.referralSource.create({ data: d });
    await audit(prisma, { actor: ctx.actor, action: "referral.saved", entityType: "ReferralSource", entityId: r.id });
  }, "Referral source saved");
}

export async function saveCampaign(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  await attempt("/admin/campaigns", async () => {
    const d = campaignSchema.parse({
      code: str(fd, "code"),
      name: str(fd, "name"),
      utmSource: str(fd, "utmSource"),
      utmMedium: str(fd, "utmMedium"),
      utmCampaign: str(fd, "utmCampaign"),
      active: bool(fd, "active"),
    });
    const id = str(fd, "id");
    const c = id ? await prisma.campaign.update({ where: { id }, data: d }) : await prisma.campaign.create({ data: d });
    await audit(prisma, { actor: ctx.actor, action: "campaign.saved", entityType: "Campaign", entityId: c.id });
  }, "Campaign saved");
}

// ---------------- Staff ----------------
export async function createStaff(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  await attempt("/admin/agents", async () => {
    await createStaffUser(ctx.actor, {
      name: str(fd, "name"),
      email: str(fd, "email"),
      role: str(fd, "role") as "AGENT",
      password: str(fd, "password"),
      maxActiveOrders: Number(str(fd, "maxActiveOrders") || 5),
    });
  }, "Staff account created. Share the temporary password securely; they'll set up two-factor authentication at first sign-in.");
}

export async function updateStaff(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "id");
  const op = str(fd, "op");
  await attempt("/admin/agents", async () => {
    if (op === "role") await updateStaffUser(ctx.actor, id, { role: str(fd, "role") as StaffRole });
    else if (op === "capacity") await updateStaffUser(ctx.actor, id, { maxActiveOrders: Number(str(fd, "maxActiveOrders")) });
    else if (op === "deactivate") await updateStaffUser(ctx.actor, id, { active: false });
    else if (op === "activate") await updateStaffUser(ctx.actor, id, { active: true });
    else if (op === "reset-mfa") await updateStaffUser(ctx.actor, id, { resetMfa: true });
    else if (op === "password") await updateStaffUser(ctx.actor, id, { password: str(fd, "password") });
    else throw new AppError("Unknown operation");
  }, "Staff account updated");
}

// ---------------- Enrollments ----------------
export async function reassign(fd: FormData) {
  const ctx = await requireStaffApi(["MANAGER", "ADMIN"]);
  const id = str(fd, "enrollmentId");
  await attempt(`/admin/enrollments/${id}`, async () => {
    const agentId = str(fd, "agentId");
    await reassignEnrollment(id, agentId === "__queue" ? null : agentId, ctx.actor, str(fd, "note") || undefined);
  }, "Assignment updated");
}

export async function deleteCustomerData(fd: FormData) {
  const ctx = await requireStaffApi(["ADMIN"]);
  const id = str(fd, "enrollmentId");
  await attempt(`/admin/enrollments/${id}`, async () => {
    if (str(fd, "confirm") !== "DELETE") throw new AppError('Type DELETE to confirm.');
    await anonymizeEnrollment(id, ctx.actor, str(fd, "reason") || "customer_request");
  }, "Customer personal information deleted");
}
