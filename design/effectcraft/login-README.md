# Sign in — the doorway to your next chapter

Original HomeLoop scene authored/rendered in EffectCraft 0.10.0. Separate from
the Welcome assets; no stock footage, AI imagery or new runtime dependency.

- `login-journey.jsx`: reproducible source with native editable gradient/SVG
  layers, Trim Paths, and a real Classic 3D leaf pivoted on its left hinge.
- `login-journey.ecproj`: editable native project.
- `../../apps/web/public/animations/homeloop-login.mp4`: 960 × 600, H.264,
  24 fps, 14 seconds, muted, 3,078,812 bytes.
- `../../apps/web/public/animations/homeloop-login-poster.png`: final scene at
  8 seconds, 120,804 bytes; fallback for reduced motion, JS/video/autoplay failure.

Rebuild from the repository root with `effectcraft-cli` on PATH:

```powershell
effectcraft-cli script design/effectcraft/login-journey.jsx --empty --save-as design/effectcraft/login-journey.ecproj
effectcraft-cli render-frame --project design/effectcraft/login-journey.ecproj --comp "HomeLoop Sign In" --time 8 --out apps/web/public/animations/homeloop-login-poster.png
effectcraft-cli render --project design/effectcraft/login-journey.ecproj --comp "HomeLoop Sign In" --out apps/web/public/animations/homeloop-login.mp4 --format h264 --fps 24 --start 0 --end 14 --audio off
```

Seconds 0–1.8 draw the architectural outline and reveal the layered arch/frame.
From approximately 1.8–6.8 seconds (rounded to 24 fps), the door rotates inward
from 0° to −58° on its Y axis. The handle belongs to the same 3D layer, so it
cannot drift away from the leaf. The bright interior is physically uncovered
by the rotating leaf; the floor-light wedge widens and its shadow turns in
the same interval. A CSS camera settle gently approaches over eight seconds.
Seconds 8–14 match at both ends: only reflected light and shadow intensity move.
The door stays open; it never repeatedly closes or restarts on its own.
The webpage plays the entrance once, then seeks to 8 seconds at each end.
It offers no manual playback controls. Asset URLs use `v=2` to invalidate the
superseded isometric garden film/poster; increment on replacement.

`apps/web/src/app/login/auth-scene.tsx` supplies progressive media enhancement
and fine-pointer depth. CSS adds nested arch contours, travelling light and
broad sage gradients. The door and background move at different depths; the form never
moves with the pointer. Reduced motion immediately removes the video, resets
pointer depth and disables CSS motion; an initially reduced preference makes
no video request. On mobile the same complete doorway fits into a compact header.

Run `node scripts/check_login.mjs` with the production app running. Optional
environment variables: `WELCOME_BASE_URL`, `WELCOME_PLAYWRIGHT_MODULE`, and
`LOGIN_ARTIFACT_DIR`. Tests cover decoded doorway frames, interior-light reveal,
the door remaining open, automatic looping,
pointer reset/form stability, responsive layouts and static fallback, alongside
existing form checks that stop before Supabase calls. No accounts are created.
