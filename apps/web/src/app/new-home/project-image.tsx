"use client";
import { useState } from "react";
import { Building2 } from "lucide-react";
import styles from "./catalogue.module.css";

export function ProjectImage({ src, project, caption = "Artist’s impression", eager = false }: { src: string | null; project: string; caption?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={styles.photo} data-project-image>
    <div className={styles.photoFallback} aria-hidden={!!src && !failed}><Building2 size={36} strokeWidth={1} aria-hidden="true" /><span>{src && !failed ? "Loading project image…" : "Project imagery unavailable"}</span></div>
    {src && !failed && <img src={src} alt={`${project} — SDP ${caption.toLowerCase()}`} width={700} height={440} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />}
    {src && !failed && <span className={styles.imageLabel}>{caption}</span>}
  </div>;
}
