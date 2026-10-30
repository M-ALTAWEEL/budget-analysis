# CLAUDE.md

Guidance for Claude (and any AI assistant) working in this repository.

## The project
**Budget Analysis**: personal and group budgeting for students, in English, Arabic (right to
left) and Turkish.

| Part | Folder | Stack | Hosting |
|---|---|---|---|
| API | `backend/` | FastAPI, SQLAlchemy 2 (async), Alembic, Python 3.12 | Render (Docker, Frankfurt) |
| Website | `frontend/` | Next.js 16, React, TanStack Query, Tailwind | Vercel |
| Mobile app | `mobile/` | Expo SDK 58, React Native, expo-router | EAS (Android now, iPhone later) |
| Database | | Postgres | Neon (production and staging branches) |
| Models | `ml/`, `backend/app/ml/` | Hand-written softmax regression, rules | Loaded from JSON at start-up |

Read these before changing behaviour:
- `docs/BUSINESS_LOGIC.md`: every rule, with the test that checks it (section 16).
- `docs/ROADMAP.md`: what is done and what is next.
- `docs/ENVIRONMENTS.md`: environments, secrets, and how a change reaches staging and production.
- `docs/design/*.md`, `docs/security/*.md`, `docs/API_VERSIONING.md`, `docs/STORE_REQUIREMENTS.md`.
- `docs/SAD.docx`: the architecture document (4+1 views). Update it when the architecture changes.

## Working with the owner
- The owner is Mouhammed Altaweel. **Reply to him in Levantine Arabic**, step by step, short and
  concrete. Everything in the repository (code, comments, docs, commit messages) is in **English**.
- A private learning log in Arabic exists on his machine; it is git-ignored. Never commit it.
- Say plainly what you can't do yourself and what he must do, in order.

## Rules that are never broken
1. **Parity.** Every user-facing feature exists on the website **and** in the app, with the
   same rules and texts. The admin dashboard is the only website-only part.
2. **Shared client code is one copy.** Types, texts (`i18n/messages/{en,ar,tr}.ts`), API calls
   (`services/`), `hooks/queries.ts` and several `lib/` files live in `frontend/src` and are
   copied into `mobile/src` by `node mobile/scripts/sync-shared.mjs`. Edit the website's copy,
   run the script, commit both. A new shared file is added to the list in that script. CI fails
   on drift (`--check`).
3. **Three languages.** Every new text goes into `en.ts`, `ar.ts` and `tr.ts`. Arabic layouts
   must work right to left (`rtl:` classes on the website, `dir` from `useI18n()` in the app).
4. **Docs with every change.** New or changed rules go into `docs/BUSINESS_LOGIC.md` (and its
   invariants table), the roadmap is ticked, and new settings go into `docs/ENVIRONMENTS.md`
   and `render.yaml` (with `sync: false` for secrets).
5. **Secrets never enter the repository or the chat.** No `.env`, keys, tokens or service
   account files in git (`google-services.json` is an EAS secret). Never ask for a secret to be
   pasted, and never screenshot one. The owner sets secrets himself (Render, Vercel, EAS,
   GitHub, Neon, Google Cloud).
6. **Never force-push `main`.** Work happens on a branch, through a pull request, with CI green
   before merging. The `staging` branch may be moved to `main` to deploy staging.
7. **Never create accounts, enter passwords or make payments** on the owner's behalf.

## Backend conventions
- One package per domain in `backend/app/domain/<name>/`: `model.py`, `schema.py`,
  `service.py`, `router.py` (some also have `repository.py`). Routers are registered in
  `app/main.py`, models in `app/models.py`.
- Services that have a method called `list` start with `from __future__ import annotations`
  (otherwise `list[...]` in later annotations breaks at import time).
- Every query is scoped to its owner; someone else's row answers **404**, the same as a
  missing one.
- Money is `Decimal`, never float; `to_money()` rounds. Each budget month has one currency; an
  expense keeps its original amount and `amount_base` in the month's currency.
- Budget months follow the person's start day and Start fresh: use `BudgetCalendar.of(user)`.
- Services take a `today` argument where dates matter, so tests can fix the day.
- **Migrations** are written by hand in `app/migrations/versions/`, named
  `YYYYMMDD_<revision>_<what>.py`, chained by `down_revision`, using `op.f(...)` names that
  match the naming convention in `app/base.py`.
- Background work (push, email) runs after the response (`BackgroundTasks`). The daily job is
  `POST /api/v1/internal/daily` (`CRON_SECRET`), called by `.github/workflows/daily.yml`.
- Lint and format: `ruff check .` and `ruff format .` (line length 100).
- Tests: `pytest` against a real Postgres (`TEST_DATABASE_URL`), with fakes in
  `tests/fakes.py` (exchange rates: 1 USD = 34 TRY; push; email). Every feature gets a test
  file and a row in the invariants table.

## Website and app conventions
- Data goes through `hooks/queries.ts` (TanStack Query) and `services/*.ts`. After a change,
  invalidate what it affects (`useInvalidateMoney()` for anything that changes spending).
- The app's new stack screens are registered in `mobile/src/app/(app)/_layout.tsx`; typed
  routes need `as Href` for new paths.
- Website checks: `npm run lint`, `npx tsc --noEmit`, `npm run build` in `frontend/`.
  App checks: `node scripts/sync-shared.mjs --check` and `npx tsc --noEmit` in `mobile/`.
- A new native module in the app means a new EAS build. Only modules already in
  `mobile/package.json` may be imported directly; anything else is installed by the owner
  (`npx expo install <name>`) first.

## CI (`.github/workflows/ci.yml`)
Backend (ruff + pytest, with Tesseract installed), Frontend (ESLint, TypeScript, build),
Mobile (shared files + TypeScript), Dependencies (pip-audit, npm audit) and CodeQL. Failures
are written as annotations, so they can be read from the checks page or the API without the
full log.

## Delivering a feature
1. A branch from `main`.
2. Backend (model, migration, schema, service, router, tests), then the website, then the app,
   then the shared-code sync.
3. Docs: business rules, invariants table, roadmap, environments, privacy policy if data
   handling changed, SAD if the architecture changed.
4. Pull request with a short description; wait for CI; merge; move `staging` to `main` when
   staging should get it too.
5. Tell the owner what changed and what he has to do (secrets, builds, store steps).
