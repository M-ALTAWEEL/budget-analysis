# Budget Analysis: Product Roadmap

> The plan that takes Budget Analysis from a portfolio project to a commercial product on
> the web, iPhone and Android. Each phase ships something complete and tested; the status
> table below is updated when a phase closes.
>
> Last updated: 29 October 2026

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Design: product plan, groups, threat model | ✅ Done |
| 1 | Production-grade infrastructure | ✅ Done (custom domain and paid plans moved to Activation) |
| 2 | Accounts, rebuilt | ✅ Done (Sign in with Apple moved to Activation, phase 8) |
| 3 | Groups | ✅ Done (notifications moved to phase 6, with mobile push) |
| 4 | Performance and load | ✅ Done (400–500 requests/s on a laptop, p95 under 100 ms) |
| 5 | Security audit | ✅ Done (OWASP ASVS L2; OWASP ZAP: zero findings) |
| 6 | iPhone and Android apps | ✅ Done on Android (iPhone builds, Universal Links, TestFlight and the Play closed test need paid accounts → Activation, phase 8) |
| 7 | Subscriptions, payments and coupons | ⬜ Not started |
| 8 | **Activation and payment** of services, then launch | ⬜ Not started |

**Why this order?** What is hard to change later (infrastructure, accounts, the data model)
comes first; what depends on it (groups, mobile, payments) comes after.

---

## Decisions

| Topic | Decision |
|---|---|
| Name | **Budget Analysis** (a custom domain is bought at Activation) |
| Market | Worldwide, with Turkey and the Arab world first |
| Platforms | Web (Next.js) and iPhone/Android (React Native with Expo), all on one API |
| Sign-in methods | Email and password, Google, **Apple**, **phone number** (SMS; WhatsApp as the cheaper channel) |
| Security baseline | **OWASP ASVS Level 2**, plus App Store and Google Play requirements |
| Groups | The creator sets the member limit. Each member's share **is added automatically** to their personal budget, in the same category. A group never sees anyone's personal data |
| Payments | A subscription (even a small one), built **last**. RevenueCat unifies Apple, Google and the web |
| Coupons | Discount coupons and free codes for family and friends: Apple Offer Codes, Google Promo Codes, and our own codes on the web |
| Cost | Estimated at the end of this file |

---

## Phase 0: Design ✅
- [x] This roadmap
- [x] Groups design: [`design/groups.md`](design/groups.md)
- [x] Threat model and security baseline: [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md)

## Phase 1: Production-grade infrastructure ✅
**Goal:** a foundation that can carry a commercial product before any new feature.
- [x] **Two environments** in code: `staging` and `production`, each with its own database and secrets (`render.yaml`; guide in [`ENVIRONMENTS.md`](ENVIRONMENTS.md))
- [x] Staging provisioned: a `staging` branch on Neon, `budget-analysis-api-staging` on Render, and Vercel preview deployments talking to it
- [x] **Redis** support: rate limiting uses it when configured (locally through Docker); not yet provisioned on the servers
- [ ] **Object storage** (S3 or R2): added with the first feature that needs it
- [x] **Sentry** in the API (enabled when `SENTRY_DSN` is set)
- [x] Sentry account (EU data region) and `SENTRY_DSN` on production and staging
- [ ] Sentry for the web and mobile front ends
- [x] **Security headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy and Permissions-Policy (website and API)
- [x] **Automated checks in CI**: CodeQL, Dependabot, pip-audit and npm audit
- [ ] Turn on secret scanning in the GitHub repository settings (owner action)
- [x] Repository links updated to the new name `budget-analysis`
- [x] **Render auto-deploy fixed**: the Render GitHub app is scoped to `budget-analysis` only
- [x] **Structured JSON logs** with no personal data, and a **request ID** on every request
- [x] **Version endpoint**: `/api/v1/version`, shown in Settings next to the client version
- [x] **Uptime alert**: every 14 minutes GitHub Actions checks the API and the website and emails on failure
- [x] **Versioned API path** (`/api/v1`) and a written policy for changing it: [`API_VERSIONING.md`](API_VERSIONING.md), because old mobile app versions keep running for years

## Phase 2: Accounts, rebuilt ✅
**Why before groups?** Nobody can be invited to a group until we know the email or phone number is theirs.
- [x] **Sign-in identities table**: one account can have an email, Google, Apple and a phone number at the same time
- [x] **Email verification** and **password reset** (short-lived, single-use links)
- [ ] **Sign in with Apple** (web and mobile) → Activation
- [x] **Phone sign-in**: a code by SMS, with SMS-pumping protection and limits per number, per IP and per country
- [x] **Database-backed sessions**: "My devices", "Sign out this device", "Sign out everywhere"
- [x] **Two-factor authentication** with an authenticator app (TOTP) and backup codes
- [x] **Breached-password check** (Have I Been Pwned k-anonymity: the password never leaves the server)
- [x] **Account deletion** (required by Apple, Google, KVKK and GDPR) and **data export**
- [x] **Security log**: every sign-in, password change and new device, with email notices
- [x] Updated privacy policy and new **terms of use** (to be reviewed by a lawyer before launch)

## Phase 3: Groups ✅
Full design in [`design/groups.md`](design/groups.md); rules in [`BUSINESS_LOGIC.md`](BUSINESS_LOGIC.md).
- [x] **3a** Groups, members and roles; invitations by link and QR code; a member limit chosen by the owner
- [x] **3b** Group expenses and split methods: equal, exact amounts, percentages and shares (the total always matches to the cent)
- [x] **3c** A unique username in Settings, and invitations by username (the invitee must accept)
- [x] **3d** **Automatic copy** of each member's share into their personal budget, in the same category
- [x] **3e** Balances ("who owes whom"), "I paid my share" per expense, settlements, and the group chat with date and time
- [x] **Authorization tests** on every endpoint: a member never sees anything personal; a non-member never sees the group
- [x] Notifications (new invitation, new expense, payment) → delivered in phase 6h
- [ ] Debt simplification (A→B→C becomes A→C). Balances are pairwise today, by design; added if users ask

## Phase 4: Performance and load ✅
Tools and method in [`../loadtest/README.md`](../loadtest/README.md); numbers and decisions in [`../loadtest/REPORT.md`](../loadtest/REPORT.md).
- [x] **4a** Measurement tools: realistic seed data (200 people, 96,000 expenses, 50 groups) and a **k6** load test with written targets: p95 under 300 ms, errors under 1%
- [x] **4b** Instrumentation: every request records its query count and database time (`Server-Timing` and logs); `summarize.py` lists the slowest endpoints and why
- [x] **4c** Finding: the database is under 10% of request time; latency came from **queueing** behind a single worker. No new indexes were needed
- [x] **4d** Multiple workers (`WEB_CONCURRENCY`), a sized connection pool (`DB_POOL_SIZE`), and an API ready for more than one server
- [x] **4e** Exchange rates cached in each process's memory. Budget summaries are deliberately **not** cached (reasons in the report)
- [x] **4f** Result: from p95 = 398 ms (1 worker, 130 req/s) to **75 ms at 390 req/s** (4 workers)

## Phase 5: Security audit ✅
Item-by-item checklist in [`security/ASVS.md`](security/ASVS.md).
- [x] **5a** **ASVS Level 2** review with the status of every requirement. Fixed: per-account sign-in limit, per-endpoint default rate limit, 1 MB request body limit, API schema hidden in production, and email notices when the password or 2FA changes
- [x] **5b** **OWASP ZAP** scans of a local deployment (anonymous and signed in): zero high or medium findings; both warnings fixed
- [x] **5c** Self-run penetration test of groups and accounts, written as automated tests (`test_pentest.py`); report in `security/ASVS.md`
- [ ] (Optional, before scale) An external penetration test

## Phase 6: iPhone and Android apps ✅
- [x] **6a React Native (Expo)**: one app for both platforms, with the same three languages, right-to-left layout and dark mode
- [x] Tokens stored in the **iOS Keychain / Android Keystore** (never in AsyncStorage)
- [x] **6b–6f Feature parity with the website**: every screen and feature. Shared code (types, texts, API calls, month and money rules) is copied from the website by a script, and CI fails if the copies drift
- [x] **Budget month start day** (the allowance day, 1–28) and **Start fresh** (hide older months without deleting them), on the server, website and app
- [x] **6g App lock** with Face ID, a fingerprint or the phone passcode, after 30 seconds away, with a privacy cover in the app switcher
- [x] **6h Push notifications for groups** (new expense, payment, invitation) in each reader's language, through Expo and Firebase. First Android development build made with EAS and tested on the Android Emulator
- [x] **6i Budget alerts as push notifications**: a category near or over its limit, the month's money almost gone or overspent; once a month each, with their own switch in Settings
- [x] **6j Invitation links open the app** on Android (App Links: `/.well-known/assetlinks.json` on the website, verified intent filter for `/join`), signed in or not
- [ ] The same on iPhone (Universal Links): needs the Apple Developer team ID → Activation
- [x] **6k Sign in with Google inside the app** (Android): the native account picker; its ID token is checked by the server exactly like the website's, and it also confirms "is it you?" for Google accounts. iPhone needs an iOS OAuth client → Activation
- [x] **Store requirements** written down: Google Play Data safety and App Store privacy labels, ready to copy ([`STORE_REQUIREMENTS.md`](STORE_REQUIREMENTS.md)); in-app account deletion done. Filled in at phase 8
- [ ] **TestFlight** for iPhone and a **closed test** on Google Play (12 testers for 14 days, required for new developer accounts) → Activation, phase 8

## Admin dashboard (website only) ✅
Design in [`design/admin.md`](design/admin.md).
- [x] Admins made only from the command line (`python -m app.cli grant-admin`), never by a request
- [x] 2FA required, the password again for actions, 404 for everyone else, tight rate limits
- [x] Overview (counts only, no money), users (search, account details, devices, security activity), system status, audit log
- [x] Actions: disable / enable, sign out everywhere, resend email confirmation; each audited and shown to the person
- [x] Currencies: the list moves into the database; admins add currencies (only ones the rates provider knows) and hide or show them, never delete; the website and app pickers read the list from the server
- [ ] Privacy policy: a sentence that support can see account details (not budget data), checked by the owner

## Extra features (before phase 7)
Thirteen features that make the product stronger, one pull request each, easiest first.
Features meant for Plus are built free now and gated by entitlements in phase 7.
- [x] **F1 Recurring expenses and subscriptions**: rules added on their day each month, reminders the day before, a monthly total; "Repeat every month" on a new expense
- [x] **F2 Personal debts**: lent or borrowed outside groups, paid back in parts, totals both ways, a reminder on the due day
- [x] **F3 Income and its sources**: job, scholarship, family and more, in any currency; came in, went out and what is left; "make my budget" from income; "same as last month"
- [x] **F4 Month-end report (Wrapped)**: spent and left over, change against last month, top categories, biggest expense, no-spend days; a push notification when a month ends; share
- [x] **F5 PDF and Excel reports (Plus)**: a month or a whole year, in the person's language (Arabic right to left); downloaded on the website, shared from the app
- [x] **F6 Savings challenges**: skip a category, spend under an amount, days without spending; wins, badges and a no-spend streak; shared with a group and joined by its members
- [x] **F7 Shared household budget (Plus)**: one monthly total for the whole group with category limits, what is left, and who paid how much; set by the group admins
- [x] **F8 Inflation and currency view (Plus)**: six months of spending in the person's currency and in a steady one at each month's rate (ECB rates, kept once fetched); purchases that got more expensive
- [x] **F9 Add an expense by voice**: one sentence in English, Arabic or Turkish fills in the form (browser speech recognition on the website, the keyboard microphone in the app)
- [x] **F10 Receipt scan (Plus)**: a photo fills in total, date and shop (Tesseract, Turkish / English / Arabic); nothing is kept. In the app through `expo-image-picker`
- [x] **F11 Bank statement import (Plus)**: Excel, CSV or PDF (Kuveyt Türk first, any bank with a table); every line with a suggestion; transfers and card payments left to the person; importing twice adds nothing
- [x] **F12 Home-screen widget** (Android): left this month, a progress bar and + Add expense; cleared on sign-out. iPhone widget with the iPhone release
- [x] **Customer support**: Help and feedback in Settings, Contact us on the sign-in page, an inbox in the admin dashboard; answers by push and email
- [x] **F13 Offline mode**: new expenses wait on the device without a connection and are sent by themselves when it is back; a device-made id stops duplicates

## Phase 7: Subscriptions, payments and coupons
- [ ] An **entitlements** table: what is free and what is paid. Code asks "is this allowed?", never "did they pay?"
  Sources: `apple`, `google`, `web` and `admin_grant`
- [ ] **RevenueCat** with Apple In-App Purchase and Google Play Billing
- [ ] Payments on the web (Paddle or iyzico; Stripe does not support Turkish companies)
- [ ] **Coupons**: Apple Offer Codes, Google Promo Codes and web codes, including fully free codes for family
- [ ] Paywall and a free trial
- [ ] **Admin: free grants**: Premium for a fixed period or lifetime, with a reason; re-auth and audit log
- [ ] **Admin: discount codes** (website only; inside the apps only Apple Offer Codes / Google Promo Codes are allowed): percent, fixed amount or free period; start and end dates; maximum uses; one per person; new subscribers only; per plan; bulk single-use codes; switch off at once; who used them
- [ ] **Admin: subscriptions** on the user page (plan, source, status, renewal) and business stats (subscribers, MRR, conversions, code use), summarised from RevenueCat
- [ ] **Admin: safety for money actions**: a second admin approves lifetime grants and big codes, daily caps, an email to all admins
- [ ] (Maybe) announcement banner, feature flags, support inbox
- [ ] **Business registration** (company or sole trader) and a bank account to receive store payouts

## Phase 8: Activation (all payments happen here), then launch
**Rule:** everything is built and tested **without paying for anything**. Every paid service has
a free stand-in in code. Activation connects the real services in one step.

| Service | Until activation | At activation |
|---|---|---|
| Domain | `budgetanalysis.vercel.app` | Buy the domain (~$10–14/year) and connect it to Vercel, Render and Google |
| Email (verification, password reset) | Locally: Mailpit catches messages. Staging: written to the logs | Resend with the custom domain |
| SMS and WhatsApp | The code is written to the logs (local and staging only) | Twilio or another provider |
| Sign in with Apple | Tests with fake keys (as for Google) | Apple Developer account ($99/year) |
| iPhone builds and push | Android builds only | Apple Developer account: builds, APNs, TestFlight |
| Subscriptions | Entitlements and test accounts | RevenueCat, Apple, Google and Paddle/iyzico |
| Servers and database | Free plans | Paid plans: no sleeping, backups |

- [ ] Buy the domain, set up `support@`, update Google, Render and GitHub
- [ ] Activate Resend, SMS, Apple and RevenueCat, and test each on staging
- [ ] Paid plans for the API server and the database
- [ ] Business registration and final terms of use
- [ ] Store listings, screenshots and descriptions in three languages
- [ ] Marketing page and privacy-respecting analytics
- [ ] Support email and an FAQ page
- [ ] Incident plan: who does what if the service goes down or data leaks

---

## Estimated cost
> October 2026 prices; they change. Every price is checked again before paying.

**One-off or yearly:** Apple Developer $99/year · Google Play $25 once · domain $15–20/year · registration and accounting depend on the country.

| Monthly | Launch (~1,000 users) | Growth (~10,000) | Large (~100,000) |
|---|---|---|---|
| Vercel Pro | $20 | $20–60 | $300+ |
| Render (API and staging) | $32–57 | $110–200 | $500+ |
| Neon | $20–45 | $80–160 | $400+ |
| Redis | ~$10 | $10–30 | $50–100 |
| Sentry | $0 | $26 | $80+ |
| Email | $0 | $20 | $90 |
| Object storage | $0 | ~$5 | $20–50 |
| Expo (EAS) | $0–19 | $19 | $99+ |
| **Total** | **~$80–160** | **~$300–550** | **~$1,500–3,000** |

- **SMS:** about $0.06–0.15 per code depending on the country; WhatsApp is 50–90% cheaper.
- **Revenue share:** Apple and Google 15%; web payments ~5%; RevenueCat is free up to $2,500/month, then ~1%.
- **We stay on free plans until about a month before launch.**
