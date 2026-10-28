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
| S1 | Password guessing / credential stuffing | bcrypt; login rate limit; breached-password check; 2FA | ✅ bcrypt + limit · ✅ 2d: HIBP, 2FA (TOTP + backup codes) |
| S2 | Rate limit bypassed across server instances | Shared limiter in Redis, per IP **and** per account | ✅ Redis support (phase 1) · ✅ 5: per account, 10 in 15 minutes from any IP (`app/core/account_limit.py`) |
| S6 | **Found in phase 1:** the client IP is read from `X-Forwarded-For`, which a client can fake, so the IP rate limit can be bypassed | The website's server sends the visitor's IP with a secret header (`X-Edge-Secret`), trusted only when it matches; otherwise the last `X-Forwarded-For` entry (added by Render), never the first; uvicorn no longer decides the IP. Limits per account as well | ✅ 2a (`app/core/client_ip.py`, `frontend/src/proxy.ts`) · ✅ 5: per account (S2) |
| S7 | **Found in phase 2 design:** account pre-hijacking. Someone signs up with the victim's (unverified) email; when the victim later signs in with Google, the accounts are linked and the attacker keeps his password | Link only to verified emails; a verified Google/Apple identity takes over an unverified account (password removed, sessions revoked) | ✅ 2a |
| S8 | An admin account is taken over | Admins need 2FA; actions need the password again within 10 minutes; tight per-IP limits; every action in an append-only audit log and in the person's own security activity; admins see no money data at all (`docs/design/admin.md`) | ✅ admin dashboard |
| S3 | Fake Google / Apple identity | Verify the ID token's signature, audience, issuer and expiry on the server | ✅ Google · 🔜 2: Apple |
| S4 | Signing up with someone else's email or phone | Email verification; phone OTP | 🔜 2 |
| S5 | SMS pumping (fake numbers that cost us money) | Limits per number, IP and country; country allow-list; provider fraud guard; CAPTCHA after repeats | ✅ 2e: per number (1/min, 5/day), per IP (5/min, 20/day), allow-list, daily cap with alert · 🔜 8: provider fraud guard, CAPTCHA |
| **T: Tampering** ||||
| T1 | SQL injection | SQLAlchemy with bound parameters only; no string-built SQL | ✅ |
| T2 | Editing another user's data (IDOR) | Every query filtered by the current user id; public ids are random UUIDs; 404 for others' items | ✅ personal · ✅ 3: groups (membership inside every query, 404 for non-members, tested) |
| T3 | Changing a group expense you don't own | Role checks (member / admin / owner) inside the query | ✅ 3: only who added it or an admin edits; tested |
| T6 | Making yourself an admin (privilege escalation) | Admins live in their own table that no request writes to; only the command line, with the database URL, grants admin; signed-in non-admins get 404 on every `/admin` address; admins can't act on themselves or other admins | ✅ admin dashboard (`test_admin.py`) |
| T5 | **Found by CodeQL (alert #1):** server-side request forgery: the exchange-rate URL contained the currency from the request | The URL is built only from a code that is in our `currencies` table (checked before any call) **and** matches `^[A-Z]{3}$` (checked again when the URL is built, and by a database CHECK). Admins can add only codes the provider already knows | ✅ phase 1 · ✅ admin currencies (`test_currency.py`) |
| T4 | Amount tricks (negative, too many decimals, splits that don't add up) | Pydantic validation; Decimal only; DB CHECK constraints; shares must sum exactly | ✅ personal · ✅ 3: largest remainder, CHECKs, randomized tests |
| **R: Repudiation** ||||
| R1 | "I never changed that" | Security log for sign-ins, password and 2FA changes; group history with author and soft delete | ✅ 2a: sign-ins, failed attempts, devices · ✅ 2b–2e · ✅ 3: group chat with author and server time, soft deletes · ✅ 5: email notices |
| **I: Information disclosure** ||||
| I1 | Session token stolen by XSS | Access token in memory only; refresh token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; CSP | ✅ cookies, CSP (phase 1) · ⚠️ 5: `'unsafe-inline'` kept, reason in `ASVS.md` (V14) |
| I2 | Group members seeing personal data | Group and personal queries never join; responses carry display names only; privacy tests | ✅ 3 |
| I3 | Error messages or logs leaking data | Generic errors in production; structured logs without passwords, tokens, emails or amounts | ✅ generic errors · ✅ 1: JSON logs without personal data |
| I4 | Tokens on the phone read by other apps | iOS Keychain / Android Keystore; biometric lock | 🔜 6 |
| I5 | Data sent to AI services (receipts) | Opt-in only; only the image is sent; disclosed in the privacy policy | 🔜 later |
| I6 | Secrets in the repo | `.env` git-ignored; GitHub secret scanning; separate secrets per environment | ✅ ignored · 🔜 1: scanning, environments |
| **D: Denial of service** ||||
| D1 | Request floods | Rate limits on every endpoint group; pagination limits; request size limits | ✅ login · ✅ 4: load-tested (400–500 req/s on one laptop) · ✅ 5: default limit on every endpoint, 1 MB bodies, paginated lists |
| D2 | Expensive endpoints (reports, exports) | Caching; background jobs for exports | ✅ exports limited to 3 a day · ✅ 4: measured, rates cached |
| **E: Elevation of privilege** ||||
| E1 | A member making themselves admin | Role changes allowed only to owner/admin, checked on the server | ✅ 3: owner only, tested |
| E2 | Getting paid features without paying | Entitlements checked on the server from RevenueCat; store receipts verified server-side | 🔜 7 |
| E3 | Guessing or reusing coupon codes | Long random codes, stored hashed, with expiry and use limits; redemption rate limited | 🔜 7 |
| E4 | A compromised dependency | Dependabot, pip-audit, npm audit, CodeQL in CI; lock files; minimal dependencies | ✅ phase 1 |

## 6. Store and privacy-law requirements

| Requirement | Where it comes from | Phase |
|---|---|---|
| Delete the account from inside the app | App Store 5.1.1(v), Google Play | ✅ 2c (web) · 6: in the apps |
| Sign in with Apple next to Google | App Store 4.8 | 2 |
| Export your data | GDPR art. 20, KVKK | ✅ 2c |
| Privacy policy + terms of service | Both stores, all privacy laws | ✅ 2g (`/privacy`, `/terms`, 3 languages) · 🔍 lawyer review before launch |
| Privacy labels / Data safety form | App Store Connect, Google Play Console | 6 |
| Payments for digital features through the store | App Store 3.1.1, Google Play Billing | 7 |

## 7. Review

At the end of every phase: update the status column, add the new entry points, and record
the date here.

| Date | Phase | Change |
|---|---|---|
| 2026-10-23 | 0 | First version |
| 2026-10-24 | 1 | CodeQL alert #1 (SSRF) fixed: T5 |
| 2026-10-24 | 1 | Security headers, CSP, CodeQL, Dependabot, dependency audit, Redis-ready limiter; found S6 |
| 2026-10-24 | 2 | Accounts design: found S7 (pre-hijacking), planned fix for S6 |
| 2026-10-24 | 2a | S6 and S7 fixed; sessions in the database with immediate sign-out; security log |
| 2026-10-24 | 2b | Email verification, password reset (one-time links, hashed, no enumeration) |
| 2026-10-24 | 2c | Re-auth for sensitive actions; email change via the new inbox; account deletion; data export |
| 2026-10-25 | 2d | 2FA (TOTP, encrypted keys, single-use codes, backup codes); breached-password check |
| 2026-10-25 | 2e | Phone sign-in: HMAC'd codes, attempts, allow-list, per-number/IP limits, daily cap (S5) |
| 2026-10-25 | 3 | Groups: T2, T3, T4, I2, E1 done; usernames with consent; settlements; chat |
| 2026-10-25 | 4 | Load tests: D1, D2 measured; no new threats |
| 2026-10-25 | 5a | ASVS L2 review (`ASVS.md`): per-account sign-in limit (S2), default rate limit and 1 MB bodies (D1), no API map in production, notices on password and 2FA changes |
| 2026-10-25 | 5b | OWASP ZAP API scans, visitor and signed in: 0 fail; fixed 5xx for switched-off features and added `Cross-Origin-Resource-Policy` |
| 2026-10-25 | 5c | Hand-written attacks as tests (`test_pentest.py`): cross-group IDOR, outsider access, personal IDOR, `alg: none`, mass assignment. All refused |
| 2026-10-28 | admin | Admin dashboard: new entry point `/admin` (website only). Added S8 (admin takeover) and T6 (making yourself an admin). Admin currencies: T5 now builds the rate URL from the `currencies` table, with a format check |
