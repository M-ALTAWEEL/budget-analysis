import type { ViewStyle } from "react-native";

import { Select } from "@/components/ui/Field";
import { useCurrencies } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { currencyChoices, currencyLabel } from "@/lib/money";
import type { Currency } from "@/types/api";

/** A currency picker fed by the server's list (admins add currencies), like the website's.
 *  Hidden currencies are left out, except the chosen one and those in `keep`. */
export function CurrencySelect({
  label,
  value,
  onChange,
  keep = [],
  exclude,
  none,
  short = false,
  disabled,
  style,
}: {
  label: string;
  value: Currency;
  onChange: (code: Currency) => void;
  keep?: (Currency | null | undefined)[];
  exclude?: Currency; // e.g. the main currency, in the second-currency picker
  none?: string; // label of an empty first choice ("None")
  short?: boolean; // "USD" instead of "US dollar (USD)", in narrow forms
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { locale } = useI18n();
  const { data } = useCurrencies();
  const codes = currencyChoices(data, [value, ...keep]).filter((code) => code !== exclude);
  const options = codes.map((code) => ({ value: code, label: short ? code : currencyLabel(data, code, locale) }));
  return (
    <Select<string>
      style={style}
      label={label}
      value={value}
      disabled={disabled}
      options={none === undefined ? options : [{ value: "", label: none }, ...options]}
      onChange={onChange}
    />
  );
}
