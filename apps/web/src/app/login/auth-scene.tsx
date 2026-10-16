"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./login.module.css";

export function AuthScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ambient, setAmbient] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setMotionAllowed(!preference.matches);
      setAmbient(false);
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !motionAllowed || failed) return;
    void video.play().catch(() => setFailed(true));
    return () => video.pause();
  }, [motionAllowed, failed]);

  useEffect(() => {
    const page = rootRef.current?.closest<HTMLElement>("[data-auth-page]");
    if (!page) return;
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const reset = () => {
      page.style.setProperty("--auth-x", "0px");
      page.style.setProperty("--auth-y", "0px");
    };
    reset();
    if (!motionAllowed || !playing || failed) return;
    const move = (event: PointerEvent) => {
      if (!pointer.matches) return;
      const rect = page.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        page.style.setProperty("--auth-x", `${x * 12}px`);
        page.style.setProperty("--auth-y", `${y * 9}px`);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); reset(); };
    page.addEventListener("pointermove", move);
    page.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerleave", leave);
      reset();
    };
  }, [motionAllowed, playing, failed]);

  function continueAmbient() {
    const video = videoRef.current;
    if (!video) return;
    setAmbient(true);
    video.currentTime = 8;
    void video.play().catch(() => setFailed(true));
  }

  return (
    <div ref={rootRef} className={styles.scene} data-auth-scene data-motion-active={motionAllowed && !failed}
      data-phase={ambient ? "ambient" : "intro"} aria-hidden="true">
      <div className={styles.sceneDepth}>
        <div className={styles.sceneCamera}>
        <Image src="/animations/homeloop-login-poster.png?v=2" alt=""
          width={960} height={600} priority sizes="(max-width: 700px) 340px, 640px"
          className={styles.scenePoster} />
        {motionAllowed && !failed ? (
          <video ref={videoRef} className={styles.sceneVideo}
            src="/animations/homeloop-login.mp4?v=2"
            poster="/animations/homeloop-login-poster.png?v=2"
            muted playsInline preload="none" tabIndex={-1}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={continueAmbient} onError={() => setFailed(true)} />
        ) : null}
        </div>
      </div>
    </div>
  );
}
