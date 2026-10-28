import { prisma } from "../db";
import { env } from "../env";

// Server-side conversion events via the GA4 Measurement Protocol. "order_confirmed" is the only
// event reported as a purchase, and it is sent only after an agent records a verified provider
// confirmation. Google Ads / Meta offline conversions use the gclid/fbclid captured at landing,
// exported from the admin CSV export (confirmed orders only).

export type ServerConversion = "enrollment_submitted" | "agent_assigned" | "order_confirmed";

export async function serverConversion(enrollmentId: string, event: ServerConversion): Promise<void> {
  const measurementId = env.ga4MeasurementId;
  const apiSecret = env.ga4ApiSecret;
  if (!measurementId || !apiSecret) return;
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { plan: true, provider: true } });
  if (!e || !e.gaClientId) return;
  if (event === "order_confirmed" && (e.status !== "PROVIDER_ORDER_CONFIRMED" || !e.confirmationNumber)) return;

  const value = (e.confirmedPriceCents ?? e.advertisedPriceCents) / 100;
  const params: Record<string, unknown> = {
    enrollment_reference: e.publicId,
    provider: e.provider.name,
    plan: e.plan.name,
    property_id: e.propertyId ?? undefined,
  };
  const events =
    event === "order_confirmed"
      ? [
          { name: "order_confirmed", params },
          {
            name: "purchase",
            params: {
              transaction_id: e.publicId,
              currency: "USD",
              value,
              items: [{ item_id: e.planId, item_name: `${e.provider.name} ${e.plan.name}`, item_brand: e.provider.name, price: value, quantity: 1 }],
            },
          },
        ]
      : [{ name: event, params }];

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      { method: "POST", body: JSON.stringify({ client_id: e.gaClientId, events }) },
    );
  } catch (err) {
    console.error("[conversions] GA4 measurement protocol failed", err);
  }
}
