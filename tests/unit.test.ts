import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generatePublicId, lookupHash } from "@/lib/crypto";
import { canTransition, statusLabel } from "@/lib/status";
import { pickRecommended, recommendedMbps } from "@/lib/recommend";
import { addressSchema } from "@/lib/address/normalize";
import { containsSensitiveNumber, enrollmentSubmitSchema } from "@/lib/validation";
import { formatPrice, formatSpeed } from "@/lib/format";

describe("crypto", () => {
  it("round-trips and uses a random IV", () => {
    const a = encrypt("hello@example.com");
    const b = encrypt("hello@example.com");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("hello@example.com");
    expect(() => decrypt(a.replace(/.$/, a.endsWith("A") ? "B" : "A"))).toThrow();
  });
  it("lookup hashes are case/space-insensitive", () => {
    expect(lookupHash(" A@B.com ")).toBe(lookupHash("a@b.com"));
  });
  it("public ids are non-sequential", () => {
    const ids = new Set(Array.from({ length: 500 }, generatePublicId));
    expect(ids.size).toBe(500);
  });
});

describe("status machine", () => {
  it("allows the happy path and blocks shortcuts", () => {
    expect(canTransition("AGENT_PROCESSING", "SUBMITTED_TO_PROVIDER")).toBe(true);
    expect(canTransition("SUBMITTED_TO_PROVIDER", "PROVIDER_ORDER_CONFIRMED")).toBe(true);
    expect(canTransition("WAITING_FOR_AGENT", "PROVIDER_ORDER_CONFIRMED")).toBe(false);
    expect(canTransition("AGENT_ASSIGNED", "PROVIDER_ORDER_CONFIRMED")).toBe(false);
    expect(canTransition("PROVIDER_ORDER_CONFIRMED", "AGENT_PROCESSING")).toBe(false);
  });
  it("labels are provider-specific", () => {
    expect(statusLabel("SUBMITTED_TO_PROVIDER", "AT&T")).toBe("Submitted to AT&T");
    expect(statusLabel("PROVIDER_ORDER_CONFIRMED", "AT&T")).toBe("AT&T Order Confirmed");
  });
});

describe("recommendations", () => {
  const plans = [
    { id: "300", downloadMbps: 300, uploadMbps: 300, monthlyPriceCents: 5000 },
    { id: "500", downloadMbps: 500, uploadMbps: 500, monthlyPriceCents: 6000 },
    { id: "1000", downloadMbps: 1000, uploadMbps: 1000, monthlyPriceCents: 7000 },
  ];
  it("small homes get the entry plan", () => {
    expect(pickRecommended(plans, { people: 1, devices: 4, streaming4k: false, gaming: false, workFromHome: false, largeUploads: false }).recommendedId).toBe("300");
  });
  it("busy homes get more speed", () => {
    const h = { people: 5, devices: 25, streaming4k: true, gaming: true, workFromHome: true, largeUploads: true };
    expect(recommendedMbps(h)).toBeGreaterThan(500);
    expect(pickRecommended(plans, h).recommendedId).toBe("1000");
  });
});

describe("validation", () => {
  it("normalises addresses", () => {
    const a = addressSchema.parse({ street: " 123  Main St ", unit: "Apt 4B", city: "Dallas", state: "tx", zip: "75201-1234" });
    expect(a).toEqual({ street: "123 Main St", unit: "4B", city: "Dallas", state: "TX", zip: "75201" });
    expect(addressSchema.safeParse({ street: "Main St", unit: null, city: "Dallas", state: "TX", zip: "75201" }).success).toBe(false);
    expect(addressSchema.safeParse({ street: "1 Main St", unit: null, city: "Dallas", state: "ZZ", zip: "75201" }).success).toBe(false);
  });
  it("detects SSNs and Luhn-valid card numbers only", () => {
    expect(containsSensitiveNumber("123-45-6789")).toBe(true);
    expect(containsSensitiveNumber("4111111111111111")).toBe(true);
    expect(containsSensitiveNumber("order 1234567890123")).toBe(false);
    expect(containsSensitiveNumber("call 214-555-0142")).toBe(false);
  });
  it("normalises phone numbers and requires consent", () => {
    const r = enrollmentSubmitSchema.safeParse({
      firstName: "A", lastName: "B", email: "a@b.co", phone: "+1 (214) 555-0142", billingSameAsService: true,
      consentTerms: true, consentContact: true, idempotencyKey: "abcdefghijklmnop",
    });
    expect(r.success && r.data.phone).toBe("2145550142");
    const bad = enrollmentSubmitSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.co", phone: "2145550142", billingSameAsService: true, consentTerms: false, consentContact: true, idempotencyKey: "abcdefghijklmnop" });
    expect(bad.success).toBe(false);
  });
});

describe("formatting", () => {
  it("formats prices and speeds", () => {
    expect(formatPrice(5000)).toBe("$50");
    expect(formatPrice(5499)).toBe("$54.99");
    expect(formatSpeed(300)).toBe("300 Mbps");
    expect(formatSpeed(5000)).toBe("5 Gbps");
  });
});
