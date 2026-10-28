# Store requirements: Google Play and the App Store

> Ready-to-copy answers for the store forms, taken from what the code actually collects.
> Update this file **and** the privacy policy (`frontend/src/app/privacy/page.tsx`) whenever
> what the app collects changes; the store answers must always match the policy.
>
> Last checked against the code: 29 October 2026 (after phase 6k).

## 1. What the app collects

| Data | Where it comes from | Why | Required? | Stored |
|---|---|---|---|---|
| Name | Sign-up, Google | Account, shown to group members | Yes | Until account deletion |
| Email address | Sign-up, Google | Sign-in, security notices | One of email or phone | Until account deletion |
| Phone number | Phone sign-in | Sign-in codes only, never marketing | Optional | Until account deletion |
| Account IDs | Our user ID; Google's account ID when signing in with Google | Sign-in | Yes | Until account deletion |
| Budgets, expenses (amount, currency, description, date, category), savings goals | Entered by the user | The app's purpose | Yes (it is the app) | Until deleted by the user or account deletion |
| Group expenses, shares, payments and the group chat | Entered by group members | Splitting costs with friends | Optional (groups) | While the group exists; a deleted user becomes "Deleted user" |
| Country | Derived from the IP address at sign-in; the IP itself is not stored | Security (device list, sign-in limits) | Yes | With each session |
| Device name ("Android app", "Chrome on Windows") | The request | Security (device list) | Yes | With each session |
| Push token | The phone, when the person allows notifications | Notifications | Optional | Until sign-out or the app is removed |
| Security log | Sign-ins, failed attempts, password and 2FA changes | Security, shown to the person | Yes | Until account deletion |

**Not collected:** precise location, contacts, photos, files, calendar, health data, web
history, advertising IDs, analytics or usage tracking, bank or card details (there are no
payments yet; phase 7 will update this file).

**Never:** sold, shared with advertisers, used for advertising or tracking across apps.

**Service providers** (process data only to run the app, so this is not "sharing" in either
store's definition): Vercel (website), Render (API), Neon (database), Expo and Google
Firebase Cloud Messaging / Apple Push (notification delivery), Google (Sign in with Google),
Have I Been Pwned (5-character hash prefix of a new password), Sentry (server error reports,
configured without personal data). Email and SMS providers once activated (phase 8).

## 2. Google Play: Data safety form

**Data collection and security**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only, HSTS) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: in the app (Settings → Your data → Delete my account) and on the website |
| Account deletion URL | `https://budgetanalysis.vercel.app/privacy` (section "Your rights") |

**Data types** (for each: *Collected*, **not** *Shared*; *Processed ephemerally*: No; *Required*
unless marked optional):

| Category | Data type | Purposes |
|---|---|---|
| Personal info | Name | App functionality, Account management |
| Personal info | Email address | App functionality, Account management |
| Personal info | Phone number (**optional**) | Account management |
| Personal info | User IDs | Account management |
| Financial info | Other financial info (budgets, expenses, goals) | App functionality |
| Messages | Other in-app messages (group chat; **optional**) | App functionality |
| Location | Approximate location (country from the IP address) | Fraud prevention, security, and compliance |
| Device or other IDs | Device or other IDs (push token; **optional**) | App functionality |

Not declared because not collected: precise location, contacts, photos and videos, audio,
files and docs, calendar, health and fitness, web browsing, app activity / analytics,
crash logs from the app (no crash reporting inside the app yet: if Sentry is added to the
app, add **App info and performance → Crash logs, Diagnostics**).

**Other Play Console declarations**

| Form | Answer |
|---|---|
| Ads | No ads |
| Target audience | 16 and over (matches the privacy policy); not designed for children |
| App access | Requires sign-in: give the reviewer a demo account (email + password, no 2FA) on production |
| Financial features | None of the regulated ones (no loans, banking, payments, crypto); personal budgeting only |
| Content rating | Utility / productivity questionnaire: no violence, user-generated content limited to group chat between invited members |
| Government app / news app / health app | No |
| Closed testing (new personal developer accounts) | 12 testers for 14 days before production access (phase 8) |

## 3. App Store: App Privacy ("nutrition labels")

**Tracking:** the app does **not** track (no data linked with other companies' data for
advertising, no data brokers). No App Tracking Transparency prompt is needed.

**Data Linked to You** (all used for **App Functionality**; none for tracking, advertising or
analytics):

| Apple category | Data type | Notes |
|---|---|---|
| Contact Info | Name | |
| Contact Info | Email Address | |
| Contact Info | Phone Number | Only with phone sign-in |
| Financial Info | Other Financial Info | Budgets, expenses, goals |
| User Content | Other User Content | Group chat, expense descriptions |
| Identifiers | User ID | |
| Location | Coarse Location | Country only, for security (device list, sign-in limits) |

**Data Not Linked to You:** none. **Not collected:** Health & Fitness, Contacts, Browsing
History, Search History, Purchases (until phase 7), Usage Data, Diagnostics, Sensitive Info,
Precise Location, Other Data.

**Other App Store requirements**

| Requirement | Status |
|---|---|
| In-app account deletion (guideline 5.1.1(v)) | ✅ Settings → Your data → Delete my account |
| **Sign in with Apple** must be offered when Google sign-in is (guideline 4.8) | ⬜ Required before the iPhone release (phase 8) |
| Privacy policy URL | `https://budgetanalysis.vercel.app/privacy` |
| Face ID usage text (`NSFaceIDUsageDescription`) | ✅ In `mobile/app.json` |
| Notifications asked only after the person turns them on | ✅ Settings → Notifications |
| Demo account for review | Same as Google Play |
| Export compliance | Only standard HTTPS encryption: answer that the app uses exempt encryption (`ITSAppUsesNonExemptEncryption = false`) |

## 4. Before submitting

- [ ] Re-read section 1 against the code (new tables, new SDKs, Sentry in the app?).
- [ ] Privacy policy and terms reviewed by a lawyer (roadmap phase 8).
- [ ] Demo account created on production, without 2FA, with some sample data.
- [ ] Play app signing SHA-1/SHA-256 added to Google sign-in and `assetlinks.json`
      (`docs/ENVIRONMENTS.md`, section 11).
- [ ] Screenshots and descriptions in three languages (phase 8).
