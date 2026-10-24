# Design: Accounts (phase 2)

Status: **approved 2026-10-24** · Owner: Mouhammed Altaweel · October 2026
Decisions: passwords at least 8 characters · deletion immediate · unverified accounts get
no groups · SMS to Turkey and the Arab countries first.
Target: OWASP ASVS 4.0 Level 2, chapters V2 (authentication), V3 (sessions) and V8 (data
protection), plus App Store 4.8 / 5.1.1(v) and Google Play account-deletion rules.

## 1. Where we are

| Today | Problem |
|---|---|
| Email + password (bcrypt), Google sign-in (`users.google_sub`) | One column per provider: Apple and phone would add two more |
| Emails are never verified | Anyone can sign up with someone else's address |
| `refresh_tokens`: one row per token, rotated, reuse ends **all** sessions | No "my devices"; two tabs refreshing at once can look like theft and log the user out everywhere |
| Rate limit per IP, IP read from `X-Forwarded-For` | **S6**: the client can fake that header |
| Google links to an existing account with the same email | **S7 (new, see 2.1)**: account pre-hijacking |
| No password reset, 2FA, deletion or export | Required by the stores and by GDPR / KVKK |

## 2. Two security issues to fix first

### 2.1 S7: account pre-hijacking (found while writing this design)
1. The attacker signs up with **the victim's email** and a password. Nothing checks the email.
2. Later the victim signs in with Google. Google's email is verified, so today the code
   **links Google to the attacker's account**.
3. Both now use the same account: the attacker with the password, and he sees everything
   the victim enters.

**Fix:** link only when the existing account's email **is verified**. If it is not, the
verified Google identity wins: the unverified password is removed, every session of the
account is revoked, and the email is marked verified. The real owner can set a password
later with "forgot password".

### 2.2 S6: the client IP can be faked
Requests reach the API two ways:
- **Through the website**, via Vercel's rewrite. Render sees Vercel's IP, not the visitor's.
- **Directly**, from the mobile apps later (phase 6).

**Fix:**
- The website's server (`frontend/src/proxy.ts`) adds `X-Client-IP` and `X-Client-Country`
  (the visitor as Vercel saw them; Vercel overwrites any value the visitor sends) and
  `X-Edge-Secret`, a shared secret from the environment (`EDGE_SECRET`, see ENVIRONMENTS.md).
- The API trusts `X-Client-IP` **only** when `X-Edge-Secret` matches (compared in
  constant time).
- Otherwise it uses the **last** entry of `X-Forwarded-For`, the one Render's own proxy
  added, which a client cannot forge. Never the first entry.
- uvicorn's `--proxy-headers` stops deciding the IP; one function in `app/core/client_ip.py` does.

## 3. Data model

```
users                                   (changed)
  email              varchar(255) NULL  phone-only accounts have no email
                     UNIQUE (lower(email)) WHERE email IS NOT NULL
  email_verified_at  timestamptz NULL   new
  password_hash      NULL               (already)
  google_sub         → moved to user_identities, column dropped
  totp_secret_enc    bytea NULL         new, encrypted (see 7)
  totp_enabled_at    timestamptz NULL   new

user_identities                         new: one row per way to sign in, except password
  user_id            → users ON DELETE CASCADE
  provider           'google' | 'apple' | 'phone'
  subject            varchar(255)       Google/Apple "sub", or the phone in E.164 (+905...)
  email              varchar(255) NULL  what the provider said, for display
  verified_at        timestamptz
  last_used_at       timestamptz
  UNIQUE (provider, subject)

sessions                                new, replaces refresh_tokens
  user_id            → users ON DELETE CASCADE
  refresh_hash       char(64) UNIQUE    SHA-256 of the current refresh token
  previous_hash      char(64) NULL      the one before, accepted for 30 s (two tabs)
  rotated_at         timestamptz NULL   when previous_hash was replaced (starts the 30 s)
  device             varchar(100)       "Chrome on Windows", "iPhone app" (coarse, from User-Agent)
  country            char(2) NULL       from the IP; the IP itself is not stored
  created_at, last_used_at
  idle_expires_at    timestamptz        30 days without use
  absolute_expires_at timestamptz       90 days after sign-in, whatever happens
  revoked_at         timestamptz NULL
  revoked_reason     'logout' | 'logout_all' | 'reuse' | 'signed_out_remotely' |
                     'account_taken_over' | 'password_changed' NULL

one_time_tokens                         new: email verification, password reset, …
  user_id            → users ON DELETE CASCADE
  purpose            'verify_email' | 'reset_password' | 'change_email'
  token_hash         char(64) UNIQUE
  payload            varchar(255) NULL  e.g. the new email for 'change_email'
  expires_at         timestamptz        verify: 24 h · reset: 30 min · change: 1 h
  used_at            timestamptz NULL

phone_codes                             new: SMS / WhatsApp codes
  phone              varchar(20)        E.164
  purpose            'sign_in' | 'link'
  code_hash          char(64)           HMAC of the 6 digits; never the code itself
  attempts           int default 0      max 5, then the code is dead
  expires_at         timestamptz        5 minutes
  used_at            timestamptz NULL
  INDEX (phone, created_at)

backup_codes                            new: 2FA recovery
  user_id            → users ON DELETE CASCADE
  code_hash          char(64)
  used_at            timestamptz NULL

security_events                         new: what the user sees in "Security activity"
  user_id            → users ON DELETE CASCADE
  type               'sign_in' | 'sign_in_failed' | 'new_device' | 'password_changed' |
                     '2fa_enabled' | '2fa_disabled' | 'email_changed' | 'session_revoked' |
                     'identity_linked' | 'identity_unlinked' | 'data_exported' |
                     'token_reuse' | 'account_taken_over'
  device, country    as in sessions
  created_at
```

**Migration (reversible):** create the new tables; copy `google_sub` into
`user_identities`; copy live `refresh_tokens` into `sessions` (device "Unknown"), so nobody
is signed out (done in 2a); make `email` nullable (2e, with phone sign-in); drop the old column and table **in a later migration**, once the new
code has run in production. Every step has a `downgrade`.

## 4. Sessions

- **Access token:** a JWT for 15 minutes, as today. It now also carries `sid` (the session's uuid).
- **Revocation is immediate:** each request loads the user **and** checks that the
  session is not revoked, in one query.
- **Refresh rotates** the token and keeps the previous hash for 30 seconds, so two tabs
  refreshing at once both work.
- **Reuse of an older token** revokes **that session only** (reason `reuse`), not every
  device, and is written to `security_events`.
- **Web:** the refresh token stays in an `httpOnly`, `Secure`, `SameSite=Lax` cookie.
  **Mobile (phase 6):** the same endpoint can return it in the body
  (`X-Client: mobile`), and the app keeps it in the Keychain or Keystore.
- **Settings → Security:** the list of sessions (device, country, last used, "this
  device"), with "Sign out" and "Sign out of all other devices".
- **Changing or resetting the password** revokes every other session.

## 5. Email: verification, password reset, change of address

- **Sending goes through an interface, `EmailSender`:**
  - `ConsoleEmailSender` writes to the log. Staging only, never production.
  - `SmtpEmailSender` sends to **Mailpit** in Docker Compose; you read the messages at
    `localhost:8025`.
  - `ResendEmailSender` comes at activation (phase 8).
- **Production refuses to start** if the provider is `console` (decided by `DEPLOY_ENV`, since
  staging also runs with `APP_ENV=production`).
- **Until activation, production has `EMAIL_BACKEND=none`:** `/auth/config` answers
  `email_enabled: false`, and the website hides "forgot password" and the "confirm your
  email" banner. Nothing else changes when a provider is switched on.
- **Emails are sent after the response** (a background task), so the answer and its timing
  don't depend on whether an account exists. At most 3 emails of a kind per account per hour.
- **Templates in en, ar and tr**, in the user's language. They contain the link, why it
  was sent, when it expires, and "if this wasn't you, ignore it".
- **Tokens:** 32 random bytes, stored as SHA-256, used once, short-lived (see 3).
- **No account enumeration:** "forgot password" and "resend verification" always answer
  the same: "If an account exists, we sent an email." Same wording and same timing.
- **Unverified accounts** can use their own budget, but cannot create or join groups,
  and see a banner asking them to verify.
- **Changing the email** sends a link to the **new** address and a notice to the **old** one.

## 6. Passwords

- **bcrypt**, as today.
- **Length:** at least **8** characters (decided 2026-10-24; NIST's minimum, and the
  breached-password check below rejects the weak ones), at most **72 bytes**. Arabic letters take 2 bytes,
  and bcrypt silently ignores anything after 72 bytes.
- **No composition rules** ("one capital, one symbol"), per NIST 800-63B. Instead…
- **Breached-password check:** the API sends the first 5 characters of the SHA-1 to
  `api.pwnedpasswords.com` (k-anonymity: the password never leaves). If that service is
  down, it allows the password and logs it (fail open).
- **Rate limits:**
  - 5 sign-ins a minute per IP;
  - 10 failed sign-ins an hour per account, then a 15-minute pause;
  - every attempt, failed or not, written to `security_events`.

## 7. Two-factor authentication (TOTP)

- **Turning it on:**
  - The app shows a QR code (`otpauth://`) for Google Authenticator, Authy or 1Password.
  - The user types one code to prove it works.
  - They get **10 backup codes**, shown once and stored hashed.
- **The secret is encrypted** with `TOTP_ENCRYPTION_KEY` (Fernet), a key separate from
  `SECRET_KEY`. A database leak alone does not reveal it.
- **Signing in:** password (or Google / Apple / phone) → a short-lived "challenge" token
  (5 minutes, purpose `2fa`) → the 6-digit code or a backup code → session. Codes are
  accepted ±30 seconds, and **each code works only once** (the last used time step is stored).
- **Turning it off, or making new backup codes,** needs a recent sign-in (see 9).
- **How (2d):** TOTP is ~30 lines in `app/core/totp.py`, checked against RFC 6238's test
  values. The QR code is an SVG made by `segno`. A wrong code 5 times ends that sign-in.
  Without `TOTP_ENCRYPTION_KEY`, staging and production hide 2FA instead of guessing a key.

## 8. Other ways to sign in

### Phone (SMS / WhatsApp)
- Numbers are normalized to E.164 with `phonenumbers`. Only countries on an allow-list
  can receive codes. **At launch: Turkey and the Arab League countries** (TR, AE, SA,
  QA, KW, BH, OM, JO, LB, SY, IQ, PS, EG, LY, TN, DZ, MA, SD, YE, MR, SO, DJ, KM),
  set in `SMS_ALLOWED_COUNTRIES` so more can be added without a code change.
- The code is 6 digits, valid 5 minutes, and allows 5 wrong attempts.
- **Limits:**
  - one code a minute per number;
  - 5 codes a day per number;
  - 20 codes a day per IP;
  - a global daily cap that alerts us (SMS pumping protection, S5).
- **Sending goes through an interface, `SmsSender`:** `ConsoleSmsSender` (log, staging
  and local only), then Twilio Verify or another provider at activation, WhatsApp first
  where it is cheaper.
- Phone numbers get reassigned to new owners. A number unused for a year needs a second
  factor (email link) before it can sign in again. **(Not built yet: phase 5 or later.)**
- **How (2e):** codes are stored as an HMAC (keyed with `SECRET_KEY`), only the newest one
  works, and the first sign-in creates the account (named after the number; no email).
  `SMS_BACKEND=console` on staging, `none` in production until activation (the option is
  hidden). Linking a phone to an existing account comes later.

### Apple
- **Server-side checks:**
  - verify the identity token with Apple's keys (`appleid.apple.com/auth/keys`);
  - `iss` must be `https://appleid.apple.com`;
  - `aud` must be our Services ID (web) or bundle ID (iOS);
  - `exp` and `nonce` are checked (the nonce prevents replay).
  - Same pattern as Google, tested with locally generated keys.
- **Data Apple gives us:**
  - Apple sends the **name only the first time**, so we save it then.
  - The email may be a **private relay** (`…@privaterelay.appleid.com`). It works once
    our domain is registered with Apple (phase 8).
- **Account deletion must also revoke the Apple token** (App Store 5.1.1(v)). This needs
  the Apple key, at activation.

### Linking rules (all providers)
1. Sign-in by `(provider, subject)` always wins.
2. Otherwise, a **verified** provider email that matches a **verified** account email
   links to that account.
3. A verified provider email that matches an **unverified** account takes it over, as in 2.1.
4. Otherwise a new account is created.
5. **Settings → Sign-in methods:** link or unlink Google, Apple and phone. The last
   remaining method cannot be removed.

## 9. Sensitive actions need a recent sign-in

Some actions need a sign-in within the last **10 minutes**:
- change the email or the password;
- turn 2FA off;
- unlink a provider;
- export the data;
- delete the account.

Otherwise the app asks for the password (or a phone code, or Google / Apple again) first.

**How (2c):** `sessions.reauthenticated_at`. The API answers `403 reauth_required`; the
website shows "Confirm it's you" (password, or the Google button for Google-only accounts),
calls `POST /auth/reauth`, then repeats the action. It counts for **this device only**.

## 10. Account deletion and data export

- **Deletion:**
  - Settings → Delete account, then a recent sign-in, then **type the account's email**
    (the same in every language, and harder to type by accident than a word).
  - Then: sessions revoked; Apple token revoked; groups keep a "Deleted user" (see
    groups.md 8.4); every personal row deleted (CASCADE); email sent.
  - **Immediate and permanent.** No 30-day wait: simpler, and the stores accept it when
    the app says so clearly.
- **Export:**
  - A ZIP made on request and **sent straight back**, without being stored, so no file
    storage is needed yet. It holds a JSON of everything and a CSV of expenses.
  - Limited to 3 a day.

## 11. Rate limits (all through Redis)

| Endpoint | Per IP | Per account / number / email |
|---|---|---|
| Sign in (password) | 5 / min | 10 failed / hour, then 15 min pause |
| Register | 5 / hour | — |
| Forgot password / resend verification | 5 / hour | 3 / hour per email |
| Send phone code | 20 / day | 1 / min, 5 / day per number |
| Check phone code | 30 / hour | 5 per code |
| 2FA code | 10 / min | 5 failed per challenge |
| Export | — | 3 / day |

## 12. API (additive, `/api/v1`)

```
POST /auth/verify-email/send          POST /auth/verify-email {token}
POST /auth/password/forgot {email}    POST /auth/password/reset {token, password}
POST /auth/password/change            POST /auth/email/change  → link to the new address
POST /auth/apple {id_token, nonce}    POST /auth/phone/send {phone} · /auth/phone/verify {phone, code}
POST /auth/2fa/setup · /enable · /disable · /backup-codes    POST /auth/2fa/verify {challenge, code}
POST /auth/reauth                     (password or provider, for section 9)
GET  /me/sessions · DELETE /me/sessions/{uuid} · POST /me/sessions/revoke-others
GET  /me/security-events              GET /me/identities · DELETE /me/identities/{uuid}
GET  /me/export                       DELETE /me
```

## 13. Order of work

| Step | What | Why first |
|---|---|---|
| **2a** ✅ | S6 (client IP), S7 (linking), `sessions`, `security_events`, "my devices" | Fixes the two holes; everything else creates sessions |
| **2b** ✅ | `EmailSender` + Mailpit, verification, forgot/reset password, change password | Needed by linking, groups and deletion |
| **2c** ✅ | Re-auth, **change email** (needs re-auth), delete account, export | Store requirements |
| **2d** ✅ | Password rules + breached check, 2FA with backup codes | |
| **2e** ✅ | Phone sign-in (console sender) | |
| **2f** | Apple sign-in (tests with local keys) | |

Each step: migration, tests, the 3 languages, staging, PR.

## 14. Tests to write (beyond the obvious)

- **S7:** pre-registering the victim's email and then signing in with Google leaves
  the attacker with no password and no session.
- **S6:**
  - a forged `X-Forwarded-For` does not change the counted IP;
  - `X-Client-IP` is ignored without the secret.
- **Sessions:**
  - parallel refresh within 30 s works;
  - reuse after it revokes only that session;
  - a revoked session's access token stops working at once.
- **Tokens:**
  - expired, used and wrong-purpose tokens fail;
  - "forgot password" answers the same for known and unknown emails.
- **2FA:**
  - the same code twice fails;
  - a backup code works once;
  - the secret in the database is not the plain secret.
- **Phone:** the 6th wrong code fails even when correct; the limits per number and per IP hold.
- **Deletion:** nothing personal is left in any table; the user's groups still balance.
