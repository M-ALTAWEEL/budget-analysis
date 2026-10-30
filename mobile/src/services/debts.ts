import { api } from "@/lib/api";
import type { Debt, DebtInput, DebtList } from "@/types/api";

export async function listDebts(): Promise<DebtList> {
  const { data } = await api.get<DebtList>("/debts");
  return data;
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const { data } = await api.post<Debt>("/debts", input);
  return data;
}

/** Person, amount, note and due day can change; who lent to whom and the currency can't. */
export async function updateDebt(
  uuid: string,
  input: Partial<Pick<DebtInput, "person" | "amount" | "note" | "due_on">>,
): Promise<Debt> {
  const { data } = await api.patch<Debt>(`/debts/${uuid}`, input);
  return data;
}

export async function deleteDebt(uuid: string): Promise<void> {
  await api.delete(`/debts/${uuid}`);
}

export async function addDebtPayment(uuid: string, amount: string, paidOn?: string): Promise<Debt> {
  const { data } = await api.post<Debt>(`/debts/${uuid}/payments`, { amount, paid_on: paidOn });
  return data;
}

export async function settleDebt(uuid: string): Promise<Debt> {
  const { data } = await api.post<Debt>(`/debts/${uuid}/settle`);
  return data;
}

export async function undoDebtPayment(uuid: string, paymentUuid: string): Promise<Debt> {
  const { data } = await api.delete<Debt>(`/debts/${uuid}/payments/${paymentUuid}`);
  return data;
}
