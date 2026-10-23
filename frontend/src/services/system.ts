import { api } from "@/lib/api";

export interface ServerVersion {
  commit: string; // short git commit, e.g. "7bc8d23"
  environment: string; // "production", "staging" or "local"
}

export async function getVersion(): Promise<ServerVersion> {
  const { data } = await api.get<ServerVersion>("/version");
  return data;
}
