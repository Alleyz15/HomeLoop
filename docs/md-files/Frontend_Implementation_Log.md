# HomeLoop Frontend Implementation Log

Last updated: 2026-10-16 (Asia/Kuala_Lumpur)

This file records frontend work by phase and action: what changed, which files were affected, bugs or gaps found, verification results, and commit references. It includes server-side Next.js helpers because they support the frontend journey. Backend implementations are included only as integration dependencies.

Product authority: [HomeLoop_更新_页面与流程.md](HomeLoop_更新_页面与流程.md). Overall progress: [Task_track.md](Task_track.md).

## How to maintain this log

- Update the relevant action after implementation or investigation. Add a new action for later fixes rather than overwriting the history of the original work.
- Record the date, actual changes, repository-relative affected paths, bugs found or “none recorded,” verification commands/results, and commit hash.
- Separate implemented code from live verification and deployment. A helper being complete does not mean its screen is complete.
- Mark uncommitted changes as “pending commit”; replace that label after the commit exists. Never invent a commit hash or a test result.
- Historical results below come from commit messages and the task tracker. They have not all been reproduced in this workspace.
- For planned actions, “files” means existing integration points or proposed paths, not files already modified.

## Phase summary

| Phase | Current status | Remaining work |
|---|---|---|
| F0 — Frontend foundation and API helpers | Implemented | Use the helpers in the remaining screens |
| F1 — Shared layout and authentication | Implemented; signed-in checks pending | Verify owner/admin login and role redirects with real sessions |
| F2 — Homeowner journey | Home + multi-record Dashboard implemented; remaining journey partial | Photos, new-home selection, plans, submission/full application details and offer controls; live-account integration checks |
| F3 — Admin journey | Role guard and helpers implemented; screens pending | Applications panel, application details, risk simulator |
| F4 — Integration, QA and delivery | In progress | Resolve open contracts, build checks, browser QA and complete demo flow |

## F0 — Foundation and frontend integration helpers

### F0-01 — Application shell and shared UI

- Date / commits: 2026-10-13; `03e0580`, dependency update `87de5e6`.
- Changes: created the Next.js application, TypeScript/Tailwind configuration, shared UI primitives, application layout, placeholder pages, and Supabase browser/server clients; subsequently upgraded the Next.js 15 patch version.
- Affected files: `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/web/postcss.config.mjs`, `apps/web/components.json`, `apps/web/.env.example`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/components/ui/*`, `apps/web/src/components/placeholder-page.tsx`, `apps/web/src/lib/utils.ts`, `apps/web/src/lib/supabase/{client,server}.ts`, initial page and middleware files.
- Bugs / gaps: placeholder routes are scaffolding, not finished product screens. `/guide` and `src/lib/guide/index.ts` remain placeholders.
- Result / verification: source and Git history confirm the foundation exists. See F1/F2 for later recorded build results; no separate scaffold execution log was found.

### F0-02 — Server-only valuation and plan API boundary

- Date / commits: 2026-10-14; `85a5e48`, `83caf6a`, contract update `d5056d7`.
- Changes: added the `server-only` boundary, typed valuation/road-search/plan contracts, internal-key HTTP requests, API error handling, and plan range types; reflected the unsupported-property-type response in the web contract.
- Affected files: `apps/web/src/lib/valuation.ts`, `apps/web/.env.example`, `.env.example`.
- Bugs / gaps: internal API credentials must remain server-side. The existence of `quotePlans()` did not implement a Plans screen or call it from a page.
- Result / verification: helper implementations exist; actual valuation UI use is recorded in F2-02. Plan request rounding is recorded separately in F2-05.

### F0-03 — Application workflow RPC wrappers

- Date / commits: 2026-10-14; `4a77305`, submission contract refinement `f772eaf`.
- Changes: added typed wrappers for submission, review, information requests, indicative quotes, inspection, formal offers, owner responses, expiry, completion tracking and admin flags. Calls use the signed-in Supabase server client.
- Affected file: `apps/web/src/lib/applications.ts`.
- Bugs / gaps: wrappers exist without owner/admin workflow screens. Insufficient-data submission conflicts with the product specification; see FE-BUG-02.
- Result / verification: source confirms the wrapper layer. The tracker records 56 passing B4 database tests historically; that is backend evidence, not browser verification of these actions.

### F0-04 — Risk-simulation API contract

- Date / commit: 2026-10-14; `3f1ea2f`.
- Changes: added `simulate()` and typed simulation parameters, risk results and histogram output for the future admin simulator.
- Affected file: `apps/web/src/lib/valuation.ts`.
- Bugs / gaps: RM outputs use different valuation bases; the simulator UI must label the chosen basis or lead with percentages. No simulator screen exists yet.
- Result / verification: helper exists. Backend tests and historical data checks are recorded in Task_track B6; no frontend simulator interaction has been verified.

## F1 — Shared layout and authentication

Implementation commit for F1-01 through F1-03: `c8d1fe2` (2026-10-15).

### F1-01 — Database role lookup and navigation

- Changes: added `getSessionUser()` and role-based landing paths; read roles from `profiles.role`, default missing/unrecognized roles to `owner`, render guest/owner/admin navigation, email and sign-out controls.
- Affected files: `apps/web/src/lib/auth.ts`, `apps/web/src/app/layout.tsx`.
- Bugs / gaps: no new bug recorded for the role lookup. The admin navigation includes a simulator route whose page is not implemented; see FE-GAP-01.
- Result: role-aware layout implemented; Act 242 footer retained.

### F1-02 — Login, registration and logout

- Changes: added email/password Server Actions, sign-in/register UI, form state, password length validation, generic sign-in failures, redirect-path filtering and an email-confirmation notice when registration returns no session.
- Affected files: `apps/web/src/app/auth/actions.ts`, `apps/web/src/app/auth/state.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/auth-form.tsx`.
- Bug found and fixed historically: exporting state objects from a `"use server"` module caused a build failure. Auth state was moved to `state.ts`. The analogous valuation module is an open finding in FE-BUG-04.
- Result: authentication UI/actions implemented; real-session verification remains pending in the tracker.

### F1-02a — Consistent Sign in presentation and interactions

- Date / commit: 2026-10-16; approved UI implementation, locally verified; pending commit.
- Layout action: replaced the plain login card with the Welcome page's ivory/forest-green/sage palette, serif heading, desktop split layout and compact mobile illustration. Added a decorative architectural grid, soft background glow and original code-native SVG homes/garden with a dotted connection, gently swaying trees and warm windows.
- Form action: kept the existing Sign in/Create account modes and Server Actions. Added a sliding tab indicator, keyboard tab navigation, password visibility toggle preserving the value, focus/hover/pressed transitions, spinner/loading labels, disabled controls while submitting and styled existing error/notice messages. Reduced motion disables decorative motion and transitions, including live preference changes.
- Affected files: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/auth-form.tsx`, new `apps/web/src/app/login/login.module.css`, narrowly scoped auth-shell rules in `apps/web/src/app/globals.css`, new `scripts/check_login.mjs`, this log and `docs/md-files/Task_track.md`.
- Scope / bugs: no new feature beyond the approved design; no Google login, password recovery, extra registration fields, new dependencies, backend/auth action changes or database/configuration changes. Existing `next` handling and 8-character registration rule retained. Visual review found a missing space between “chapter” and “awaits” when the desktop line break was hidden on mobile; fixed it and added a regression assertion. No new backend bug recorded.
- Verification: final `npm run build` passed, including lint and TypeScript (login route 5.04 kB, first-load JS 123 kB). `node scripts/check_login.mjs` passed in headless Edge: palette, preserved `next`, visibility/value toggle, keyboard tabs, required/min-length rules, actual local Server Action errors, pending/disabled feedback, both modes at 1440/768/390/320 px without overflow, visible focus, initial/live reduced motion and no runtime errors. `node scripts/check_welcome.mjs` regression checks also passed. Desktop/mobile screenshots were visually reviewed and saved under the session visualization folder `homeloop-login`; `git diff --check` passed. Browser submissions use only empty sign-in and short-password registration, returning from local validation before Supabase calls; no accounts or real credentials were used. Real successful owner/admin authentication remains unverified; no commit or deployment performed. Preview: `http://127.0.0.1:3000/login?next=/valuation`.

### F1-02b — Cinematic Sign in scene and fuller animated background

- Date / commit: 2026-10-16; user-approved animation upgrade, implemented and locally verified; pending commit. Supersedes F1-02a's flat SVG scene without changing the form layout, copy, colour palette or authentication.
- EffectCraft action: authored a separate dimensional scene with two isometric houses, a veranda, planted terraces, layered foliage, rising walls, settling roofs, native Trim Paths/travelling marker, arrival ripple, warm windows and camera settle. Retained reproducible source and editable native project; rendered a 960 × 600, 24 fps, 14-second muted H.264 film (3,747,662 bytes) and 8-second poster (95,894 bytes). Seconds 0–8 introduce the scene; seconds 8–14 have matched ambient endpoints and repeat without rebuilding the houses.
- Page/background action: replaced only the old scene with progressive media; expanded architectural contours, moving sage gradients and travelling light across the composition; added independent foreground foliage and fine-pointer depth at different layer speeds. The form never follows the pointer. Refined existing tab/content transitions and input glow; no new controls/features. Mobile uses the same scene cropped into a compact header.
- Affected files: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/login.module.css`, new `apps/web/src/app/login/auth-scene.tsx`, new `apps/web/public/animations/{homeloop-login.mp4,homeloop-login-poster.png}`, new `design/effectcraft/{login-journey.jsx,login-journey.ecproj,login-README.md}`, expanded `scripts/check_login.mjs`, this log and `docs/md-files/Task_track.md`. Welcome source/assets and authentication actions/configuration were not changed in this revision.
- Fallback/safety action: initial reduced motion makes no MP4 request; live preference changes remove the video and reset depth immediately. Video/autoplay failure and disabled JavaScript retain the rendered still. No manual playback controls, new dependencies, account creation or database changes.
- Verification: `npm run build` passed including lint/TypeScript (login 5.25 kB, first-load JS 130 kB). Expanded `node scripts/check_login.mjs` passed: decoded 960 × 600 film, five distinct assembly/arrival frames, automatic playback/8-second ambient seek, pointer depth/reset without shifting the form, existing local validation/loading/error/tab/password interactions, both modes at 1440/768/390/320 px without overflow, initial/live reduced motion, no-video/no-JS fallbacks and no runtime errors. `node scripts/check_welcome.mjs` regression and `git diff --check` passed. Rendered story frames plus desktop/mobile screenshots visually reviewed; artifacts in the session visualization folder `homeloop-login-motion` and `homeloop-login-motion-story-*.png`.
- Bugs/limitations: no new authentication/backend bug recorded. Actual successful account sign-in remains outside this motion-only revision; validation tests stop before Supabase calls. Preview: `http://127.0.0.1:3000/login?next=/valuation`. No commit or deployment performed.

### F1-02c — Approved slowly opening doorway replaces the garden

- Date / commit: 2026-10-16; user approved the doorway picture and slow-opening sequence; implemented and locally verified; pending commit. Supersedes F1-02b's house/garden model.
- Artwork action: rebuilt the existing EffectCraft source/project as a layered sage/ivory arch and forest-green arched door. A native Classic 3D Y-axis rotation pivots the door and its attached handle on the left hinge: 0° to −58° over five seconds (approximately 1.8–6.8 seconds, rounded to 24 fps). The bright interior is uncovered by the leaf; a coordinated floor-light wedge widens and the shadow turns. Outline entrance precedes opening; the door stays open during the matched 8–14 second reflected-light/shadow loop. Media remains 960 × 600, 24 fps, 14 seconds, muted; replacement MP4 3,078,812 bytes, 8-second poster 120,804 bytes.
- Page action: replaced garden contours with nested arch outlines, removed the old foliage and scene-specific “Two homes” caption as shown in the approved preview, retained the main copy/form/palette and moving sage background. Added a gentle eight-second camera approach, kept fine-pointer depth and the stationary form, fit the whole doorway into the mobile header, and cache-versioned replacement media to `v=2`.
- Affected files: `apps/web/src/app/login/{page.tsx,auth-scene.tsx,login.module.css}`, `apps/web/public/animations/{homeloop-login.mp4,homeloop-login-poster.png}`, `design/effectcraft/{login-journey.jsx,login-journey.ecproj,login-README.md}`, `scripts/check_login.mjs`, this log and `docs/md-files/Task_track.md`. No Welcome source/assets, authentication actions, database/settings or dependencies changed for this action.
- Bugs/refinements: visual review found the opaque film boundary against the background grid; added two-axis feathering to blend it into the page. Preserved initial/live reduced motion, no-video/no-JS/poster fallback and automatic playback without controls. No new backend/auth bug found.
- Verification: final feathered production `npm run build` passed, including lint/TypeScript (login 4.9 kB, first-load JS 129 kB). Expanded `node scripts/check_login.mjs` passed in Edge: distinct decoded opening frames, increasing revealed-interior brightness, the door remaining open late in the film, ambient seek, fixed form during pointer depth, existing local validation/loading/errors, both modes at 1440/768/390/320 px without overflow, reduced-motion/live-stop, video/JS failure fallbacks and no runtime errors. Welcome regression and `git diff --check` passed. EffectCraft property inspection confirmed the 0°→−58° native hinge keyframes. Closed/half-open/open rendered frames and final desktop/mobile screenshots were reviewed; artifacts in the session visualization folder `homeloop-doorway` and `doorway-{closed,opening}.png`. Preview: `http://127.0.0.1:3000/login?next=/valuation`. No real account/authentication mutations, commit or deployment performed.

### F1-03 — Session and admin route protection

- Changes: protected `/dashboard`, `/valuation`, `/new-home`, `/plans`, `/apply` and `/admin` prefixes; preserved the destination in `next`; added a database-role check in the admin layout that redirects owners to `/dashboard`.
- Affected files: `apps/web/src/middleware.ts`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/page.tsx` (placeholder).
- Bugs / gaps: no separate authorization bug confirmed in this inspection. Signed-in owner/admin behavior still needs live testing.
- Result / historical verification for F1: commit message and tracker report clean build, TypeScript and ESLint checks; unauthenticated protected-route redirects and public routes were checked against the live project. Those results have not been rerun here.

### F1-04 — Role-aware login destinations and public/application navigation

- Date / commit: 2026-10-16; approved targeted bug fix, implemented and locally verified; pending commit.
- Bugs found: `next=/valuation` took precedence over the admin landing page after successful login (FE-BUG-06). The shared role-aware header and `/` logo links appeared on Welcome while the session remained active, contrary to the intended public-page header (FE-BUG-07). Neither behavior meant the login/session had failed.
- Redirect action: added pure shared routing helpers; admins always land on `/admin`; owners may resume only normalized homeowner routes, otherwise `/dashboard`. Reused the policy after sign-in/registration and when an already signed-in user opens `/login`. Role lookup remains server-side from `profiles.role`, not editable JWT/user metadata.
- Header/logo action: moved the existing navigation markup, labels and classes into a pathname-aware presentation component. Public pages show brand-only navigation; application pages retain role navigation/email/sign-out. Both header/footer logos return to the role landing page inside the application and `/` on public pages. Visiting Welcome hides controls without destroying the session; Back/Forward updates the header.
- Affected files: `apps/web/src/app/{layout.tsx,auth/actions.ts,login/page.tsx}`, `apps/web/src/lib/auth.ts`, new `apps/web/src/lib/auth-routing.ts`, new `apps/web/src/components/site-navigation.tsx`, new `scripts/{auth_navigation.test.mjs,check_auth_navigation.mjs}`, this log and `docs/md-files/Task_track.md`.
- Verification: `node --test scripts/auth_navigation.test.mjs scripts/quote_plans.test.mjs` passed all five tests (four new navigation/state tests and the existing rounding regression). The actual production Next.js login actions/layouts passed successful owner/admin browser journeys against a local auth/profile stub: intended redirects, owner valuation hydration/one-character search validation, both logos, clean Welcome while retaining the session, Back/Forward, signed-in `/login`, owner denial of `/admin`, and explicit sign-out. No browser runtime errors. `node scripts/check_auth_navigation.mjs` restored the original production build in `finally`, including lint/TypeScript; a bundle scan confirmed no test auth key remained. Final `check_login.mjs` and `check_welcome.mjs` production regressions passed (animations, form states, responsive/reduced-motion/fallback checks); `git diff --check` passed. No application test bypass or real-account changes. Screenshots: session visualization folder `auth-fix`. Normal preview running at `http://127.0.0.1:3000`.
- Scope/limitations: no styling/animation, passwords, database/settings, application workflow or admin-screen implementation changes. Middleware/admin authorization guards are retained. Real demo passwords were not configured, so live owner/admin credentials were not tested. The existing absent `/admin/simulator` page remains FE-GAP-01; unrelated console warnings/404s were not treated as this valuation crash.

## F2 — Homeowner journey

### F2-01 — Welcome page

- Date / commit: 2026-10-15; `f4597bf`.
- Changes: replaced the welcome placeholder with the HomeLoop proposition, free-valuation/sign-in links, and a role-based dashboard link for signed-in users.
- Affected file: `apps/web/src/app/page.tsx`.
- Bugs / gaps: none separately recorded for this action.
- Result: welcome content implemented; destination Dashboard remains a placeholder.

### F2-01a — Approved Welcome-page design and EffectCraft animation

- Date / commit: 2026-10-16; implemented and locally verified, pending commit. This is the Welcome page only; it does not complete the remaining homeowner/admin phases.
- Content / changes: replaced the plain introduction with an ivory/forest-green landing page, editorial heading, three benefits, four workflow steps, introductory Plan A/B cards, and a final valuation CTA. Guest navigation scrolls to the explanation/plan sections; existing owner/admin navigation remains. Guests continue through `/login?next=/valuation`; owner/admin CTAs use their existing landing routes. Kept English copy, eligibility context, prototype identification and the original Act 242 disclaimer.
- Affected page/shell files: `apps/web/src/app/page.tsx`, `apps/web/src/app/welcome.module.css` (new), `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`.
- EffectCraft action: authored original SVG house/garden shapes through the installed EffectCraft 0.10.0 CLI, imported them into native layers, and added opacity/position keyframes. Rendered a six-second 760 × 700 H.264 animation at 24 fps and a still at 3.6 seconds. Video is 434,810 bytes; poster is 58,499 bytes. Used the CLI directly; no MCP connection was configured.
- Affected artwork files: `design/effectcraft/welcome-journey.jsx`, `design/effectcraft/welcome-journey.ecproj`, `design/effectcraft/README.md`, `apps/web/public/animations/homeloop-journey.mp4`, `apps/web/public/animations/homeloop-journey-poster.png` (all new).
- Playback / accessibility changes: new `apps/web/src/components/welcome/journey-visual.tsx` plays the muted entrance once, offers pause/play/replay, avoids requesting video for reduced motion, and retains the poster on video failure. Added keyboard skip navigation, visible focus styles, decorative icon handling and responsive layouts.
- Bugs / refinements found: the initial page-level opacity entrance made the hero too faint during transitions/screenshots. Removed opacity from that entrance so the headline is visible immediately, while preserving subtle movement and the EffectCraft animation. Increased supporting text sizes after visual review. No backend, schema or authentication implementation changes were needed.
- Verification: `npm run lint` passed. Final production `npm run build` passed, including lint and TypeScript validation (home route 8.7 kB; first-load JS 115 kB). Sandbox font/file restrictions and a Next.js telemetry config rename required running the build with approved permissions and `NEXT_TELEMETRY_DISABLED=1`; these were environment issues.
- Browser checks: new `scripts/check_welcome.mjs` passed against the production server in headless Microsoft Edge. Verified guest copy, CTA destination and actual login click-through, section anchors, four steps/two plans, Act 242 footer, MP4 decoding, pause/play/replay, and layouts at 1440/768/390/320 px without horizontal overflow. Reduced-motion mode loads a decoded still and makes no MP4 request; blocked video retains the artwork; keyboard skip works; no browser runtime errors were observed.
- Review artifacts: desktop/full-page/mobile/reduced-motion PNGs saved outside the repository under the session visualization folder, `homeloop-welcome`. Build preview runs at `http://127.0.0.1:3000`.
- Limitations: signed-in owner/admin CTA branches were reviewed in source but not exercised with real accounts. Other workflow screens are still pending. No commit or deployment performed; unrelated pre-existing `.env.example` edits were preserved. Also update `Task_track.md` for this phase.

### F2-01b — Richer cinematic scene and interactive page motion

- Date / commit: 2026-10-16; user-approved motion revision, implemented and locally verified, pending commit. Theme, marketing copy, eligibility text and navigation destinations retained.
- EffectCraft action: split the houses into separate walls, roofs, windows and details; animate the landscape unfolding, walls rising, roofs dropping/settling, garden growth, a native Bezier/Trim Paths connection and travelling marker, arrival ripple, warmer windows and roof glint. Parent the artwork to a keyframed rig for a coherent push-in. Rebuilt the native `.ecproj`, MP4 and poster through EffectCraft 0.10.0.
- Scene timing / assets: 760 × 700, 24 fps, 13 seconds total. Seconds 0–9 tell the moving-home story; seconds 9–13 form the matched garden/window loop. MP4: 1,524,859 bytes; 9-second poster: 71,238 bytes. Source and reproduction instructions remain in `design/effectcraft/welcome-journey.jsx` and `design/effectcraft/README.md`.
- Web interaction action: added fine-pointer parallax to the artwork, labels and floating note; pause resets pointer offsets. The ending loops without automatically rebuilding the houses; a separate replay action restarts the journey. Added one-time, staggered scroll reveals, a drawing workflow connector, plan-card/icon hover movement and a decorative path drawing behind the final CTA.
- Affected implementation files: `apps/web/src/components/welcome/journey-visual.tsx`, new `apps/web/src/components/welcome/welcome-effects.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/welcome.module.css`; regenerated `apps/web/public/animations/{homeloop-journey.mp4,homeloop-journey-poster.png}` and updated all three `design/effectcraft` source/project/documentation files. Extended `scripts/check_welcome.mjs`; updated this log and `Task_track.md`.
- Edge cases handled: cache-versioned the replacement assets (`v=2`); keep playback controls outside the moving artwork; reset scene phase when motion preference changes; cancel reveals and remove the video immediately on reduced motion. Content stays visible without JavaScript, and a failed/blocked video retains the poster. No new runtime dependency or backend/auth change.
- Verification: final `npm run build` passed, including lint and TypeScript (home route 9.73 kB; first-load JS 116 kB). EffectCraft rendered story frames at 0.6, 1.5, 3.4, 5.4 and 8.8 seconds, which were visually inspected.
- Browser verification: expanded `node scripts/check_welcome.mjs` passed in headless Edge. Five decoded cinematic-frame hashes differ; ambient loop, pause stability, replay reset, pointer depth/reset, scroll/hover triggers and CTA path trigger passed. Desktop/tablet/390px/320px overflow checks, actual login click-through, section navigation, reduced-motion/no-video-load, runtime motion-preference changes, video failure, keyboard skip and JavaScript-disabled content all passed; no browser runtime errors.
- Artifacts / handoff: frame PNGs and refreshed browser screenshots in the session visualization folder under `homeloop-motion-v2`; production preview at `http://127.0.0.1:3000`. No commit or deployment performed. Real signed-in journeys remain outside this Welcome-page revision.

### F2-01c — Remove requested Welcome navigation and playback controls

- Date / commit: 2026-10-16; implemented and locally verified; pending commit.
- Navigation action: removed the guest header links “How it works”, “Our plans” and “Sign in”, plus the hero “See how it works” link and their link destinations. Kept the workflow/plan sections, valuation CTAs, login route required by those CTAs, and signed-in role navigation unchanged.
- Animation action: removed pause/play and replay buttons, their handlers and unused icon imports. Automatic entrance/ambient looping, pointer depth, reduced-motion behavior, fallback artwork, animation assets, styling and other content remain unchanged.
- Affected files: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/welcome/journey-visual.tsx`, `scripts/check_welcome.mjs`, `design/effectcraft/README.md`, this log and `docs/md-files/Task_track.md`.
- Bugs found: none recorded; this is a user-requested UI removal. Updated browser checks to assert the links/controls are absent and use scrolling instead of removed section links.
- Verification: `npm run build` passed, including lint and TypeScript. Updated `node scripts/check_welcome.mjs` passed in headless Edge: requested links/controls absent, automatic playback/ambient loop, distinct scene frames, pointer depth/reset, scroll/hover effects, valuation login destination, 1440/768/390/320 px layouts without overflow, reduced motion, video failure, keyboard skip and no-JavaScript content; no browser runtime errors. Screenshots saved under the session visualization folder `homeloop-cleanup`. No backend/auth implementation, dependency, commit or deployment changes.

### F2-02 — Valuation input and Server Actions

- Date / commit: 2026-10-15; `f4597bf`.
- Changes: implemented road search, scheme/district/SDP labels, road-specific property types, intermediate/corner/custom choices, typical-area display, manual sizes, m²/sq-ft conversion, terrace shortcuts, tenure controls, submission/loading states and API error messages. Passed the selected scheme with road information and invoked the protected API through Server Actions.
- Affected files: `apps/web/src/app/valuation/page.tsx`, `apps/web/src/app/valuation/valuation-form.tsx`, `apps/web/src/app/valuation/actions.ts`, `apps/web/src/lib/units.ts`.
- Bugs / gaps: automatic tenure selection is claimed in earlier documentation but is not connected in the current form (FE-BUG-03). Exported state objects require build verification (FE-BUG-04). Optional photos are pending. Intermediate units without typical sizes show manual inputs, but those values are not submitted under the current `needsSizes` condition (FE-BUG-05).
- Result: main form implemented; authenticated search → valuation → save → result has not been verified end to end in the tracker or this chat.

### F2-02a — Fix valuation initial-state browser crash

- Date / commit: 2026-10-16; approved targeted fix; implemented and locally verified; pending commit.
- Bug/action: the exact production chunk/column in the supplied console screenshot resolved to `search.results.length`. Exporting `emptyRoadSearch` and `emptyValuationForm` from a `"use server"` module compiled them into function references; isolated rendering reproduced the exact TypeError. Moved both plain state objects/types to `state.ts`; action code now imports types only, and the client imports the initial values from that ordinary module. No calculation, validation, sizing or valuation API behavior changed.
- Affected files: new `apps/web/src/app/valuation/state.ts`, `apps/web/src/app/valuation/actions.ts`, `apps/web/src/app/valuation/valuation-form.tsx`, regression tests listed in F1-04, this log and `docs/md-files/Task_track.md`.
- Verification/result: plain-object/array and server-module export checks passed; the production browser rendered valuation after successful isolated owner login and completed its local search validation without a crash. This confirms FE-BUG-04 was a browser-runtime bug despite previous clean builds. FE-BUG-02/03/05 remain unrelated and unchanged; no saved valuation/application was created by the tests.

### F2-03 — Save valuations and render results

- Date / commit: 2026-10-15; `f4597bf`.
- Changes: saved the signed-in user's valuation with comparables, returned the saved ID and redirected to `/valuation/result/[id]`; added owner-scoped retrieval, catalog metadata lookup, amount/range/confidence display, comparable table, insufficient-data copy and the non-SDP Plan B notice. Stored unpriced requests with null amounts.
- Affected files: `apps/web/src/lib/valuations.ts`, `apps/web/src/app/valuation/actions.ts`, `apps/web/src/app/valuation/result/[id]/page.tsx`, `apps/web/src/lib/units.ts`.
- Bug fixed historically: no frontend code previously wrote `valuation_requests`, so the application workflow had no saved valuation ID to reference.
- Open bug: result copy says an insufficient-data application can be submitted, but SQL rejects it (FE-BUG-02).
- Result / historical verification for F2-01 through F2-03: tracker reports build, TypeScript and ESLint passed and all 13 inserted columns/constraints were statically checked. Real-session end-to-end verification remains pending.

### F2-04 — AI explanation and loading experience

- Date / commits: 2026-10-15; initial integration `1a93777`, diagnostic types `04831ed`, `f8447bc`, contract enrichment `3474211`, streaming/loading `1fb3620`.
- Changes: added typed `explainValuation()` / `adminAssist()` calls and fallback diagnostics; passed property-type context; rendered the valuation explanation and distinguished LLM text from template output. Moved explanation work into an async component under Suspense so the AI request no longer blocks the valuation content. Added rotating loading phrases, animated dots, reduced-motion support and accessible status text. API failures omit the explanation card.
- Affected files: `apps/web/src/lib/valuation.ts`, `apps/web/src/app/valuation/result/[id]/page.tsx`, `apps/web/src/components/ai-thinking.tsx`.
- Bug / UX problem addressed: awaiting AI text in the main page delayed visible valuation results.
- Result / verification: source and tracker confirm the integration and streaming structure; browser timing/accessibility checks were not rerun in this chat. The admin phrase preset/helper exists, but the admin detail screen is pending.

### F2-05 — Whole-RM rounding before plan quotation

- Date / commit: 2026-10-15; pending commit (working-tree changes).
- Changes: inside `quotePlans()`, copy the input and apply `Math.round()` to `estimate`, `low` and `high` before serializing the request. Preserve original stored/input precision and all other fields. Backend formulas still round the calculated offers.
- Affected files: `apps/web/src/lib/valuation.ts` (implementation), `scripts/quote_plans.test.mjs` (new regression test), `docs/md-files/Task_track.md` (completion note).
- Bug found: passing RM785,635.36 directly produced Plan A RM616,724 and Plan B RM589,227; using the displayed whole-RM valuation RM785,635 produces RM616,723 and RM589,226. Earlier backend plan fixtures already used an integer and did not expose the input-rounding difference.
- Result: approved round → calculate → round policy implemented at the frontend API boundary. The Plans screen still has no caller, so this prepares its future integration.
- Verification executed in this chat: `node --test scripts/quote_plans.test.mjs` passed (one test; two helper calls). Checks cover all three outgoing amounts, a .5 boundary, already-rounded input, preserved original input/other fields, request URL/method/key and response forwarding. The test mocks HTTP and does not call a live API.
- Additional verification executed: imported the actual Python plan functions and asserted both raw-input and rounded-input Plan A/B outputs; passed. `git diff --check` passed.
- Limitation: full web build/lint could not run in this workspace because frontend dependencies are absent. No deploy or commit was performed.

### F2-06a — Dashboard screen and original moving artwork

- Date / commit: 2026-10-16 (Asia/Kuala_Lumpur); pending commit.
- Purpose / approval: build only the homeowner Dashboard screen, following section 5.6 and the approved ivory/forest-green theme. User explicitly requested more moving animation; destination pages are separate phases.
- Before → after: replaced the Dashboard placeholder with a responsive introduction, eight-stage journey, current-state next-step card, current-home/preparation card, selected/future-home card and footer reassurance. Mobile uses a vertical timeline. Unfinished destinations are disabled and labelled; existing valuation routes remain functional. No offer acceptance, upload, new-home selection, application-detail screen or admin screen was added.
- Motion: authored a new EffectCraft twelve-second film with moving contours, floating layered landmarks, pulsing rings and three travelling lights; rendered native editable project, MP4 and poster. Added staggered entrances, progress-line drawing, current-stage pulse, moving background arches, button hover/press and loading skeletons. Amounts remain static. No pause/replay controls. Reduced-motion changes stop decorative CSS/video movement; autoplay/media errors preserve the poster.
- Affected files: `apps/web/src/app/dashboard/{page.tsx,dashboard-screen.tsx,dashboard.module.css,journey-scene.tsx,loading.tsx}`, Dashboard-scoped rules in `apps/web/src/app/globals.css`, `design/effectcraft/dashboard-journey.{jsx,ecproj,md}`, `apps/web/public/animations/homeloop-dashboard.mp4`, `apps/web/public/animations/homeloop-dashboard-poster.png`.
- Bugs / scope: no unrelated visual changes intended. New-home/plan header links are hidden only on the Dashboard while those pages remain placeholders; the Dashboard explains their availability. Other routes retain their existing header presentation.
- Verification: EffectCraft project creation and frame/video rendering succeeded (720 × 260, 24 fps, 12 seconds). Production compilation, lint and TypeScript passed. Browser acceptance results recorded in F2-06c.

### F2-06b — Owner-scoped records and honest workflow summaries

- Date / commit: 2026-10-16; pending commit.
- Changes: added a server-only, session-client reader and a pure display model. Dashboard verifies the session and redirects admins to `/admin`. Reads the latest active application, otherwise the latest closed/completed application; aligns it with its referenced valuation rather than a newer unrelated one. Reads latest valuation for owners without applications. Uses explicit owner filters plus existing RLS; queries only required fields. Internal notes, photo paths and quote payloads are not selected.
- Display states: new, priced, insufficient data, all 20 application statuses, post-inspection information requests, signing pending/confirmed, Plan B selling sub-progress and closed journeys. Shows recorded ranges, offers, visit dates, requested-information/rejection reasons and selected project. Overdue `offer_sent`/`review_requested` records display as expired without calling a write/RPC. Dates are formatted in Asia/Kuala_Lumpur. Main read failures show retry rather than a false new-user screen; optional context failures display a warning.
- Affected files: `apps/web/src/lib/dashboard.ts`, `apps/web/src/lib/dashboard-model.ts`, Dashboard page/screen above.
- Bugs prevented / found: newer valuations must not overwrite an active application's property context; missing monetary values must not display RM0; stale stored offer statuses must not imply an expired offer is still actionable. Covered by regressions. No existing backend bug was modified.
- Remaining data limitations: guarantee-period deadline and actual settlement/net-proceeds fields are not available in this Dashboard contract, so no countdown or paid-out amount is invented. Unconfirmed future milestone dates say timing is to be confirmed. Offer response controls and detailed pages remain F2-11/later work by approval.
- Verification: `node --test scripts/dashboard.test.mjs scripts/auth_navigation.test.mjs scripts/quote_plans.test.mjs` passed all 12 tests (7 new Dashboard tests). Reader tests cover ownership, active/closed selection, linked valuations, excluded internal fields and primary/context/network failures. Tests use local doubles, not hosted user data.
- External changes: no migrations, database writes, credentials, Render, Vercel or Supabase configuration changes; no package/dependency additions.

### F2-06c — Dashboard browser and regression checks

- Date / commit: 2026-10-16; pending commit.
- Affected files: `scripts/dashboard.test.mjs`, `scripts/check_dashboard.mjs`, `scripts/check_auth_navigation.mjs`, this log and `docs/md-files/Task_track.md`.
- Changes: added local-only auth/data protocol-stub browser tests for the actual Next.js pages and actions, screenshots, owner/admin guards, workflow states, decoded animation frames, responsive overflow, runtime reduced motion and media-error fallback. Updated the existing auth-navigation stub to provide empty Dashboard reads for its new-owner account; no production auth code changed.
- Build setup finding: the first sandboxed production build hit EPERM in Next's user configuration directory. An approved build outside the sandbox with telemetry disabled passed. No application change was needed for that environment restriction.
- Production restoration: the browser harness restored the normal `.env`-configured production build successfully, including lint/TypeScript. A bundle scan found no Dashboard/auth test public keys. The sandboxed preview was not reachable by the outside browser; it was stopped and the normal preview restarted outside the sandbox on `http://127.0.0.1:3000`. This is a local server, not a deployment.
- Unrelated-page regression verification: `node scripts/check_login.mjs` and `node scripts/check_welcome.mjs` passed against the restored normal preview (including desktop/tablet/390/320px, existing animation playback, keyboard/validation, reduced motion, media failure and no-JavaScript fallbacks). Login smoke returned HTTP 200. `git diff --check` passed; Git only warned about its configured future LF-to-CRLF normalization.
- Browser verification: `node scripts/check_dashboard.mjs` passed all acceptance groups against the actual production Next.js frontend with local-only test auth/data. Covered new/priced/unpriced/review/information request/indicative/inspection/offer/overdue/Plan B/rejection/handover states; failed reads; 1440/768/390/320px widths for new and offer states; four distinct decoded video frames, muted loop and autoplay without controls; current-stage pulse; runtime reduced-motion toggling; media-error fallback; signed-out/admin redirects; explicit owner filters; no application writes; no browser runtime exceptions. Desktop new/offer and 390px new-user screenshots were inspected locally. These screenshots contain test records, not live customer data.
- Bug found and fixed: QA caught a real 4px horizontal overflow on 390px screens: the decorative backdrop used desktop 24px bleed while the shared mobile shell uses 20px padding. Fixed the Dashboard mobile inset; all four widths passed on rerun (FE-BUG-08). Two initial harness-only issues (loopback cookie origin and collision with Next's built-in `role=alert` announcer) were corrected without production auth changes. Screenshots wait for finite entrance animations to finish.
- Limitations: isolated tests do not prove hosted RLS policies or the full real owner/admin workflow. No real application records are created for screenshots. Full destination screens and user response actions remain intentionally unimplemented.

### F1-05 — Always-visible header and homeowner Home navigation

- Date / commit: 2026-10-16 (Asia/Kuala_Lumpur); pending commit.
- User-approved change: keep the header visible on every route, including Welcome. Remove owner header links for Dashboard, Valuation, New home and Plans; the latter remain internal workflow pages, not standalone header navigation. Admin links are unchanged.
- Changes: global sticky, opaque ivory header with appropriate stacking and anchor offset. Added authenticated `/home`; owner default landing and application header/footer brand links now target `/home`. Explicit safe `next` destinations still work. Updated the owner redirect out of `/admin` and the signed-in Welcome entry label. Public Welcome/login still hide account navigation and do not sign the user out.
- Affected files: `apps/web/src/app/globals.css`, `apps/web/src/components/site-navigation.tsx`, `apps/web/src/lib/auth-routing.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/page.tsx`, route/nav regression scripts.
- Bug fixed: New home/Plans links previously resurfaced when leaving the old Dashboard for Valuation because they were only hidden by Dashboard CSS. Owner links are now removed from the navigation definition, not conditionally hidden.
- Verification: routing/initial-state tests passed; Home browser checks passed sticky Welcome/owner headers, the default signed-in owner landing, brand navigation and absence of the four header links on Home/Valuation. Full owner/admin and Welcome/login regression results are recorded with F2-06f.

### F2-06d — Home first page, approved three-card design

- Date / commit: 2026-10-16; pending commit. Implemented and browser-verified before beginning F2-06e.
- Approved scope: replace the former single-case landing experience with `/home`: one full-width Your Records card with Manage Dashboard, then two equal-height cards (Your Next Step / Room For What's Next). Remove Your Current Home and the account-wide journey tracker. Do not implement drafts or resume unfinished form inputs.
- Changes: compact ivory/forest-green layout, real links to `/dashboard` and `/valuation`, page/button transitions and moving contour background. Reused the original travelling-path film on the left; authored a distinct EffectCraft architectural gallery on the right with three moving facade panels and sweeping light. Shared decorative film component provides muted loop, poster, autoplay/error fallback and live reduced-motion handling, without playback controls.
- Affected files: `apps/web/src/app/home/{page.tsx,home.module.css}`, `apps/web/src/components/decorative-film.tsx`, Home-scoped shell rules in `apps/web/src/app/globals.css`, `design/effectcraft/home-gallery.{jsx,ecproj,md}`, `apps/web/public/animations/homeloop-gallery.mp4`, `apps/web/public/animations/homeloop-gallery-poster.png`, `scripts/owner_home_checks.mjs`.
- Verification: production build/lint/TypeScript passed. Home-only browser run passed exactly three cards, equal desktop card heights, no vertical scrolling at 1366×768/1440×900/1920×1080, no horizontal overflow at 768/390/320px, three distinct decoded frames from each film, automatic muted looping/no controls, reduced motion and media fallback. Inspected 1366px desktop screenshot. The normal `.env` production build was restored after this first phase.
- Scope limits: catalogue is still a separate unimplemented screen, so Explore SDP Homes is visibly disabled with a reason. No fake listings, unfinished-form persistence, backend rule changes, database writes or service settings changes were added. Small screens and increased text size may scroll normally; no content is hidden to force a one-screen layout.

### F2-06e — Multi-record Dashboard and per-application Connected Journey

- Date / commit: 2026-10-16; pending commit. Implementation complete; full two-page browser acceptance passed.
- User-approved specification refinement: `/home` is the homeowner action page; `/dashboard` is the records page. This extends the original section 5.6 layout without changing the backend's one-active-submitted-application rule.
- Changes: four aggregate summary cards, search, status filters, ten-row pagination and mobile record cards. All saved applications are listed, plus standalone valuations not linked to an application; linked valuations are not counted again as separate records. No new case/draft entity is invented. Only actual handover counts as a completed move; attention-needed applications overlap with in-progress as labelled.
- Progress: opening an application expands only that application's eight-stage tracker and property/new-home/plan/status details beneath its row. Events are requested only after the ID matches an application in the owner's own visible collection; arbitrary/foreign/off-page IDs do not trigger event reads. Valuation-only rows open the existing valuation result, not a fabricated application tracker.
- Data/security: session-scoped read-only queries, explicit user filters on each collection batch, existing RLS, exact counts and batching past the API row cap. Event history is also batched and scoped to the selected owned application. Internal notes/payloads are never requested. Errors produce retry/context states, not false empty accounts or RM0 amounts; expiry presentation remains read-only. No schema, RPC or lifecycle-rule changes.
- Affected files: `apps/web/src/lib/owner-records{,-model}.ts`, `apps/web/src/app/dashboard/{page.tsx,dashboard-screen.tsx,dashboard.module.css,case-progress.tsx}`. Removed obsolete `apps/web/src/app/dashboard/journey-scene.tsx`; the decorative films now belong to Home via the shared component. Removed the route-level `loading.tsx` and its unused skeleton styles after the no-JavaScript fallback check (F2-06f).
- Verification: production build/lint/TypeScript passed. `node --test scripts/owner_records.test.mjs scripts/dashboard.test.mjs scripts/auth_navigation.test.mjs scripts/quote_plans.test.mjs` passed 18 tests. New tests cover linked-record deduplication, full collection batching/ownership, expired vs accepted offers, summary meanings, literal search, filters, page clamping, URL encoding, selected-case event scope and failed reads. Final browser results follow in F2-06f.
- Remaining scope: full response forms, new-home catalogue/selection, plan selection, submission and admin screens stay in their own phases; no draft saving is added.

### F2-06f — Two-page browser acceptance and regression record

- Date / commit: 2026-10-16; pending commit.
- Affected files: `scripts/check_dashboard.mjs`, `scripts/owner_home_checks.mjs`, `scripts/owner_records_checks.mjs`, `scripts/owner_records.test.mjs`, `scripts/auth_navigation.test.mjs`, `scripts/check_auth_navigation.mjs`, this log and `docs/md-files/Task_track.md`.
- Changes: reused the local-only Supabase protocol stub against real production Next.js routes/actions. Added independent first-page checks (`OWNER_HOME_ONLY=1`) and multi-record fixtures for records, pagination/filtering, expanded-case isolation, responsive layout and workflow states. The harness restores the normal environment build in `finally`; no real accounts or application writes are used.
- Browser results: Home-only phase passed first; full `node scripts/check_dashboard.mjs` then passed Home plus empty/valuation/unpriced/application states, a 15-record mixed history, summary totals/deduplication, search/reset (including empty-filter reset), status filters, both pagination directions, per-case expansion, foreign-ID isolation, 1440/768/390/320px layouts, live reduced motion, sticky headers, owner/admin guards and no runtime exceptions or application writes. Actual Manage Dashboard entry and valuation/brand/default-login links passed. A separate JavaScript-disabled browser context also passed record pagination and per-case expansion. Inspected Home and collapsed/expanded Dashboard screenshots. Normal production build is restored after each run.
- Bug found and fixed: browser checks showed same-route client pagination did not navigate, with no browser/server exceptions. Disabling prefetch alone did not resolve it. Dashboard pagination, reset and application expansion now use explicit GET links; filters use a GET form. This passed actual click navigation and preserves query/filter/page state. Expanded/collapsed case links also target their own row anchor. Different-page navigation continues using the existing links. No lifecycle mutation was introduced.
- Harness finding: a local fixture's `eq.` operator parser was corrected before the final run; no production query or auth change was needed for that fixture issue.
- Fallback bug found/fixed: the route-level streaming loading boundary kept the records hidden behind a skeleton when JavaScript was disabled. Removed that boundary so the server completes the records HTML before displaying it; GET navigation uses the browser's pending state rather than a JavaScript-dependent skeleton. Retained server error/retry states. The JavaScript-disabled pagination/expansion rerun passed (FE-BUG-11).
- Authentication regressions: `node scripts/check_auth_navigation.mjs` passed admin/owner successful sign-in, explicit-next handling, new role landing/brand links, clean public Welcome, Back/Forward session preservation, owner role restrictions and explicit sign-out. Its normal environment production build (lint/TypeScript included) was restored. No real accounts were used.
- Final visual/animation regressions: `node scripts/check_login.mjs` and `node scripts/check_welcome.mjs` passed against the normal restored build, including desktop/tablet/390/320px, existing EffectCraft playback, controls/links, form validation, keyboard, reduced motion, media errors and no-JavaScript artwork/content. Login smoke returned HTTP 200. Bundle scan found no local-test public keys. `git diff --check` passed (only configured future LF-to-CRLF warnings).
- Local handoff: normal production preview is running on `http://127.0.0.1:3000`; Home is `/home`, records are `/dashboard`. This is not a deployment. Real-account data/RLS checks remain separate; all successful-login and mixed-history automation used local fixtures, not hosted customer records.
- Documentation: updated the approved Home/Dashboard split, navigation, no-draft rule and logical page count in `docs/md-files/HomeLoop_更新_页面与流程.md`; backend business/eligibility rules were not changed.
- External changes: none. No deployment or commit is performed. Hosted owner/admin end-to-end behaviour and RLS remain a separate real-account verification, not proven by local stubs.

### F2-06g — Home architectural canvas background

- Date / commit: 2026-10-16 (Asia/Kuala_Lumpur); pending commit.
- Purpose / scope: user approved filling the empty background on `/home` with animated architectural linework, soft moving light and a travelling connection. Only the Home backdrop is changed; existing three cards, copy, links, films, dimensions and desktop one-screen layout are retained.
- Changes: replaced three faint contour ellipses with a viewport-clipped, non-interactive CSS/SVG canvas. Added floor-plan outlines, an architectural elevation, dotted paper texture, two drifting radial glows, two drawing/fading line traces and a travelling light along a curved connection. Detail is concentrated in exposed margins, with opaque cards maintaining readability. No new media assets, dependencies, client hydration or JavaScript animation loops.
- Accessibility / responsive behaviour: artwork is `aria-hidden`, SVG is non-focusable and the entire canvas ignores pointer events. Mobile hides secondary details and the travelling connection. Reduced motion stops animation and retains static outlines/light; CSS also works without JavaScript. The clipped fixed canvas adds no layout height or horizontal overflow.
- Affected files: `apps/web/src/app/home/architectural-background.tsx` (new), `apps/web/src/app/home/page.tsx`, `apps/web/src/app/home/home.module.css`, `scripts/owner_home_checks.mjs`, this log.
- Verification: the existing 18 Node regression tests passed; `git diff --check` passed with only configured LF-to-CRLF warnings. `OWNER_HOME_ONLY=1 node scripts/check_dashboard.mjs` passed outside the sandbox using local fixture accounts: all five background animations change visually relevant CSS properties; non-interactive markup; reduced-motion live stop/restart; JavaScript-disabled rendering; viewport clipping; unchanged three cards, equal-height lower cards, existing films and navigation. No desktop scrolling at 1366×768, 1440×900 and 1920×1080; no horizontal overflow at 768/390/320px. No browser runtime errors or application writes. Desktop/mobile screenshots inspected under `home-background-qa` in the local visualization directory. Initial sandbox Edge launch failed before page tests because of sandbox browser-profile restrictions, not an application exception.
- Bug found and fixed during visual QA: the initial full-screen solid backdrop inside Home's isolated stacking context covered the desktop footer. Removed the isolated stacking context and solid fill so the transparent negative-layer artwork sits behind all normal page content. Added stacking/transparency regression assertions; final browser rerun passed and the inspected desktop screenshot confirms the footer is visible.
- External changes: none. No backend/auth/records reader, database, hosted service, deployment or commit changes.
- Local handoff: normal production build restored successfully (TypeScript/build checks passed), fixture-key bundle scan clean, and existing local production preview restarted at `http://127.0.0.1:3000`. Sites skill guidance was applied in local-only mode to preserve the existing branding and bounded scope; no Site registration, source synchronization or publication.

### F2-06h — Clarify submitted valuation records versus unfinished forms

- Date / commit: 2026-10-16 (Asia/Kuala_Lumpur); pending commit.
- Scope: implement the user's latest approval to distinguish a submitted valuation with no estimate from an unfinished form. The earlier Dashboard animation, clickable-summary and application-action proposals are not part of this focused pass.
- Finding: `createValuation()` validates inputs, awaits the valuation response and only then calls `saveValuation()`. An insufficient-data response is intentionally saved with null amounts. Dashboard reads saved submissions; there is no draft entity or autosave path to remove. Null estimates must not be used to delete or hide these submitted records.
- Changes: standalone no-estimate valuations now read `Estimate unavailable` instead of `More data needed` and link to their saved result with `View explanation`. Priced valuations use `View valuation`. One shared presentation helper checks the estimate and range amounts before describing a usable estimate. Table explanatory copy states that only submissions are listed and an unavailable estimate is not an unfinished form. Record totals, application attention counts, collection queries, application action buttons, routes and layout are unchanged.
- Affected files: `apps/web/src/lib/owner-records-model.ts`, `apps/web/src/app/dashboard/dashboard-screen.tsx`, `scripts/owner_records.test.mjs`, `scripts/owner_records_checks.mjs`, this log.
- Verification: `node --test scripts/owner_records.test.mjs scripts/dashboard.test.mjs scripts/auth_navigation.test.mjs scripts/quote_plans.test.mjs` passed 20 tests. New tests cover retaining unpriced submissions without counting them as unfinished/attention tasks, valid/missing/non-finite/invalid amounts, label/search consistency, invalid-form validation before save, service-failure handling and successful submission of a null-price response. `git diff --check` passed (only configured LF-to-CRLF warnings). `node scripts/check_dashboard.mjs` passed full Home/Dashboard production browser checks using local fixture accounts: correct priced/unpriced status and destination link, retained unpriced total, zero false attention tasks, no resume/complete-form action, unchanged application statuses, pagination/search/filter/expansion, owner isolation, responsive layouts, reduced motion and JavaScript-disabled navigation. No runtime errors or application writes. Inspected `records-estimate-unavailable.png` in the local `dashboard-valuation-status-qa` visualization directory. Real hosted user data was not used.
- Bugs / limits: misleading Dashboard wording corrected. No draft saving/resume added, no records deleted, and no backend, database, service configuration or deployment changes. The separate manual-valuation submission conflict (FE-BUG-02) remains open and is not changed here. The existing result page is the explanation destination; this pass does not redesign that page or add a new response workflow.
- Local handoff: normal production environment build restored successfully; fixture-key scan clean. Local preview started at `http://127.0.0.1:3000` with the updated Dashboard at `/dashboard`. Sites skill guidance kept the edit local-only and within the approved scope; no publication or external source synchronization.

### F2-08a — Home-entry SDP catalogue (browsing only)

- Date / commit: started 2026-10-16, verified 2026-10-17 (Asia/Kuala_Lumpur); pending commit.
- Approved scope: Home → Explore SDP Homes → browse/search/filter the catalogue. Saved-valuation entry/context, unit selection, quotations, plans and submissions are explicitly deferred. Project/launch buttons open the existing official SDP project pages in a new tab rather than an unfinished internal detail route. No internal interest-registration workflow is implied.
- Data finding: read-only inspection of the configured catalogue returned 35 rows: 16 selling, 7 upcoming, 3 check and 9 under-construction, with `checked_on` 2026-10-14. No image columns, structured unit catalogue or live inventory exists. Three selling projects have no published starting price. Current Supabase docs/changelog were checked via the Supabase skill; Sites skill was used in local-only mode. No schema/configuration changes required.
- Implementation: replaced `/new-home` placeholder with an ivory/forest/sage gallery, two category tabs with live database counts, literal bounded project/township search, township and landed/high-rise filters, reset, source dates and explicit catalogue-not-live-availability disclaimer. Missing prices/sizes/dates stay unavailable rather than RM0 or invented values. Read-only session client uses explicit selling/upcoming filtering, exact counts and range batching. Database errors render a retry state, not a false empty catalogue. Owner role guard added to this page; existing middleware/login handling retained.
- Design/motion: three photo shutters reveal and independently drift; staged card entrances, lift/shadow/image-zoom hover, focus and button press feedback. Textured paper margins and static sage/sand planes fill background space without repeating houses, doors, travelling paths or drawing outlines. Responsive 3/2/1-column grid; reduced motion disables animations/transitions and preserves content. Standard GET tabs/filters support browsing without JavaScript.
- Home change: enabled the existing Explore SDP Homes link to `/new-home` and replaced its coming-soon note. No other Home card, film or background is changed; header still contains only the existing owner controls.
- Assets: curated/downloaded/optimised 23 official SDP page images; reviewed contact sheet and corrected initial logo/lifestyle candidates. Non-facade official media are explicitly labelled (published floor plan, facilities, development master plan, launch announcement, township setting). Source URLs/dates are retained in `public/catalogue/sources.json`, with regeneration/provenance notes in `design/catalogue/README.md`. Copyright remains with the owners; publication permissions are not asserted.
- Affected files: `apps/web/src/app/new-home/{page.tsx,catalogue.module.css,project-image.tsx}`, `apps/web/src/lib/catalogue{,-model}.ts`, `apps/web/public/catalogue/*`, `apps/web/src/app/home/page.tsx`, catalogue-scoped additions to `apps/web/src/app/globals.css`, `scripts/{catalogue.test.mjs,catalogue_checks.mjs,catalogue_fixtures.mjs,fetch_catalogue_assets.mjs,check_dashboard.mjs,owner_home_checks.mjs}`, `design/catalogue/README.md`, this log and `Task_track.md`.
- Verification: 25 Node tests passed (`node --test scripts/catalogue.test.mjs scripts/owner_records.test.mjs scripts/dashboard.test.mjs scripts/auth_navigation.test.mjs scripts/quote_plans.test.mjs`), covering catalogue allow-list/counts, literal search, filters, URL encoding, missing prices/sizes, calendar validation, safe official destinations, batched read-only queries and error/empty distinction, plus all existing records/auth/rounding regressions. `node scripts/check_dashboard.mjs` passed real production-route browser checks with local fixture accounts: Home entry, actual tabs/forms/reset, a new-tab official destination (intercepted locally), decoded images/fallback, three independently moving shutters, hover depth, 1440/768/390/320px and 3/2/1 columns, sticky header, live reduced-motion stop/restart, no-JavaScript browsing and owner/admin guards. Existing Home/Dashboard regression checks passed; no runtime exceptions or application writes. Desktop/mobile screenshots inspected. The new reader also returned the actual 23 public catalogue rows (16 selling, 7 upcoming) with the expected three unpriced selling projects, using anon read access without logging in or changing records.
- QA findings: the first browser run's generic alert selector matched both the application error state and Next's route announcer. Scoped the test to the catalogue error state; no product error-handling change was needed. Reset scroll/focus before desktop full-page captures and load offscreen lazy images before mobile captures to avoid misleading screenshot artefacts. Image loading now uses neutral loading copy; actual image failures show the unavailable fallback.
- Limits / external effects: no records, schema, auth settings, Render/Vercel/Supabase configuration, deployment or commit changed. No backend API or image-generation service runs on catalogue page requests. No saved-valuation handoff was wired or changed; it remains for the next discussion.
- Local handoff: normal production environment build restored successfully (TypeScript/build checks passed), fixture-key bundle scan clean, whitespace check passed and preview running at `http://127.0.0.1:3000`. Home entry is `/home`; catalogue is `/new-home`. Asset regeneration records its retrieval date in Asia/Kuala_Lumpur rather than overwriting the database catalogue-check dates.

### F2-07 through F2-11 — Remaining homeowner actions

These are remaining actions. Catalogue browsing is implemented in F2-08a; the other selection/workflow portions remain planned.

| Action | Intended change | Existing integration points / proposed files | Bugs, dependencies and acceptance work |
|---|---|---|---|
| F2-07 Photos | Optional owner-folder upload and photo display | Existing valuation form/actions; storage integration and display files to be selected during implementation | Private `photos` bucket exists; test ownership and upload failures |
| F2-08 New-home selection | Catalogue browsing implemented (F2-08a); internal details, unit choice, sales quote and price source remain | `/new-home` catalogue; proposed internal detail/selection views not implemented | Discuss saved-valuation entry next; preserve selected valuation across steps and agree structured unit data |
| F2-09 Plan selection | Plan A/B cards, recommendation question, eligibility and detailed quotes | Existing `apps/web/src/app/plans/page.tsx` (placeholder), `apps/web/src/lib/valuation.ts`; proposed detail routes | Use `quotePlans()` so the approved rounding policy applies |
| F2-10 Apply | Timeline, cash timing, address/title, PDPA consent and submission | Proposed `apps/web/src/app/apply/page.tsx` and actions; existing application/valuation helpers | Resolve FE-BUG-02 before supporting manual-valuation applications |
| F2-11 Owner responses | Proceed/withdraw, accept/switch/decline/review and e-SPA declaration | Existing application RPC wrappers; UI/actions paths to be selected | Test expiry, one-review/one-switch limits and permitted status transitions |

## F3 — Admin journey

The admin role guard is implemented in F1-03; workflow and AI helpers are implemented in F0/F2. The following screens are planned, with no completed UI verification recorded.

| Action | Intended change | Existing integration points / proposed files | Bugs, dependencies and acceptance work |
|---|---|---|---|
| F3-01 Applications panel | Monthly quota bars, stage tabs, application list, filters and flags | Existing `apps/web/src/app/admin/page.tsx` (placeholder), `apps/web/src/lib/applications.ts` | Verify quota/flags, empty lists and role access |
| F3-02 Application detail | Property/launch data, comparables/photos, AI summary, audit history and stage-specific actions | Proposed `apps/web/src/app/admin/applications/[id]/page.tsx` and actions; existing application and AI helpers | Show computed offer previews; final decisions remain admin actions; test every transition |
| F3-03 Risk simulator | Sliders, risk metrics, histogram and township filtering | Proposed `apps/web/src/app/admin/simulator/page.tsx`; existing `simulate()` helper | Navigation currently points to an absent page (FE-GAP-01); label RM valuation basis |

## F4 — Integration, QA and delivery

### F4-01 — Repository inspection and local verification baseline

- Date / commit: 2026-10-15; investigation only, no code changes for the inspection.
- Actions: compared current pages, helpers, SQL submission rules, tracker and Git history; confirmed placeholder/missing routes and reproduced the rounding discrepancy.
- Files examined: `apps/web/src/app/**`, `apps/web/src/lib/**`, `apps/web/src/middleware.ts`, `supabase/migrations/20261014111603_application_workflow.sql`, plan calculation source/tests and project documentation.
- Results executed in this workspace: initial `npm run lint` failed because `eslint` is not installed; `npm run build` failed because `next` is not installed; `python -m pytest` failed because `pytest` is not installed. These are environment limitations, not successful application checks or evidence of a particular runtime failure.
- Successful targeted checks: the F2-05 Node regression test, direct Python formula assertions and whitespace check. Historical build/test claims remain explicitly historical.
- Bugs / gaps recorded: FE-BUG-01 through FE-BUG-05 and FE-GAP-01 below. No full browser or live-session verification was performed here.

### F4-02 — Dedicated frontend implementation record

- Date / commit: 2026-10-15; pending commit.
- Changes: created this phase/action log, linked it from the overall tracker, reconstructed existing changes using source and commits, separated planned work from implemented work, and recorded verification limits and open findings.
- Affected files: `docs/md-files/Frontend_Implementation_Log.md`, `docs/md-files/Task_track.md`.
- Bugs / gaps: earlier implementation plans contain unchecked steps despite completion summaries; this file supplements those plans with evidence and actual status.
- Verification: checked recorded commit references and affected paths against Git/source; this is a documentation update, with no runtime implementation changes.

### F4-03 — Remaining integration and release actions

Status: pending. No completion or deployment is claimed.

- Wire the remaining screens to the server helpers; preserve valuation, launch and plan selections across the journey.
- Resolve the open bugs below and record each fix as a new action with its own files, results and commit.
- Run frontend lint, TypeScript and production build once dependencies are installed; reconcile FE-BUG-04 with the earlier clean-build report.
- Verify real-session owner/admin login, role restrictions, valuation persistence and owner data isolation.
- Verify loading, error and empty states throughout the journey; the existing AI loading card covers only one part of this work.
- Check desktop/mobile layout, keyboard use and reduced-motion behavior in a browser.
- Exercise both plan journeys, review/switch/expiry rules, admin actions, quota limits and post-acceptance tracking.
- Deploy the frontend and complete the documented demo with real demo sessions. Record environment, date, results, failures and deployment/commit reference without credentials.

## Frontend bug and gap register

| ID | Status / evidence | Problem and impact | Affected files / next action |
|---|---|---|---|
| FE-BUG-01 | Fixed locally; pending commit; targeted checks passed | Decimal valuation input caused RM1 differences from the agreed whole-RM calculation sequence | `apps/web/src/lib/valuation.ts`, `scripts/quote_plans.test.mjs`; see F2-05 |
| FE-BUG-02 | Open; confirmed code/spec conflict | Result page says insufficient-data owners can apply; `submit_application` requires status `ok` and positive valuation amounts. Saving an unpriced record alone does not enable submission | `apps/web/src/app/valuation/result/[id]/page.tsx`, `apps/web/src/lib/valuations.ts`, `supabase/migrations/20261014111603_application_workflow.sql`; agree and implement the manual-valuation contract before F2-10; any schema fix requires a new migration |
| FE-BUG-03 | Open; observed statically, no browser reproduction | Form initializes tenure to `Freehold`; selecting a road/type does not call `roadDetails()` or apply `tenure_mode`, despite earlier automatic-tenure claims. Leasehold users must manually correct it | `apps/web/src/app/valuation/valuation-form.tsx`, `apps/web/src/app/valuation/actions.ts`, `apps/web/src/lib/valuations.ts`; connect metadata and verify both tenures |
| FE-BUG-04 | Reproduced in the exact production chunk; fixed locally, pending commit | A clean build did not catch the browser receiving initial-state function references instead of objects and crashing at `search.results.length` | State objects moved to `apps/web/src/app/valuation/state.ts`; imports corrected in actions/form; plain-state tests and successful isolated owner browser navigation passed; see F2-02a |
| FE-BUG-05 | Open; observed statically, conditional path not exercised | An intermediate unit without typical catalog sizes allows manual sizes, but hidden `land_sqm`/`floor_sqm` values are sent only when `needsSizes` is true (corner/custom). The intermediate manual fallback therefore sends empty sizes and can be rejected | `apps/web/src/app/valuation/valuation-form.tsx`, `apps/web/src/app/valuation/actions.ts`; submit manually entered intermediate sizes and test missing catalog metadata |
| FE-BUG-06 | Fixed locally; isolated owner/admin login tests passed; pending commit | A homeowner `next` destination overrode the admin landing page after authentication | Shared `auth-routing.ts` policy used by login actions and signed-in login-page redirects; see F1-04 |
| FE-BUG-07 | Fixed locally; isolated navigation/Back/Forward tests passed; pending commit | Welcome inherited application navigation/email/sign-out, and application brand links returned to Welcome | Pathname-aware `site-navigation.tsx` hides application controls on public pages without clearing sessions; both application brand links target the role landing page; see F1-04 |
| FE-GAP-01 | Partially addressed by F2-06 and F2-08a; selection/workflow routes pending | Home, multi-record Dashboard and Home-entry SDP catalogue are implemented. Explore SDP Homes is enabled; catalogue buttons open official SDP pages. Internal new-home detail/selection, plans, admin, apply and simulator screens remain unfinished | Saved-valuation handoff and selection remain for the next discussion; remaining workflow/response screens stay in F2/F3 |
| FE-BUG-09 | Fixed locally; Home/Valuation browser checks passed; pending commit | Owner New home/Plans header links reappeared outside the old Dashboard because only route-specific CSS hid them | Owner navigation entries removed in `site-navigation.tsx`; internal workflow routes remain intact |
| FE-GAP-02 | Implemented; full multi-case browser verification passed; pending commit | The previous landing reader showed a single latest/active record and could not present owner history | New read-only batched records reader, summary/table/filter/pagination and owned-case expansion in F2-06e; one-active application backend policy unchanged |
| FE-BUG-10 | Fixed locally; actual pagination/search/filter/expansion clicks passed; pending commit | Same-route client pagination did not switch record pages in browser QA, without runtime/server errors; prefetch disabling alone did not fix it | Dashboard query-state controls use explicit GET links/forms; preserved filter/page state and per-case anchors verified in F2-06f |
| FE-BUG-11 | Fixed locally; JavaScript-disabled pagination/expansion passed; pending commit | Records were hidden behind the route's streaming loading skeleton without JavaScript | Removed Dashboard `loading.tsx`; server now completes the records HTML without that boundary, retaining browser navigation feedback and server error/retry states |
| FE-BUG-12 | Fixed locally; 20 automated tests and production browser regressions passed; pending commit | Dashboard `More data needed` and generic `View result` could make a submitted unpriced valuation appear to be an unfinished form | `owner-records-model.ts` and Dashboard screen now use `Estimate unavailable` / `View explanation`, retain saved submissions and clarify there are no form drafts; see F2-06h |
| FE-BUG-08 | Fixed locally; responsive browser checks passed; pending commit | Dashboard decorative backdrop extended 4px beyond narrow mobile screens because its 24px bleed did not match the shared shell's 20px mobile padding | Dashboard module CSS uses 20px backdrop insets at widths up to 480px; 320/390/768/1440px new/offer checks passed |

## Entry template for future actions

```text
Action ID / title:
Phase:
Date (Asia/Kuala_Lumpur):
Status: planned / in progress / implemented / verified / deployed
Problem or purpose:
Changes made (before → after):
Affected files (actual repository-relative paths):
Bugs found / fixed / still open:
Verification commands and actual results:
Remaining checks or limitations:
Commit(s): pending commit / verified hash
Deployment reference (if applicable):
```
