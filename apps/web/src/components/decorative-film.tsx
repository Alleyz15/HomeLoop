"use client";

import { useEffect, useRef, useState } from "react";

/** Shared muted decoration. No data, controls, or video request in reduced motion. */
export function DecorativeFilm({ name, src, poster, className }: { name: string; src: string; poster: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowed(!preference.matches);
    update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (!video || !allowed || failed) return;
    void video.play().catch(() => setFailed(true));
    return () => video.pause();
  }, [allowed, failed]);
  return <div className={className} aria-hidden="true" data-film={name} data-motion-active={allowed && !failed} style={{ backgroundImage: `url('${poster}')` }}>
    {allowed && !failed ? <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" tabIndex={-1} onError={() => setFailed(true)} /> : null}
  </div>;
}
