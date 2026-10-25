# OWASP ASVS Level 2: where Budget Analysis stands

Reviewed in phase 5 (October 2026) against **ASVS 4.0.3, Level 2**, chapter by chapter,
for the API (FastAPI), the website (Next.js) and the way they're hosted. Each line says
what the requirement asks, what we do, and where in the code it is.

✅ meets it · ⚠️ partly, or met another way (reason given) · ❌ not yet (planned phase) · ➖ doesn't apply

## V1 Architecture

| Requirement | Status | How |
|---|---|---|
| Threat model kept up to date (1.1.2) | ✅ | `docs/security/THREAT_MODEL.md`, reviewed at the end of every phase |
| One access-control mechanism, used everywhere (1.4.1, 1.4.4) | ✅ | `app/dependencies.py` (`get_current_auth`) for identity; group access always through `GroupService.membership` |
| Secrets out of the code (1.6.2, 2.10.4) | ✅ | Environment variables per environment; `.env` git-ignored; Render generates `SECRET_KEY` |
| Dependencies kept up to date (1.14.2) | ✅ | Dependabot, `pip-audit`, `npm audit`, CodeQL in CI |

## V2 Authentication

| Requirement | Status | How |
|---|---|---|
| Passwords at least 12 characters (2.1.1) | ⚠️ | **8**, a product decision. NIST SP 800-63B allows 8 when breached passwords are refused, which we do (2.1.7) |
| Long passwords allowed, at least 64 (2.1.2) | ✅ | Up to 72 bytes, bcrypt's own limit; longer is refused with a clear message |
| No composition rules, no forced rotation (2.1.9, 2.1.10) | ✅ | Only the length and the breach check |
| Breached passwords refused (2.1.7) | ✅ | Have I Been Pwned with k-anonymity: only 5 characters of a hash leave the server (`app/core/breached.py`) |
| Password change needs the current one (2.1.6) | ✅ | `change_password` |
| Anti-automation on sign-in (2.2.1) | ✅ | 5 a minute per IP **and** (phase 5) 10 in 15 minutes per account from any IP, counted the same for emails without an account (`app/core/account_limit.py`) |
| Notice after an authentication change (2.2.3) | ✅ | Phase 5: email on password change or reset, 2FA on or off; email change notifies the old address; security activity in Settings |
| Passwords stored with a slow hash (2.4.1, 2.4.4) | ✅ | bcrypt, cost 12, random salt |
| Recovery: one-time, short-lived, no enumeration (2.5.1–2.5.6) | ✅ | Reset links: hashed, 30 minutes, once; same answer for unknown emails; all sessions signed out after a reset |
| Out-of-band codes (2.7) | ✅ | Phone codes: HMAC'd, newest only, 5 attempts, short lifetime, per-number and per-IP limits |
| One-time passwords (TOTP) (2.8) | ✅ | RFC 6238, ±1 step, a code never works twice, key encrypted at rest; 10 hashed backup codes |
| Account enumeration (registration) | ⚠️ | Sign-up says when an email already has an account (409), like most apps; limited to 5 a minute per IP. Sign-in and reset don't tell |

## V3 Session management

| Requirement | Status | How |
|---|---|---|
| Never in URLs (3.1.1) | ✅ | Access token in memory, refresh token in a cookie |
| New session at sign-in, strong random tokens (3.2.1–3.2.3) | ✅ | `secrets.token_urlsafe(48)`; only the hash stored |
| Sign-out ends the session on the server (3.3.1) | ✅ | Sessions in the database; the access token carries the session id and is checked on every request |
| Re-authentication after idle time (3.3.2, L2: 12 h / 30 min idle) | ⚠️ | 30 days idle, 90 days absolute, like most phone apps. Mitigated: 10-minute re-auth for sensitive actions (delete, export, email, 2FA), "sign out everywhere", device list |
| Sign out of other devices after a password change (3.3.3) | ✅ | |
| Cookie flags: Secure, HttpOnly, SameSite (3.4.1–3.4.3) | ✅ | `Secure` in production, `HttpOnly`, `SameSite=Lax`, a narrow `Path` |
| `__Host-` cookie prefix (3.4.4) | ⚠️ | Not used: it needs `Path=/`, and we keep the refresh cookie on `/api/v1/auth` only. The narrow path limits it more |
| Refresh token rotation, reuse detection (3.5.x) | ✅ | Rotated each refresh, 30-second grace; reuse revokes the session |
| Re-auth before sensitive actions (3.7.1) | ✅ | `RecentAuth` (10 minutes) |

## V4 Access control

| Requirement | Status | How |
|---|---|---|
| Enforced on the server, deny by default (4.1.1, 4.1.3, 4.1.5) | ✅ | Every route needs `CurrentUser` unless it's public on purpose (sign-in, health, version) |
| No IDOR (4.2.1) | ✅ | Personal data: every query filtered by user id, 404 for others. Groups: membership checked inside the query, 404 for non-members. Tests for each |
| Roles can't be raised by the user (4.1.2, 4.2.2) | ✅ | Only the owner changes roles; checked on the server; tested |
| Anti-CSRF (4.2.2) | ✅ | JSON API with a bearer token; the only cookie (refresh) is `SameSite=Lax` and same-site (the website forwards `/api/v1`) |
| MFA for administrative access (4.3.1) | ➖ | No admin interface. Hosting dashboards (GitHub, Render, Vercel, Neon) use the owner's 2FA |

## V5 Validation, sanitization and encoding

| Requirement | Status | How |
|---|---|---|
| Input validated on the server (5.1.3, 5.1.4) | ✅ | Pydantic on every body: types, lengths, ranges, allow-lists (currencies, categories, split methods) |
| Mass assignment (5.1.2) | ✅ | Separate input schemas; `extra` fields ignored; ids and roles never taken from bodies |
| Output encoding, no XSS (5.3.x) | ✅ | React escapes everything; no `dangerouslySetInnerHTML` with user data (the only one is our own theme script) |
| SQL injection (5.3.4) | ✅ | SQLAlchemy with bound parameters only |
| SSRF (5.2.6) | ✅ | Outgoing URLs built from our own constants (T5, CodeQL alert #1) |

## V6 Stored cryptography

| Requirement | Status | How |
|---|---|---|
| Approved algorithms, random from a CSPRNG (6.2.x, 6.3.x) | ✅ | bcrypt, SHA-256 for random tokens, HMAC-SHA256 for phone codes, Fernet (AES-128-CBC + HMAC) for TOTP keys, `secrets` for randomness |
| Keys managed outside the code (6.4.x) | ✅ | `SECRET_KEY`, `TOTP_ENCRYPTION_KEY`, `EDGE_SECRET` per environment; production refuses the development key |

## V7 Errors and logging

| Requirement | Status | How |
|---|---|---|
| No sensitive data in logs (7.1.1, 7.1.2) | ✅ | JSON logs without bodies, query strings, tokens, emails or amounts; the request path only |
| Security events logged (7.2.x) | ✅ | `security_events`: sign-ins, failures, devices, password/2FA/email changes, exports, shown to the user |
| Generic errors, no stack traces (7.4.1) | ✅ | Errors go to Sentry without personal data |

## V8 Data protection

| Requirement | Status | How |
|---|---|---|
| No caching of sensitive answers (8.2.1) | ✅ | `Cache-Control: no-store` on every API answer |
| Export and deletion (8.3.x) | ✅ | ZIP export (3 a day, after re-auth); immediate deletion |
| Minimal data (8.3.4) | ✅ | No IP addresses stored, only the country; group members see names only |

## V9 Communication

| Requirement | Status | How |
|---|---|---|
| TLS everywhere, HSTS (9.1.1–9.1.3) | ✅ | Vercel and Render serve HTTPS only; HSTS 2 years; the database over TLS (`sslmode=require`) |

## V10 Malicious code

| Requirement | Status | How |
|---|---|---|
| No unexpected outbound calls; integrity of dependencies (10.3.x) | ✅ | Lock files, Dependabot, CodeQL; outbound only to Google, HIBP, the rates provider, Sentry |

## V11 Business logic

| Requirement | Status | How |
|---|---|---|
| Steps in order, limits on business actions (11.1.x) | ✅ | Amounts as Decimal with CHECK constraints; splits must add up exactly; leaving a group needs a zero balance; limits on invites, exports, codes, sign-ins |

## V12 Files and resources

| Requirement | Status | How |
|---|---|---|
| Uploads | ➖ | No file uploads yet. Receipts (later) will need this chapter |

## V13 API and web services

| Requirement | Status | How |
|---|---|---|
| Same encoding everywhere, JSON content type (13.1.1, 13.2.5) | ✅ | |
| Request size limits (13.1.x, D1) | ✅ | Phase 5: no body over 1 MB (`app/core/body_limit.py`); every list paginated with a maximum |
| Rate limits on every endpoint | ✅ | Phase 5: 300 a minute per visitor by default, stricter on sign-in, codes, invites, exports |
| No API map in production | ✅ | Phase 5: `/docs` and `/openapi.json` only outside production |

## V14 Configuration

| Requirement | Status | How |
|---|---|---|
| Builds and dependencies checked (14.2.x) | ✅ | CI: tests, lint, types, audits, CodeQL on every pull request |
| No debug in production (14.3.2) | ✅ | No docs, generic errors, `APP_ENV=production` checks at start |
| Security headers (14.4.x) | ✅ | API: `nosniff`, `DENY`, `no-referrer`, `no-store`, CSP `default-src 'none'`, HSTS. Website: CSP, HSTS, Permissions-Policy, COOP |
| CSP without `unsafe-inline` (14.4.3) | ⚠️ | The website's CSP still allows inline scripts: Next.js writes small inline scripts in every page. Moving to per-request nonces needs every page rendered per request, which the cached pages (Cache Components) don't allow yet. Risk kept low: React escapes all data, no HTML from users, the access token is never stored where a script could read it later |
| CORS allow-list (14.5.3) | ✅ | Only the website's origins |

## Summary

- **Meets Level 2** in every chapter that applies, with five documented exceptions (⚠️):
  password length 8, 30-day sessions, no `__Host-` cookie prefix, sign-up says an email
  is taken, and `unsafe-inline` in the website's CSP.
- **Found and fixed in phase 5:** per-account sign-in limit, a default rate limit on
  every endpoint, a 1 MB body limit, no API map in production, email notices when the
  password or 2FA changes.
- **Next:** an OWASP ZAP scan (5b), and a review before launch (phase 8).
