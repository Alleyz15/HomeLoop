import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin, Ruler, KeyRound, CalendarDays, CircleAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { catalogueHref, catalogueSize, catalogueCheckedDate, officialProjectUrl } from "@/lib/catalogue-model";
import { getJourneyValuation } from "@/lib/development";
import { publishedLayouts } from "@/lib/development-model";
import sources from "../../../../public/catalogue/sources.json";
import { ProjectImage } from "../project-image";
import { ValuationContext } from "../valuation-context";
import { PricePanel } from "./price-panel";
import styles from "./development.module.css";

export const metadata: Metadata = { title: "Development details | HomeLoop" };
const images: Record<string, { src: string; sourcePage: string; caption?: string }> = sources;

export default async function DevelopmentPage({ params, searchParams }: {
  params: Promise<{ project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/new-home");
  if (user.role === "admin") redirect("/admin");
  const [{ project }, query] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(project) || !Number.isSafeInteger(Number(project))) notFound();
  const valuationId = typeof query.valuation === "string" ? query.valuation : undefined;
  const [catalogue, context] = await Promise.all([getCatalogue(), getJourneyValuation(valuationId, user.id)]);
  const back = catalogueHref({ tier: "selling", query: "", location: "", type: "all" }, context.valuation?.id);
  if (catalogue.error) return <section className={styles.page} data-development-page><Link href={back} className={styles.back}><ArrowLeft size={14} />Back to developments</Link><div className={styles.notice} role="alert"><CircleAlert size={24} /><h1>Let’s reconnect to this development.</h1><p>The catalogue couldn’t be loaded. Refresh to try again; this does not mean the project is unavailable.</p></div></section>;
  const launch = catalogue.launches.find(row => row.id === Number(project) && ["selling", "upcoming"].includes(row.tier));
  if (!launch) notFound();
  const url = officialProjectUrl(launch.project_url);
  const image = images[launch.project];
  const src = image && url && url === officialProjectUrl(image.sourcePage) ? image.src : null;
  const layouts = publishedLayouts(launch.project, url);
  return <div className={styles.page} data-development-page>
    <div className={styles.backdrop} aria-hidden="true"><i /><i /></div>
    <Link href={catalogueHref({ tier: launch.tier === "upcoming" ? "upcoming" : "selling", query: "", location: "", type: "all" }, context.valuation?.id)} className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Back to developments</Link>
    <div className={styles.layout}>
      <section className={styles.overview} aria-labelledby="development-title">
        <p className={styles.eyebrow}>A LITTLE CLOSER TO WHAT’S NEXT</p>
        <h1 id="development-title">{launch.project}</h1>
        <p className={styles.location}><MapPin size={15} aria-hidden="true" />{[launch.township, launch.area, launch.state].filter(Boolean).join(" · ") || "Location not published"}</p>
        <div className={styles.chips}><span>{launch.tier === "upcoming" ? "Coming soon" : "Available development"}</span>{launch.property_type && <span>{launch.property_type}</span>}</div>
        <div className={styles.imageFrame} data-focus-reveal><ProjectImage src={src} project={launch.project} caption={image?.caption} eager /><span className={styles.focusMark} aria-hidden="true" /></div>
        <dl className={styles.facts}>
          <div><dt><Ruler size={17} aria-hidden="true" />Built-up</dt><dd>{catalogueSize(launch)}</dd></div>
          <div><dt><KeyRound size={17} aria-hidden="true" />Tenure</dt><dd>{launch.tenure || "Not published"}</dd></div>
          <div><dt><CalendarDays size={17} aria-hidden="true" />Expected completion</dt><dd>{launch.expected_completion || "Not published"}</dd></div>
        </dl>
        <ValuationContext context={context} />
        {context.state === "none" && <aside className={styles.notice}><h2>A closer look, at your pace.</h2><p>You’re browsing without a saved valuation. Start from a valuation result to see how this home’s price compares with your current home.</p></aside>}
        <p className={styles.source}>{catalogueCheckedDate(launch.checked_on)}{url && <> · <a href={url} target="_blank" rel="noopener noreferrer">Official SDP development page<ArrowUpRight size={12} aria-hidden="true" /></a></>}</p>
      </section>
      <PricePanel key={`${launch.id}-${context.valuation?.id ?? context.state}`} launch={launch} layouts={layouts.layouts} layoutSource={layouts.source} context={context} />
    </div>
    <p className={styles.disclaimer}>A place to explore, not a reservation. Project imagery is sourced from SDP and may show an artist’s impression. Availability, eligibility, layout details and prices must be confirmed with SDP sales. Nothing on this page submits an application or reserves a unit.</p>
  </div>;
}
