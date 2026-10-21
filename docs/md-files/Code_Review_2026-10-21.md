# HomeLoop Code Review — 2026-10-21 (Round 1) — ✅ DONE

> **Status: closed. Every finding in this document was resolved on 2026-10-21, in `main` at `f06f071`.**
> Verified by re-running each original reproduction against the fixed code. Nothing here is outstanding.
> The document is kept unchanged below as the record of what was wrong, what was done, and what to
> re-check if any of it regresses.
>
> | # | Finding | Fixed by |
> |---|---|---|
> | 1 | Formal offer could not be issued | `3e24a34`, `5ea6195` + migration `20261021054226` |
> | 2 | Plan B stuck at `under_review` | `3f301d2`, `113a4af` |
> | 3 | Admin could not answer a review | `3e24a34`, `5ea6195` (`respondReviewFromPreview`) |
> | 4 | A3 simulator missing | `7448fe2` |
> | 5 | Guard missed spelled-out numbers | `3a72485` |
> | 6 | Flag rules duplicated | migration `20261021074642` |
> | — | B→A re-scheduling (found while writing the solutions) | `6b629b3` + migration `20261021074642` |
>
> Three of these were fixed more thoroughly than this document proposed: the formal offer became a
> preview-then-finalize flow with a revision token, the number guard parses word phrases and grounds them
> instead of rejecting them outright, and the simulator followed the ringgit-basis guidance exactly.
>
> **Flaws found *after* these fixes are in a separate document:**
> [Code_Review_2026-10-21_Round2.md](Code_Review_2026-10-21_Round2.md).


Reviewer: Claude (Damian's session) · Branch reviewed: `main` at `a4506a4` · Deadline: **10/23 23:59** (about 2.5 days)

Scope: the 59 commits merged into `main` since `0a9d705` (2026-10-15), all 17 files under `docs/`, the
`services/valuation` service including the new `app/ai` package, the three new migrations, and the
`apps/web` frontend. Product authority: [HomeLoop_更新_页面与流程.md](HomeLoop_更新_页面与流程.md).
Progress: [Task_track.md](Task_track.md).

Method: claims below were reproduced rather than read off the code. Commands and outputs are quoted so
anyone can re-run them. Where a suspicion turned out to be wrong, that is recorded too, so nobody
re-investigates it.

**Branches checked.** Every finding was verified against `main` at `a4506a4` *and* against the unmerged
branches, so nothing here duplicates work already done elsewhere. One result of that: **finding 2 is
already fixed on `origin/QY`** in commit `3f301d2` and only needs merging — see that section. The other
five are open on `main` and on `QY`.

---

## Summary

| # | Finding | Severity | Blocks the demo? | Fix size |
|---|---|---|---|---|
| 1 | The formal offer cannot be issued; 12 RPCs and 10 built UI controls are stranded | **Blocker** | Yes — steps 8–9 | one `case` + a form |
| 2 | A Plan B application can never leave `under_review` | ~~Blocker~~ **fixed on `QY`** | was step 6 | merge `QY` |
| 3 | The admin cannot respond to an offer review | High | §5.5 owner option | one `case` + a form |
| 4 | A3 risk simulator page does not exist | High | Yes — step 10, 原则 13 | one page, API already done |
| 5 | The 原则 14 number guard misses spelled-out numbers | Medium | Trust risk on camera | ~15 lines + 2 prompt lines |
| 6 | Flag rules are implemented twice (SQL + TypeScript) | Low | No | a comment |

Findings 1, 2 and 3 are all in the same two files. Taken together they are the difference between a
journey that stops halfway and one that completes on camera.

Each finding below is written as **Problem** — what is wrong, where, and the evidence — followed by
**Solution** — the concrete edits, with file paths, line numbers and code. Nothing in a Solution section
needs to be re-derived before it can be implemented.

Plus three findings from the 2026-10-14 review that are still open (see *Previously reported*).

---

## Unmerged work: what `origin/QY` already delivers

`origin/QY` is one non-merge commit ahead of `main`: **`3f301d2` "feat(frontend): add Plan B initial
figures flow"** (Alleyz15, 2026-10-21), touching 9 files, +69/−16. It closes finding 2 and nothing else,
so the other five findings below are open on `main` and on `QY` alike.

**What it does.** An admin reviewing a Plan B case at `under_review` can now send initial figures:

- `initial_b` added to `AdminAction` and to `ADMIN_ACTIONS` with `result: "indicative_sent"`
- `initialBFigures()` (`lib/admin-application-detail-model.ts:60`) reads the saved quote and returns
  `{ low, high, floor }` only when all three are positive and ordered
- `adminCaseActions()` line 72 offers it for Plan B, mirroring the existing Plan A branch
- `initialPlanBFigures()` in `lib/application-detail-model.ts` gives the owner's side the same figures
- the admin panel renders **"Expected open-market proceeds"** as a range and **"Indicative guarantee
  floor"** as a separate amount, with the sentence that the proceeds assume an open-market sale and
  selling fees while the floor is a separate fallback — explicitly "preliminary figures, not a formal
  offer"
- 39 lines of new test coverage across `scripts/admin_application_detail.test.mjs` and
  `scripts/application_detail.test.mjs`

**The semantic decision, which this review had left open.** `indicative_low` / `indicative_high` are now
defined as the **expected open-market net proceeds** (after assumed selling fees), with the 75% guarantee
floor shown alongside rather than stored. That is a better reading of §5.5's
"并显示预计可拿到的市价范围" than the point-value this document originally recommended: the owner reacts to
what they would actually receive, and the floor is presented as the fallback it is. **Treat this as the
decided answer.**

**What makes it safe, and worth preserving in later work:**

- the server action re-reads the application and derives the amounts server-side — no browser-supplied
  figure is trusted, and no formula is recomputed or copied
- it fails closed on every doubtful case: missing, incomplete or mismatched snapshot, a quote whose
  `new_home.price` differs from the application's, a selected plan other than B, a case that has already
  switched plan, or a manual-valuation case
- the range, the floor and the meaning of the amounts are recorded in the **private** audit payload
  (`indicative_kind: "expected_open_market_proceeds"`), while the owner reads the sent range from the
  application and the floor from their own matching quote — the private audit is not exposed
- an information reply still requires the admin to send explicitly; nothing auto-advances

**Still outstanding on it**, per the author's own Task_track note — this is a working flow, not a
completed acceptance: eligibility and whole-ringgit validation, rejecting unexpected amount fields, a
full versioned receipt, validating the plan and range returned by the RPC, and isolated database and
browser evidence.

**Also recorded in that note, and not previously captured in this review:** after a B→A plan switch, the
case returns to `inspection_scheduled` and needs a fresh registered-valuer appointment, and **that
re-scheduling is not implemented**. It sits in the same area as finding 1 and should be handled with it.

**Merge this before starting findings 1 or 3.** All three touch `adminCaseActions()` and `ADMIN_ACTIONS`;
merging first avoids a conflict in exactly those two places.

---

## 1. Blocker — the formal offer cannot be issued

### Problem

**Where:** `apps/web/src/app/admin/applications/[id]/actions.ts:48` (the action switch) and
`apps/web/src/lib/admin-application-detail-model.ts:21` (`ADMIN_ACTIONS`).

**What:** `ADMIN_ACTIONS` defines 14 admin actions. Their target statuses are:

```
under_review, info_requested, rejected, indicative_sent, manual_valuation_pending,
inspection_scheduled, inspected, espa_signed, listed, buyer_found,
guarantee_triggered, old_home_completed, handover, (message = no status change)
```

`offer_sent` is **not** among them. `issueOffer` exists in `apps/web/src/lib/applications.ts:263` and is
referenced nowhere in the app except as a display label in
`apps/web/src/lib/application-detail-model.ts:73`. The `findings` action's own help text says it plainly:
*"Record the completed visit and the confirmed market value. This does not issue an offer."*

**Why it matters:** an application reaches `inspected` and then stops permanently. Reading the required
status out of the migrations shows what that strands:

| RPC | Requires | UI built? |
|---|---|---|
| `accept_offer` | `offer_sent` | yes (owner) |
| `decline_offer` | `offer_sent` | yes (owner) |
| `switch_plan` | `offer_sent` | yes (owner) |
| `request_review` | `offer_sent` | yes (owner, via the photo RPC) |
| `respond_review` | `review_requested` ← `offer_sent` | **no** — see finding 2 |
| `mark_espa_signed` | `accepted` ← `offer_sent` | yes (owner) |
| `confirm_espa` | `espa_signed` | yes (admin `signing`) |
| `mark_listed` | `espa_signed` | yes (admin) |
| `mark_buyer_found` | `listed` | yes (admin) |
| `mark_guarantee_triggered` | `listed` | yes (admin) |
| `mark_old_home_completed` | `espa_signed` | yes (admin) |
| `mark_handover` | `old_home_completed` | yes (admin) |

That is **12 RPCs unreachable, 10 of which already have working UI controls**. The owner's
accept / decline / switch-plan panel and six admin milestone actions are fully wired and can never
appear, because the one status that unlocks them can never be set.

`switch_manual_plan_to_b` is the exception — it requires `inspected`, so it does work today.

**Against the spec:** 第 4 关 of §5.5 is *"admin 填看屋结果 → 系统按公式算 → admin 批准 → 屋主决定"*. The
first half exists; "admin 批准" does not. Demo script step 8's second half ("批准并发出正式报价") and all of
step 9 ("屋主接受 → 下一步：通过 HIMS 签 e-SPA") cannot be performed.

**Note:** Task_track line 291 does record that G1 (formal offer preview / issue / review response) was
deliberately deferred. What is not recorded is that deferring it severs the journey and strands ten
finished controls. That is why this is listed as a blocker rather than as planned scope.

### Solution

Three small edits, all in files that already do this shape of work. The UI calculates no price: the
database recomputes the offer from `confirmed_value`, sets the 14-day expiry and checks the monthly quota
itself, and `issue_offer` returns the saved application row containing the authoritative `offer_amount`.

**1. Declare the action** — `apps/web/src/lib/admin-application-detail-model.ts`, in `ADMIN_ACTIONS`:

```ts
offer: {
  label: "Issue formal offer",
  detail: "The system calculates the offer from the confirmed market value using the plan formula, "
        + "then sends it to the owner with a 14-day response deadline.",
  result: "offer_sent",
},
```

**2. Expose it at the right stage** — same file, `adminCaseActions()`, line 70. Today that line reads
`if (status === "inspected") actions.push("information", "reject");`. Add `"offer"` as the first entry so
it leads, since it is the expected next step:

```ts
if (status === "inspected") actions.push("offer", "information", "reject");
```

**3. Wire it** — `apps/web/src/app/admin/applications/[id]/actions.ts`, in the switch at line 48, and add
`issueOffer` to the import from `@/lib/applications`:

```ts
case "offer": result = await issueOffer(id, audit); break;
```

The existing post-condition check at line 65 (`result.status !== ADMIN_ACTIONS[input.action].result`)
then verifies the transition for free.

**Form:** a confirmation only — no amount input. Show the confirmed market value, the plan, and a sentence
saying the system will calculate the offer from it; keep the optional internal note the other actions
already have. **Do not compute a preview in the frontend**, or the `0.785` / `0.75` duplication spreads to
a third place (see finding 6). After the call succeeds, display `offer_amount` and `offer_expires_at` from
the returned row — that is the authoritative figure.

**Surface these two rejections**, because both are expected in normal use and both arrive as Postgres
exceptions:

- `Plan % monthly limit exceeded: RM% used + RM% offer > RM% limit` — 原则 12: the admin must then ask the
  owner to wait, or reject.
- The Plan A re-checks (SDP township, and confirmed value not above the new-home price). If Plan A has
  become ineligible, the owner can move to Plan B before a formal offer without spending their one
  `plan_switch_count` — `switch_manual_plan_to_b` already works from `inspected`.

**Verify:** owner submits → admin start → indicative → owner continue → schedule → findings → **offer** →
owner sees the amount and the countdown → accept → `espa_signed` path opens. That is demo steps 6 to 9.

**Handle the B→A return path in the same pass.** `switch_plan` from B to A clears the offer and returns
the case to `inspection_scheduled` to await a registered valuer, but **re-scheduling that appointment is
not implemented** — `adminCaseActions()` only offers `findings` at `inspection_scheduled`, never
`schedule` again. So a case that switches B→A lands in a state whose appointment cannot be set. The
author of `3f301d2` records this in Task_track as still open. Fix it by allowing `schedule` at
`inspection_scheduled` as well, so an appointment can be set or revised:

```ts
if (status === "inspection_scheduled") actions.push("findings", "schedule");
```

---

## 2. Fixed on `QY` — a Plan B application could never leave `under_review`

> **Status: fixed on `origin/QY` in `3f301d2`, pending merge.** See
> [*Unmerged work: what `origin/QY` already delivers*](#unmerged-work-what-originqy-already-delivers)
> above for what it does, the semantic decision it settles, and what its author lists as still
> outstanding. **No further implementation is needed — only the merge.** The problem is kept below
> because it explains why the merge matters and what to verify afterwards.
>
> **After merging, verify:** a Plan B case at `under_review` offers "Send initial Plan B figures"; the
> owner sees an expected-proceeds range plus a separate guarantee floor, labelled preliminary and not an
> offer; 「我有兴趣，继续」 moves it to `owner_proceed`; and a Plan B case whose saved quote is missing or
> mismatched still shows the honest stage note rather than an invented range.

### Problem

**Where:** `apps/web/src/lib/admin-application-detail-model.ts:65`.

**What:** that line reads

```ts
else if (app.plan === "A" && initialARange(app)) actions.push("initial_a");
```

so `send_indicative` is offered for **Plan A only**. For a Plan B case at `under_review` the available
actions are just `information`, `reject` and `message`. And `proceed_application` requires status
`indicative_sent`:

```
proceed_application requires status indicative_sent, current status is %
```

So a Plan B application has no route onward: no indicative range, therefore no owner "continue",
therefore no visit, therefore no offer. It can only be answered with an information request or rejected.

The code is honest about it — `caseStageNote()` line 83 returns:

> *"Initial Plan B sending is pending confirmation of whether its range represents expected market
> proceeds or guarantee-floor amounts. No range will be sent until that meaning is agreed."*

and Task_track line 291 lists it as open item G2. So this is a known, deliberate hold, not an oversight.

**Why it is a blocker anyway:** Plan B is the plan the project leads with — 商业模式 §7.3 states
*"所以 HomeLoop 主推方案 B"* — and demo script step 5 selects Plan B explicitly, then step 6 has the admin
send the indicative range. The scripted demo therefore stops at the first admin step, two stages earlier
than finding 1.

**Important:** this is a **frontend gate only**. `send_indicative` has no plan restriction in SQL. It
rejects manual-valuation cases and requires `under_review`, validates `low > 0`, `high > 0`,
`low <= high`, and nothing else. Nothing in the database needs to change.

### Solution (superseded by `QY` `3f301d2` — kept for the reasoning)

The blocking question — what a Plan B indicative range means — is already answered by the spec. §5.5 第 2 关:

> 初步报价区间按 AI 估价区间计算：方案 A =（AI 低价 ~ AI 高价）×（1 − 11.5% − 10%）；
> **方案 B 保底 = AI 中间值 × 75%**，并显示预计可拿到的市价范围。

So the Plan B floor is a single figure derived from the midpoint, and the expected market range is shown
alongside it rather than being the stored indicative. Two ways to store that in the existing
`indicative_low` / `indicative_high` columns:

- **Recommended — store the floor as a point:** `low = high = plan_b.floor` from the saved quote
  snapshot. This is the literal reading of the spec, it keeps "the floor is one number" true everywhere,
  and the expected market range is already available in `plan_quote_snapshot`
  (`expected_net_low` / `expected_net_high`) for display without storing anything new.
- **Alternative — store the floor range:** `low = plan_b.floor_low`, `high = plan_b.floor_high`, which
  B3 already returns (`services/valuation/app/plans/calc.py:218`). Symmetric with Plan A, but it implies
  the floor is a range, which the spec does not say.

Either satisfies the SQL validation. Pick one, write it into Task_track so it stops being "pending", then:

**1.** Add a `initialBRange(app)` helper next to `initialARange` (line 54), reading `plan_b.floor` (or the
floor range) out of `savedCaseQuote(app)` with the same positive-and-ordered validation.

**2.** Replace line 65 so both plans are handled:

```ts
else if (app.plan === "A" && initialARange(app)) actions.push("initial_a");
else if (app.plan === "B" && initialBRange(app)) actions.push("initial_b");
```

**3.** Add an `initial_b` entry to `ADMIN_ACTIONS` with `result: "indicative_sent"`, and a case in the
switch calling `sendIndicative(id, low, high, audit)` with the chosen figures.

**4.** On the owner's side, label it as a floor, not an offer: the indicative is explicitly
*"不是正式报价"*, and the owner's response is 「我有兴趣，继续」 / 「不用了」, which
`proceedApplication` / `withdrawApplication` already implement.

**Keep the existing honesty.** `caseStageNote()` line 83 should stay as the message for any Plan B case
whose saved quote cannot produce a valid floor — the current wording is good, and no range should ever be
invented when the snapshot is missing or malformed.

---

## 3. High — the admin cannot respond to an offer review

### Problem

**Where:** `apps/web/src/lib/applications.ts:285` (`respondReview`).

§5.5 gives the owner four responses to a formal offer: accept, switch plan, decline, and
**要求复核（只能一次）**.

The **owner half is built.** It is easy to miss, because it does not go through the `requestReview`
helper: `app/dashboard/applications/[id]/actions.ts:70` calls `submitApplicationResponse(...)` with
`purpose: "offer_review"`, and `submit_application_response` in
`20261019191115_application_photos_and_message_privacy.sql:243` calls `public.request_review(...)`
internally, so the owner's review request works and carries photos. The same wrapper calls
`public.provide_info(...)` for `info_response`, so information replies work too. (Searching only for the
TypeScript helper names makes both of these look unwired — they are not.)

The **admin half is missing.** `respondReview` is defined but called from nowhere, and no `ADMIN_ACTIONS`
entry targets a review response. So an application that reaches `review_requested` is a second dead end:
the owner can ask for a review, and nobody can answer it. `respond_review` requires status
`review_requested`, which is only reachable from `offer_sent`, so today it is unreachable anyway — but it
must be built alongside finding 1, or issuing offers simply moves the dead end one step later.

### Solution

Same three-edit shape as finding 1. `respond_review`'s signature is
`(p_application_id, p_keep_offer boolean, p_reason text, p_confirmed_value numeric default null, p_note, p_payload)`
and `respondReview()` already wraps it at `apps/web/src/lib/applications.ts:285`.

**1.** `ADMIN_ACTIONS`: add `review_response` with `result: "offer_sent"` — the RPC returns the case to
`offer_sent` either way, with a fresh 14-day deadline.

**2.** `adminCaseActions()`: add `if (status === "review_requested") actions.push("review_response", "reject");`
There is no entry for that status today.

**3.** The switch: `case "review_response": result = await respondReview(id, { keepOffer, reason, confirmedValue }, audit); break;`

**Form:** the owner's review reason and any photos they attached must be shown first — they are on the
case already via `application_photos` and the `request_review` event's `owner_message`. Then: keep the
offer or revise it (the `keepOffer` boolean), a **required** reason the owner will see, and a new confirmed
market value only when revising. §5.5 is explicit that there is **no negotiation** — the price follows the
formula and the visit findings — so the form should ask for a corrected market value, never a corrected
offer amount. The database recomputes the offer from it.

**One review only.** `review_count` is capped at 1 by a CHECK constraint and enforced in the RPC, so after
one round the owner's review option must disappear. The owner-side panel already tracks this; just make
sure the admin form is not offered a second time.

---

## 4. High — A3 risk simulator does not exist

### Problem

**Where:** missing route `apps/web/src/app/admin/simulator/`; `simulate()` at
`apps/web/src/lib/valuation.ts:373` is never called; nothing in the UI links to it.

原则 13 states "A3 风险模拟要做", §5.2 specifies the page, and it is step 10 of the demo script. The
backend is done and deployed: `POST /simulator/run` answers 200 on Render and reproduces all eight
figures published in 商业模式 §5 (Plan A means +12.3% / +7.7% / +3.2% / −5.9%, loss shares 15 / 30 / 47 /
72%, Plan B trigger shares 6 / 9 / 13 / 45%, average costs 0.45 / 0.70 / 1.08 / 3.29%).

**Important when building the page — the ringgit basis.** The document's primitive result is a
*percentage of the valuation*. Its RM3,500 and RM26,000 come from applying those percentages to the
worked example's RM786,000 valuation, **not** from averaging ringgit over the 187 cases — the sample's own
mean valuation is RM944,511, so a per-case ringgit average gives RM7,354 and RM36,953 instead. The API
returns all three bases:

- `avg_topup_pct_of_valuation` — the primitive, matches the document exactly
- `avg_topup_per_deal` — the percentage restated at `reference_valuation_rm` (default 786,000)
- `avg_topup_per_deal_sample_weighted` — averaged using each case's own valuation

**Lead with the percentage.** If a ringgit figure is shown, state which valuation it uses. The reference
valuation is an overridable input and a constant, never a pre-filled scenario (原则 11).

### Solution

**Route:** `apps/web/src/app/admin/simulator/page.tsx`. `app/admin/layout.tsx` already guards the whole
`/admin` subtree by role, so no new auth work is needed. Add a nav entry for admins.

**Server side:** a server action calling `simulate(input)` from `apps/web/src/lib/valuation.ts:373`. It is
`server-only`, so the sliders live in a client component that posts to the action — the same pattern
`/valuation` already uses for `findRoads`.

**Inputs** (all optional; every default comes from the B3 constants, so hardcode nothing):

| Input | Range | Default |
|---|---|---|
| `plan_b_floor_ratio` | 0.50 – 0.95 | 0.75 |
| `plan_a_cost_pct` | 0 – 0.50 | 0.115 |
| `plan_a_buffer_pct` | 0 – 0.50 | 0.10 |
| `seller_agent_pct` | 0 – 0.20 | 0.032 |
| `seller_legal_pct` | 0 – 0.20 | 0.012 |
| `price_drop_pct` | 0 – 0.40 | 0 |
| `township` | optional filter | all 187 cases |

Out-of-range values return 422 with a readable message, so the sliders should simply be bounded to match.

**Display**, per §5.2 — "需补差额或会亏损的单的比例、每单平均成本、每单平均盈利":

- Plan B: `share_needing_topup`, and `avg_topup_pct_of_valuation` **as the headline figure**
- Plan A: `share_loss_making`, `avg_profit_pct`, `p10_profit_pct`
- `n_cases` — state that it is 187 backtest errors, and that this is a simulation, not a forecast
  (the response's `note` field says exactly that; render it)
- `ratio_histogram` — 10 bins, counts always sum to `n_cases`, which makes a simple bar chart safe

**The slide that matters.** Demo step 10 is "把房价下跌拉到 20%，显示方案 B 每单仍然盈利". At
`price_drop_pct = 0.20` the API returns Plan A at **−5.9%** (loss-making on the old-home leg, 72% of deals)
while Plan B's average cost is **3.29%** of the valuation — far below the ~RM159,000 profit on the new-home
sale. That contrast is the strongest argument in 商业模式 §5, so make it legible: show both plans side by
side and let the drop slider move them together.

**Do not re-derive any number in the frontend.** Every figure above comes straight from the response.

---

## 5. Medium — the 原则 14 number guard misses spelled-out numbers

### Problem

**Where:** `services/valuation/app/ai/guard.py:12` (`NUMBER_PATTERN`).

The guard is otherwise well built: `facts.py` pre-formats money, percentages and sizes into display
strings, and strips `distance` and `price_per_sqm` so the allowed-number set stays tight. Digit
hallucinations are correctly caught. Reproduced against the **real** facts payload built by
`build_explanation_facts()`:

```
ALLOWED   "Your home is worth about RM785,635."                            correct
ALLOWED   "Your home is worth about RM786,000."                            correct (nearest 1,000)
BLOCKED   "Your home is worth about RM950,000."            -> ['RM950,000']
BLOCKED   "We used 14 comparable sales."                   -> ['14']
ALLOWED   "worth roughly eight hundred and fifty thousand ringgit."        HOLE
ALLOWED   "We looked at fourteen recent sales on your road."               HOLE
BLOCKED   "Expect a 40% premium."                          -> ['40%']
```

`NUMBER_PATTERN` matches digits only, so a spelled-out numeral passes untouched. The prompt does say
*"Use only those facts and numbers"* and *"Do not invent locations, facts, or numbers"*
(`app/ai/prompts/explain_valuation.md`), but that is prompt-level mitigation. The guard is the
deterministic control, and "around eight hundred thousand" is a very natural phrasing for a friendly
three-sentence explanation — exactly the register the prompt asks for.

### Solution

Two parts, and the fallback machinery already exists — a guard failure already falls back to the template
and sets `source: "template"`, so only the detector and the prompts change.

**1. Prompts** — one line in each of `app/ai/prompts/explain_valuation.md` and `admin_assist.md`:

> Write every number as digits, exactly as it appears in the supplied facts. Never spell a number out as
> words.

**2. Detector** — in `services/valuation/app/ai/guard.py`, beside `NUMBER_PATTERN`:

```python
NUMBER_WORDS = frozenset({
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
    "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion",
    "dozen", "half", "quarter", "third", "double", "triple",
})
WORD_PATTERN = re.compile(r"[A-Za-z]+")


def number_words_in_text(text: str) -> list[str]:
    return [
        match.group(0)
        for match in WORD_PATTERN.finditer(text)
        if match.group(0).casefold() in NUMBER_WORDS
    ]
```

then include them in the existing check:

```python
def ungrounded_numbers(text: str, payload: Any) -> list[str]:
    offending = number_words_in_text(text)
    ...  # existing digit logic appends to the same list
```

**Watch for false positives** on the ordinary English senses of these words — "first", "second" are not in
the set, but "half" and "quarter" can appear innocently ("a quarter of the range"), and "one" shows up in
"one of the sales". If the eval cases start falling back too often, narrow the set to the ones that can
actually express a value — `hundred`, `thousand`, `million`, `billion`, `dozen` and the digits one
through twenty — since a fabricated amount almost always needs a magnitude word.

**Verify** with the existing `eval/smoke_explain.py --runs N`: the real-success rate should stay roughly
where it is. A sharp rise in template fallbacks means the word list is too broad, not that the model got
worse.

---

## 6. Low — flag rules exist in two places

### Problem

**Where:** `admin_application_flags` in `supabase/migrations/20261017142952_manual_valuation_workflow.sql`
and a TypeScript reimplementation at `apps/web/src/lib/admin-applications-model.ts:132`, which carries an
explicit `// Parity:` comment explaining the reason (the RPC triggers lazy expiry and the read-only model
must not change state).

The reasoning is sound, but the 80% quota threshold and the "confirmed value more than 10% below the AI
low" rule now have two implementations that must be changed together. Same class of hazard as the
`0.785` / `0.75` duplication below. Worth a comment on the SQL side pointing back at the TypeScript, so
whoever edits one finds the other.

### Solution

No behaviour change, and no migration — editing an applied migration is forbidden by rule 4, and this does
not warrant a new one. Add a comment above `admin_application_flags` in the **next** migration that
touches the file, or simply note the pairing in Task_track §4 (done). The TypeScript side already carries
its `// Parity:` comment; the missing half is the pointer in the other direction.

If a threshold does change before the deadline, change both in the same commit and say so in the message.
The two values to watch are the **80%** quota threshold and the **10%** below-AI-low gap.

---

## Verified healthy

Checked and found correct, so nobody needs to re-check:

- **Tests and build:** 171 Python tests pass, 10 skipped. `tsc --noEmit`, `eslint` and `next build` all
  clean across 16 routes.
- **No server-only leaks.** Two client components appear to import server-only libraries
  (`app/valuation/valuation-form.tsx`, `app/dashboard/applications/[id]/response-panel.tsx`) but both are
  `import type`, which is erased at compile time. No value import of a `server-only` module from a client
  component exists anywhere.
- **No `NEXT_PUBLIC_` misuse.** `VALUATION_API_URL` and `VALUATION_INTERNAL_KEY` stay server-side.
- **No broken internal links.** Every `href` in the UI resolves to a real route.
- **Audit-note privacy is correct.** `20261019191115` revokes `select (note, payload)` from
  `authenticated` and grants only the owner-safe columns. The `owner_message` backfill looks alarming at
  first read but is scoped `where actor_role = 'owner'`, and `write_application_event` only populates it
  when the actor is the owner — so admin notes are never exposed. The frontend reads only
  `to_status, created_at, action, reason` plus `owner_message`.
- **Timezone fix is complete and consistent.** `20261015084351` moved quota months to
  `at time zone 'Asia/Kuala_Lumpur'`, and so did the later `20261017142952` redefinitions. No bare
  `date_trunc` on a timestamp remains in either. This closes finding #8 from the previous review properly
  rather than partially — a half-applied fix would have been worse than the original bug.
- **Deployments are current.** Render serves the comparable-date fix (a comparable now reads `2023-12`,
  previously `2023-11`), plus `/simulator/run` and `/plans/quote`. The Vercel site serves the new code and
  redirects `/home`, `/dashboard`, `/valuation`, `/admin` to `/login?next=…` when signed out.
- **No leftover TODO/FIXME.** The "Coming soon" matches are legitimate labels for upcoming developments.
- **`provide_info` and `request_review` are wired, despite appearances.** Both are invoked by
  `submit_application_response`, not by their TypeScript helpers, so a search for `provideInfo` /
  `requestReview` wrongly suggests they are dead. Only `issue_offer` and `respond_review` are genuinely
  uninvoked. Worth knowing before auditing RPC coverage by helper name.
- **`expire_offers` is intentionally uninvoked.** Expiry is lazy, performed inside the workflow RPCs, so
  the standalone RPC needs no caller.

---

## Previously reported findings (2026-10-14 review)

**Fixed:**

| # | Finding | How |
|---|---|---|
| 6 | `net_at_floor` deducted a 3.2% agent fee on a guarantee purchase | now equals the floor price; Task_track §1.5 updated |
| 7 | `create_demo_users.py` reported success even when the role update matched no row | now asserts the response matched and exits non-zero |
| 8 | Quota months counted in UTC, not Malaysian time | `at time zone 'Asia/Kuala_Lumpur'`, applied consistently |
| 9 | `monthly_limits` seeded only to 2026-12 | seeded to 2027-06 |

**Still open:**

- **#1 — the estimate is not monotonic in land area.** Re-tested today against the deployed service,
  unchanged. Same road, same house type, built-up fixed at 190 m²:

  ```
  land=430  RM1,420,880
  land=480  RM1,348,384   <-- RM72,496 LESS for a bigger lot
  land=530  RM1,326,988   <-- drops again
  land=630  RM1,262,300   <-- drops again
  ```

  Cause: `estimate = median_ppsm * subject_floor_sqm`
  (`services/valuation/app/model/comps_knn.py:160`) scales only by built-up area; land affects which
  comparables are chosen but never the scaling, so a comparable-set swap makes the figure jump. Three
  approaches were measured previously — effective-area weighting cut the drops from 10 to 4, a distance
  cap did nothing, and only a kernel-weighted estimator removed them entirely, but that moved the central
  estimate to RM821,651 (+4.5%), which fails the golden test and invalidates the "误差中位数 10.1%" backtest
  claim in the deck. **This needs a team decision plus a backtest re-run, not a quiet code change.** It
  does not affect the demo path, because an intermediate unit uses the road's typical size.
- **#5 — the offer formula has two sources of truth.** `private.application_offer` hardcodes `0.785` and
  `0.75` (`supabase/migrations/20261014111603_application_workflow.sql:114`) while
  `app/plans/constants.py` derives them from 11.5% + 10% and 75%. They agree today. Changing a rate means
  editing Python *and* adding a new migration — rule 4 forbids editing the applied one.
- **#10 — `backtest_ratios` cannot be retried after a partial import.** `requires_empty=True` means a
  half-finished load must be truncated manually, and the README documents that only for `transactions`.

---

## Suggested order for the remaining time

About 2.5 days remain. Findings 1, 2 and 3 all live in the same two files
(`lib/admin-application-detail-model.ts` and `app/admin/applications/[id]/actions.ts`), so doing them
together is cheaper than doing them separately — one pass over the admin stage machine.

| Order | Finding | Why first | Rough shape |
|---|---|---|---|
| 1 | **2** — Plan B indicative | **Already written on `QY`.** Merging it unblocks the demo's first admin step | merge `QY` into `main` |
| 2 | **1** — issue formal offer | Unblocks ten finished controls and the end of the journey | one action + a confirm form |
| 3 | **4** — A3 simulator | 原则 13 mandates it; API is done, deployed, verified | one page, no backend work |
| 4 | **3** — review response | Completes §5.5's four owner options; only reachable after finding 1 | one action + a form |
| 5 | **5** — number-word guard | Protects the explanation on camera | ~15 lines + 2 prompt lines |
| 6 | **6** — flag comment | Housekeeping | a comment |

**Merge `QY` first.** Finding 2 is done there and nothing else should be built on top of a `main` that
still has the Plan B dead end — findings 1 and 3 touch the same two files, so merging first avoids a
conflict in `adminCaseActions()` and `ADMIN_ACTIONS`.

**Then run the demo script end to end**, because findings 1 and 2 are exactly the steps a page-by-page
review would not catch — each page works in isolation; it is the hand-off between stages that breaks.
Steps 6 through 9 are the ones that have never been executed.

Still outstanding from Task_track regardless: the end-to-end signed-in verification with the demo
accounts (owner → `/home`, admin → `/admin`, owner blocked from `/admin`), `scripts/verify_auth.py` for
the database side, the optional valuation photo upload, and the full demo run on Vercel.
