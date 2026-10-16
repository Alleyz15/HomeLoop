import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Check, Files } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { DecorativeFilm } from "@/components/decorative-film";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Your HomeLoop | HomeLoop" };

export default async function OwnerHomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/home");
  if (user.role === "admin") redirect("/admin");
  return <div className={styles.home} data-owner-home>
    <div className={styles.contours} aria-hidden="true"><i /><i /><i /></div>
    <section className={styles.intro} aria-labelledby="owner-home-heading">
      <p className={styles.eyebrow}><span className={styles.dot} />YOUR NEXT CHAPTER</p>
      <h1 id="owner-home-heading">Your move, <em>at a glance.</em></h1>
      <p>A clear view of where to begin, and what comes next.</p>
    </section>
    <section className={styles.records} aria-labelledby="records-heading" data-home-card="records">
      <span className={styles.recordsIcon}><Files size={26} strokeWidth={1.4} aria-hidden="true" /></span>
      <div><p className={styles.eyebrow}>YOUR RECORDS</p><h2 id="records-heading">Every case. <em>One clear view.</em></h2>
        <p className={styles.description}>Review your saved valuations and follow each application’s progress.</p></div>
      <Link prefetch={false} href="/dashboard" className={styles.button}>Manage Dashboard<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </section>
    <div className={styles.grid}>
      <section className={styles.actionCard} aria-labelledby="valuation-heading" data-home-card="valuation">
        <div className={styles.cardCopy}><p className={styles.eyebrow}>YOUR NEXT STEP</p><h2 id="valuation-heading">A new move <em>starts here.</em></h2><p className={styles.description}>Discover your current home’s preliminary value.</p></div>
        <DecorativeFilm name="journey" className={styles.film} src="/animations/homeloop-dashboard.mp4?v=1" poster="/animations/homeloop-dashboard-poster.png?v=1" />
        <div className={styles.cardBottom}><Link href="/valuation" className={styles.button}>Start Free Valuation<ArrowUpRight size={17} aria-hidden="true" /></Link><p className={styles.noObligation}><Check size={13} aria-hidden="true" />Preliminary estimate. No obligation to proceed.</p></div>
      </section>
      <section className={`${styles.actionCard} ${styles.galleryCard}`} aria-labelledby="new-home-heading" data-home-card="gallery">
        <div className={styles.cardCopy}><p className={styles.eyebrow}>ROOM FOR WHAT’S NEXT</p><h2 id="new-home-heading">Find your <em>next address.</em></h2><p className={styles.description}>Explore new Sime Darby Property developments.</p></div>
        <DecorativeFilm name="gallery" className={styles.film} src="/animations/homeloop-gallery.mp4?v=1" poster="/animations/homeloop-gallery-poster.png?v=1" />
        <div className={styles.cardBottom}><button type="button" className={styles.button} disabled aria-describedby="catalogue-availability">Explore SDP Homes<ArrowUpRight size={17} aria-hidden="true" /></button><p id="catalogue-availability" className={styles.comingNext}>Property catalogue · coming in its own phase</p></div>
      </section>
    </div>
  </div>;
}
