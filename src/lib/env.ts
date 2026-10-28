// Centralised, lazily-validated environment access. Values are read at call time so that
// `next build` does not fail on variables only needed at runtime.

function read(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

function required(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  get appUrl(): string {
    return (read("APP_URL") ?? (read("VERCEL_PROJECT_PRODUCTION_URL") ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}` : "http://localhost:3000")).replace(/\/$/, "");
  },
  /** Secure cookies whenever the site is served over HTTPS. */
  get secureCookies(): boolean {
    return this.appUrl.startsWith("https://");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get dataEncryptionKey(): string {
    return required("DATA_ENCRYPTION_KEY");
  },
  get dataEncryptionKeyPrevious(): string | undefined {
    return read("DATA_ENCRYPTION_KEY_PREVIOUS");
  },
  get hashPepper(): string {
    return required("HASH_PEPPER");
  },
  get staffMfaRequired(): boolean {
    return (read("STAFF_MFA_REQUIRED") ?? "true") !== "false";
  },
  get setupToken(): string | undefined {
    return read("SETUP_TOKEN");
  },
  get cronSecret(): string | undefined {
    return read("CRON_SECRET");
  },
  // Email
  get emailProvider(): "resend" | "postmark" | "smtp" | "log" | "memory" {
    const p = (read("EMAIL_PROVIDER") ?? "log").toLowerCase();
    if (p === "resend" || p === "postmark" || p === "smtp" || p === "memory") return p;
    return "log";
  },
  get emailFrom(): string {
    return read("EMAIL_FROM") ?? "Shop Cheap Internet <enroll@shopcheapinternet.com>";
  },
  get emailReplyTo(): string | undefined {
    return read("EMAIL_REPLY_TO");
  },
  get resendApiKey(): string | undefined {
    return read("RESEND_API_KEY");
  },
  get postmarkToken(): string | undefined {
    return read("POSTMARK_SERVER_TOKEN");
  },
  get smtpUrl(): string | undefined {
    return read("SMTP_URL");
  },
  get agentNotifyEmail(): string | undefined {
    return read("AGENT_NOTIFY_EMAIL");
  },
  // Address verification (Smarty)
  get smartyAuthId(): string | undefined {
    return read("SMARTY_AUTH_ID");
  },
  get smartyAuthToken(): string | undefined {
    return read("SMARTY_AUTH_TOKEN");
  },
  // Server-side conversion tracking
  get ga4MeasurementId(): string | undefined {
    return read("NEXT_PUBLIC_GA4_ID");
  },
  get ga4ApiSecret(): string | undefined {
    return read("GA4_API_SECRET");
  },
  // Provider defaults
  get defaultAttPortalUrl(): string {
    return read("ATT_SPOC_PORTAL_URL") ?? "https://www.attspoc.com/";
  },
  get dataRetentionDays(): number {
    const n = Number(read("DATA_RETENTION_DAYS") ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  },
  get supportPhone(): string | undefined {
    return read("NEXT_PUBLIC_SUPPORT_PHONE");
  },
  get supportEmail(): string {
    return read("NEXT_PUBLIC_SUPPORT_EMAIL") ?? "support@shopcheapinternet.com";
  },
};
