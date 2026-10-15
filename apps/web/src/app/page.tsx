import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Check, ChartNoAxesCombined,
  ClipboardCheck, House, MoveUpRight, Route, ScanLine, ShieldCheck,
} from "lucide-react";

import { JourneyVisual } from "@/components/welcome/journey-visual";
import { WelcomeEffects } from "@/components/welcome/welcome-effects";
import { getSessionUser, landingPathFor } from "@/lib/auth";

import styles from "./welcome.module.css";

const STEPS = [
  { icon: ScanLine, title: "Know your home's value", text: "Start with a free preliminary estimate, backed by real nearby transactions." },
  { icon: House, title: "Find your next address", text: "Explore a new SDP home and see what the move could mean for your budget." },
  { icon: Route, title: "Choose your way forward", text: "Compare a direct purchase with a guaranteed price floor. See the details clearly." },
  { icon: ClipboardCheck, title: "Make your move", text: "Apply online. Your trade-in team reviews your home, and you track each next step." },
] as const;

export default async function HomePage() {
  const user = await getSessionUser();
  const startHref = user ? landingPathFor(user.role) : "/login?next=/valuation";
  const startLabel = user
    ? user.role === "admin" ? "Open applications" : "Go to my Dashboard"
    : "Value my home for free";

  return (
    <WelcomeEffects>
      <section className={styles.hero} aria-labelledby="welcome-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.liveDot} /> A clearer path to your next SDP home</p>
          <h1 id="welcome-heading" className={styles.heroHeading}>
            Your <em>next chapter</em><br />starts with the<br />home you own.
          </h1>
          <p className={styles.heroDescription}>
            Discover your current home&apos;s estimated value, explore a new
            Sime Darby Property home, and find a clearer way to bridge the two.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={startHref}>
              {startLabel}<ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <p className={styles.noObligation}><Check size={14} aria-hidden="true" /> Free preliminary valuation. No obligation to proceed.</p>
          <div className={styles.heroFootnote}>
            <span className={styles.footnoteLine} /> A home is more than an address. So is your next move.
          </div>
        </div>
        <div className={styles.heroVisual} data-hero-scene>
          <div className={styles.visualTopline}>
            <span>ROOM FOR WHAT&apos;S NEXT</span><MoveUpRight size={20} aria-hidden="true" />
          </div>
          <JourneyVisual />
          <div className={styles.currentHomeLabel}><span /> YOUR CURRENT HOME</div>
          <div className={styles.nextHomeLabel}><span /> YOUR NEXT CHAPTER</div>
          <div className={styles.visualNote}>
            <span className={styles.noteIcon}><Route size={23} strokeWidth={1.5} aria-hidden="true" /></span>
            <div><strong>Two homes. One connected journey.</strong><p>A little less uncertainty. More possibility.</p></div>
          </div>
        </div>
      </section>

      <section className={styles.benefits} aria-label="Why HomeLoop">
        <div data-reveal><span className={styles.benefitIcon}><ChartNoAxesCombined size={22} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Clarity, from the start</h2><p>Estimates grounded in NAPIC sales data.</p></div></div>
        <div data-reveal data-reveal-delay="100"><span className={styles.benefitIcon}><ShieldCheck size={22} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Options you can understand</h2><p>Clear calculations. Human-reviewed offers.</p></div></div>
        <div data-reveal data-reveal-delay="200"><span className={styles.benefitIcon}><Route size={22} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>A move you can follow</h2><p>Your next step, all in one place.</p></div></div>
      </section>

      <section id="how-it-works" className={styles.howSection} aria-labelledby="how-heading">
        <div className={styles.sectionIntro}>
          <div><p className={styles.eyebrow}>THE WAY FORWARD</p><h2 id="how-heading" className={styles.sectionHeading}>One move.<br /><em>Four clear steps.</em></h2></div>
          <p className={styles.sectionDescription}>From “what is my home worth?” to “what&apos;s next?”<br />A simpler journey, with you in control.</p>
        </div>
        <ol className={styles.steps} data-draw-line>
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className={styles.step} data-reveal data-reveal-delay={index * 110}>
              <div className={styles.stepTop}><span className={styles.stepNumber}>0{index + 1}</span><Icon size={27} strokeWidth={1.3} aria-hidden="true" /></div>
              <h3>{title}</h3><p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="our-plans" className={styles.plansSection} aria-labelledby="plans-heading">
        <div className={styles.sectionIntro}>
          <div><p className={styles.eyebrow}>A CHOICE THAT FITS YOUR LIFE</p><h2 id="plans-heading" className={styles.sectionHeading}>Your move.<br /><em>Your way forward.</em></h2></div>
          <p className={styles.sectionDescription}>Choose a new SDP home, then compare two ways<br />to move on from the one you own.</p>
        </div>
        <div className={styles.planGrid}>
          <article className={`${styles.planCard} ${styles.directPlan}`} data-reveal>
            <div className={styles.planTop}><span className={styles.planTag}>PLAN A</span><House size={29} strokeWidth={1.3} aria-hidden="true" /></div>
            <h3>A direct purchase.<br /><em>A clearer next step.</em></h3>
            <p>Let SDP purchase your eligible home directly, with an offer based on a registered valuer&apos;s formal valuation.</p>
            <ul><li><Check size={16} aria-hidden="true" /> No waiting for an open-market buyer</li><li><Check size={16} aria-hidden="true" /> Explore the deposit-offset arrangement</li></ul>
            <div className={styles.planBottom}><span>For eligible homes in SDP townships</span><ArrowUpRight size={21} aria-hidden="true" /></div>
          </article>
          <article className={`${styles.planCard} ${styles.guaranteePlan}`} data-reveal data-reveal-delay="130">
            <div className={styles.planTop}><span className={styles.planTag}>PLAN B</span><ShieldCheck size={29} strokeWidth={1.3} aria-hidden="true" /></div>
            <h3>More room to sell.<br /><em>A floor to fall back on.</em></h3>
            <p>Sell on the open market with an agreed minimum price and a fallback purchase if the guarantee conditions are met.</p>
            <ul><li><Check size={16} aria-hidden="true" /> Pursue an open-market sale</li><li><Check size={16} aria-hidden="true" /> Keep an agreed price floor</li></ul>
            <div className={styles.planBottom}><span>For eligible landed homes in supported districts</span><ArrowUpRight size={21} aria-hidden="true" /></div>
          </article>
        </div>
        <p className={styles.planCaveat}>Both plans are for homeowners moving to a new SDP home. Eligibility, inspection and offer terms apply. Deposit offset is a design assumption subject to legal review.</p>
      </section>

      <section className={styles.finalCta} aria-labelledby="start-heading" data-draw-line>
        <svg className={styles.ctaRoute} viewBox="0 0 420 320" fill="none" aria-hidden="true">
          <path pathLength="1" d="M30 320C-60 150 230 280 190 160C135 5 420 130 440-20" />
          <path pathLength="1" d="M63 330C-25 165 265 295 225 175C170 20 455 145 475-5" />
        </svg>
        <div><p className={styles.ctaEyebrow}>A FRESH START, WITH A LITTLE MORE CLARITY</p><h2 id="start-heading">Start with a clearer picture<br />of your home&apos;s value.</h2><p>Your next chapter can begin with one simple step.</p></div>
        <Link href={startHref} className={styles.limeButton}>
          {user ? startLabel : "Get my free valuation"}<ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </WelcomeEffects>
  );
}
