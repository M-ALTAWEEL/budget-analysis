import { api } from "@/lib/api";
import type { ContributionInput, Goal, GoalDetail, GoalInput } from "@/types/api";

export async function listGoals(): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>("/goals");
  return data;
}

/** One goal with its history of deposits and withdrawals. */
export async function getGoal(uuid: string): Promise<GoalDetail> {
  const { data } = await api.get<GoalDetail>(`/goals/${uuid}`);
  return data;
}

export async function createGoal(input: GoalInput): Promise<GoalDetail> {
  const { data } = await api.post<GoalDetail>("/goals", input);
  return data;
}

export async function updateGoal(uuid: string, input: Partial<GoalInput>): Promise<GoalDetail> {
  const changes = { ...input };
  delete changes.currency; // fixed at creation: every deposit is in this currency
  const { data } = await api.patch<GoalDetail>(`/goals/${uuid}`, changes);
  return data;
}

export async function archiveGoal(uuid: string): Promise<void> {
  await api.delete(`/goals/${uuid}`);
}

export async function addContribution(uuid: string, input: ContributionInput): Promise<GoalDetail> {
  const { data } = await api.post<GoalDetail>(`/goals/${uuid}/contributions`, input);
  return data;
}

export async function removeContribution(goalUuid: string, contributionUuid: string): Promise<GoalDetail> {
  const { data } = await api.delete<GoalDetail>(`/goals/${goalUuid}/contributions/${contributionUuid}`);
  return data;
}
