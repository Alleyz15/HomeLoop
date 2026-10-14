import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

/**
 * Every `/admin` route is for the SDP trade-in team only. The role comes from
 * `profiles.role` on each request, so a homeowner who guesses the URL is sent
 * back to their own dashboard.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?next=/admin");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
