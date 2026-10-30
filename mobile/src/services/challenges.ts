import { api } from "@/lib/api";
import type { Challenge, ChallengeInput, ChallengeList } from "@/types/api";

export async function listChallenges(): Promise<ChallengeList> {
  const { data } = await api.get<ChallengeList>("/challenges");
  return data;
}

export async function createChallenge(input: ChallengeInput): Promise<Challenge> {
  const { data } = await api.post<Challenge>("/challenges", input);
  return data;
}

/** Take part in one someone started in one of my groups. */
export async function joinChallenge(uuid: string): Promise<Challenge> {
  const { data } = await api.post<Challenge>(`/challenges/${uuid}/join`);
  return data;
}

export async function deleteChallenge(uuid: string): Promise<void> {
  await api.delete(`/challenges/${uuid}`);
}
