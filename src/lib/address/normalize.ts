import { z } from "zod";

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export const addressSchema = z.object({
  street: z
    .string()
    .transform(collapse)
    .pipe(z.string().min(3, "Enter your street address").max(120).regex(/\d/, "Street address should include a house or building number")),
  unit: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? collapse(v).replace(/^(apt|apartment|unit|ste|suite|#)\.?\s*/i, "") : null))
    .pipe(z.string().max(20).nullable()),
  city: z.string().transform(collapse).pipe(z.string().min(2, "Enter your city").max(60)),
  state: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .refine((s) => s in US_STATES, "Choose a valid US state"),
  zip: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => /^\d{5}(-\d{4})?$/.test(s), "Enter a valid 5-digit ZIP code")
    .transform((s) => s.slice(0, 5)),
});

export type Address = z.infer<typeof addressSchema>;

export function formatAddressLine(a: { street: string; unit?: string | null }): string {
  return a.unit ? `${a.street}, Unit ${a.unit}` : a.street;
}

export function formatFullAddress(a: { street: string; unit?: string | null; city: string; state: string; zip: string }): string {
  return `${formatAddressLine(a)}, ${a.city}, ${a.state} ${a.zip}`;
}
