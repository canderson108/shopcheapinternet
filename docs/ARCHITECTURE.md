# Architecture

## Layout

```
src/
  app/                    Next.js App Router
    (public pages)        /, /plans, /enroll, /enrollment/[publicId], /property/[slug], /providers/[slug], /internet/*, /legal/*
    agent/                Agent workspace (queue + order workspace)
    admin/                Admin dashboard (server components + server actions in actions.ts)
    staff/, setup/        Sign-in, 2FA, first-admin bootstrap
    api/                  Route handlers (JSON + server-sent-event streams)
  components/             UI (customer, agent/, admin/, staff/)
  lib/
    services/             Business logic — framework-independent and covered by tests
      funnel.ts           Shopping session: address, plan selection, autosave
      enrollment.ts       submitEnrollment (transactional, idempotent)
      assignment.ts       Fair auto-assignment, queue drain, claim, reassignment
      status-service.ts   Status transitions with optimistic locking + history
      orders.ts           Agent actions: processing, checklist, notes, portal, confirmation, cancel
      messages.ts         Customer ↔ agent messaging
      notify.ts           Emails (sent only after commit)
      conversions.ts      Server-side GA4 events (verified orders only)
      reports.ts          Dashboard metrics
      admin.ts            Providers, plans (with price history), properties, staff
      retention.ts        PII deletion and maintenance
    auth/                 Staff sessions + TOTP, customer sessions + access links
    crypto.ts             AES-256-GCM field encryption, keyed hashes, tokens
    realtime.ts           Event log + SSE streaming
prisma/                   schema.prisma, migrations, idempotent seed
tests/                    Vitest integration + unit tests
```

## Data model (key tables)

- **StaffUser** (agents, managers, admins via `role`) + **AgentProfile** (availability, capacity, fairness timestamp) + **StaffSession**.
- **Provider** (portal URL, instructions, `orderable` flag) → **Plan** → **PlanPriceHistory**; **ServiceArea** (advertised ZIP coverage).
- **Property** → **PropertyUnit**; **ReferralSource**; **Campaign**.
- **EnrollmentSession**: one per shopping session (a lead once an address is entered); holds the encrypted address and draft and the plan selection.
- **Enrollment**: the permanent request/order. Encrypted address, billing and notes; plan snapshot; pricing source and timestamp; status and `statusVersion`; assignment; checklist; confirmation fields; attribution.
- **Customer**: encrypted email and phone with HMAC lookup hashes.
- **EnrollmentStatusHistory** (every change: from, to, actor, note, time), **AgentAssignment**, **Message**, **AgentNote**, **ConsentRecord**, **CustomerAccessToken**, **CustomerSession**, **AuditLog**, **EmailLog**, **RealtimeEvent**, **RateLimitBucket**.

## Status machine (`src/lib/status.ts`)

```
ENROLLMENT_STARTED → INFORMATION_SUBMITTED → WAITING_FOR_AGENT ⇄ AGENT_ASSIGNED → AGENT_PROCESSING
AGENT_PROCESSING ⇄ ADDITIONAL_INFO_REQUIRED
AGENT_PROCESSING → SUBMITTED_TO_PROVIDER → PROVIDER_ORDER_CONFIRMED   (confirmation form only)
any open state → UNABLE_TO_COMPLETE (reason required) / CUSTOMER_CANCELED
```

Every transition goes through `transitionStatus()`. It checks the transition is allowed, updates with `WHERE statusVersion = n` (stale writes get 409), and writes history, an audit entry and real-time events in the same transaction.

## Assignment and concurrency

- `pickAgent()` locks all AVAILABLE agent rows (`SELECT … FOR UPDATE`), then counts each agent's active orders with a fresh snapshot. It picks the agent with the fewest active orders; ties go to the earliest `lastAssignedAt`. It never exceeds `maxActiveOrders`. Locking serializes concurrent assignments, so capacity can't be overshot. A test covers this with 10 concurrent submissions.
- An enrollment row is locked (`FOR UPDATE`) before any agent action. Agents may act only on their own orders; managers and admins may act on any.
- Claiming from the queue checks `status = WAITING_FOR_AGENT AND assignedAgentId IS NULL` under the row lock, so exactly one claimer wins.
- `drainQueue()` assigns waiting orders oldest-first (`FOR UPDATE SKIP LOCKED`). It runs on agent availability changes, order closure, and the daily cron.

## Real-time

Writes append rows to `RealtimeEvent` (channels `enrollment:{id}`, `agent:{id}`, `staff`) inside the same transaction as the change. `GET …/events` streams them as server-sent events, polling the table every 1.5s for about 50s per connection. Browsers reconnect automatically with `Last-Event-ID`, so nothing is missed between connections. This works on Vercel serverless functions with no extra infrastructure. To move to a push service (Pusher, Ably), replace `publish()` and `sseResponse()` in `src/lib/realtime.ts`.

## Security notes

- PII columns (`…Enc`) are encrypted in the application with AES-256-GCM. Key rotation is supported via `DATA_ENCRYPTION_KEY_PREVIOUS`, and the key id is embedded in each ciphertext.
- Customer access is never granted by the enrollment reference alone. It requires an httpOnly session cookie or an expiring 256-bit emailed token.
- Staff: bcrypt (cost 12), account lockout, TOTP 2FA, 12-hour sessions stored hashed, role checks on every page, route and server action.
- CSRF: the middleware rejects cross-origin state-changing API requests; server actions have built-in origin checks; cookies are `SameSite=Lax`.
- Rate limits (Postgres-backed) on address lookups, autocomplete, submission, messages, sign-in, 2FA, link requests and setup.
- Audit log covers sign-ins, PII views, exports, every status, assignment, message and note action, and configuration changes.
- SSNs and card numbers are rejected in customer chat, agent messages and notes.
