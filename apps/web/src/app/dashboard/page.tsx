import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOwnerRecords } from "@/lib/owner-records";
import { DashboardScreen } from "./dashboard-screen";

export const metadata: Metadata = { title: "Your Dashboard | HomeLoop" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "admin") redirect("/admin");
  return <DashboardScreen data={await getOwnerRecords(user.id)} params={await searchParams} />;
}
