import { z } from "zod";
import { addressSchema } from "./address/normalize";

export const CONSENT_VERSION = "2026-10-28";

export const CONSENT_TEXT = {
  terms:
    "I agree to the Shop Cheap Internet Terms of Service and Privacy Policy, and I authorize Shop Cheap Internet to submit an internet service order to the selected provider on my behalf using the information I provided.",
  contact:
    "I agree that Shop Cheap Internet may contact me by email, phone call, or text message at the contact information I provided about this enrollment request. Message and data rates may apply. Consent is not a condition of purchase for marketing messages.",
  marketing: "Send me occasional internet deals and savings tips by email. I can unsubscribe anytime.",
} as const;

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .transform((d) => (d.length === 11 && d.startsWith("1") ? d.slice(1) : d))
  .refine((d) => /^[2-9]\d{2}[2-9]\d{6}$/.test(d), "Enter a valid 10-digit US mobile number");

const name = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, "Required").max(60).regex(/^[\p{L}][\p{L}' .-]*$/u, "Use letters only"));

function tomorrowUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

export const installDateSchema = z
  .string()
  .optional()
  .nullable()
  .transform((s) => (s ? s : null))
  .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Choose a valid date")
  .transform((s) => (s ? new Date(`${s}T00:00:00.000Z`) : null))
  .refine((d) => d === null || (d >= tomorrowUtc() && d.getTime() <= tomorrowUtc().getTime() + 90 * 86400_000), "Choose a date between tomorrow and 90 days from now");

export const enrollmentSubmitSchema = z
  .object({
    firstName: name,
    lastName: name,
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
    phone,
    unit: z.string().max(20).optional().nullable(),
    billingSameAsService: z.boolean(),
    billing: addressSchema.optional().nullable(),
    preferredInstallDate: installDateSchema,
    preferredInstallTime: z.enum(["morning", "afternoon", "evening", "any"]).optional().nullable(),
    notes: z.string().max(1000).optional().nullable().transform((s) => (s ? s.trim() : null)),
    consentTerms: z.literal(true, { error: "You must accept to continue" }),
    consentContact: z.literal(true, { error: "We need permission to contact you about this order" }),
    consentMarketing: z.boolean().optional().default(false),
    idempotencyKey: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/),
    gaClientId: z.string().max(64).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.billingSameAsService && !v.billing) {
      ctx.addIssue({ code: "custom", path: ["billing"], message: "Enter your billing address" });
    }
  });

export type EnrollmentSubmitInput = z.input<typeof enrollmentSubmitSchema>;
export type EnrollmentSubmitData = z.output<typeof enrollmentSubmitSchema>;

// Fields the client may autosave (all optional). Sensitive identifiers are intentionally absent.
export const draftSchema = z.object({
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(20).optional(),
  unit: z.string().max(20).optional().nullable(),
  billingSameAsService: z.boolean().optional(),
  billing: z
    .object({ street: z.string().max(120), unit: z.string().max(20).optional().nullable(), city: z.string().max(60), state: z.string().max(2), zip: z.string().max(10) })
    .partial()
    .optional()
    .nullable(),
  preferredInstallDate: z.string().max(10).optional().nullable(),
  preferredInstallTime: z.string().max(10).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  consentMarketing: z.boolean().optional(),
  idempotencyKey: z.string().max(64).optional(),
});

export type Draft = z.infer<typeof draftSchema>;

// Detects data that must never be collected through chat or notes (SSN / card numbers).
export function containsSensitiveNumber(text: string): boolean {
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return true;
  const digitRuns = text.replace(/[ -]/g, "").match(/\d{13,19}/g) ?? [];
  return digitRuns.some(luhn);
}

function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
