import { usePathname, useRouter, type Href } from "expo-router";
import { useEffect } from "react";

import { takePendingLink } from "@/lib/links";

/**
 * An invitation link opened while signed out leads to the sign-in screen first. Once
 * signed in (this mounts with the signed-in app), it opens what the link was for.
 */
export function PendingLink() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const link = takePendingLink();
    // Already there (signed in when the link came): nothing more to do.
    if (link && pathname !== "/groups/join") router.push(link as Href);
  }, [pathname, router]);

  return null;
}
