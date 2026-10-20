import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/admin-applications";
import type { AdminParams } from "@/lib/admin-applications-model";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Applications | HomeLoop Team" };
export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/home");
  const [data, params] = await Promise.all([getAdminDashboard(), searchParams]);
  return <AdminDashboard data={data} params={params} />;
}
