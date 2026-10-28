# Testing

## Automated (runs in GitHub Actions on every push)

`.github/workflows/ci.yml` runs these steps against a real PostgreSQL 16 service:

1. **Install dependencies.**
2. **Validate the Prisma schema** and **apply migrations.**
3. **Check migration drift.** Fails if `schema.prisma` and the SQL migrations disagree.
4. **Seed twice** to prove the seed is idempotent.
5. **Vitest suite** (`tests/`):
   - `enrollment.test.ts`: full submission; PII encrypted at rest; status history and consent records; queueing when no agents; idempotent duplicate submissions (including concurrent); validation; billing address; price-change blocking; non-orderable providers; honest availability labels; encrypted autosave; property attribution; expiring access links; immediate assignment.
   - `assignment.test.ts`: fair distribution; busy, offline and deactivated agents excluded; capacity limits; no over-assignment under 10 concurrent submissions; queue drain (oldest first); capacity freed when orders close; exactly one winner when two agents claim; agents blocked from others' orders; manager reassignment and return-to-queue.
   - `confirmation.test.ts`: end-to-end agent workflow (portal, checklist, notes, install options, submitted, confirmed); confirmation email only after verification; permission checks; invalid transitions; optimistic concurrency; info requests; price-change approval; SSN and card blocking; missing portal URL; PII deletion.
   - `unit.test.ts`: crypto, status machine, recommendations, validation, formatting.
6. **Production build** (`next build`, which includes type checking) and a standalone `tsc --noEmit`.
7. **Smoke test** of the built server over HTTP: homepage, provider page, sitemap; protected pages redirect; APIs return 401; cross-site POST blocked; then a full customer funnel with a cookie jar (address → plans → select → enroll page → submit → status page). It also checks the status page is not visible without the customer's cookie.

Run locally (requires PostgreSQL):

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/sci_test DIRECT_URL=$DATABASE_URL
npx prisma migrate deploy
npm test
```

## Manual end-to-end checklist (staging or production, before launch)

Use two browsers: one as customer, one as agent.

1. **Agent:** sign in at `/staff/login`, complete 2FA, and set yourself **Available**. Click "Enable desktop alerts".
2. **Customer:** open `/`, enter a real address, and check that autocomplete and verification work if Smarty is configured.
3. **Customer:** compare plans, use "Tell us about your home", compare two plans, then **Select Plan**.
4. **Customer:** fill the form, leave the page, return, and confirm the values were autosaved. Submit.
5. **Agent:** the order appears instantly with a sound and desktop alert. Open it.
6. **Agent:** click **Open AT&T SPOC** (new tab, your credentials). Copy fields with the copy buttons and run the serviceability check.
7. **Agent:** send "Present install options". **Customer:** pick an option on the status page and see it appear for the agent in real time.
8. **Agent:** submit in SPOC, set **Submitted to AT&T**, then record the SPOC confirmation number.
9. **Customer:** the status page updates live to confirmed and the confirmation email arrives with the number.
10. **Admin:** the dashboard counts the order as confirmed; check the CSV export and audit log entries.

**Error cases to try:**

- Close the customer tab and use "Email me a secure link" at `/enrollment/find`.
- Double-click submit.
- Submit with all agents Offline; the order queues and drains when one goes Available.
- Reassign as a manager.
- Have two agents claim the same queued order.
- Cancel as the customer.
- Change a plan price between selection and submit; submission is blocked with a notice.
