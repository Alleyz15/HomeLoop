"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "@/app/welcome.module.css";

export function JourneyVisual() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setMotionAllowed(!preference.matches);
      setAmbient(false);
      if (preference.matches) setPlaying(false);
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !motionAllowed) return;
    void video.play().catch(() => undefined);
    return () => video.pause();
  }, [motionAllowed]);

  useEffect(() => {
    const scene = sceneRef.current?.closest<HTMLElement>("[data-hero-scene]");
    if (!scene) return;
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const reset = () => {
      scene.style.setProperty("--scene-x", "0px");
      scene.style.setProperty("--scene-y", "0px");
      scene.style.setProperty("--scene-rx", "0deg");
      scene.style.setProperty("--scene-ry", "0deg");
    };
    if (!motionAllowed || !playing) { reset(); return; }
    const move = (event: PointerEvent) => {
      if (!pointer.matches) return;
      const rect = scene.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty("--scene-x", `${x * 8}px`);
        scene.style.setProperty("--scene-y", `${y * 6}px`);
        scene.style.setProperty("--scene-rx", `${-y * 2}deg`);
        scene.style.setProperty("--scene-ry", `${x * 2.5}deg`);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); reset(); };
    scene.addEventListener("pointermove", move);
    scene.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", leave);
      reset();
    };
  }, [motionAllowed, playing]);

  function playAmbient() {
    const video = videoRef.current;
    if (!video) return;
    setAmbient(true);
    // The last four seconds are matched at the ends: trees sway, windows warm,
    // and the houses stay assembled. Never replay construction automatically.
    video.currentTime = 9;
    void video.play().catch(() => setPlaying(false));
  }

  return (
    <div ref={sceneRef} className={styles.journey} data-motion-active={motionAllowed && playing} data-scene-phase={ambient ? "ambient" : "intro"}>
      <div className={styles.journeyStage}>
      <Image
        className={styles.journeyPoster}
        src="/animations/homeloop-journey-poster.png?v=2"
        alt="Two illustrated homes connected by a garden path, representing the journey from your current home to your next one."
        width={760} height={700} priority
      />
      {motionAllowed && !failed ? (
        <>
          <video
            ref={videoRef} className={styles.journeyVideo}
            src="/animations/homeloop-journey.mp4?v=2" poster="/animations/homeloop-journey-poster.png?v=2"
            muted playsInline preload="none" aria-hidden="true" tabIndex={-1}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={playAmbient}
            onError={() => setFailed(true)}
          />
        </>
      ) : null}
      </div>
    </div>
  );
}
