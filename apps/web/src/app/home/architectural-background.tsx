import styles from "./home.module.css";

// Decorative only: CSS animates the SVG without hydration, timers or user data.
export function ArchitecturalBackground() {
  return <div className={styles.canvas} aria-hidden="true" data-home-background>
    <div className={`${styles.glow} ${styles.sageGlow}`} />
    <div className={`${styles.glow} ${styles.creamGlow}`} />
    <div className={styles.paperGrid} />
    <svg className={styles.blueprint} viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
      <g className={styles.floorPlan}>
        <path d="M-30 235H116V339H63V422H-30 M-30 248H103V326H50V409H-30 M22 248V295H103 M22 295V326H50 M50 366H103V422 M63 339H116V459H-30 M22 295H-30 M63 389H116" />
        <path d="M116 277H160 M138 257V297 M-10 459V494H116V480 M-10 487H116" />
        <path d="M103 295A32 32 0 0 0 71 263V295 M63 366A27 27 0 0 1 90 339H63" />
      </g>
      <g className={`${styles.floorPlan} ${styles.rightPlan}`}>
        <path d="M1465 390H1336V505H1380V592H1465 M1465 404H1350V491H1394V578H1465 M1350 447H1412V404 M1412 447V491H1465 M1336 505V626H1465 M1336 553H1380 M1394 536H1465" />
        <path d="M1336 429H1294 M1315 408V450 M1350 447A31 31 0 0 1 1381 416V447" />
      </g>
      <g className={styles.elevation}>
        <path d="M1020 172H1318 M1040 172V98L1100 69L1160 98V172 M1050 172V106L1100 82L1150 106V172 M1160 112H1288V172 M1172 123H1276V172 M1070 172V125H1090V172 M1110 172V125H1130V172 M1194 123V172 M1221 123V172 M1248 123V172 M1040 185H1288 M1040 180V190 M1288 180V190" />
      </g>
      <g className={styles.registrationMarks}>
        <path d="M150 192V206 M143 199H157 M1289 698V712 M1282 705H1296 M79 664V678 M72 671H86" />
        <circle cx="150" cy="199" r="13" /><circle cx="1289" cy="705" r="13" />
      </g>
      <path className={styles.tracing} pathLength="1" d="M-30 235H116V339H63V422H-30 M116 339V459H-30" />
      <path className={`${styles.tracing} ${styles.rightTrace}`} pathLength="1" d="M1465 390H1336V505H1380V592H1465 M1336 505V626H1465" />
      <path className={styles.connection} d="M180 278C92 278 139 367 98 394S89 508 180 508H692Q720 508 720 552V765" />
      <path className={styles.traveller} pathLength="100" d="M180 278C92 278 139 367 98 394S89 508 180 508H692Q720 508 720 552V765" />
    </svg>
  </div>;
}
