# Dashboard motion source

Original HomeLoop artwork authored in EffectCraft 0.10.0, independent of the
Welcome houses and Sign-in doorway. No external stock, property photos, or AI
imagery. The film is decorative; all status labels and progress are real HTML.

- `dashboard-journey.jsx`: reproducible source with moving contours, floating
  layered landmarks, breathing orbits and three lights travelling along a route.
- `dashboard-journey.ecproj`: generated editable native project.
- `../../apps/web/public/animations/homeloop-dashboard.mp4`: 720 × 260 H.264,
  24 fps, 12-second seamless loop, no audio.
- `../../apps/web/public/animations/homeloop-dashboard-poster.png`: frame at 4s.

Run from the repository root, with the downloaded EffectCraft CLI on PATH:

```powershell
effectcraft-cli script design/effectcraft/dashboard-journey.jsx --empty --save-as design/effectcraft/dashboard-journey.ecproj
effectcraft-cli render-frame --project design/effectcraft/dashboard-journey.ecproj --comp "HomeLoop Dashboard" --time 4 --out apps/web/public/animations/homeloop-dashboard-poster.png
effectcraft-cli render --project design/effectcraft/dashboard-journey.ecproj --comp "HomeLoop Dashboard" --out apps/web/public/animations/homeloop-dashboard.mp4 --format h264 --fps 24 --start 0 --end 12 --audio off
```

The client mounts the muted looping video only when reduced motion is not
requested. Preference changes remove/remount playback; autoplay/media errors
retain the poster. No pause/replay buttons. CSS independently animates the
page entrance, progress-line reveal, active-stage pulse and architectural
background. Financial values never count up or drift. No motion library added.

QA: `node --test scripts/dashboard.test.mjs` and
`node scripts/check_dashboard.mjs`. Browser QA needs Playwright and Edge; set
`WELCOME_PLAYWRIGHT_MODULE` if Playwright is installed outside the repo.
It builds a local-only auth/data stub configuration, restores the normal build
in `finally`, and never creates real accounts or writes hosted records. Stop
the normal frontend before running it. Screenshots default to the gitignored
`apps/web/.next/dashboard-qa` folder; set `DASHBOARD_ARTIFACT_DIR` to retain them
outside the build directory while the final production build is restored.
