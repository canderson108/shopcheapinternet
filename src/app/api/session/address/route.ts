import { z } from "zod";
import { prisma } from "@/lib/db";
import { addressSchema } from "@/lib/address/normalize";
import { addressVerificationConfigured, verifyAddress } from "@/lib/address/smarty";
import { ensureFunnelSession } from "@/lib/funnel-cookie";
import { setSessionAddress } from "@/lib/services/funnel";
import { ipHash, json, readBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, NotFoundError } from "@/lib/errors";

const bodySchema = z.object({
  address: z.object({
    street: z.string(),
    unit: z.string().optional().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
  propertySlug: z.string().max(80).optional().nullable(),
  acceptUnverified: z.boolean().optional(),
});

export const POST = route(async (req) => {
  await rateLimit(`addr:${ipHash(req)}`, 30, 300);
  const body = await readBody(req, bodySchema);
  const parsed = addressSchema.safeParse(body.address);
  if (!parsed.success) {
    throw new AppError("Please check your address.", 422, "validation", Object.fromEntries(parsed.error.issues.map((i) => [i.path.map(String).join("."), i.message])));
  }
  let address = parsed.data;

  let property: { id: string; referralCode: string | null; campaignCode: string | null } | null = null;
  if (body.propertySlug) {
    const p = await prisma.property.findFirst({ where: { slug: body.propertySlug, active: true }, include: { referralSource: true, campaign: true } });
    if (!p) throw new NotFoundError("Property not found");
    property = { id: p.id, referralCode: p.referralSource?.code ?? null, campaignCode: p.campaign?.code ?? null };
    if (p.zip !== address.zip || p.street.toLowerCase() !== address.street.toLowerCase()) {
      // Property links are for that community's address only.
      address = { ...address, street: p.street, city: p.city, state: p.state, zip: p.zip };
    }
  }

  let verified = false;
  let source = "customer_entered";
  if (addressVerificationConfigured()) {
    const v = await verifyAddress(address);
    if (v.status === "verified") {
      address = v.address;
      verified = true;
      source = "smarty";
    } else if (v.status === "needs_unit") {
      if (!address.unit) return json({ ok: false, needsUnit: true, suggestion: v.address, error: "This address has multiple units. Please enter your apartment or unit number." }, 422);
      address = v.address;
      source = "smarty_unit_unconfirmed";
    } else if (v.status === "not_found" && !body.acceptUnverified) {
      return json({ ok: false, notFound: true, error: "We couldn't verify that address. Check it, or continue anyway and our specialist will confirm it." }, 422);
    }
  }

  const session = await ensureFunnelSession();
  await setSessionAddress(session.id, address, { verified, source, propertyId: property?.id ?? null, unitNumber: address.unit });
  return json({ ok: true, verified, address, next: "/plans" });
});
