"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, Home, ImageIcon, LockKeyhole, MessageSquare } from "lucide-react";
import { CASE_SECTIONS, sectionHref, type CaseSection } from "./sections";
import styles from "./detail.module.css";

const ICONS = [Home, FileText, MessageSquare, ImageIcon, LockKeyhole];
export function EvidenceTabs({ initial, href, panels }: { initial: CaseSection; href: string; panels: Record<CaseSection, ReactNode> }) {
  const [active, setActive] = useState(initial);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);
  function select(section: CaseSection) {
    setActive(section);
    // Replace, rather than navigate: keep unsent forms and open evidence intact.
    window.history.replaceState(window.history.state, "", sectionHref(window.location.pathname + window.location.search, section));
  }
  return <section className={styles.evidenceWorkspace} aria-label="Application evidence">
    <div className={styles.tabScroll}><nav className={styles.tabs} role="tablist" aria-label="Case evidence sections">
      {CASE_SECTIONS.map((section, index) => { const Icon = ICONS[index]; return <a key={section.id} ref={element => { links.current[index] = element; }}
        id={`tab-${section.id}`} role="tab" aria-selected={active === section.id} aria-controls={`panel-${section.id}`} tabIndex={active === section.id ? 0 : -1}
        href={sectionHref(href, section.id)} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); select(section.id); }}
        onKeyDown={event => { let next: number; if (event.key === " ") next = index; else if (event.key === "ArrowRight") next = (index + 1) % CASE_SECTIONS.length; else if (event.key === "ArrowLeft") next = (index + CASE_SECTIONS.length - 1) % CASE_SECTIONS.length; else if (event.key === "Home") next = 0; else if (event.key === "End") next = CASE_SECTIONS.length - 1; else return; event.preventDefault(); select(CASE_SECTIONS[next].id); links.current[next]?.focus(); }}>
        <Icon size={16} strokeWidth={1.6} aria-hidden="true" /><span>{section.label}</span>
      </a>; })}
    </nav></div>
    {CASE_SECTIONS.map(section => <div key={section.id} id={`panel-${section.id}`} className={styles.tabPanel} role="tabpanel" aria-labelledby={`tab-${section.id}`} hidden={active !== section.id} tabIndex={0}>{panels[section.id]}</div>)}
  </section>;
}
