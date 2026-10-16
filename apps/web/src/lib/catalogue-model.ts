export type CatalogueLaunch = {
  id: number; tier: string; project: string; township: string | null;
  area: string | null; state: string | null; category: string | null;
  property_type: string | null; price_from_rm: number | null;
  built_up_min_sqft: number | null; built_up_max_sqft: number | null;
  tenure: string | null; expected_completion: string | null;
  project_url: string | null; checked_on: string | null;
};
export type CatalogueFilters = { tier: "selling" | "upcoming"; query: string; location: string; type: "all" | "landed" | "high-rise" };

export function officialProjectUrl(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && ["www.simedarbyproperty.com", "simedarbyproperty.com"].includes(url.hostname)
      && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export function catalogueView(launches: CatalogueLaunch[], params: Record<string, string | string[] | undefined>) {
  const text = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const visible = launches.filter((launch) => ["selling", "upcoming"].includes(launch.tier)
    && Number.isSafeInteger(launch.id) && launch.id > 0 && !!launch.project.trim());
  const locations = [...new Set(visible.map((launch) => launch.township).filter((value): value is string => !!value))].sort();
  const filters: CatalogueFilters = {
    tier: text("tier") === "upcoming" ? "upcoming" : "selling",
    query: text("q").trim().slice(0, 100),
    location: locations.includes(text("location")) ? text("location") : "",
    type: ["landed", "high-rise"].includes(text("type")) ? text("type") as "landed" | "high-rise" : "all",
  };
  const query = filters.query.toLocaleLowerCase("en-MY");
  const rows = visible.filter((launch) => launch.tier === filters.tier
    && (!filters.location || launch.township === filters.location)
    && (filters.type === "all" || launch.category === filters.type)
    && (!query || [launch.project, launch.township, launch.area, launch.state].join(" ").toLocaleLowerCase("en-MY").includes(query)))
    .sort((a, b) => a.project.localeCompare(b.project) || a.id - b.id);
  return { rows, filters, locations, counts: {
    selling: visible.filter((launch) => launch.tier === "selling").length,
    upcoming: visible.filter((launch) => launch.tier === "upcoming").length,
  } };
}

export function catalogueHref(filters: CatalogueFilters, valuationId?: string) {
  const params = new URLSearchParams();
  if (filters.tier === "upcoming") params.set("tier", "upcoming");
  if (filters.query) params.set("q", filters.query);
  if (filters.location) params.set("location", filters.location);
  if (filters.type !== "all") params.set("type", filters.type);
  if (valuationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valuationId)) params.set("valuation", valuationId);
  return "/new-home" + (params.size ? "?" + params.toString() : "");
}

const positive = (value: number | null) => value != null && Number.isFinite(Number(value)) && Number(value) > 0;
const numberLabel = (value: number) => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(value);
export function cataloguePrice(amount: number | null) {
  return positive(amount) ? `RM${numberLabel(Number(amount))}` : null;
}
export function catalogueSize(launch: Pick<CatalogueLaunch, "built_up_min_sqft" | "built_up_max_sqft">) {
  const low = launch.built_up_min_sqft, high = launch.built_up_max_sqft;
  if (positive(low) && positive(high) && Number(high) > Number(low)) return `${numberLabel(Number(low))}–${numberLabel(Number(high))} sq ft`;
  if (positive(low)) return `From ${numberLabel(Number(low))} sq ft`;
  if (positive(high)) return `Up to ${numberLabel(Number(high))} sq ft`;
  return "Size not published";
}
export function catalogueCheckedDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Check date not recorded";
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Check date not recorded";
  return "Checked " + new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(date);
}
