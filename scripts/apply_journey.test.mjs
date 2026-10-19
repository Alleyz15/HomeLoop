import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../apps/web/src/lib/apply-journey.ts", import.meta.url), "utf8");
const { applicationJourney } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const stage = (steps, id) => steps.find(step => step.id === id);

test("priced A and B explain initial-range consent before the correct home visit", () => {
  for (const plan of ["A", "B"]) {
    const steps = applicationJourney(plan, "priced", "Freehold");
    assert.deepEqual(steps.slice(0, 5).map(step => step.id), ["review", "consent", "visit", "offer", "sign"]);
    assert.match(stage(steps, "consent").title, /initial price range/);
    assert.match(stage(steps, "consent").note, /only after you agree/);
    assert.match(stage(steps, "offer").time, /14 days/);
  }
  assert.equal(stage(applicationJourney("A", "priced", null), "visit").title, "Meet the registered valuer");
  const b = applicationJourney("B", "priced", null);
  assert.equal(stage(b, "visit").title, "Arrange a home inspection");
  assert.match(stage(b, "visit").body, /SDP team member or partner agent/);
});

test("manual A and B explain separate visit consent and never invent an indicative range", () => {
  for (const plan of ["A", "B"]) {
    const steps = applicationJourney(plan, "manual", "Freehold");
    assert.match(stage(steps, "consent").body, /No initial price range is invented/);
    assert.match(stage(steps, "consent").note, /PDPA consent.*not consent to a visit/);
    assert.equal(stage(steps, "visit").title, "Meet the registered valuer");
    assert.doesNotMatch(JSON.stringify(steps), /RM\s*[\d,]+/);
  }
});

test("leasehold consent is conditional and placed before completion; B retains buyer and fallback stages", () => {
  for (const plan of ["A", "B"]) for (const mode of ["priced", "manual"]) {
    const steps = applicationJourney(plan, mode, "Leasehold");
    assert.match(stage(steps, "consent-state").time, /1–3 months/);
    assert.ok(steps.findIndex(step => step.id === "consent-state") < steps.findIndex(step => step.id === "complete"));
    assert.equal(stage(applicationJourney(plan, mode, "Freehold"), "consent-state"), undefined);
    assert.equal(stage(applicationJourney(plan, mode, null), "consent-state"), undefined);
    assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
    for (const step of steps) {
      for (const key of ["title", "time", "body", "note"]) assert.ok(step[key].trim().length > 0, `${step.id}.${key}`);
      assert.ok(step.body.length > 40 && step.note.length > 40, `${step.id} needs a useful plain-language explanation`);
    }
  }
  const b = applicationJourney("B", "priced", "Freehold");
  assert.match(stage(b, "market").body, /confirmed floor/);
  assert.match(stage(b, "old-spa").time, /14 working days/);
  assert.match(stage(b, "complete").note, /more than a year/);
  assert.match(stage(b, "handover").time, /24 or 36 months/);
  assert.equal(stage(applicationJourney("A", "priced", null), "market"), undefined);
});

test("useful notes and amounts stay on the pages, and reduced-motion covers all new animation", async () => {
  const read = path => readFile(new URL(`../apps/web/src/app/${path}`, import.meta.url), "utf8");
  const apply = await read("apply/page.tsx"), details = await read("plans/[plan]/page.tsx");
  for (const text of ["RPGT retention estimate", "Outstanding loans", "You do not need to upload", "Amounts follow the registered valuation", "60 days", "90 days", "3% retention assumption", "sixth year", "not your live application progress"]) assert.ok(apply.includes(text), text);
  for (const text of ["Indicative guarantee floor", "rounding_adjustment", "RPGT retention estimate", "not added again", "Expected range after assumed selling fees"]) assert.ok(details.includes(text), text);
  const css = await read("apply/apply.module.css");
  assert.match(css, /prefers-reduced-motion: reduce.*\.page \*/s);
  assert.match(css, /guidePulse/);
  const plansCss = await read("plans/plans.module.css");
  assert.match(plansCss, /\.page\[data-plan-calculation\] \.math > div/);
});
