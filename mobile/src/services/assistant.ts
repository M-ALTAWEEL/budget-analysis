import { api } from "@/lib/api";
import type { AssistantAnswer } from "@/types/api";

export async function askAssistant(question: string): Promise<AssistantAnswer> {
  const { data } = await api.post<AssistantAnswer>("/assistant/ask", { question });
  return data;
}
