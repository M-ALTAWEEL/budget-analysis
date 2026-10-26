# Recovery: going back to a safe version

> This file lives in the repository, so it is always at hand.

## Safe point: v1.0
The last working version before the commercial plan (19 October 2026):

| | |
|---|---|
| **Tag** | `v1.0` |
| **Commit** | `fe8b23919f82b8f7bbb4a7f54fd13857f501bf12` (`fe8b239`) |
| **Contents** | The complete single-user Budget Analysis: budgets, expenses, goals, ML categorization, forecast, tips, assistant, Google sign-in, three languages, new name and logo |
| **Full offline backup** | `BudgetAnalysis_v1.0_backup.bundle` on the maintainer's machine: the whole history in one file, usable even if the GitHub repository is deleted |

## Situations

### 1. The last pushed commit was a mistake
```
git revert HEAD
git push
```
Creates a new commit that undoes the last one. History is kept.

### 2. Return the whole product to v1.0, removing all later work
```
git switch main
git revert --no-edit v1.0..HEAD
git push
```
Undoes every commit after v1.0, in order. The product behaves exactly like v1.0, and the newer
work stays in history in case the decision is reversed.

### 3. Look at v1.0 without changing anything
```
git switch --detach v1.0
```
Return with `git switch main`.

### 4. The repository is gone or the machine failed
```
git clone <path-to>/BudgetAnalysis_v1.0_backup.bundle budget-analysis-restored
```
**Keep a second copy of the bundle elsewhere** (cloud drive or USB stick), not only on the desktop.

## The database ⚠️
The commands above restore code, **not data**. Therefore:
- Every schema change (Alembic migration) has a downgrade: `alembic downgrade -1`.
- **Before any migration** on the production database: a Neon backup branch (Branches → Create branch).
- Since phase 1, every migration runs on staging first.

## Rules from now on
- Every phase on **its own branch** (`phase-1`, `phase-2`, …); `main` is production.
- Before every large phase: a new tag (`v1.1`, `v2.0`, …), recorded below.

| Tag | Date | Contents |
|---|---|---|
| `v1.0` | 2026-10-19 | Last version before the commercial plan |
