import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(
  new URL("../apps/web/src/lib/valuation-copy.ts", import.meta.url),
  "utf8",
);
const valuationCopy = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);

test("intermediate auto-fill explains a single recent sale without a misleading share", () => {
  assert.equal(
    valuationCopy.intermediateAutoFillCopy({
      recentSales: 1,
      land: "388 m²",
      floor: "222 m²",
      typicalShare: 1,
    }),
    "Filled in from the only recent sale on this road (388 m² land, 222 m² built-up). Please check these match your home.",
  );
});

test("intermediate auto-fill names a small sample of two to four sales", () => {
  for (const recentSales of [2, 3, 4]) {
    assert.equal(
      valuationCopy.intermediateAutoFillCopy({
        recentSales,
        land: "164 m²",
        floor: "180 m²",
        typicalShare: 0.75,
      }),
      `Filled in from the ${recentSales} recent sales on this road (164 m² land, 180 m² built-up). Please check these match your home.`,
    );
  }
});

test("intermediate auto-fill keeps the established share wording for five or more sales", () => {
  assert.equal(
    valuationCopy.intermediateAutoFillCopy({
      recentSales: 5,
      land: "164 m²",
      floor: "180 m²",
      typicalShare: 0.8,
    }),
    "Filled in from this road: 164 m² land and 180 m² built-up, which 80% of these homes share.",
  );
});
