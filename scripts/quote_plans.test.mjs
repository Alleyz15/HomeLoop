import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Exercise the real server helper without installing Next.js. Only its
// framework-specific server-only marker is removed for this Node test.
const source = await readFile(
  new URL("../apps/web/src/lib/valuation.ts", import.meta.url),
  "utf8",
);
const javascript = stripTypeScriptTypes(source.replace('import "server-only";', ""));
const { quotePlans } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

test("quotePlans sends whole-RM valuations without changing the saved input", async (t) => {
  const originalUrl = process.env.VALUATION_API_URL;
  const originalKey = process.env.VALUATION_INTERNAL_KEY;
  t.after(() => {
    for (const [name, value] of [
      ["VALUATION_API_URL", originalUrl],
      ["VALUATION_INTERNAL_KEY", originalKey],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.VALUATION_API_URL = "https://valuation.example.test";
  process.env.VALUATION_INTERNAL_KEY = "test-only-key";

  const input = {
    valuation: {
      estimate: 785635.36,
      low: 742127.49,
      high: 877737.5,
      confidence: "medium",
      scheme: "BUKIT JELUTONG, SHAH ALAM",
      is_sdp: true,
      tenure: "Freehold",
    },
    new_home: { launch_id: 1, sales_quote_rm: 809888.25 },
  };
  const originalInput = structuredClone(input);
  const apiResponse = { plan_a: { offer: 616723 }, plan_b: { floor: 589226 } };
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://valuation.example.test/plans/quote");
    assert.equal(init.method, "POST");
    assert.equal(init.headers["X-Internal-Key"], "test-only-key");
    const sent = JSON.parse(init.body);
    assert.deepEqual(sent, {
      ...originalInput,
      valuation: {
        ...originalInput.valuation,
        estimate: 785635,
        low: 742127,
        high: 877738,
      },
    });
    // The normalized request reproduces the deck's whole-RM offers.
    assert.equal(Math.round(sent.valuation.estimate * 0.785), 616723);
    assert.equal(Math.round(sent.valuation.estimate * 0.75), 589226);
    return Response.json(apiResponse);
  });

  assert.deepEqual(await quotePlans(input), apiResponse);
  assert.deepEqual(input, originalInput);
  // Reusing an already-rounded valuation must produce the same request.
  await quotePlans({
    ...input,
    valuation: { ...input.valuation, estimate: 785635, low: 742127, high: 877738 },
  });
  assert.equal(fetchMock.mock.callCount(), 2);
});
