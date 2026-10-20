export const CASE_SECTIONS = [
  { id: "property", label: "Property & valuation" },
  { id: "plan", label: "Plan & findings" },
  { id: "messages", label: "Owner messages" },
  { id: "photos", label: "Photos" },
  { id: "audit", label: "Internal audit" },
] as const;
export type CaseSection = typeof CASE_SECTIONS[number]["id"];
export function caseSection(value: unknown): CaseSection {
  return CASE_SECTIONS.some(section => section.id === value) ? value as CaseSection : "property";
}
/** Only called with an already validated local case URL. */
export function sectionHref(href: string, section: CaseSection) {
  const url = new URL(href, "http://homeloop.local");
  url.searchParams.set("tab", section);
  return url.pathname + url.search;
}
