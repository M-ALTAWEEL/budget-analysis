import { api } from "@/lib/api";
import type { Currency, CurrencyInfo, Rates } from "@/types/api";

export async function getRates(base: Currency): Promise<Rates> {
  const { data } = await api.get<Rates>("/currency/rates", { params: { base } });
  return data;
}

/** Every currency with its names; no sign-in needed (the sign-up form uses it). */
export async function listCurrencies(): Promise<CurrencyInfo[]> {
  const { data } = await api.get<CurrencyInfo[]>("/currency/list");
  return data;
}
