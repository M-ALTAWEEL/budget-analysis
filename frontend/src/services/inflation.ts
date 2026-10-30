import { api } from "@/lib/api";
import type { InflationView } from "@/types/api";

/** The last six months in a steadier currency, and prices that went up (feature F8). */
export async function getInflation(): Promise<InflationView> {
  const { data } = await api.get<InflationView>("/insights/inflation");
  return data;
}
