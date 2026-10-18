import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPlanJourney } from "@/lib/plans";
import { depositAnswer, type PlanParams } from "@/lib/plans-model";
import { PlanError } from "./shared";
import { PlansScreen } from "./plans-screen";

export const metadata: Metadata = { title: "Compare trade-in plans | HomeLoop" };
export default async function PlansPage({ searchParams }: { searchParams: Promise<PlanParams> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/plans");
  if (user.role === "admin") redirect("/admin");
  const params = await searchParams;
  const result = await getPlanJourney(params, user.id);
  if (!result.journey) return <PlanError message={result.error} />;
  return <PlansScreen journey={result.journey} answer={depositAnswer(params.deposit)} />;
}
