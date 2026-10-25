import { useAuth } from "@/components/auth/AuthProvider";
import { Text } from "@/components/ui/Text";
import { useRates } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import type { Currency } from "@/types/api";

/** "≈ USD 61.20": the amount in the second currency, at today's rate (if one is chosen). */
export function Approx({ amount, currency, size = 14 }: { amount: number | string; currency: Currency; size?: number }) {
  const { user } = useAuth();
  const { money } = useI18n();
  const second = user?.secondary_currency ?? null;
  const wanted = second !== null && second !== currency;
  const rates = useRates(currency, wanted);
  if (!wanted || !rates.data) return null;
  const converted = Number(amount) * Number(rates.data.rates[second]);
  return (
    <Text size={size} tone="muted">
      ≈ {money(converted, second)}
    </Text>
  );
}
