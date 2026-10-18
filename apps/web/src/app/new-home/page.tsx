import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin, Search, SlidersHorizontal, Compass, CircleAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { getJourneyValuation } from "@/lib/development";
import { developmentHref } from "@/lib/development-model";
import { catalogueView, catalogueHref, cataloguePrice, catalogueSize, catalogueCheckedDate, officialProjectUrl } from "@/lib/catalogue-model";
import sources from "../../../public/catalogue/sources.json";
import { ProjectImage } from "./project-image";
import { ValuationContext } from "./valuation-context";
import styles from "./catalogue.module.css";

export const metadata: Metadata = { title: "Explore SDP Homes | HomeLoop" };
const images: Record<string, { src: string; sourcePage: string; caption?: string }> = sources;
const heroImage = images["Serenia Baleria 1 & 2"]?.src;

export default async function NewHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/new-home");
  if (user.role === "admin") redirect("/admin");
  const [data, params] = await Promise.all([getCatalogue(), searchParams]);
  const context = await getJourneyValuation(typeof params.valuation === "string" ? params.valuation : undefined, user.id);
  const valuationId = context.valuation?.id;
  const view = catalogueView(data.launches, params);
  const { filters } = view;
  return <div className={styles.catalogue} data-catalogue-page>
    <div className={styles.backdrop} aria-hidden="true"><i /><i /></div>
    <Link href="/home" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" />Back to Home</Link>
    <section className={styles.hero} aria-labelledby="catalogue-heading">
      <div className={styles.heroCopy}><p className={styles.eyebrow}>EXPLORE SDP HOMES</p><h1 id="catalogue-heading">Find a place for<br /><em>your next chapter.</em></h1><p>Explore new developments. Find room for what comes next.</p><span className={styles.heroNote}>A little space to imagine more.</span></div>
      <div className={styles.panorama}>
        <div className={styles.shutters} aria-hidden="true" data-photo-shutters>
          {[0, 1, 2].map((strip) => <div key={strip} className={styles.shutter} style={{ "--strip": strip } as CSSProperties}><div className={styles.photoStrip} style={{ backgroundImage: heroImage ? `url("${heroImage}")` : undefined }} /></div>)}
        </div>
        <p><a href="https://www.simedarbyproperty.com/serenia-city/serenia-baleria/" target="_blank" rel="noopener noreferrer">Serenia Baleria · SDP imagery</a> · Artist’s impression</p>
      </div>
    </section>
    <ValuationContext context={context} />
    {data.error ? <section className={styles.error} role="alert"><CircleAlert size={30} strokeWidth={1.3} aria-hidden="true" /><h2>Let’s reconnect to the catalogue.</h2><p>We couldn’t load the developments. Please try again; this does not mean there are no projects.</p><a href={catalogueHref(filters, valuationId)} className={styles.button}>Try again<ArrowUpRight size={16} aria-hidden="true" /></a></section> : <>
      <nav className={styles.tabs} aria-label="Development categories" data-tier={filters.tier}>
        {([['selling', 'Available developments'], ['upcoming', 'Coming soon']] as const).map(([tier, label]) => <a key={tier} href={catalogueHref({ ...filters, tier }, valuationId)} aria-current={filters.tier === tier ? "page" : undefined}>{label}<span>{view.counts[tier]}</span></a>)}
      </nav>
      <form action="/new-home" method="get" role="search" className={styles.filters} key={JSON.stringify(filters)}>
        {filters.tier === "upcoming" && <input type="hidden" name="tier" value="upcoming" />}
        {valuationId && <input type="hidden" name="valuation" value={valuationId} />}
        <div className={styles.searchField}><label htmlFor="catalogue-search">Search developments</label><div><Search size={17} aria-hidden="true" /><input id="catalogue-search" name="q" type="search" maxLength={100} defaultValue={filters.query} placeholder="Search project or township" /></div></div>
        <div className={styles.selectField}><label htmlFor="catalogue-location">Location</label><select id="catalogue-location" name="location" defaultValue={filters.location}><option value="">All locations</option>{view.locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></div>
        <div className={styles.selectField}><label htmlFor="catalogue-type">Home type</label><select id="catalogue-type" name="type" defaultValue={filters.type}><option value="all">All home types</option><option value="landed">Landed</option><option value="high-rise">High-rise</option></select></div>
        <button type="submit" className={styles.filterButton}><SlidersHorizontal size={14} aria-hidden="true" />Apply</button>
        <a className={styles.reset} href={catalogueHref({ tier: filters.tier, query: "", location: "", type: "all" }, valuationId)}>Reset</a>
      </form>
      <div className={styles.resultsHeading}><p role="status"><strong>{view.rows.length}</strong> {view.rows.length === 1 ? "development" : "developments"} to explore</p><span>Catalogue listings · not live unit availability</span></div>
      {view.rows.length ? <section className={styles.grid} aria-label="SDP developments">
        {view.rows.map((launch, index) => {
          const url = officialProjectUrl(launch.project_url);
          const image = images[launch.project];
          const src = image && url === officialProjectUrl(image.sourcePage) ? image.src : null;
          const price = cataloguePrice(launch.price_from_rm);
          return <article key={launch.id} className={styles.card} data-launch={launch.id} style={{ "--delay": `${Math.min(index, 5) * 65}ms` } as CSSProperties}>
            <ProjectImage src={src} project={launch.project} caption={image?.caption} eager={index < 3} />
            <div className={styles.cardContent}><h2>{launch.project}</h2><p className={styles.location}><MapPin size={13} aria-hidden="true" />{[launch.township, launch.area].filter(Boolean).join(" · ") || "Location not published"}</p>
              <div className={styles.chips}>{launch.property_type && <span>{launch.property_type}</span>}{launch.tenure && <span>{launch.tenure}</span>}</div>
              <p className={styles.size}>{catalogueSize(launch)}</p>
              {launch.expected_completion && <p className={styles.completion}>Published completion: {launch.expected_completion}</p>}
              <div className={styles.price}>{price ? <><span>{launch.tier === "upcoming" ? "Indicative from" : "From"}</span><strong>{price}</strong></> : <strong className={styles.unpriced}>Contact sales for pricing</strong>}</div>
              {valuationId ? <Link className={styles.button} href={developmentHref(launch.id, valuationId)} aria-label={`View development: ${launch.project}`}>View development<ArrowUpRight size={15} aria-hidden="true" /></Link> : url ? <a className={styles.button} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${launch.tier === "upcoming" ? "View launch updates" : "View development"}: ${launch.project} (opens SDP website in a new tab)`}>{launch.tier === "upcoming" ? "View launch updates" : "View development"}<ArrowUpRight size={15} aria-hidden="true" /></a> : <span className={styles.unavailable}>Project link unavailable</span>}
              <p className={styles.cardNote}>{catalogueCheckedDate(launch.checked_on)} · {valuationId ? "Explore details in HomeLoop" : url ? "Opens SDP website" : "Details to be confirmed"}</p>
            </div>
          </article>;
        })}
      </section> : <section className={styles.empty}><Compass size={34} strokeWidth={1.2} aria-hidden="true" /><h2>A different view might be the one.</h2><p>{view.counts[filters.tier] ? "No developments match these filters. Try another location or home type." : "No developments are listed in this category yet. Check the other category or visit again later."}</p><a href={catalogueHref({ tier: filters.tier, query: "", location: "", type: "all" }, valuationId)}>Clear filters<ArrowUpRight size={15} aria-hidden="true" /></a></section>}
      <aside className={styles.sourceNote}><span>EXPLORE WITH CLARITY</span><p>Prices and availability are subject to confirmation with SDP sales galleries. Starting prices are not a quotation for a specific unit. Project imagery is sourced from SDP and may be an artist’s impression, not a completed-home photograph.</p><p>Browse freely here. Opening a development does not reserve a home or submit an application.</p></aside>
    </>}
  </div>;
}
