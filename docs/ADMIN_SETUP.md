# Administrative setup

## Roles

| Role | Can do |
| --- | --- |
| **Agent** | Agent workspace: receive/claim orders, work only their own orders, message customers, record confirmations |
| **Manager** | Everything an agent can, plus work any order, reassign or return orders to the queue, dashboard, enrollment search, CSV export (without PII) |
| **Admin** | Everything, plus staff accounts, providers, plans and pricing, properties, campaigns, audit log, CSV export with contact details, customer data deletion |

All staff must set up two-factor authentication (TOTP app) at first sign-in. Admins can reset another user's 2FA or password; doing so signs that user out everywhere.

## First-time configuration

1. **Create the first admin.** Use `/setup` (see DEPLOYMENT.md) and sign in at `/staff/login`.
2. **Configure the AT&T provider.** Go to Admin → Providers → AT&T.
   - Set **Order portal entry URL** to your authorized SPOC sign-in or landing page. Don't use a URL containing `(S(...))`.
   - Review the **agent order-entry instructions**, which are shown next to the "Open AT&T SPOC" button.
   - Optionally paste **service area ZIP codes**. Plans then show only in those ZIPs and are labeled "advertised in your ZIP". Leave it empty to show plans everywhere as "availability not yet confirmed".
3. **Verify pricing.** In Admin → Plans & pricing, open each AT&T plan, confirm the current offer on att.com, and update **Date verified**. Every edit records price history. Plans unverified for 30+ days are flagged.
4. **Add agents.** Go to Admin → Staff & agents → Add staff member. Share the temporary password securely; agents set up 2FA at first sign-in. Set **Max active orders** per agent; auto-assignment never exceeds it.
5. **Add properties.** Go to Admin → Properties → Add property. Set a slug, which gives the property its page at `/property/{slug}`. Add units in bulk (`101-124`, `A1, A2`, or one per line). Link a referral source or campaign to attribute every enrollment from that page.
6. **Add referral sources and campaigns.** Use any site link with `?ref={code}`, `?campaign={code}` or `utm_campaign=...`. Attribution is kept through enrollment and shown in reports.

## Daily operations

- Agents set themselves **Available** to receive orders automatically, using the fewest-active-orders-first rule with ties going to whoever has waited longest. **Busy** or **Offline** agents receive nothing new.
- When nobody has capacity, orders wait in the **queue**. Any agent can claim from it, and it drains automatically when someone becomes available or an order closes.
- Managers reassign from Admin → Enrollments → (order) → Assignment, or return an order to the queue.
- **Status rules:** only the confirmation form can mark an order confirmed, and it requires the provider's confirmation number. "Unable to complete" requires a reason, which is shared with the customer.

## Adding another provider (e.g. Spectrum)

1. Go to Admin → Providers → (provider). Set the portal URL, instructions, requirements and confirmation label, then tick **Orderable**.
2. Go to Admin → Plans & pricing → Add plan for each plan, with its source and verification date.
3. Optionally add service area ZIPs.

No code changes are needed. The funnel, agent workspace, emails and reports are provider-neutral.

## Privacy requests

To handle a deletion request, open the enrollment (Admin → Enrollments), go to **Delete customer data**, and type `DELETE`. This erases contact details, addresses, notes and messages. Order facts are kept for reporting. For automatic retention, set `DATA_RETENTION_DAYS`.
