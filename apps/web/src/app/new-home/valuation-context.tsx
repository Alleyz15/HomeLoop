import { Home, CircleAlert } from "lucide-react";
import { marketRm, type ValuationContext as Context } from "@/lib/development-model";
import styles from "./[project]/development.module.css";

export function ValuationContext({ context }: { context: Context }) {
  const { valuation, state } = context;
  if (state === "none") return null;
  return <aside className={styles.valuation} data-valuation-context={state}>
    {valuation ? <Home size={21} strokeWidth={1.3} aria-hidden="true" /> : <CircleAlert size={21} aria-hidden="true" />}
    <div><p className={styles.eyebrow}>YOUR CURRENT HOME</p>
      {valuation ? <><h2>{valuation.scheme || "Saved property"}</h2><p>{valuation.road_norm || "Street not recorded"}</p>
        {state === "ready" ? <><strong className={styles.range}>{marketRm(Math.round(Number(valuation.low)))} – {marketRm(Math.round(Number(valuation.high)))}</strong><p>Middle estimate {marketRm(Math.round(Number(valuation.estimate)))} · Preliminary, not a formal valuation.</p></> : <p>No estimate available. You can browse developments, but a price difference or plan quote cannot be calculated.</p>}
      </> : <><h2>{state === "error" ? "We couldn’t load your valuation." : "This valuation isn’t available."}</h2><p>{state === "error" ? "Refresh to try again. No valuation amounts have been assumed." : "It may no longer exist or may not belong to this account. No property details are shown."}</p></>}
    </div>
  </aside>;
}
