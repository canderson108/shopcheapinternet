# Deployment: GitHub → Vercel + managed PostgreSQL

The repository builds on Vercel without changes. Dependencies are installed by Vercel, migrations are applied during the build, and reference data is seeded idempotently.

## 1. Create the database

Any managed PostgreSQL 14+ works. Recommended: **Neon** (via the Vercel Marketplace, which injects env vars automatically) or **Supabase**.

You need two connection strings:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | **Pooled** connection (Neon: "pooled connection"; Supabase: transaction pooler, port 6543, append `?pgbouncer=true`) |
| `DIRECT_URL` | **Direct** connection, used for migrations |

If your provider has no pooler, set both to the same URL. Use a region close to your Vercel region (e.g. `us-east-1` / `iad1`).

## 2. Import the GitHub repo into Vercel

1. Vercel → **Add New → Project** → import `shopcheapinternet` from GitHub.
2. Framework preset: **Next.js** (auto-detected). `vercel.json` sets the build command to `npm run vercel-build`.
3. Before the first deploy, add the environment variables (next step).

## 3. Environment variables

Generate secrets locally with `node scripts/gen-keys.mjs`, or use any generator producing the same lengths. Set these for **Production** (and Preview, with separate values and a separate database if you use preview deployments):

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Yes | See step 1 |
| `APP_URL` | Yes | `https://shopcheapinternet.com` |
| `DATA_ENCRYPTION_KEY` | Yes | 32 random bytes, base64. **Store a backup offline.** Losing it makes customer PII unreadable. |
| `HASH_PEPPER` | Yes | Random string. Never change after launch (search by email/phone depends on it). |
| `CRON_SECRET` | Yes | Vercel sends it to `/api/cron/maintenance` |
| `SETUP_TOKEN` | First deploy | Lets you create the first admin at `/setup`; delete afterwards |
| `STAFF_MFA_REQUIRED` | Yes | `true` |
| `ATT_SPOC_PORTAL_URL` | Recommended | Your authorized SPOC sign-in/landing URL (no `(S(...))` session segment). Used when the AT&T provider is first seeded; editable later in Admin → Providers |
| `EMAIL_PROVIDER` + keys | Yes for launch | `resend` + `RESEND_API_KEY`, or `postmark` + `POSTMARK_SERVER_TOKEN`, or `smtp` + `SMTP_URL`. Set `EMAIL_FROM` to a verified sender on shopcheapinternet.com |
| `AGENT_NOTIFY_EMAIL` | Recommended | Team inbox for queued orders |
| `SMARTY_AUTH_ID`, `SMARTY_AUTH_TOKEN` | Recommended | Address autocomplete + verification |
| `NEXT_PUBLIC_GA4_ID`, `GA4_API_SECRET`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Optional | Analytics / ads |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` | Recommended | Shown in header/footer/emails |
| `DATA_RETENTION_DAYS` | Optional | Auto-erase PII N days after an order closes |

## 4. Deploy

Trigger a deploy (push to `main` or click **Deploy**). The build runs:

```
prisma generate → prisma migrate deploy → tsx prisma/seed.ts → next build
```

The seed only creates the AT&T provider, its plans, and placeholder (non-orderable) providers if they don't already exist. It never overwrites prices you've edited.

## 5. Create the first administrator

Visit `https://<your-deployment>/setup`, enter `SETUP_TOKEN`, and create your admin account. The page disables itself once any staff account exists. Then **remove `SETUP_TOKEN`** from Vercel and redeploy.

Alternative: `npm run create-admin -- "Name" email "password"` from a machine with `DATABASE_URL` set.

Sign in at `/staff/login`. You'll be required to set up two-factor authentication.

## 6. Domain

Vercel → Project → **Settings → Domains** → add `shopcheapinternet.com` and `www.shopcheapinternet.com` (redirect www → apex), then update DNS at your registrar as Vercel instructs. HTTPS is automatic. Confirm `APP_URL` matches the final domain.

## 7. Email sender domain

In Resend or Postmark, verify `shopcheapinternet.com` (SPF/DKIM DNS records) so emails from `EMAIL_FROM` are delivered. Send yourself a test by submitting an enrollment.

## 8. Cron

`vercel.json` schedules `/api/cron/maintenance` daily at 09:00 UTC (allowed on all Vercel plans). It purges expired sessions, tokens and old real-time events, erases abandoned funnel addresses, applies `DATA_RETENTION_DAYS`, and assigns any queued orders if agents are available.

Queue assignment doesn't depend on the cron. It also happens immediately on submission, when an agent goes Available, and when an order closes.

## Real-time on Vercel

Live updates use server-sent events backed by a Postgres event table (see ARCHITECTURE.md). Each stream connection lasts about 50 seconds and reconnects automatically, resuming from the last event. `vercel.json` gives the stream functions `maxDuration: 60`. No extra service is required.

## Production checklist

- [ ] All required env vars set; `DATA_ENCRYPTION_KEY` backed up offline
- [ ] First admin created, `SETUP_TOKEN` removed
- [ ] AT&T provider portal URL confirmed (Admin → Providers → AT&T)
- [ ] Plan prices re-verified and "Date verified" updated (Admin → Plans & pricing)
- [ ] Email provider domain verified; test emails received
- [ ] Smarty keys added (or accept unverified addresses with agent verification)
- [ ] Privacy policy / terms reviewed by counsel (`src/app/legal/[doc]/page.tsx`)
- [ ] Domain + HTTPS active, `APP_URL` correct
- [ ] Agents created, MFA set up, test order run end-to-end (docs/TESTING.md)
