import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-application-detail";
import { simulate } from "@/lib/valuation";
import { SimulatorClient } from "./simulator-client";
import styles from "./simulator.module.css";

export const metadata: Metadata = { title: "Risk Simulator | HomeLoop Team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSimulatorPage() {
  await requireAdmin();
  try {
    return <SimulatorClient initial={await simulate()} />;
  } catch {
    return <div className={styles.page} data-admin-simulator><a className={styles.back} href="/admin"><ArrowLeft size={14} aria-hidden="true" />Back to applications</a><section className={styles.unavailable} role="alert"><AlertTriangle size={24} aria-hidden="true" /><h1>Risk simulator unavailable</h1><p>The historical scenario service could not be loaded. No application, offer or limit was changed.</p><a href="/admin/simulator">Try again</a></section></div>;
  }
}

