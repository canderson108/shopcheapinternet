# Shop Cheap Internet

Internet plan shopping, enrollment, and agent-assisted ordering platform for **shopcheapinternet.com**.

Customers enter their address, compare plans, choose one, and submit an enrollment request once. Enrollment specialists receive it in a real-time agent workspace, open the provider's order portal (AT&T SPOC first) in a separate tab, enter the order manually using one-click copy tools, and record the provider's confirmation, which is then shown to and emailed to the customer.

> Shop Cheap Internet is an independent enrollment service. Nothing in this codebase automates, scrapes, embeds, or logs into AT&T SPOC or any provider system. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## What's included

| Area | Highlights |
| --- | --- |
| **Customer site** | Conversion-focused homepage, address search with optional Smarty autocomplete/verification, plan comparison with recommendations and side-by-side compare, enrollment form with autosave, real-time status page with chat, expiring secure re-entry links, property landing pages (`/property/{slug}`), SEO content and provider/ZIP pages, sitemap, structured data, consent-aware GA4/GTM/Google Ads/Meta tags |
| **Agent workspace** (`/agent`) | Live queue (server-sent events) with sound and desktop alerts, Available/Busy/Offline, automatic fair assignment with capacity limits, claim-from-queue with race protection, two-panel order workspace with per-field and grouped copy buttons, "Open AT&T SPOC" button, saved checklist, status controls with optimistic locking, customer messaging (questions, info requests, install options, price-change approval), internal notes, verified-confirmation form |
| **Admin** (`/admin`) | Metrics dashboard (leads, requests, pending, active, confirmed, failed, conversion rates, processing time, agent productivity, by property/provider/plan, trends), enrollment search and filters, reassignment, CSV export (with/without PII, plus offline-conversion export), staff management with roles and MFA reset, properties and units, providers and portal URLs, plans and pricing with full price history, referral sources and campaigns, audit log, customer data deletion |
| **Security** | Staff passwords hashed with bcrypt, TOTP two-factor authentication required for staff, role-based access (Agent / Manager / Admin), AES-256-GCM encryption of customer PII at rest, keyed hashes for lookups, audit logging including PII views and exports, database-backed rate limiting, CSRF origin checks, no SSN/card collection (blocked in chat and notes), data retention controls |
| **Ops** | PostgreSQL + Prisma migrations, idempotent seed with sourced AT&T pricing, Vercel configuration and daily maintenance cron, GitHub Actions CI (install, migration drift check, tests, build, type check, end-to-end smoke test) |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Zod · Vitest

## Quick start (local)

Requires Node.js 20.18+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, DIRECT_URL
npm run gen-keys              # paste the output into .env
npx prisma migrate deploy
npm run db:seed               # AT&T provider + starter pricing (idempotent)
npm run create-admin -- "Your Name" you@example.com "a-long-password-123"
npm run dev
```

Open http://localhost:3000 for the customer site and http://localhost:3000/staff/login for staff. Set `STAFF_MFA_REQUIRED="false"` locally if you don't want to set up an authenticator during development (keep it `true` in production).

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): GitHub → Vercel + managed Postgres, step by step
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): AT&T SPOC, pricing data, address verification, email, analytics: what's live and what credentials activate each
- [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md): first admin, agents, providers, pricing, properties
- [docs/TESTING.md](docs/TESTING.md): automated tests and the manual end-to-end checklist
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, status machine, assignment, real-time design

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run vercel-build` | Used by Vercel: generate client, apply migrations, seed (idempotent), build |
| `npm test` | Vitest suite (needs `DATABASE_URL` pointing at a disposable database) |
| `npm run typecheck` | TypeScript check |
| `npm run db:seed` | Idempotent reference data |
| `npm run create-admin` | Create an administrator from the CLI |
| `npm run gen-keys` | Generate secrets for the environment |
