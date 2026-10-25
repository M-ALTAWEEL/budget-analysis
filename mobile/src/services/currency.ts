import { api } from "@/lib/api";
import type { Currency, Rates } from "@/types/api";

export async function getRates(base: Currency): Promise<Rates> {
  const { data } = await api.get<Rates>("/currency/rates", { params: { base } });
  return data;
}
