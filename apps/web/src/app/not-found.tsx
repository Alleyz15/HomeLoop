import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <section className={styles.page} data-not-found-page>
      <div className={styles.code} aria-hidden="true">404</div>
      <p className={styles.eyebrow}>PAGE NOT FOUND</p>
      <h1>This page has moved on.</h1>
      <p className={styles.copy}>
        The link may be out of date, or the page may no longer exist. You can
        return home and continue from there.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          <Home size={16} aria-hidden="true" />
          Go to HomeLoop
        </Link>
        <Link href="/login" className={styles.secondary}>
          <ArrowLeft size={16} aria-hidden="true" />
          Sign in
        </Link>
      </div>
    </section>
  );
}
