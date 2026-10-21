# HomeLoop Code Review — 2026-10-21 (Round 2) — open flaws and recommended fixes

Reviewed: `main` at `f06f071` · Date: 2026-10-21 · Deadline: 10/23 23:59

**This is the second review, run after Round 1's findings were all fixed.** Round 1 is closed and kept
as a record at [Code_Review_2026-10-21.md](Code_Review_2026-10-21.md); its seven findings — the formal
offer being unissuable, Plan B stuck at `under_review`, the missing admin review response, the absent A3
simulator, the number guard ignoring spelled-out numbers, duplicated flag rules, and B→A appointments —
were all resolved in `f06f071` and are **not** repeated here.

This document lists **only what is still wrong**, each flaw paired with a recommended fix.

Scope: the whole repository — all 17 documents, `services/valuation` including the `app/ai` package, all
twelve migrations, and the `apps/web` frontend, with particular attention to the ~1,050 lines of SQL
added by the Round 1 fixes and to areas Round 1 had not examined closely (the apply flow, money
formatting, the owner and admin display models, and the AI mismatch detection). Every flaw below was
reproduced, not inferred.

Product authority: [HomeLoop_更新_页面与流程.md](HomeLoop_更新_页面与流程.md).
Progress: [Task_track.md](Task_track.md).

---

## Summary

| # | Flaw | Severity | Demo-visible | Fix size |
|---|---|---|---|---|
| 1 | One amount renders three different ways | Medium | **Yes** | ~20 lines, presentation only |
| 2 | The estimate is not monotonic in land area | Medium | No | model change + backtest re-run |
| 3 | An appointment date can never be changed | Low–Medium | Yes, to the owner | new RPC, or a decision |
| 4 | Two different confirmed-value gap rules | Low | Admin only | wording, or align the rule |
| 5 | The offer formula has two sources of truth | Low | No | a comment, or derive once |
| 6 | Fraction words bypass the number guard | Very low | No | ~5 lines |
| 7 | `backtest_ratios` cannot be retried after a partial import | Very low | No | docs, or drop the guard |
| 8 | Four exported helpers are never called | Trivial | No | delete or comment |

Only flaw 1 is worth doing before the deadline. Flaw 2 needs a decision, not a rushed change.

---

## 1. One amount renders three different ways — Medium

**Where:** `lib/units.ts:31`, `lib/development-model.ts:21`, `lib/dashboard-model.ts:91`,
`lib/admin-applications-model.ts:90`, `lib/admin-simulator-model.ts:27`.

**What:** five money formatters use three different precision rules. The golden case's stored estimate
`785635.3591160221` renders as:

| Rendering | Formatter | Pages |
|---|---|---|
| `RM785,635` | `formatRm`, simulator `money` (`Math.round`) | valuation result, A3 simulator |
| `RM785,635.36` | `marketRm`, `adminMoney` (`maximumFractionDigits: 2`) | new-home, plans, apply, **all** admin pages |
| `RM 785,635` | `dashboard-model.money` (`style: "currency"`, which inserts a space) | dashboard cards |

The cents forms contradict a decision already on record — Task_track §1.5:
*"所有金额四舍五入到 RM 整数"*, all amounts round to whole ringgit. Twelve files use them, and the owner's
journey crosses all three styles in one sitting: result page → new-home → plans → dashboard.

For a product whose entire pitch is transparent, defensible pricing, one number shown three ways reads as
carelessness, and it is the kind of thing a judge notices on a shared screen.

**Recommended fix** — presentation only; change no stored or computed value.

Keep `lib/units.ts` `formatRm` as the single implementation, and re-point the others at it so the twelve
call sites stay untouched. Preserve `marketRm`'s negative handling (price gaps go negative when the old
home is worth more than the new one) and `dashboard-model.money`'s null branch:

```ts
export function marketRm(value: number) {
  return `${value < 0 ? "-" : ""}${formatRm(Math.abs(value))}`;
}
export function adminMoney(value: number) { return formatRm(value); }
export function money(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? "Not recorded" : formatRm(Number(value));
}
```

Drop `style: "currency"` entirely — it is what inserts the space, and its output varies with the
runtime's ICU version, which `marketRm`'s own comment already warns about.

---

## 2. The estimate is not monotonic in land area — Medium

**Where:** `services/valuation/app/model/comps_knn.py:160`.

**What:** `estimate = median_ppsm * subject_floor_sqm` scales only by built-up area. Land area decides
*which* comparables are selected but never the scaling, so when the comparable set swaps the figure jumps.
Measured against the deployed service — same road, same house type, built-up fixed at 190 m²:

```
land=380 m²   RM1,251,761
land=430 m²   RM1,420,880
land=480 m²   RM1,348,384   <-- RM72,496 LESS for a bigger lot
land=530 m²   RM1,326,988   <-- drops again
land=630 m²   RM1,262,300   <-- drops again
```

Three non-monotonic steps in one sweep. A corner lot priced below its smaller neighbour is indefensible
for a product built on transparent pricing, and it is exactly the case an admin flag would query.

**Already classified by the team as an accepted deadline constraint**, and it does not affect the demo
path, because an intermediate unit uses the road's typical size.

**Recommended fix** — a decision, not a quick change. Three approaches were measured:

| Approach | Non-monotonic steps (of 56) | Central estimate |
|---|---|---|
| Current | 10, worst −RM84,329 | RM785,635 ✓ matches the golden test |
| Effective-area weighting (`floor + k·land`) | 4 | RM782,059 ✓ |
| Comparable distance cap | 7 — no improvement | RM785,635 ✓ |
| **Kernel-weighted smoothing** | **0** | **RM821,651 ✗ (+4.5%)** |

Only smoothing removes it, and that moves the central estimate enough to fail the golden test **and**
invalidate the "误差中位数 10.1%" backtest claim in the deck. So: either accept it for the hackathon and
say so in the deck's limitations, or change the estimator **and re-run the backtest** to restore the
accuracy claim. Do not change the model without re-running the backtest.

---

## 3. An appointment date can never be changed once recorded — Low–Medium

**Where:** `lib/admin-application-detail-model.ts:88-92`.

**What:**

```ts
if (status === "owner_proceed") actions.push("schedule");
if (status === "inspection_scheduled") {
  if (isPlanBToAValuation(app) && !app.inspection_scheduled_at) actions.push("schedule_plan_a");
  else actions.push("findings");
}
```

`schedule` is reachable only from `owner_proceed`, and `schedule_plan_a` only for a Plan B→A case that has
no appointment yet. Once `inspection_scheduled_at` is set — ordinary case or switched case — nothing can
change it. `schedule_inspection` requires `owner_proceed` and `schedule_plan_a_valuation` requires
`plan_switch_count = 1` with no date set, so there is no path in the UI or the database.

If the owner calls to move the visit, the admin can only record findings against a stale date or leave it
wrong, and §5.6 shows that date to the owner ("已安排上门 ｜ 日期、谁会来") — so it is both visible and
uncorrectable.

**This may well be deliberate.** The workflow is append-only throughout, and silently rewriting a
recorded appointment would weaken the audit trail.

**Recommended fix** — either answer is acceptable; the silent dead end is the problem.

*If rescheduling should be possible*, add it as a **new event** rather than a mutation:

1. A `reschedule` entry in `ADMIN_ACTIONS` with `result: "inspection_scheduled"` and an `appointment`
   field, offered at `status === "inspection_scheduled"` alongside `findings`.
2. A `reschedule_inspection` RPC in a **new** migration, modelled on `schedule_plan_a_valuation`: admin
   check, `FOR UPDATE`, require `status = 'inspection_scheduled'`, require a future timestamp, update
   `inspection_scheduled_at`, and write one event recording **both** the previous and the new date.

*If it should not be possible*, record that in Task_track and have the stage note tell the admin what to
do instead — reject and ask the owner to re-apply, or record findings only after the visit that actually
happened.

---

## 4. Two different confirmed-value gap rules — Low

**Where:** `admin_application_flags` in
`supabase/migrations/20261017142952_manual_valuation_workflow.sql`,
`lib/admin-applications-model.ts:140`, and `services/valuation/app/ai/service.py:detect_mismatches`.

**What:** three implementations, two of which agree:

| Implementation | Rule |
|---|---|
| SQL `admin_application_flags` | `confirmed_value < snapshot_low * 0.90` — >10% below the AI **low** |
| TypeScript model | `ratioCompare(confirmed_value, snapshot_low, 9, 10) < 0` — **identical**, via exact integer ratios |
| Python AI assist | `abs(confirmed − estimate) / estimate > 0.10` — >10% from the **mid-point**, **either direction** |

SQL↔TypeScript parity is correct and deliberate, and the integer-ratio comparison sensibly avoids float
drift. The Python rule is a different instrument.

Worked example — AI estimate RM786,000, AI low RM742,000, confirmed value RM700,000: the flag does **not**
fire (700,000 is not below 742,000 × 0.9 = 667,800), but the AI note says the confirmed value is 10.9%
below the estimate. The admin sees an AI-written discrepancy that no flag corroborates, with no way to
tell which to trust.

**Recommended fix:** both behaviours are defensible — a risk *flag* versus an advisory *note* — so this is
a labelling fix rather than a logic one. Cheapest: leave the thresholds alone and make the AI's wording say
what it measures, *"…below the AI mid-point estimate"* instead of a bare "below the AI estimate". If they
should agree instead, move the Python rule onto the AI low and make it one-directional.

---

## 5. The offer formula has two sources of truth — Low

**Where:** `supabase/migrations/20261014111603_application_workflow.sql:114` and
`services/valuation/app/plans/constants.py`.

**What:** `private.application_offer` hardcodes `0.785` and `0.75`, while the Python constants derive them
from 11.5% + 10% and 75%. They agree today — RM786,000 yields 617,010 and 589,500 from both — but changing
a rate means editing Python **and** adding a new migration, since rule 4 forbids editing an applied one.
Nothing links the two.

**Recommended fix:** the pattern finding 6 of the first pass established for the flag rules — a comment on
each side naming the other. Add one above `admin_application_flags`-style, in the **next** migration that
touches the workflow file, and a matching note in `constants.py`. If a rate ever does change, change both
in the same commit and say so in the message.

---

## 6. Fraction words bypass the number guard — Very low

**Where:** `services/valuation/app/ai/guard.py` — `_NUMBER_WORDS`.

**What:** the parser covers `one`…`nineteen`, the tens, and `hundred`/`thousand`/`million`/`billion`,
including multi-word phrases with "and" and hyphens. It does not cover fraction or multiplier words, so
*"Prices rose by a third since then"* passes. Verified alongside the cases that are correctly blocked:

```
ALLOWED  "Prices rose by a third since then."
BLOCKED  "Worth over half a million ringgit."        -> resolves to 1,000,000, fails grounding
BLOCKED  "About a thousand ringgit per square metre." -> resolves to 1,000, fails grounding
BLOCKED  "Based on two dozen recent sales."           -> resolves to 2, fails grounding
```

It asserts no amount, so it cannot put a wrong ringgit figure on screen — the risk 原则 14 exists to
prevent. It could still state an invented *relationship*.

**Recommended fix:** add `half`, `third`, `quarter`, `double`, `triple`, `dozen` to a **separate** set that
triggers the template fallback on sight, rather than folding them into `_NUMBER_WORDS` to be parsed —
they cannot be grounded against any number in the payload. Keep them separate deliberately, and watch for
false positives on innocent uses such as "a quarter of the sales".

---

## 7. `backtest_ratios` cannot be retried after a partial import — Very low

**Where:** `scripts/import_csv.py` — `requires_empty=True`.

**What:** if the 187-row load fails part way, the table is non-empty and a retry is refused. The operator
must truncate manually, and the README documents truncation only for `transactions`.

**Recommended fix:** the guard is correct — the CSV has no stable row identifier, so re-running would
duplicate rows. Document it instead: add `backtest_ratios` to the README's truncate note, and have the
error message name the table to truncate.

---

## 8. Four exported helpers are never called — Trivial

**Where:** `apps/web/src/lib/applications.ts`.

**What:** `expireOffers`, `getAdminApplicationFlags`, `provideInfo` and `requestReview` are exported and
unused. The first two intentionally — expiry is lazy inside the workflow RPCs, and the flags are computed
by the TypeScript model. The last two are superseded by `submit_application_response`, which calls
`provide_info` and `request_review` itself.

**Recommended fix:** delete them, or add a one-line comment on each saying what calls the underlying RPC
instead. Worth doing because auditing RPC coverage by helper name gives a false negative here — this
review made exactly that mistake on its first pass.

---

## Not flaws, but unverified

Neither is a defect; both are gaps in evidence.

- **The signed-in end-to-end run has never been done.** Owner → `/home`, admin → `/admin`, owner blocked
  from `/admin`, and demo script steps 1–10 in a browser with the demo accounts. This is the largest
  untested area in the project. `scripts/verify_auth.py` covers the database half; the UI half needs a
  person.
- **The pgTAP suites have not been executed in this review** — no Docker or local Supabase was available.
  The SQL assessment is from reading, supported by 198 assertions across five test files
  (`application_workflow` 59, `application_photos` 57, `manual_valuation_workflow` 35,
  `formal_offer_preview` 27, `plan_b_to_a_valuation` 20). Someone with a local stack should run
  `npx supabase test db` before the deadline.

**Health at `f06f071`:** 174 Python tests pass (10 skipped), 118 Node assertions across 19 suites, and
`tsc`, `eslint` and `next build` all clean across 17 routes.
