import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

async function loadTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
}

const { postAuthPathFor, brandPathFor, isApplicationPath } = await loadTs("../apps/web/src/lib/auth-routing.ts");
const { emptyRoadSearch, emptyValuationForm } = await loadTs("../apps/web/src/app/valuation/state.ts");

test("admin role wins over every requested destination", () => {
  for (const next of [undefined, "", "/valuation", "/admin/simulator", "/dashboard", "https://example.test"]) {
    assert.equal(postAuthPathFor("admin", next), "/admin");
  }
});

test("owner retains only permitted, normalized in-app destinations", () => {
  for (const next of ["/valuation", "/valuation/result/123?view=details#top", "/new-home/project-1", "/plans?home=42", "/apply", "/dashboard"]) {
    assert.equal(postAuthPathFor("owner", next), next);
  }
  for (const next of [undefined, "", "/", "/login", "/admin", "/admin/simulator", "/administrator", "/guide", "https://example.test", "//example.test", "/\\example.test", "/valuation/../admin", "/valuation/../../admin", "/valuation-extra", "/%61dmin", "/\n/example.test"]) {
    assert.equal(postAuthPathFor("owner", next), "/dashboard", String(next));
  }
});

test("public-page brand stays public; application brands return to the role landing page", () => {
  for (const path of ["/", "/login", "/guide", "/unknown"]) {
    assert.equal(isApplicationPath(path), false);
    assert.equal(brandPathFor(path, "admin"), "/");
    assert.equal(brandPathFor(path, "owner"), "/");
  }
  assert.equal(brandPathFor("/admin", "admin"), "/admin");
  assert.equal(brandPathFor("/admin/applications/123", "admin"), "/admin");
  assert.equal(brandPathFor("/valuation", "owner"), "/dashboard");
  assert.equal(brandPathFor("/admin"), "/");
});

test("valuation initial states are plain objects and action modules export functions only", async () => {
  assert.equal(typeof emptyRoadSearch, "object");
  assert.deepEqual(emptyRoadSearch.results, []);
  assert.equal(emptyRoadSearch.results.length, 0);
  assert.deepEqual(emptyValuationForm, { error: null });
  const actions = await readFile(new URL("../apps/web/src/app/valuation/actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(actions, /export\s+(?:const|let|var|default)\b/);
  const form = await readFile(new URL("../apps/web/src/app/valuation/valuation-form.tsx", import.meta.url), "utf8");
  assert.match(form, /import\s*\{\s*emptyRoadSearch,\s*emptyValuationForm\s*\}\s*from\s*"\.\/state"/);
});
