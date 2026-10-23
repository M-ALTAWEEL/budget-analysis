# Threat model: Budget Analysis

Version 1 · October 2026 · Reviewed at the end of every phase.

## 1. Target

**OWASP ASVS 4.0 Level 2**, the standard recommended for applications that handle
personal and financial data, together with the App Store Review Guidelines (5.1 Privacy)
and Google Play's User Data policy. Phase 5 checks every ASVS item and records its status.

## 2. What we protect

| Asset | Why it matters |
|---|---|
| Accounts (passwords, sessions, phone numbers) | Taking over an account exposes everything else |
| Personal finances (budgets, expenses, goals) | Private, and they reveal habits and income |
| Group data (shared expenses, balances, members) | Visible to members only |
| Payment status and coupon codes (phase 7) | Revenue; free codes must not leak or be guessable |
| Secrets (database URL, signing keys, API keys) | Full access to everything |
| Availability | Users rely on it every day; SMS costs real money |

## 3. Who might attack

- **Outsiders:** credential stuffing with leaked passwords, scanning for common holes,
  abusing SMS to run up our bill (SMS pumping).
- **Another user:** guessing other people's ids, reading a group they were removed from,
  reusing an old invite link.
- **A group member:** trying to see a fellow member's personal data through the group.
- **A stolen device or token:** someone holding a phone or a copied token.
- **Supply chain:** a compromised library in Python or npm.

## 4. Entry points

The web app (Vercel) → the API (`/api/v1`, FastAPI on Render) → PostgreSQL (Neon).
Later: the mobile apps, SMS and email providers, Apple and Google sign-in, payment webhooks,
file uploads (receipts).

## 5. Threats (STRIDE) and what stops them

Status: ✅ done · 🔜 planned (phase) · 🔍 to check in phase 5

| # | Threat | Mitigation | Status |
|---|---|---|---|
| **S: Spoofing** ||||
| S1 | Password guessing / credential stuffing | bcrypt; login rate limit; breached-password check; 2FA | ✅ bcrypt + limit · 🔜 2: HIBP, 2FA |
| S2 | Rate limit bypassed across server instances | Shared limiter in Redis, per IP **and** per account | ✅ Redis support (phase 1) · 🔜 2: per account |
| S6 | **Found in phase 1:** the client IP is read from `X-Forwarded-For`, which a client can fake, so the IP rate limit can be bypassed | Trust only the IP set by our own proxy (Vercel), and send a secret header from the proxy so the API refuses direct calls; limits per account as well | 🔜 2 |
| S3 | Fake Google / Apple identity | Verify the ID token's signature, audience, issuer and expiry on the server | ✅ Google · 🔜 2: Apple |
| S4 | Signing up with someone else's email or phone | Email verification; phone OTP | 🔜 2 |
| S5 | SMS pumping (fake numbers that cost us money) | Limits per number, IP and country; country allow-list; provider fraud guard; CAPTCHA after repeats | 🔜 2 |
| **T: Tampering** ||||
| T1 | SQL injection | SQLAlchemy with bound parameters only; no string-built SQL | ✅ |
| T2 | Editing another user's data (IDOR) | Every query filtered by the current user id; public ids are random UUIDs; 404 for others' items | ✅ personal · 🔜 3: groups |
| T3 | Changing a group expense you don't own | Role checks (member / admin / owner) inside the query | 🔜 3 |
| T4 | Amount tricks (negative, too many decimals, splits that don't add up) | Pydantic validation; Decimal only; DB CHECK constraints; shares must sum exactly | ✅ personal · 🔜 3 |
| **R: Repudiation** ||||
| R1 | "I never changed that" | Security log for sign-ins, password and 2FA changes; group history with author and soft delete | 🔜 2, 3 |
| **I: Information disclosure** ||||
| I1 | Session token stolen by XSS | Access token in memory only; refresh token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; CSP | ✅ cookies, CSP (phase 1) · 🔜 5: nonce-based CSP without `'unsafe-inline'` |
| I2 | Group members seeing personal data | Group and personal queries never join; responses carry display names only; privacy tests | 🔜 3 |
| I3 | Error messages or logs leaking data | Generic errors in production; structured logs without passwords, tokens, emails or amounts | ✅ generic errors · 🔜 1: logs |
| I4 | Tokens on the phone read by other apps | iOS Keychain / Android Keystore; biometric lock | 🔜 6 |
| I5 | Data sent to AI services (receipts) | Opt-in only; only the image is sent; disclosed in the privacy policy | 🔜 later |
| I6 | Secrets in the repo | `.env` git-ignored; GitHub secret scanning; separate secrets per environment | ✅ ignored · 🔜 1: scanning, environments |
| **D: Denial of service** ||||
| D1 | Request floods | Rate limits on every endpoint group; pagination limits; request size limits | ✅ login · 🔜 1, 4 |
| D2 | Expensive endpoints (reports, exports) | Caching; background jobs for exports | 🔜 4 |
| **E: Elevation of privilege** ||||
| E1 | A member making themselves admin | Role changes allowed only to owner/admin, checked on the server | 🔜 3 |
| E2 | Getting paid features without paying | Entitlements checked on the server from RevenueCat; store receipts verified server-side | 🔜 7 |
| E3 | Guessing or reusing coupon codes | Long random codes, stored hashed, with expiry and use limits; redemption rate limited | 🔜 7 |
| E4 | A compromised dependency | Dependabot, pip-audit, npm audit, CodeQL in CI; lock files; minimal dependencies | ✅ phase 1 |

## 6. Store and privacy-law requirements

| Requirement | Where it comes from | Phase |
|---|---|---|
| Delete the account from inside the app | App Store 5.1.1(v), Google Play | 2 |
| Sign in with Apple next to Google | App Store 4.8 | 2 |
| Export your data | GDPR art. 20, KVKK | 2 |
| Privacy policy + terms of service | Both stores, all privacy laws | 2 |
| Privacy labels / Data safety form | App Store Connect, Google Play Console | 6 |
| Payments for digital features through the store | App Store 3.1.1, Google Play Billing | 7 |

## 7. Review

At the end of every phase: update the status column, add the new entry points, and record
the date here.

| Date | Phase | Change |
|---|---|---|
| 2026-10-23 | 0 | First version |
| 2026-10-24 | 1 | Security headers, CSP, CodeQL, Dependabot, dependency audit, Redis-ready limiter; found S6 |
