"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./adviser.module.css";

/** Decorative 2.5D puppet: independently articulated raster head, torso and arm. */
export function PlanAdviser({ plan = null }: { plan?: "A" | "B" | null }) {
  const [failed, setFailed] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className={styles.stage} data-plan={plan ?? "none"} data-adviser={failed ? "unavailable" : "ready"} data-motion={motionReady ? "ready" : "static"} aria-hidden="true">
      <div className={styles.halo} />
      {!failed && (
        <div className={styles.figure}>
          <div className={styles.breath} data-adviser-layer="breath">
            <div className={styles.armDirection} data-adviser-layer="gesture">
              <div className={styles.arm}>
                <Image src="/plans/adviser/arm.webp" alt="" fill sizes="230px" onError={() => setFailed(true)} draggable={false} />
              </div>
            </div>
            <div className={styles.torso} data-adviser-layer="torso">
              <Image src="/plans/adviser/torso.webp" alt="" fill sizes="300px" onError={() => setFailed(true)} draggable={false} />
            </div>
            <div className={styles.headDirection} data-adviser-layer="head-turn">
              <div className={styles.head}>
                <Image src="/plans/adviser/head.webp" alt="" fill sizes="250px" onError={() => setFailed(true)} draggable={false} />
                <div className={styles.blink} data-adviser-layer="blink">
                  <Image src="/plans/adviser/head-blink.webp" alt="" fill sizes="250px" onError={() => setFailed(true)} draggable={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
