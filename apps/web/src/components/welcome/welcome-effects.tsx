"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "@/app/welcome.module.css";

/** Progressive enhancement: all server-rendered text is visible without JS. */
export function WelcomeEffects({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;

    const configure = () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      if (preference.matches || !("IntersectionObserver" in window)) {
        root.querySelectorAll("[data-reveal], [data-draw-line]").forEach((element) => {
          element.setAttribute("data-revealed", "true");
        });
        return;
      }
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (!entry.isIntersecting || element.dataset.revealed === "true") return;
          element.dataset.revealed = "true";
          observer?.unobserve(element);
          if (!element.hasAttribute("data-reveal")) return;
          const animation = element.animate(
            [{ transform: "translateY(28px)", opacity: 0.35 }, { transform: "translateY(0)", opacity: 1 }],
            { duration: 650, delay: Number(element.dataset.revealDelay ?? 0), easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" },
          );
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -24px 0px" });
      root.querySelectorAll("[data-reveal], [data-draw-line]").forEach((element) => {
        if (element.getAttribute("data-revealed") !== "true") observer?.observe(element);
      });
    };
    configure();
    preference.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", configure);
    };
  }, []);

  return <div ref={rootRef} className={styles.welcome} data-welcome-page>{children}</div>;
}
