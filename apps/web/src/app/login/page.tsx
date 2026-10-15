import { redirect } from "next/navigation";

import { getSessionUser, landingPathFor } from "@/lib/auth";

import { AuthForm } from "./auth-form";
import { AuthScene } from "./auth-scene";
import styles from "./login.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    redirect(landingPathFor(user.role));
  }

  const { next } = await searchParams;

  return (
    <section className={styles.page} data-auth-page aria-label="HomeLoop account">
      <div className={styles.background} aria-hidden="true">
        <svg viewBox="0 0 1160 900" fill="none" className={styles.contours} preserveAspectRatio="xMidYMid slice">
          <g stroke="#9eb585" strokeWidth="1">
            <path d="M-70 900V480A400 400 0 0 1 730 480V900" />
            <path d="M-25 900V480A355 355 0 0 1 685 480V900" />
            <path d="M20 900V480A310 310 0 0 1 640 480V900" />
            <path d="M65 900V480A265 265 0 0 1 595 480V900" />
            <path d="M110 900V480A220 220 0 0 1 550 480V900" />
          </g>
          <path className={styles.lightTrail} pathLength="1" d="M20 900V480A310 310 0 0 1 640 480V900" stroke="#88a965" strokeWidth="2" />
        </svg>
      </div>
      <div className={styles.introduction}>
        <p className={styles.eyebrow}><span /> A CLEARER WAY HOME</p>
        <h2 className={styles.headline}>Welcome back.<br />Your <em>next chapter</em><br />{" "}awaits.</h2>
        <p className={styles.description}>A little less uncertainty. More possibility.<br />Pick up your journey to your next SDP home.</p>

        <div className={styles.illustration} aria-hidden="true">
          <AuthScene />
        </div>
      </div>
      <div className={styles.card}>
        <AuthForm next={next ?? ""} />
      </div>
    </section>
  );
}
