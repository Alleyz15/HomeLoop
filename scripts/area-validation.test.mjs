import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(
  new URL("../apps/web/src/lib/units.ts", import.meta.url),
  "utf8",
);
const units = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);

test("area limit uses recorded maximum, typical size, then fallback", () => {
  assert.deepEqual(units.areaLimit(295, 245), {
    maxSqm: 395,
    source: "recorded",
  });
  assert.deepEqual(units.areaLimit(null, 245), {
    maxSqm: 345,
    source: "typical",
  });
  assert.deepEqual(units.areaLimit(null, null), {
    maxSqm: 1000,
    source: "fallback",
  });
});

test("area validation distinguishes missing, invalid and excessive values", () => {
  const limit = units.areaLimit(295, 245);

  assert.equal(
    units.validateAreaInput("", "sqm", "Land area", limit).error,
    "Enter the land area.",
  );
  for (const value of ["letters", "0", "-2"]) {
    assert.equal(
      units.validateAreaInput(value, "sqm", "Land area", limit).error,
      "Enter a valid land area greater than 0.",
    );
  }
  assert.match(
    units.validateAreaInput("396", "sqm", "Land area", limit).error,
    /must not exceed 395 m²/,
  );
  assert.deepEqual(
    units.validateAreaInput("395", "sqm", "Land area", limit),
    { sqm: 395, error: null },
  );
});

test("square-foot input uses and displays the same square-metre cap", () => {
  const limit = units.areaLimit(295, 245);
  const maxSqft = units.fromSqm(limit.maxSqm, "sqft");

  assert.equal(
    units.validateAreaInput(String(maxSqft), "sqft", "Land area", limit).error,
    null,
  );
  assert.match(
    units.validateAreaInput(String(maxSqft + 1), "sqft", "Land area", limit)
      .error,
    /4,252 sq ft/,
  );
});
