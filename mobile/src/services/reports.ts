import { api } from "@/lib/api";
import type { Wrapped } from "@/types/api";

/** The month in a few numbers (feature F4). 404 when the month has no budget. */
export async function getWrapped(month: string): Promise<Wrapped> {
  const { data } = await api.get<Wrapped>(`/reports/${month}/wrapped`);
  return data;
}
