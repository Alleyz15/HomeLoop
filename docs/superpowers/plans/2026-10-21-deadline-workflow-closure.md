# Deadline workflow closure implementation plan

## 1. B-to-A state-machine support

- Add failing pgTAP coverage for admin/owner permissions, legal state checks,
  one event per scheduling action, required registered-valuer evidence,
  explanation rules, and preservation of the previous Plan B value.
- Create a new migration containing `schedule_plan_a_valuation` and a
  signature-compatible replacement for `record_inspection`.
- Add the server-only TypeScript RPC wrapper and admin action model/form wiring.
- Add Node regressions for action visibility, validation, RPC arguments and the
  owner-visible explanation.

## 2. A3 admin simulator

- Add a pure view/input model and failing Node tests for strict input parsing,
  percentage-first output and histogram totals.
- Add an admin-only Server Component, debounced client sliders and a server
  action that calls the existing server-only `simulate()` helper.
- Add an Applications-page link and responsive/reduced-motion styling.

## 3. AI number-word grounding

- Add failing unit tests for fabricated and grounded English number phrases.
- Extend the existing guard parser without changing prompts or endpoint
  contracts.
- Run the full valuation test suite.

## 4. Documentation, verification and delivery

- Record the B-to-A decision, A3 completion, number-guard fix and SQL/TS flag
  parity in `Task_track.md`.
- Run local Supabase reset/tests/lint, web Node tests/TypeScript/ESLint/build,
  and all Python tests.
- Run `supabase db push --dry-run`, report the new SQL summary, and wait for
  explicit `确认 push` before any linked push.
- Commit each logical unit on `QY`; do not git push.
