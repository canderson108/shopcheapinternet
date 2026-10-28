# Integrations: status and what activates each one

| Integration | Status in this codebase | What's needed to activate |
| --- | --- | --- |
| AT&T order entry (SPOC) | **Manual by design.** Agent workspace opens the configured portal URL in a new tab; agents copy fields in and record the confirmation | Authorized SPOC agent credentials (held by each agent; never stored here) and the correct portal entry URL in Admin → Providers |
| Plan pricing | **Internal pricing database** with admin editing, source and verification date on every plan, full price history | Your team re-verifies prices periodically (plans older than 30 days are flagged) |
| Address autocomplete and verification | **Built (Smarty).** Falls back to manual entry plus agent verification when not configured | `SMARTY_AUTH_ID` + `SMARTY_AUTH_TOKEN` (secret keys) with US Autocomplete Pro and US Street API subscriptions |
| Address-level serviceability | **Not available.** Plans are labeled "availability not yet confirmed" or "advertised in your ZIP"; agents verify in SPOC and mark "Plan availability confirmed" | An authorized serviceability API from a provider or licensed data vendor. The `ServiceArea` table and `AvailabilityStatus` enum are ready for it |
| Transactional email | **Built** (Resend, Postmark, or SMTP) | API key/SMTP URL and a verified sender domain |
| Agent alerts | **Built.** Real-time in-app toast, sound, desktop notifications, title badge; email to agents for new assignments and to the team inbox for queued orders | Optional `AGENT_NOTIFY_EMAIL` |
| GA4 / GTM / Google Ads / Meta Pixel | **Built.** Consent-gated tags; funnel events; server-side `order_confirmed` + `purchase` only after verified confirmation | IDs in env; `GA4_API_SECRET` for server-side events |
| Google Ads / Meta offline conversions | **Built as CSV export** (Admin → Enrollments → "Offline conversions CSV"): confirmed orders with gclid/fbclid | Upload to Google Ads / Meta, or automate later with their APIs |

## AT&T SPOC: findings and design

- The SPOC link provided, `https://www.attspoc.com/e/(S(mxoa5rovrowrzxoe3k4ebjki))/oe/landing.aspx`, contains an ASP.NET cookieless session segment `(S(...))`. That segment expires and is tied to one browser session, so it must not be used as a permanent link. The app stores a **configurable portal entry URL** per provider (seeded from `ATT_SPOC_PORTAL_URL`, default `https://www.attspoc.com/`). Set it to the authorized sign-in/landing page your AT&T channel manager gives you.
- There is **no automation**: no iframe, no form filling, no session handling, no credential storage, no CAPTCHA handling. The portal opens in its own tab with `noopener` and `no-referrer`.
- Speed comes from the workspace: per-field copy buttons in SPOC field order, grouped copy (contact, address, plan), a provider-specific instruction panel, a saved checklist, and one-click status/confirmation recording.
- An order is shown to the customer as confirmed only after an agent records an AT&T order/confirmation number. The confirmation email is sent only after that transaction commits, and only if a confirmation number, confirming agent and timestamp are present.

## Pricing data: HighSpeedInternet.com findings

- HighSpeedInternet.com is operated by **Clearlink**. It publishes no public API or pricing data feed. Its "licensing and reuse of content" path is an advertising/licensing contact form, and it earns affiliate revenue from outbound links. It also offers **NextConnect** (clearlink.com/nextconnect), a partner/revenue product for ISPs and partners.
- Scraping is therefore **not** assumed to be permitted and is not implemented.
- **What was built instead:** an internal pricing database (`Plan` and `PlanPriceHistory`) maintained in Admin → Plans & pricing. Every plan stores advertised price, regular price, term, conditions, install and equipment fees, promotion and expiry, contract, data cap, disclosures, **source name, source URL and the date verified**. The customer site shows the source and date next to every price.
- **To automate later:** contact Clearlink about data licensing or NextConnect, or obtain a provider/affiliate feed. Add an importer that calls `upsertPlan()` in `src/lib/services/admin.ts`, which already records price history and audit entries. No schema or UI changes are needed.

### Seeded AT&T pricing (verify before launch)

Seeded from AT&T's Fiber plans page (att.com) on 2026-10-28, cross-checked against Allconnect (updated 2026-10-20):

| Plan | Advertised | Regular after 12 mo | Speed |
| --- | --- | --- | --- |
| Fiber 300 | $50/mo | $60 | 300/300 |
| Fiber 500 | $60/mo | $75 | 500/500 |
| Fiber 1 Gig | $70/mo | $90 | 1 Gig symmetrical |
| Fiber 5 Gig | $110/mo | $135 | 5 Gig symmetrical |
| Internet Air (5G) | $55/mo | — | up to ~300/30, varies |

Prices include the $10/mo AutoPay + paperless discount, plus taxes and fees. Equipment is included, data is unlimited on Fiber, and AT&T is currently waiving its installation fee. Online-only att.com promotions such as reward cards may not apply to agent-placed orders, so they were left out of the advertised promo field.

## Email

Templates are in `src/lib/email/templates.ts`. Emails sent:

- **To customers:** request received (with secure link), agent assigned, more information needed, submitted to provider, order confirmed (only after verification), unable to complete, secure re-entry link.
- **To staff:** new assignment, queued order (team inbox), customer replied while agent offline.

Every send is logged in `EmailLog` and visible on the admin enrollment page. Email failures never roll back order state.

## Analytics events

- **Client (`src/lib/track.ts`):** `address_search`, `plans_displayed`, `plan_selected`, `enrollment_started`, `enrollment_submitted` (mapped to Meta `Search`, `AddToCart`, `InitiateCheckout`, `Lead`).
- **Server (`src/lib/services/conversions.ts`, GA4 Measurement Protocol):** `enrollment_submitted`, `agent_assigned`, and, only after a verified confirmation, `order_confirmed` + `purchase`.
- Tags load only when IDs are set. Google tags start in Consent Mode v2 "denied". Meta loads only after the visitor accepts.
