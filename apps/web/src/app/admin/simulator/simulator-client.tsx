"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, Calculator, LoaderCircle, ShieldCheck } from "lucide-react";
import { simulatorFormValues, simulatorResultView, type SimulatorFields } from "@/lib/admin-simulator-model";
import type { SimulatorResponse } from "@/lib/valuation";
import { runAdminSimulation, type SimulatorActionState } from "./actions";
import styles from "./simulator.module.css";

const money = (value: number) => `RM${Math.round(value).toLocaleString("en-MY")}`;
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

type SliderKey = Exclude<keyof SimulatorFields, "reference_valuation_rm" | "township">;
const SLIDERS: Array<{ key: SliderKey; label: string; min: number; max: number; step: number; help: string }> = [
  { key: "price_drop_pct", label: "Market price drop", min: 0, max: 40, step: 1, help: "Stress the historical sale ratios after a broad market decline." },
  { key: "plan_b_floor_ratio", label: "Plan B guarantee floor", min: 50, max: 95, step: 0.5, help: "Guaranteed floor as a share of the confirmed valuation." },
  { key: "plan_a_cost_pct", label: "Plan A cost allowance", min: 0, max: 50, step: 0.5, help: "Documented allowance for acquisition and resale costs." },
  { key: "plan_a_buffer_pct", label: "Plan A risk buffer", min: 0, max: 50, step: 0.5, help: "Risk buffer deducted from the direct-purchase offer." },
  { key: "seller_agent_pct", label: "Plan B agent fee", min: 0, max: 20, step: 0.1, help: "Assumed fee on an open-market sale." },
  { key: "seller_legal_pct", label: "Plan B legal fee", min: 0, max: 20, step: 0.1, help: "Assumed legal cost on an open-market sale." },
];

function Histogram({ result }: { result: SimulatorResponse }) {
  const max = Math.max(1, ...result.ratio_histogram.map(bin => bin.count));
  return <section className={styles.histogram} aria-labelledby="histogram-heading">
    <div className={styles.sectionTitle}><div><p>HISTORICAL DISTRIBUTION</p><h2 id="histogram-heading">Realised price ratios</h2></div><span>{result.n_cases} backtest cases</span></div>
    {result.ratio_histogram.length ? <div className={styles.bars} role="img" aria-label={`Histogram of ${result.n_cases} historical backtest cases`}>
      {result.ratio_histogram.map((bin, index) => <div className={styles.bin} key={`${bin.lower}-${bin.upper}`}>
        <span className={styles.count}>{bin.count}</span>
        <span className={styles.bar} style={{ height: `${Math.max(3, (bin.count / max) * 100)}%` }} />
        <span className={styles.binLabel}>{index % 2 === 0 ? `${bin.lower.toFixed(2)} to ${bin.upper.toFixed(2)}` : ""}</span>
      </div>)}
    </div> : <p className={styles.empty}>No historical cases match this filter.</p>}
  </section>;
}

export function SimulatorClient({ initial }: { initial: SimulatorResponse }) {
  const [state, submit, pending] = useActionState<SimulatorActionState, FormData>(runAdminSimulation, { result: initial });
  const [fields, setFields] = useState<SimulatorFields>(() => simulatorFormValues(initial.inputs));
  const [changed, setChanged] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const result = state.result ?? initial;
  const view = simulatorResultView(result);

  useEffect(() => {
    if (!changed) return;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 450);
    return () => window.clearTimeout(timer);
  }, [changed, fields]);

  const update = (key: keyof SimulatorFields, value: string) => {
    setFields(current => ({ ...current, [key]: key === "township" ? value : Number(value) }));
    setChanged(true);
  };

  return <div className={styles.page} data-admin-simulator>
    <a className={styles.back} href="/admin"><ArrowLeft size={14} aria-hidden="true" />Back to applications</a>
    <header className={styles.heading}><div><p className={styles.eyebrow}>RISK SIMULATOR</p><h1>Stress the assumptions<span>.</span></h1><p>Explore historical outcomes without changing live applications, offers or monthly limits.</p></div><div className={styles.sample}><BarChart3 size={20} aria-hidden="true" /><strong>{view.cases}</strong><span>historical cases</span></div></header>

    <div className={styles.workspace}>
      <form ref={formRef} action={submit} className={styles.controls} aria-labelledby="controls-heading">
        <div className={styles.sectionTitle}><div><p>SCENARIO INPUTS</p><h2 id="controls-heading">Adjust the stress case</h2></div>{pending && <span className={styles.calculating} role="status"><LoaderCircle size={14} aria-hidden="true" />Recalculating</span>}</div>
        {SLIDERS.map(item => <label className={styles.slider} key={item.key}>
          <span><strong>{item.label}</strong><output htmlFor={`sim-${item.key}`}>{Number(fields[item.key]).toFixed(item.step < 1 ? 1 : 0)}%</output></span>
          <input id={`sim-${item.key}`} name={item.key} type="range" min={item.min} max={item.max} step={item.step} value={fields[item.key]} onChange={event => update(item.key, event.target.value)} />
          <small>{item.help}</small>
        </label>)}
        <div className={styles.fieldGrid}><label><span>Reference valuation (RM)</span><input name="reference_valuation_rm" type="number" min="1" step="1000" value={fields.reference_valuation_rm} onChange={event => update("reference_valuation_rm", event.target.value)} /></label><label><span>Township filter (optional)</span><input name="township" type="text" maxLength={120} value={fields.township} placeholder="All townships" onChange={event => update("township", event.target.value)} /></label></div>
        <button className={styles.runButton} type="submit" disabled={pending}><Calculator size={15} aria-hidden="true" />Run this scenario</button>
        <p className={styles.autoNote}>Slider changes recalculate automatically after a short pause.</p>
        {state.error && <p className={styles.error} role="alert"><AlertTriangle size={15} aria-hidden="true" />{state.error}</p>}
      </form>

      <main className={styles.results} aria-live="polite" aria-busy={pending}>
        <div className={styles.resultTop}><div><p className={styles.eyebrow}>SCENARIO RESULT</p><h2>{fields.price_drop_pct}% market drop</h2></div><span>{result.inputs.township ?? "All townships"}</span></div>
        <div className={styles.planResult} data-plan="B"><div className={styles.planHeading}><span><ShieldCheck size={18} aria-hidden="true" /></span><div><p>PLAN B</p><h3>Guarantee exposure</h3></div></div><div className={styles.primaryMetric}><strong>{view.planBMeanTopupShare}</strong><span>average top-up as a share of valuation</span></div><dl><div><dt>Cases needing a top-up</dt><dd>{view.planBTopupShare}</dd></div><div><dt>At {view.referenceBasis}</dt><dd>{money(result.plan_b.avg_topup_per_deal)} average</dd></div><div><dt>Using each sample valuation</dt><dd>{money(result.plan_b.avg_topup_per_deal_sample_weighted)} average</dd></div><div><dt>90th percentile top-up</dt><dd>{money(result.plan_b.p90_topup)}</dd></div></dl></div>
        <div className={styles.planResult} data-plan="A"><div className={styles.planHeading}><span><Calculator size={18} aria-hidden="true" /></span><div><p>PLAN A</p><h3>Direct-purchase result</h3></div></div><div className={styles.primaryMetric}><strong>{view.planAMeanReturn}</strong><span>average result as a share of valuation</span></div><dl><div><dt>Loss-making cases</dt><dd>{view.planAProbabilityOfLoss}</dd></div><div><dt>At {view.referenceBasis}</dt><dd>{money(result.plan_a.avg_profit_per_deal)} average</dd></div><div><dt>Using each sample valuation</dt><dd>{money(result.plan_a.avg_profit_per_deal_sample_weighted)} average</dd></div><div><dt>10th percentile result</dt><dd>{pct(result.plan_a.p10_profit_pct)}</dd></div></dl></div>
        {view.histogramCases !== view.cases && <p className={styles.error} role="alert">Histogram total does not match the returned case count. Treat this result as unavailable.</p>}
      </main>
    </div>
    <Histogram result={result} />
    <aside className={styles.note}><AlertTriangle size={17} aria-hidden="true" /><p><strong>Decision support only.</strong> Results replay 187 historical backtest errors under selected assumptions. They are not forecasts, approvals or live capacity commitments. RM figures depend on the labelled valuation basis; compare percentages first.</p></aside>
  </div>;
}

