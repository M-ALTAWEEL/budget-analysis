# Business Logic

**Budget Analysis** · Version 1.0 · 27 October 2026 · Owner: Mouhammed Altaweel

This document states the business rules of Budget Analysis: what the product calculates,
what it allows, what it refuses, and why. It is the reference for product decisions, tests
and support. Where a rule is enforced, the module is named so it can be checked in code.

Related documents: [`SAD.docx`](SAD.docx) (architecture), [`design/accounts.md`](design/accounts.md),
[`design/groups.md`](design/groups.md), [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md).

---

## Contents
1. [Product scope](#1-product-scope)
2. [Glossary](#2-glossary)
3. [Money and currencies](#3-money-and-currencies)
4. [The budget month](#4-the-budget-month)
5. [Budgets and category limits](#5-budgets-and-category-limits)
6. [Expenses](#6-expenses)
7. [Categories and automatic categorization](#7-categories-and-automatic-categorization)
8. [Insights: the tank, alerts, forecast, tips, comparison](#8-insights)
9. [Savings goals](#9-savings-goals)
10. [The assistant](#10-the-assistant)
11. [Groups](#11-groups)
12. [Accounts and security](#12-accounts-and-security)
13. [Notifications](#13-notifications)
14. [Privacy and data rights](#14-privacy-and-data-rights)
15. [Platform parity](#15-platform-parity)
16. [Invariants checked by tests](#16-invariants-checked-by-tests)
17. [Admin dashboard](#17-admin-dashboard)

---

## 1. Product scope

Budget Analysis helps students and young people living away from home see **how much of
their allowance is left, whether it will last the month, and where it goes**, and share
costs with the people they live with.

| Capability | Summary |
|---|---|
| Monthly budget | One total per budget month, optionally split into category limits |
| Expenses | Recorded in any supported currency, converted to the budget currency at that day's rate |
| Insights | The "tank" (what is left), alerts, an end-of-month forecast, tips, and a comparison with last month |
| Savings goals | Targets with deposits, withdrawals and the monthly amount needed |
| Assistant | Questions about one's own numbers in English, Arabic or Turkish |
| Groups | Shared expenses with four split methods, balances between each pair of members, settlements and a chat-style history |
| Platforms | Website, iPhone and Android, with the same features and rules |

**Target market:** worldwide, with Turkey and the Arab world first. **Languages:** English,
Arabic (right-to-left) and Turkish.

## 2. Glossary

| Term | Meaning |
|---|---|
| **Base currency** | The user's main currency. New budgets and new expenses default to it |
| **Budget currency** | The currency of one month's budget, fixed when that budget is created |
| **Budget month** | The period a budget covers. Identified as `YYYY-MM`; it may start on any day from 1 to 28 |
| **Start day** | The day the budget month begins (the allowance or salary day) |
| **Fresh start** | A date before which spending is hidden from every view and calculation, without deleting it |
| **Limit** | An optional maximum for one category within a month |
| **Planned** | The sum of all category limits in a month |
| **Share** | One member's part of a group expense |
| **Copy** | A personal expense created automatically from a group share |
| **Settlement** | A payment between two group members that reduces what one owes the other |
| **Pair debt** | What one member owes another after all expenses and settlements between them |

## 3. Money and currencies

**Rules** (`app/core/money.py`, `app/domain/currency/`):

1. Money is always a **decimal**, never a floating-point number. Amounts have **2 decimal
   places**; rounding is **half-up** (2.345 → 2.35).
2. Amounts are positive and at most **9,999,999,999.99**.
3. Supported currencies are rows in the **`currencies` table** (`app/domain/currency/catalog.py`),
   with a name in each language. The app started with **TRY, USD, EUR, AED, SAR, QAR**;
   admins add more (section 17), only ones the rates provider knows. A currency is never
   removed, only **hidden**: a hidden currency isn't offered for anything newly chosen
   (sign-up, main or second currency, a goal, a group, a budget or expense in another
   currency), but whoever already uses it keeps it, and it still converts. TRY, the sign-up
   default, can't be hidden. A sign-in with Google or a phone that makes a new account
   falls back to TRY when the chosen currency isn't offered.
4. Exchange rates have **8 decimal places**. They are fetched from the rates provider and
   cached in the database and in each server process for **12 hours**. If the provider is
   down, the most recent cached rates are used ("stale but available"); with no rates at
   all the request fails with a clear message rather than guessing. If the provider stops
   quoting one currency, only conversions into or out of that currency fail (503); every
   other currency keeps working, and the gap is logged.
5. **Rate snapshot:** when an expense is converted, the rate used is stored with it. Later
   rate changes never rewrite history.
6. A **second currency** can be chosen for display only (amounts shown again as "≈"). It
   never affects stored amounts. If it is set to the base currency, it is cleared.

## 4. The budget month

**Rules** (`app/core/dates.py: BudgetCalendar`, `frontend/src/lib/month.ts`; the same rule on
server, website and app):

1. **Start day.** Each user chooses a start day from **1 to 28** (default 1 = calendar
   months). 28 is the maximum because every month has a 28th.
2. **Naming.** A budget month keeps the name and key of the calendar month it **starts in**.
   With start day 10, the budget month `2026-10` runs **10 October – 9 November**. With
   start day 1 it is simply October.
3. **Membership of a day.** A date belongs to the budget month whose start is the latest
   start on or before it. With start day 10, 9 October belongs to `2026-09`; 10 October to
   `2026-10`.
4. **Labels.** With start day 1 the month is shown as "October 2026"; otherwise as the date
   range, for example "10 Oct – 9 Nov".
5. **Planning ahead.** Users can view and plan **one month ahead** of the current one, never
   further.
6. **Changing the start day** re-groups existing expenses by the new rule immediately. Budget
   totals stay attached to their month keys. Nothing is deleted.

### Fresh start

1. **Start fresh** hides all spending before a chosen day (today, when set from Settings):
   older months disappear from the month switcher, comparisons, tips, the assistant and the
   expense list.
2. A month that **ended before** the fresh start date behaves as if it had no budget
   (`404 No budget`), so nothing can be compared with it.
3. The month that **contains** the fresh start date still shows, counting only spending from
   that date on.
4. **Nothing is deleted.** Clearing the fresh start ("Show my older months again") restores
   every view exactly as before.
5. A fresh start cannot be in the future (one day of tolerance for time zones).

## 5. Budgets and category limits

**Rules** (`app/domain/budget/service.py`):

1. **One budget per user per month.** Setting the total again updates it.
2. **Expenses need a budget.** An expense cannot be recorded in a month that has no budget
   (`409`). The app asks the user to set the month's budget first.
3. **The budget currency is fixed at creation.** All of that month's expenses are converted
   into it, so changing it later would mix currencies. Choosing a different currency when
   creating a budget also makes it the user's new base currency.
4. **Copy last month.** A new month can be created in one step with last month's total,
   currency and limits (for categories that still exist).
5. **Limits are optional.** A category without a limit still appears in the breakdown when
   money is spent on it.
6. **Planned ≤ total.** The sum of limits cannot exceed the month's total, and the total
   cannot be lowered below what is already planned (`422`).
7. Saving limits **replaces the whole plan** for that month (at most 50 categories). A
   category cannot appear twice.
8. **Remaining** = total − spent. It may be negative (over budget); the product says so
   plainly instead of hiding it.

## 6. Expenses

**Rules** (`app/domain/expense/`):

1. **Fields:** amount, currency (default: base currency), description (1–200 characters),
   category, date.
2. **Dates** cannot be in the future (one day of tolerance for time zones).
3. **Conversion:** the amount is converted into the **budget currency of the month the date
   falls in**, at that day's rate. Both the original and the converted amount are stored,
   with the rate.
4. **Editing** an expense re-converts it if the amount, currency or date changes.
5. **Ordering:** lists are newest first and grouped by day, with a daily total in the budget
   currency.
6. **Source:** an expense is either `manual` or `group` (a copy of a group share; see 11.6).
   Group copies show a group marker.
7. **Ownership:** every expense belongs to one user. Requesting someone else's expense gets
   the same answer as one that does not exist (`404`).

## 7. Categories and automatic categorization

### Categories
1. Eight **built-in categories** exist for everyone: food, transport, study, entertainment,
   shopping, health, bills, other. They cannot be renamed or removed, and their names are
   translated.
2. Users can create **their own categories** (name 1–50 characters, icon, colour). Names are
   unique per user (`409`).
3. Removing a category **archives** it: past expenses keep it; it is no longer offered.

### Suggesting a category
**Rules** (`app/domain/expense/categorizer.py`):

1. **History first.** If the user has written the same description before (after
   normalization: case, accents and Arabic letter forms ignored), the category they chose
   last time is suggested. This works for their own categories too.
2. **Model second.** Otherwise a softmax-regression model trained on examples in three
   languages suggests a built-in category, **only if its confidence is at least 0.60**. At
   that threshold it suggests for about 40% of new descriptions and is right about 81% of
   the time. Below it, nothing is suggested: a wrong suggestion is worse than none.
3. The suggestion is never forced. The user can always pick another category.
4. **Recording the outcome.** The server stores how each expense was categorized: `ai`
   (kept the model's suggestion, with its confidence), `history`, or `user` (chose
   something else, or changed it later). This measures real accuracy and provides new
   training data.

## 8. Insights

### 8.1 The tank (left to spend)
1. Shows the amount left, the amount spent and the total, with a bar that drains as money
   is spent.
2. In the current month a **"today" marker** shows how far through the month we are.
3. The colour and sentence follow the pace:

| State | Condition | Message |
|---|---|---|
| Over | spent > total | How much over budget |
| Finished | a past month within budget | Spent X of Y |
| Too fast | current month, forecast > total | What can be spent per day to stay within budget |
| Early | current month, before day 7 | Daily amount for the days left (no forecast yet) |
| On pace | otherwise | Daily amount for the days left |

### 8.2 Alerts
**Rules** (`frontend/src/lib/insights.ts: findAlerts`), most serious first:
1. **Category over its limit** (critical).
2. **Category at 85% or more** of its limit (warning).
3. **90% of the budget gone** with more than 3 days left in the current month (warning).

Overspending the whole budget is not an alert: the tank already says it prominently.

### 8.3 End-of-month forecast
**Rules** (`app/ml/forecast.py`):
1. Shown only for the **current** month and only from **day 7** of the budget month.
   Earlier forecasts err by 40% or more and would mislead.
2. **One-off days** (a day costing more than **3×** the median spending day, such as rent)
   are counted once and never projected.
3. Forecast = spent so far + (average everyday spending × days left).
4. Days are counted from the budget month's start day, not from the 1st.

### 8.4 Comparison with last month
1. Compares the **same number of days** of both months (days 1–18 against days 1–18), never
   a partial month against a whole one.
2. Shown only if last month has a budget in the **same currency** and at least one day of
   this month has passed. A fresh start hides it.
3. Changes within **±5%** are shown as "about the same". Spending less is the positive
   direction.

### 8.5 Tips
**Rules** (`app/domain/budget/tips.py`):
1. **Repeated purchases:** the same thing (after normalization) bought **at least 4 times**
   in the month; the top 3 by total are shown, with the saving if halved.
2. **Most expensive weekday:** over the last **12 weeks**, one-offs excluded, shown only if
   each weekday was seen at least 4 times and the busiest costs **30% more** than an average
   day. Months budgeted in another currency are left out.

## 9. Savings goals

**Rules** (`app/domain/goal/service.py`):

1. A goal has a name (1–60 characters), target amount, currency (fixed once created), an
   optional target date, an icon and a colour.
2. **Deposits and withdrawals** are recorded with a date (not in the future) and an optional
   note (up to 100 characters). A withdrawal cannot exceed what is saved (`422`).
3. **Removing** a deposit that later withdrawals depend on is refused until those
   withdrawals are removed (`409`); the saved amount can never go negative.
4. **Progress** = saved ÷ target, capped at 100%. A goal is **achieved** when saved ≥ target.
5. **Months left** counts calendar months including the current one (18 October → 15 March =
   6). If the date has passed, months left = 0 and everything missing is due now.
6. **Monthly amount needed** = remaining ÷ months left, **rounded up** to the cent, so the
   last month is never a few cents short.
7. Goals are separate from the monthly budget: saving does not count as spending.
8. Archiving a goal hides it; its history is kept.

## 10. The assistant

**Rules** (`app/domain/assistant/`, `app/ml/assistant_entities.py`):

1. Answers questions about the user's **own** numbers in English, Arabic or Turkish:
   spending, what is left, top categories, the forecast, the comparison with last month,
   and goals.
2. **Intent** is decided by a model; the answer is given only when its confidence is at
   least **0.40**; otherwise the assistant lists what can be asked.
3. **Period and category** are recognized by rules ("last week", "الأكل", "yemeğe").
   "This month" and "last month" follow the user's budget month and fresh start.
4. **The number always comes from the database** with the product's own calculations; the
   model never produces an amount. The sentence is written by the client in the user's
   language.
5. No external AI service is used, and questions never leave the product.

## 11. Groups

Full design: [`design/groups.md`](design/groups.md). The rules below are the ones in force.

### 11.1 Principles
1. **Your share is your expense, not what you paid.** If you pay 300 for three people, your
   spending is 100; the other 200 is owed to you.
2. **A group never sees anything personal**: no budget, personal expense, limit or total.
3. **Balances are computed, never stored**, so they cannot drift from the history.
4. **Paying someone back is not spending.** A settlement changes balances, never a budget.
5. **Every amount adds up to the cent.**

### 11.2 Groups and members
1. Creating or joining a group requires a **verified email** where email is enabled.
2. A group has a name (up to 60 characters), a **currency fixed at creation**, and a
   **member limit from 2 to 100** chosen by the creator. The limit cannot be set below the
   current number of members.
3. **Roles:**

| Role | Can |
|---|---|
| Member | See expenses, shares, balances and members (display names only); add expenses; edit their own expenses; record payments they are part of |
| Admin | Also edit or delete any expense, create and revoke invite links, invite by username, remove members, record payments between others |
| Owner | Also rename, change the member limit, and promote or demote admins |

4. **Joining is limited atomically:** the member count is checked in the same transaction
   that adds the member, so concurrent joins cannot exceed the limit.
5. **Leaving requires a zero balance** ("Settle up before leaving"). When the owner leaves,
   the oldest admin becomes owner, otherwise the oldest member. When the last member leaves,
   the group is archived.
6. **Non-members get `404`** on every group address, so a group's existence is never
   confirmed.

### 11.3 Invitations
1. **Links** (with a QR code): random 32-byte tokens stored only as a hash, valid **7 days**,
   revocable, and joining is rate-limited.
2. **By username:** an admin invites a username; the person must **accept or decline**. After
   a decline, the group cannot ask the same person again for **30 days**.
3. Usernames are unique, stored in lower case, 3–20 characters (letters, digits, "." and
   "_", starting with a letter), and some names are reserved.

### 11.4 Group expenses
1. Fields: description, built-in category, amount, currency, who paid, date, split method,
   and the people included.
2. An expense paid in another currency is converted to the **group currency** at that day's
   rate; the original amount, currency and rate are kept.
3. Only **who added it, or an admin**, can edit or delete an expense. Deleting is soft: the
   history and audit trail remain.
4. People who left can stay in older expenses; new expenses include current members only.

### 11.5 Split methods and rounding
| Method | Input | Rule |
|---|---|---|
| Equal | Who is included | Same share each |
| Exact | An amount per person | Must add up to the total exactly, otherwise `422` |
| Percent | A percentage per person | Must add up to exactly 100% |
| Shares | A number of shares per person | Proportional to the shares |

Equal, percent and share splits use the **largest remainder method**: each share is rounded
down to the cent, then the leftover cents go one at a time to the largest remainders, ties
to the member who joined first. 100.00 ÷ 3 = 33.34 + 33.33 + 33.33.

### 11.6 Shares in personal budgets
1. Each member's share is **copied automatically** into their own expenses, in the built-in
   category with the same slug, converted into **their** budget currency for **their** budget
   month (which follows their own start day).
2. A copy is made only if the member has **auto-add** on (the default) **and** a budget for
   that month. Otherwise the share waits as **pending**; the member adds it ("Add" or
   "Add all") or dismisses it.
3. A share of **0** creates nothing.
4. When the group expense changes, copies follow; when it is deleted, copies are deleted.
5. If a member **edits or deletes their copy**, it becomes theirs: the share is marked
   `dismissed` and the group never touches it again. Moving it to another category does not
   count as that.

### 11.7 Balances and settlements
1. **Pair debts.** For each expense, each included member owes the payer their share. Every
   settlement reduces what one person owes another. Between any two people, opposite debts
   cancel: if A owes B 30 and B owes A 10, A owes B 20. Debts are **not simplified across
   people** (A→B→C is not turned into A→C), so everyone sees exactly whom they owe.
2. **Net balance** of a member = what others owe them − what they owe others. The sum of
   all members' net balances is always zero.
3. **"I paid my share"** records a settlement for exactly the member's share of one expense,
   to its payer. It is refused if the member paid the expense, owes nothing for it, or
   already paid it (`409`).
4. **Any payment** between two members can be recorded by either of them, or by an admin.
   Nobody can pay themselves.
5. **Undo:** a payment can be removed by either person in it, whoever recorded it, or an
   admin.
6. **The chat** lists every expense and payment in the order they were recorded, each with
   the **server's** date and time, so nothing can be back-dated. It loads 30 items at a time.

## 12. Accounts and security

Full design: [`design/accounts.md`](design/accounts.md); verification: [`security/ASVS.md`](security/ASVS.md).

1. **Sign-in methods:** email and password, Google, and phone number (SMS code). One account
   can have several. Sign in with Apple arrives at activation.
2. **Passwords:** at least **8** characters (at most 72 bytes), no composition rules,
   checked against known breached passwords without sending the password anywhere.
3. **Sessions:** access tokens last **15 minutes**; a session ends after **30 days** without
   use and **90 days** after sign-in in any case. Users see every signed-in device and can
   sign out one or all others. Changing the password signs out the other devices.
4. **Rate limits:** 5 sign-ins per minute per IP; **10 attempts per 15 minutes per account**
   from anywhere (counted even for emails without an account, so the limit reveals nothing);
   a default of 300 requests per minute per client; request bodies up to 1 MB.
5. **Two-factor authentication (TOTP):** turned on with a QR code and one code; **10 backup
   codes**, shown once, stored hashed; each code works once; 5 wrong codes end the sign-in.
6. **Phone codes:** 6 digits, valid 5 minutes, 5 attempts, at most one per minute and 5 per
   day per number, 20 per day per IP, a global daily cap, and an allow-list of countries
   (Turkey and the Arab League).
7. **Recent sign-in required (10 minutes)** for: changing email or password, turning 2FA
   off, new backup codes, exporting data and deleting the account. Otherwise the user
   confirms with their password first.
8. **No account enumeration:** "forgot password" and similar flows answer identically
   whether or not the account exists.
9. **Security log and notices:** sign-ins, failures, password and 2FA changes are recorded
   and shown to the user; password and 2FA changes also trigger an email notice.
10. **Unverified accounts** can use their own budget but not groups.
11. **App lock (mobile):** optional, per phone: Face ID, fingerprint or the phone passcode
    on opening the app and after more than **30 seconds** away; not asked again right after
    a password sign-in. A cover hides amounts in the app switcher.

## 13. Notifications

**Rules** (`app/domain/notify/`, `app/core/push.py`):

1. **Email** is used for verification, password reset, email change, account deletion and
   security notices, in the user's language, at most 3 of a kind per account per hour.
2. **Push notifications** (mobile) are sent for group activity and budget alerts:

| Event | Who receives it |
|---|---|
| New group expense | Members with a non-zero share, except who added it |
| Payment recorded | The other person in the payment |
| Invitation by username | The invitee |
| A category reaches **85%** of its limit, or goes **over** it | The budget's owner |
| **90%** of the month's money is gone with more than 3 days left, or the month is **overspent** | The budget's owner |

3. Each person receives it **in their own language**. Tapping a group one opens the group.
4. **Budget alerts** (`app/domain/notify/budget_alerts.py`) follow the overview's alerts and
   arrive **once per budget month** each; going over replaces the "near" one. Only the
   current budget month counts, and they are checked after anything that adds to the
   person's spending: their own expense, an edit, or a group share copied into their budget.
   Tapping one opens the overview.
5. Users switch group notifications and budget alerts on or off (separately) in Settings;
   the phone's own permission is also required. Signing out removes that phone; phones that uninstalled the app are
   forgotten automatically.
6. Notifications contain only who, which group or category, and how much: what a lock
   screen may show.
7. Sending happens **after** the response, so a slow notification service never delays the
   app.

## 14. Privacy and data rights

1. **Data minimization:** logs contain no personal data; the group feature never exposes
   email, phone or budgets.
2. **Export:** users can download all their data as a ZIP file at any time.
3. **Deletion:** immediate and permanent, after a recent sign-in and typing the account's
   email (or phone). Personal data is deleted; in groups the person becomes "Deleted user"
   so other members' balances stay correct.
4. The privacy policy and terms of use are available in all three languages.
5. **Support access:** admins (section 17) see account details only (name, email, phone,
   username, sign-in methods, language, currencies, devices, security activity), never
   budgets, expenses, categories, goals or groups. Every admin action is in the audit log
   and in the person's own security activity. The privacy policy says so.

## 15. Platform parity

1. The website, iPhone app and Android app offer **the same features and rules**.
2. Types, texts in three languages, API calls and the month and money rules are **one shared
   copy**, copied from the website into the app by a script; CI fails if they drift.
3. Platform-only features: app lock and push notifications (mobile), keyboard and large-screen
   layouts (web). Links sent by email open the website.
4. The admin dashboard is **website only** (section 17).

## 16. Invariants checked by tests

| Invariant | Where |
|---|---|
| Shares of a group expense add up exactly to its amount | `test_group_split.py` |
| Net balances in a group sum to zero | `test_group_settle.py` |
| A non-member gets 404 on every group address | `test_groups.py`, `test_pentest.py` |
| Another user's expense, goal or category is never visible | `test_expenses.py`, `test_pentest.py` |
| Planned limits never exceed the budget total | `test_budgets.py` |
| A withdrawal never exceeds the saved amount | `test_goals.py` |
| Expenses fall in the budget month of their start day; a fresh start hides without deleting | `test_budget_cycle.py` |
| The forecast counts days from the start day and appears only within the current month | `test_budget_cycle.py`, `test_ml_forecast.py` |
| Notifications reach the right people, in their language, and respect the switch | `test_push.py` |
| Each budget alert arrives once a month, only for the current month, and respects its switch | `test_budget_alerts.py` |
| Sign-in limits, session expiry and re-authentication | `test_auth.py`, `test_sessions.py`, `test_hardening.py` |
| No request makes anyone an admin; non-admins get 404 on every admin address | `test_admin.py` |
| Admins never see an amount, expense, budget or goal | `test_admin.py` |
| A hidden currency can't be newly chosen, but stays usable and convertible for whoever has it | `test_admin_currencies.py` |
| The exchange-rate URL only ever holds a three-letter code from our table | `test_currency.py` |
| A currency the rates provider stops quoting never stops conversion between the others | `test_currency.py` |

## 17. Admin dashboard

Full design: [`design/admin.md`](design/admin.md).

1. **Who:** only the command line (`python -m app.cli grant-admin`) makes an admin, and it
   needs the database URL. Admins need two-factor authentication.
2. **What they see:** counts across everyone, and account information of one person (email,
   phone, sign-in methods, devices, security activity). **Never** expenses, budgets, goals,
   categories or groups.
3. **What they do:** disable or enable an account, sign it out everywhere, resend the email
   confirmation. Each needs the password again within 10 minutes, never applies to an admin
   (themselves included), is written to the audit log, and appears in the person's own
   security activity.
4. **Currencies:** admins add a currency (code plus its name in English, Arabic and Turkish)
   and hide or show it again (section 3). Same rules: the password again within 10 minutes,
   and every change in the audit log. The website and the app read the list from
   `GET /currency/list`, so a new currency appears without a new release.
