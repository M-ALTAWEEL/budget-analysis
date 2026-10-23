# Design: Groups (shared expenses)

Status: approved for phase 3 · Owner: Mouhammed Altaweel · October 2026

## 1. The problem

Students who live together take turns buying groceries, paying bills and ordering food.
They need to see who paid what, when, and how much each person owes, **without** any of
that leaking into, or being mixed with, their personal budget.

## 2. Principles

1. **Your share is your expense, not what you paid.** If I pay 300 for three people, my
   personal spending is 100. The other 200 is money owed to me, not money spent.
2. **The group never sees anything personal.** No budget, no personal expense, no category
   limit, no total. The only bridge is a share being copied into its owner's personal account.
3. **Balances are computed, never stored.** "Who owes whom" is always calculated from the
   expenses and settlements, so it can never drift from them (one source of truth).
4. **Paying someone back is not spending.** A settlement changes balances only, never a budget.
5. **Every amount adds up to the cent.** The shares of an expense always sum exactly to it.

## 3. Data model

All tables inherit `id`, `uuid`, `created_at` and `updated_at` from `BaseModel`. The API
only ever exposes `uuid`.

```
groups
  name              varchar(60)
  currency          char(3)          fixed at creation (like a budget)
  member_limit      int              chosen by the creator; CHECK 2..100
  created_by        → users.id
  archived_at       timestamptz null

group_members                         UNIQUE (group_id, user_id)
  group_id          → groups.id  ON DELETE CASCADE
  user_id           → users.id   null once the account is deleted (see 8.4)
  display_name      varchar(100)     kept for history after the account is deleted
  role              'owner' | 'admin' | 'member'
  auto_add_shares   bool default true
  left_at           timestamptz null

group_invites
  group_id          → groups.id
  token_hash        char(64) UNIQUE  SHA-256; the token itself is only in the link
  created_by        → group_members.id
  expires_at        timestamptz      default 7 days
  max_uses          int null
  uses              int default 0
  revoked_at        timestamptz null

group_expenses                        INDEX (group_id, spent_at)
  group_id          → groups.id
  paid_by           → group_members.id
  created_by        → group_members.id
  description       varchar(200)
  category_slug     varchar(30)      one of the default categories (see 6.2)
  amount            numeric(12,2)    in the group's currency
  original_amount   numeric(12,2)    what was actually paid...
  original_currency char(3)          ...and in which currency
  fx_rate           numeric(18,8)    snapshot, like personal expenses
  split_method      'equal' | 'exact' | 'percent' | 'shares'
  spent_at          date
  deleted_at        timestamptz null soft delete: history and audit stay

group_expense_shares                  UNIQUE (group_expense_id, member_id)
  group_expense_id  → group_expenses.id ON DELETE CASCADE
  member_id         → group_members.id
  amount            numeric(12,2)    in the group's currency; CHECK amount >= 0
  weight            numeric(9,4) null the % or number of shares the user typed
  status            'pending' | 'added' | 'dismissed'
  personal_expense_id → expenses.id UNIQUE null  the copy in the member's own account

group_settlements
  group_id          → groups.id
  from_member       → group_members.id   the one who pays back
  to_member         → group_members.id
  amount            numeric(12,2)    CHECK amount > 0, from ≠ to
  settled_at        date
  created_by        → group_members.id
  deleted_at        timestamptz null
```

The personal `expenses` table gets one new column:

```
expenses.source   'manual' | 'group'   default 'manual'
```

A personal expense with `source = 'group'` is linked through
`group_expense_shares.personal_expense_id` and shows "from: Flat 4B" in the owner's list.

## 4. Splitting and rounding

The shares must add up to the amount exactly. Equal, percent and share splits use the
**largest remainder method**:

1. Compute each exact share in cents and round it down.
2. Hand the cents left over, one at a time, to the members with the largest remainders.
3. If two remainders tie, the member who joined first wins, so the result is the same
   every time.

Example: 100.00 split three ways → 33.34, 33.33, 33.33.

`exact` splits are checked instead: if the typed amounts don't add up, the API answers 422.

## 5. Balances and settling up

For each member:

```
net = paid (expenses they paid)
    − owed (their shares)
    + sent (settlements they paid)
    − received (settlements paid to them)
```

A positive `net` means the group owes them; negative means they owe. The sum over all
members is always zero, and a test checks it.

**Simplifying debts.** The greedy method repeatedly matches the person who owes the most
with the person owed the most, until everything is zero. That gives at most `n − 1`
payments. Example: A owes B 50, B owes C 50 → "A pays C 50".

## 6. Adding your share to your personal account

### 6.1 The flow

1. A group expense is saved together with its shares, in one transaction.
2. For each member with `auto_add_shares = true` (the default), the system:
   - converts the share into the currency of that month's budget, with the day's rate,
     exactly like a personal expense;
   - creates the personal expense: `source = 'group'`, the mapped category, and the
     description "Groceries · Flat 4B";
   - sets the share's `status` to `'added'` and links `personal_expense_id`.
3. If the member has no budget for that month, the share stays `pending` and they see
   "You have 2 group shares to add". It is added as soon as they set the budget.
4. Members who turned auto-add off see the pending share with an "Add to my budget" button,
   or can dismiss it.
5. A share of 0 (for example "this item is only mine") creates nothing.

### 6.2 Categories

Group expenses use the **default categories** only (food, transport, bills…), because
personal custom categories are private and differ from person to person. The share is
added to the member's category with the same slug. Each member can still move their copy
to one of their own categories afterwards.

### 6.3 Changes after the fact

| What happens in the group | The personal copy |
|---|---|
| The amount or split changes | Updated to the new share |
| The category changes | Updated, unless the member moved it to their own category |
| The expense is deleted | Deleted |
| The member edits or deletes their copy | The share is marked `dismissed`; the group stays as it was |

## 7. Privacy and permissions

| Who | Can |
|---|---|
| Not a member | Nothing. Every group URL answers **404**, so a group's existence is never confirmed |
| Member | See the group's expenses, shares, balances and members (display name only, no email or phone); add expenses and settlements; edit their own |
| Admin | Also edit or delete any expense, invite, remove members |
| Owner | Also rename, change the member limit (not below the current count), archive |

- **Group queries never join personal tables**, and personal queries never join group
  tables. The only write across the line is the share copy, done by the service.
- Every repository method takes the current user's id and checks membership in the
  query itself, not afterwards in Python.
- Invite tokens are random 32 bytes, stored only as a hash, expire after 7 days, can
  be revoked, and joining is rate limited.
- The member limit is counted in the same transaction that adds the member, so two
  people joining at once can't go over it.

## 8. Edge cases

1. **Leaving a group** is allowed only when your balance is zero. Otherwise you have to
   settle up first.
2. **Removing a member** who still has a balance: an admin can do it, but the history and
   balance stay under their name, marked "left".
3. **The owner leaves:** ownership goes to the oldest admin, otherwise the oldest member.
   The last member leaving archives the group.
4. **Account deletion:** `user_id` becomes NULL and `display_name` becomes "Deleted user".
   Shares and settlements stay, so other members' balances remain correct. The deleted
   person's personal copies are deleted with their account.
5. **Different currencies:** an expense paid in another currency is converted to the
   group's currency at that day's rate, and the rate is stored.

## 9. API (sketch)

```
POST   /groups                              create (name, currency, member_limit)
GET    /groups                              my groups
GET    /groups/{uuid}                       details, members, my balance
PATCH  /groups/{uuid}                       owner/admin
POST   /groups/{uuid}/invites               create an invite link
POST   /invites/{token}/accept              join
DELETE /groups/{uuid}/members/{uuid}        leave or remove
GET    /groups/{uuid}/expenses              paginated
POST   /groups/{uuid}/expenses              with the split
PATCH  /groups/{uuid}/expenses/{uuid}
DELETE /groups/{uuid}/expenses/{uuid}
GET    /groups/{uuid}/balances              net per member + the simplified payments
POST   /groups/{uuid}/settlements
GET    /me/group-shares?status=pending      shares waiting to be added
POST   /me/group-shares/{uuid}/add | /dismiss
```

## 10. Tests to write

- Rounding: every split method sums exactly to the amount, for 1 to 100 members.
- Balances: the sum over members is always zero; property-based tests with random expenses.
- Simplifying debts: the result settles everyone, in at most `n − 1` payments.
- Auto-add: the right amount, category and currency; pending when there is no budget;
  updated or removed when the group expense changes.
- **Privacy**: a member requesting any personal endpoint of another member gets nothing;
  a non-member gets 404 on every group URL; group responses never contain email, phone
  or budget fields.
- Member limit: concurrent joins never exceed it.
- Leaving with a balance is refused; account deletion keeps other members' balances.
