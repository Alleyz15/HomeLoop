import { ValuationForm } from "./valuation-form";
import { ArrowLeft, ArrowUpRight, House, MapPin } from "lucide-react";
import Link from "next/link";
import styles from "./valuation.module.css";

export default function ValuationPage() {
  return (
    <section className={styles.page} data-valuation-page>
      <div className={styles.backdrop} aria-hidden="true"><i /><i /></div>
      <Link href="/home" className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Back to Home</Link>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />A CLEARER START TO YOUR NEXT CHAPTER</p>
          <h1>Value <em>your home</em></h1>
          <p>Free, and based on real transactions published by NAPIC. We do not ask for your house number at this stage, only the road.</p>
          <div className={styles.heroTags}><span><House size={14} aria-hidden="true" />Your home, in perspective</span><span><MapPin size={14} aria-hidden="true" />Start with your road</span></div>
        </div>
        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.artHalo} />
          <div className={styles.artPaper}>
            <svg viewBox="0 0 420 255" fill="none">
              <defs>
                <pattern id="valuation-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" stroke="#8c9d76" strokeOpacity=".15" strokeWidth=".7" /></pattern>
                <linearGradient id="valuation-wall" x1="205" y1="90" x2="265" y2="205" gradientUnits="userSpaceOnUse"><stop stopColor="#fbf9ed" /><stop offset="1" stopColor="#e5e8d7" /></linearGradient>
                <linearGradient id="valuation-roof" x1="120" y1="64" x2="264" y2="123" gradientUnits="userSpaceOnUse"><stop stopColor="#849574" /><stop offset="1" stopColor="#4a6650" /></linearGradient>
              </defs>
              <path d="M0 0H420V255H0z" fill="url(#valuation-grid)" />
              <circle cx="302" cy="69" r="37" fill="#e9dfbd" fillOpacity=".65" />
              <path d="m75 183 160 48 126-56-154-46-132 54Z" fill="#dce5cd" />
              <path d="m99 183 133 40 105-48" stroke="#8b9f78" strokeOpacity=".35" />
              <ellipse cx="217" cy="186" rx="99" ry="20" fill="#5e7650" fillOpacity=".09" />
              <g className={styles.houseDrawing}>
                <path d="m133 119 99 29v65l-99-29v-65Z" fill="url(#valuation-wall)" stroke="#83957b" strokeWidth="1.1" />
                <path d="m232 148 69-36v64l-69 37v-65Z" fill="#d3ddc5" stroke="#83957b" strokeWidth="1.1" />
                <path d="m120 122 52-65 101 29-42 66-111-30Z" fill="url(#valuation-roof)" stroke="#4c6650" strokeWidth="1.1" />
                <path d="m231 152 42-66 39 29-81 37Z" fill="#a6b49a" stroke="#607958" strokeWidth="1.1" />
                <path d="m248 142 25-39 22 16-47 23Z" fill="#eff1e3" stroke="#83957b" />
                <path d="m154 144 24 7v25l-24-7v-25Z" fill="#a7b9a0" stroke="#708a6a" />
                <path d="m166 148 0 25m-12-13 24 7" stroke="#eff2e4" />
                <path d="m193 161 24 7v40l-24-7v-40Z" fill="#4e6b52" stroke="#415e47" />
                <path d="m210 186 0 4" stroke="#d9d5b2" strokeWidth="2" strokeLinecap="round" />
                <path d="m251 159 28-15v24l-28 15v-24Z" fill="#9bae92" stroke="#708a6a" />
                <path d="m265 152 0 24m-14-5 28-15" stroke="#eff2e4" />
                <path d="m187 204 32 9-14 8-32-10 14-7Z" fill="#e8e9db" stroke="#9ca98c" />
              </g>
              <path d="M102 178v-32m0 18c-24 0-24-35-5-36 0-19 29-14 25 4 15 11 1 33-20 32Z" fill="#b7c79f" stroke="#8fa67a" />
              <path d="M102 176v-30m0 11-9-8m9 1 8-9" stroke="#718a5e" />
              <path d="M323 179v-24m0 12c-18 0-18-26-3-27 0-15 22-11 19 3 11 8 1 25-16 24Z" fill="#cad5b7" stroke="#9db18a" />
              <path d="M323 179v-27" stroke="#82986d" />
              <path d="M51 205h34m-17-17v34m291-180h21m-10-10v21" stroke="#9aaa86" strokeOpacity=".55" />
            </svg>
          </div>
          <div className={styles.artLabel}><span className={styles.artIcon}><House size={16} /></span><span>A little clarity.<small>A new perspective.</small></span><ArrowUpRight size={14} /></div>
        </div>
      </header>
      <ValuationForm />
    </section>
  );
}
