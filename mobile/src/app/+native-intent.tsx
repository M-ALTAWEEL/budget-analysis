import { appPathFor } from "@/lib/links";

/** Expo Router asks this about every link that opens the app (phase 6j). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return appPathFor(path);
  } catch {
    return path;
  }
}
