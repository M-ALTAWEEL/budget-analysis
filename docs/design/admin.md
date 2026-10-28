# Admin dashboard

> Website only (`/admin`). The mobile apps have no admin screens and ship no admin code.
> Code: `backend/app/domain/admin/`, `backend/app/cli.py`, `frontend/src/app/admin/`.

## 1. Why

The owners need to see how the product is doing, help people with their accounts, and
check that the services are healthy, **without** weakening the privacy promise: nobody,
not even an admin, reads a person's expenses, budgets, goals or groups.

## 2. Who is an admin

- Admins are rows in `platform_admins`, a table of its own. Nothing that registers or
  updates a user touches it, so **no request field can make anyone an admin** (tested in
  `test_admin.py`).
- **Only the command line grants or revokes admin.** It needs the environment's
  `DATABASE_URL`, so only someone who already holds the database can do it:

  ```
  # local
  docker compose exec api python -m app.cli grant-admin  riza@test.com --by riza
  docker compose exec api python -m app.cli revoke-admin riza@test.com --by riza
  docker compose exec api python -m app.cli list-admins

  # staging / production (Render's free plan has no shell): from a developer machine
  cd backend && DATABASE_URL="<that environment's Neon URL>" python -m app.cli list-admins
  ```

- Revoking keeps the row (history); every grant and revoke is in the audit log as
  `cli:<name>`.

## 3. How the dashboard is protected

| Rule | How |
|---|---|
| Signed-in non-admins can't tell the admin API exists | Every `/admin/*` answers **404 Not Found**, the same as an unknown address. Not signed in: 401 like every endpoint, so the browser can renew its token |
| Admins must have two-factor authentication | 403 `admin_2fa_required` until 2FA is on |
| Actions need the password again | Disable, enable, sign out, resend: the sign-in or a re-authentication within 10 minutes (`RecentAuth`), else 403 `reauth_required` |
| Tight limits | 30 reads and 10 actions a minute per IP, on top of the default limit |
| Repeated tries are noticed | Each refused try is logged; 5 in an hour from one account is logged as an error (Sentry) |
| No admin acts on themselves or another admin | 400. Admins are managed from the command line only |
| Everything is recorded | `admin_audit_log`: who, what, on whom, when, from which country. Append only, no endpoint changes it |
| The person is told | Each action adds `admin_action` to their own security activity ("Account action by Budget Analysis support") |

## 4. What admins see

- **Overview:** counts only: users, active in 7 and 30 days, sign-ups and expenses added per
  day (30 days), sign-in methods, 2FA and confirmed-email rates, groups, push devices.
  **No amounts.**
- **Users:** search by the start of an email, username, name or phone number. A user's page
  shows account information (email, phone, username, sign-in methods, 2FA, language,
  currency, status), signed-in devices (device and country, never IP or token) and their
  security activity.
- **Never shown:** expenses, budgets, limits, goals, categories, groups, group members or
  messages.
- **System:** database check, versions, which services are on (email, SMS, push, Google,
  Redis, Sentry, 2FA key) as names and yes/no only, and when exchange rates were last
  fetched.
- **Audit log:** every admin action and grant.

## 5. What admins can do

| Action | Effect |
|---|---|
| Disable | Can't sign in; every session ends now. Data is kept |
| Enable | Can sign in again |
| Sign out everywhere | Every session ends; they can sign in again |
| Resend confirmation | A new email-confirmation link (only when email is switched on) |
| Currencies | Add, hide, show (below). Same re-auth, limits and audit log |

### Currencies

The currency list is the `currencies` table (code, names in English, Arabic and Turkish,
hidden). The website and the app read it from `GET /currency/list` (no sign-in, since the
sign-up form needs it).

| Action | Effect |
|---|---|
| Add | Code plus the three names (the page pre-fills them from the browser). Refused unless the rates provider knows the code, so every currency can be converted. Offered to everyone at once |
| Hide | Not offered for new choices. Whoever already uses it keeps it, and it still converts. TRY (the sign-up default) can't be hidden |
| Show | Offered again |

There is no delete: budgets, goals, groups and expenses keep their currency for good. Each
server process keeps the list for a minute and looks again at once for a code it doesn't
know yet, so a new currency works everywhere right away. A hidden one may still be accepted
for up to a minute on other processes.

## 6. Later (with phase 7, payments)

See `docs/ROADMAP.md`, phase 7: entitlements and free grants (including lifetime), web
discount codes, the subscription view, business stats, and extra safety for money actions
(second-person approval, daily caps, email to all admins).
