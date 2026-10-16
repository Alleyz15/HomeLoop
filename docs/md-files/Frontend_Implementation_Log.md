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
| F2 — Homeowner journey | Partially implemented | Dashboard, photos, new-home selection, plans, application and offer controls |
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

### F2-06 through F2-11 — Remaining homeowner actions

These are planned actions. No implementation changes or completion tests are recorded for them.

| Action | Intended change | Existing integration points / proposed files | Bugs, dependencies and acceptance work |
|---|---|---|---|
| F2-06 Dashboard | Eight-stage progress, current-state cards and Plan B listing sub-progress | Existing `apps/web/src/app/dashboard/page.tsx` (placeholder), `apps/web/src/lib/applications.ts`, `apps/web/src/lib/valuations.ts` | Verify new user, saved valuation, active application and offer states |
| F2-07 Photos | Optional owner-folder upload and photo display | Existing valuation form/actions; storage integration and display files to be selected during implementation | Private `photos` bucket exists; test ownership and upload failures |
| F2-08 New-home selection | Selling/upcoming catalogue, details, unit choice, sales quote and price source | Existing `apps/web/src/app/new-home/page.tsx` (placeholder); proposed `apps/web/src/app/new-home/[project]/page.tsx` | Preserve selected valuation across steps; confirm available launch/unit data |
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
| FE-GAP-01 | Pending implementation; unchanged by the login fix | `/admin/simulator` is linked in application navigation without a page. Dashboard, new-home, plans, admin applications and guide pages remain placeholders; apply and detail routes are absent | Navigation now resides in `apps/web/src/components/site-navigation.tsx`; pending route files remain in F2/F3; implement and verify those screens in their phases |

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
