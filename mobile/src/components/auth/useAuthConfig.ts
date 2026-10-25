import { useQuery } from "@tanstack/react-query";

import { getAuthConfig } from "@/services/auth";

/** Which sign-in features the server has switched on (email, phone, 2FA…). Same key as the website. */
export function useAuthConfig() {
  return useQuery({ queryKey: ["auth-config"], queryFn: getAuthConfig, staleTime: Infinity });
}
