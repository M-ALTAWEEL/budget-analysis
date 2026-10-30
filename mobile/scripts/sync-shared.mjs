// Copies the code the app shares with the website, so both always say and compute the
// same things: the texts in three languages, the API calls, the month and money rules.
//
//   node scripts/sync-shared.mjs          copy from ../frontend/src
//   node scripts/sync-shared.mjs --check  only check they're the same (CI): exit 1 if not
//
// Edit these files in frontend/src, never here; then run this script.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "../../frontend/src");
const to = join(here, "../src");

export const SHARED = [
  "types/api.ts",
  "i18n/config.ts",
  "i18n/messages/en.ts",
  "i18n/messages/ar.ts",
  "i18n/messages/tr.ts",
  "lib/month.ts",
  "lib/money.ts",
  "lib/insights.ts",
  "lib/challenges.ts",
  "lib/offline.ts",
  "lib/errors.ts",
  "hooks/queries.ts",
  "hooks/useDebouncedValue.ts",
  "services/assistant.ts",
  "services/auth.ts",
  "services/budget.ts",
  "services/challenges.ts",
  "services/currency.ts",
  "services/debts.ts",
  "services/expenses.ts",
  "services/goals.ts",
  "services/groups.ts",
  "services/income.ts",
  "services/inflation.ts",
  "services/recurring.ts",
  "services/reports.ts",
  "services/security.ts",
  "services/support.ts",
  "services/system.ts",
  "components/auth/AuthProvider.tsx",
  "components/settings/useChangeLocale.ts",
];

const check = process.argv.includes("--check");
const different = [];
for (const file of SHARED) {
  const source = join(from, file);
  const target = join(to, file);
  if (check) {
    if (!existsSync(target) || !readFileSync(source).equals(readFileSync(target))) different.push(file);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
if (check && different.length) {
  console.error(`Out of date (run: node scripts/sync-shared.mjs):\n  ${different.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? "Shared files are up to date." : `Copied ${SHARED.length} shared files.`);
