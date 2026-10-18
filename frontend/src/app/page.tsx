import { redirect } from "next/navigation";

// The app has no landing page yet: "/" goes straight to the overview.
// Signed-out visitors are sent on to /login by the app layout.
export default function Home() {
  redirect("/overview");
}
