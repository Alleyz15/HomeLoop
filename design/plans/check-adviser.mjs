// Local-only visual fixture; does not contact the application, Supabase or any API.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const modulePath = process.env.WELCOME_PLAYWRIGHT_MODULE || "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(modulePath).href);
const css = await readFile(path.join(root, "apps/web/src/app/plans/adviser.module.css"), "utf8");
async function asset(name) {
  try { return "data:image/webp;base64," + (await readFile(path.join(root, "apps/web/public/plans/adviser", name + ".webp"))).toString("base64"); }
  catch { if (name === "head-blink") return asset("head"); throw new Error(`Missing asset: ${name}`); }
}
const [arm, torso, head, blink] = await Promise.all(["arm", "torso", "head", "head-blink"].map(asset));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 440 }, reducedMotion: "reduce" });
  const img = (url) => `<img src="${url}" style="position:absolute;width:100%;height:100%;inset:0" alt="">`;
  await page.setContent(`<style>html,body{margin:0;background:#f7f5eb}${css}</style><div class="stage" data-plan="none"><div class="halo"></div><div class="figure"><div class="breath"><div class="armDirection"><div class="arm">${img(arm)}</div></div><div class="torso">${img(torso)}</div><div class="headDirection"><div class="head">${img(head)}<div class="blink">${img(blink)}</div></div></div></div></div></div>`);
  await page.locator("img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "Reduced-motion pose must be completely static");
  await page.screenshot({ path: path.join(here, "adviser-preview.png") });
  const forcedBlink = await page.addStyleTag({ content: ".blink{display:block!important;opacity:1!important}" });
  await page.screenshot({ path: path.join(here, "adviser-preview-blink.png") });
  await forcedBlink.evaluate((element) => element.remove());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(50);
  const animations = await page.evaluate(() => document.getAnimations().map((animation) => animation.animationName));
  for (const name of ["adviser-breathe", "adviser-attentive", "adviser-present", "adviser-blink"]) assert.ok(animations.includes(name), `${name} must animate an independent part`);
  await page.addStyleTag({ content: ".armDirection,.headDirection{transition:none!important}" });
  const headPose = async () => page.locator(".headDirection").evaluate((element) => getComputedStyle(element).transform);
  await page.locator(".stage").evaluate((element) => { element.dataset.plan = "A"; });
  const poseA = await headPose();
  await page.locator(".stage").evaluate((element) => { element.dataset.plan = "B"; });
  assert.notEqual(await headPose(), poseA, "Plan selection must change the adviser's head pose");
  console.log("Adviser previews saved; static reduced motion, four independent motions and responsive plan pose verified.");
} finally { await browser.close(); }
