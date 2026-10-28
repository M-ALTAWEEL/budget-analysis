# Environments: local, staging and production

| | Local | Staging | Production |
|---|---|---|---|
| **Website** | `localhost:3000` | Vercel preview deployment of each branch | `budgetanalysis.vercel.app` |
| **API** | Docker on the developer's machine | `budget-analysis-api-staging` on Render, from the **`staging`** branch | `budgetbuddy-api` on Render, from the **`main`** branch |
| **Database** | PostgreSQL in Docker | Neon branch **`staging`** (separate copy) | Neon branch **`main`** |
| **Mobile app** | Expo Go or a development build, against staging | EAS `development` and `preview` builds | EAS `production` build (store) |
| **Secrets** | `backend/.env` | Environment variables of the staging service on Render; EAS secrets | Environment variables of the production service on Render; EAS secrets |

**Rule:** nothing reaches `main` before it has run on staging, and staging **never touches real user data**.

## Workflow for every phase
```
git switch phase-N                     # work happens on the phase branch
git push origin phase-N                # Vercel builds a preview of the website
git push --force origin phase-N:staging  # the staging API runs the same code
```
1. Vercel builds a **preview**; previews call the **staging API**.
2. Render deploys **staging** automatically.
3. Everything is tested on the preview, and in the mobile app (which points at staging).
4. Pull request → CI green → **merge into `main`** → production updates automatically.

**What is running?** At the bottom of Settings: `Version: web 7bc8d23 · api 7bc8d23` (the
app shows `app 0.1.0 · api …`). After a release both numbers match; on staging `(staging)` is shown next to them.

## One-time setup
### 1. A `staging` git branch
```
git push origin main:staging
```

### 2. The staging database on Neon
Neon → project → **Branches** → **Create branch**:
- Name `staging`, parent `main`.
- It starts as a **copy of the current data** (copy-on-write: only changes use storage).
- ⚠️ That copy contains real data. For a clean staging database choose **Schema only**.
- Copy the **connection string** of the `staging` branch (not `main`).

### 3. The staging API on Render
After `render.yaml` is merged, Render proposes the **`budget-analysis-api-staging`** service
(Blueprint → **Sync**). Fill in its variables:
- `DATABASE_URL` → the Neon **staging** branch
- `FRONTEND_URL` → the preview URLs (for example `https://budget-analysis-git-phase-1-m-altaweel.vercel.app`)
- `GOOGLE_CLIENT_ID` → same value as production
- `SENTRY_DSN` → optional

### 4. Previews call staging
Vercel → Settings → **Environment Variables** → `API_ORIGIN`:
- **Production** → the production API
- **Preview** → `https://budget-analysis-api-staging.onrender.com`

### 5. Sentry (error reports)
sentry.io → free account → **Create Project** → **FastAPI** → copy the **DSN** into `SENTRY_DSN`
on both Render services. Errors are separated by `environment`: `production` and `staging`.

### 6. `EDGE_SECRET` (phase 2a)
A secret shared by the website server (Vercel) and the API (Render), so the API can trust the
visitor IP the website forwards (threat S6). **Two different secrets**, one per environment,
each set in two places with the **same value**:

| Secret | Vercel (Environment Variables) | Render |
|---|---|---|
| First | `EDGE_SECRET` → **Production** | `budgetbuddy-api` |
| Second | `EDGE_SECRET` → **Preview** | `budget-analysis-api-staging` |

Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Never written in chat or code.

### 7. Email (phase 2b)
`EMAIL_BACKEND` decides where email goes:

| Environment | Value | Meaning |
|---|---|---|
| Local | `smtp` | Delivered to **Mailpit**: `docker compose up -d mailpit`, read at http://localhost:8025 |
| Staging | `console` | Written to the **logs** of the staging service on Render (with the link) |
| Production | `none` | Email is off until Activation (phase 8); "Forgot password" is hidden |

Production **refuses to start** with `console`, because password-reset links would end up in the logs.

### 8. `TOTP_ENCRYPTION_KEY` (phase 2d)
Encrypts the two-factor keys in the database. **Two different keys**, one per Render service.
```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
- Without it, staging and production **hide** the two-factor option.
- ⚠️ **If the key is lost or changed, everyone with 2FA can only sign in with backup codes.**
  Keep it in a password manager; it is never rotated casually.

### 9. `SMS_BACKEND` (phase 2e)
| Environment | Value | Meaning |
|---|---|---|
| Local | `console` (in `backend/.env`) | The code appears in the API terminal |
| Staging | `console` | The code appears in the Render **logs** (search for `sms to=`) |
| Production | `none` | "Continue with phone" is hidden until Activation |

Production **refuses to start** with `console`: anyone reading the logs could sign in to any phone account.

### 10. `PUSH_BACKEND` (phase 6h)
| Environment | Value | Meaning |
|---|---|---|
| Local | `none` or `console` | Nothing is sent, or messages are written to the terminal |
| Staging | `expo` | Real notifications through Expo's push service |
| Production | `none` until the store release, then `expo` | |

`EXPO_ACCESS_TOKEN` is only needed if "enhanced push security" is turned on in the Expo account.

### 11. The mobile app (EAS, phase 6)
- `mobile/eas.json` sets `EXPO_PUBLIC_API_URL` per build profile: `development` and `preview`
  use the staging API; `production` uses `https://budgetanalysis.vercel.app/api/v1`.
- **Firebase** (Android push): `google-services.json` is **not** in git. It is stored as the EAS
  secret file `GOOGLE_SERVICES_JSON`, which `mobile/app.config.ts` reads at build time.
- The **FCM V1 service-account key** is uploaded to EAS credentials (`eas credentials`) and never
  kept on disk.
- The **Android signing keystore** is generated and stored by EAS. Its SHA-1 and SHA-256
  fingerprints (public) are needed for Google sign-in and App Links.
- **App Links:** `frontend/public/.well-known/assetlinks.json` lists the SHA-256 fingerprints
  allowed to open `https://budgetanalysis.vercel.app/join`. When Google Play signs the store
  build, add the **Play app signing** SHA-256 (Play Console → App integrity) to that list.
  Changing the intent filters in `mobile/app.json` needs a new native build.
- Developers sign in to the CLI with an Expo access token in `EXPO_TOKEN`, never written in chat.

### 12. Admins (admin dashboard)
Admins are made **only from the command line**, which needs that environment's
`DATABASE_URL`. No page or request can make one (`docs/design/admin.md`).

| Environment | How |
|---|---|
| Local | `docker compose exec api python -m app.cli grant-admin <email> --by <your name>` |
| Staging / production | Render's free plan has no shell: from a developer machine, `cd backend` and run `python -m app.cli grant-admin <email> --by <your name>` with `DATABASE_URL` set to that environment's Neon URL **for that command only** (never saved in a file) |

- Also: `revoke-admin <email> --by <name>` and `list-admins`. Every grant and revoke is in the
  audit log.
- The person must already have an account, and must turn on **two-factor authentication**
  before the dashboard (`/admin`) opens.
- Migrations add the `platform_admins`, `admin_audit_log` and `currencies` tables (the
  last one starts with the six built-in currencies); they run on deploy like any other.
