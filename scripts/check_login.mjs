// UI acceptance checks only: invalid submissions stop before Supabase calls.
// No accounts are created and no real sign-in credentials are submitted.
// Requires a running frontend, Playwright and Microsoft Edge.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.WELCOME_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const baseUrl = process.env.WELCOME_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = path.resolve(process.env.LOGIN_ARTIFACT_DIR ?? "apps/web/.next/login-qa");
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseUrl}/login?next=/valuation`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.equal(await page.getByRole("heading", { name: "Sign in", exact: true }).count(), 1);
  assert.equal(await page.locator("input[name='next']").inputValue(), "/valuation");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(247, 247, 239)");
  assert.match(await page.locator("footer").innerText(), /Act 242/);
  assert.match(await page.getByRole("heading", { level: 2 }).textContent(), /next chapter awaits/);
  assert.equal(await page.getByRole("link", { name: /Google|Forgot password/i }).count(), 0);
  assert.equal(await page.locator("input[type='email']").getAttribute("required"), "");

  await page.waitForFunction(() => document.querySelector("[data-auth-scene] video")?.readyState >= 2);
  const sceneVideo = page.locator("[data-auth-scene] video");
  const media = await sceneVideo.evaluate((video) => ({width:video.videoWidth,height:video.videoHeight,duration:video.duration,muted:video.muted,controls:video.controls}));
  assert.deepEqual([media.width,media.height], [960,600]);
  assert.ok(media.duration >= 14 && media.duration < 15);
  assert.equal(media.muted, true);
  assert.equal(media.controls, false);
  await page.waitForFunction(() => !document.querySelector("[data-auth-scene] video").paused);
  const frameHashes = await sceneVideo.evaluate(async (video) => {
    video.pause(); // Test-only pause, not a user-facing control.
    const canvas = document.createElement("canvas");
    canvas.width = 240; canvas.height = 150;
    const ctx = canvas.getContext("2d");
    const hashes = [];
    for (const time of [.8,2.5,4.4,6.4,8]) {
      await new Promise((resolve) => { video.addEventListener("seeked", resolve, {once:true}); video.currentTime = time; });
      ctx.drawImage(video,0,0,240,150);
      const pixels = ctx.getImageData(0,0,240,150).data;
      let hash = 2166136261;
      for (let i=0;i<pixels.length;i+=16) hash = Math.imul(hash ^ pixels[i],16777619);
      hashes.push(hash);
    }
    return hashes;
  });
  assert.equal(new Set(frameHashes).size, 5, "Distinct outline/closed/opening/open doorway frames");
  const lightLevels = await sceneVideo.evaluate(async (video) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    const levels = [];
    for (const time of [1.8,6.8,13.5]) {
      await new Promise((resolve) => { video.addEventListener("seeked", resolve, {once:true}); video.currentTime = time; });
      ctx.drawImage(video,0,0);
      const pixels = ctx.getImageData(550,340,8,8).data;
      let sum = 0;
      for (let i=0;i<pixels.length;i+=4) sum += (pixels[i]+pixels[i+1]+pixels[i+2])/3;
      levels.push(sum/(pixels.length/4));
    }
    return levels;
  });
  assert.ok(lightLevels[1] > lightLevels[0]+80, "The hinged leaf must uncover the warm interior, not simply fade");
  assert.ok(lightLevels[2] > lightLevels[0]+80, "The door must stay open during the ambient segment");
  await sceneVideo.evaluate(async (video) => { video.currentTime = 13.7; await video.play(); });
  await page.waitForFunction(() => {
    const scene = document.querySelector("[data-auth-scene]");
    const video = scene.querySelector("video");
    return scene.dataset.phase === "ambient" && !video.paused && video.currentTime >= 8 && video.currentTime < 10;
  });
  const authPage = page.locator("[data-auth-page]");
  const rect = await authPage.boundingBox();
  const formRect = await page.locator("[role='tablist']").boundingBox();
  await page.mouse.move(rect.x+rect.width*.15,rect.y+rect.height*.75);
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector("[data-auth-page]").style.getPropertyValue("--auth-x"))) > .1);
  assert.equal((await page.locator("[role='tablist']").boundingBox()).x, formRect.x, "Pointer depth must not move the form");
  await page.mouse.move(0,0);
  await page.waitForFunction(() => document.querySelector("[data-auth-page]").style.getPropertyValue("--auth-x") === "0px");
  console.log("PASS EffectCraft doorway decoding, distinct opening frames, revealed interior light, no automatic closing, ambient loop and pointer depth/form stability");

  const password = page.getByLabel("Password", { exact: true });
  await password.fill("view-only-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  assert.equal(await password.getAttribute("type"), "text");
  assert.equal(await password.inputValue(), "view-only-password");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  assert.equal(await password.getAttribute("type"), "password");
  assert.equal(await password.inputValue(), "view-only-password");

  await page.getByRole("tab", { name: "Sign in", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Create account", exact: true }).getAttribute("aria-selected"), "true");
  assert.equal(await password.getAttribute("minlength"), "8");
  assert.equal(await password.getAttribute("autocomplete"), "new-password");
  assert.equal(await page.locator("input[name='next']").inputValue(), "/valuation");
  await page.getByLabel("Email address").fill("ui-only@example.invalid");
  await password.fill("short");
  assert.equal(await password.evaluate((input) => input.validity.tooShort), true);
  await page.keyboard.press("Tab");
  await page.getByRole("tab", { name: "Create account", exact: true }).focus();
  await page.keyboard.press("Home");
  assert.equal(await page.getByRole("tab", { name: "Sign in", exact: true }).getAttribute("aria-selected"), "true");
  assert.equal(await password.getAttribute("minlength"), null);
  assert.equal(await password.getAttribute("autocomplete"), "current-password");
  console.log("PASS theme, next destination, password visibility/value preservation, keyboard tabs and existing validation rules");

  // Delay actual local server actions to inspect pending feedback. Empty sign-in
  // and short registration are rejected locally, before any Supabase mutation.
  await page.route("**/login?next=/valuation", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 650));
    await route.continue();
  });
  await page.locator("form").evaluate((form) => { form.noValidate = true; });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const pending = page.getByRole("button", { name: "Signing in…", exact: true });
  await pending.waitFor();
  assert.equal(await pending.isDisabled(), true);
  assert.equal(await page.locator("form").getAttribute("aria-busy"), "true");
  assert.equal(await page.getByRole("tab", { name: "Create account", exact: true }).isDisabled(), true);
  const formError = page.locator("form p[role='alert']");
  await formError.waitFor();
  assert.match(await formError.innerText(), /Enter your email address and password/);
  assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isEnabled(), true);
  await page.screenshot({ path: path.join(artifactDir, "sign-in-error.png"), fullPage: true });

  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Email address").fill("ui-only@example.invalid");
  await password.fill("short");
  await page.locator("form").evaluate((form) => { form.noValidate = true; });
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Creating account…", exact: true }).waitFor();
  await formError.waitFor();
  assert.match(await formError.innerText(), /at least 8 characters/);
  assert.equal(await page.locator("input[name='next']").inputValue(), "/valuation");
  await page.screenshot({ path: path.join(artifactDir, "create-account-error.png"), fullPage: true });
  console.log("PASS actual server-action validation, loading feedback, duplicate-submit prevention and styled errors; no Auth API submissions");

  for (const [name, width, height] of [["desktop",1440,1000],["tablet",768,1024],["mobile",390,844],["small-mobile",320,800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/login?next=/valuation`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("[data-auth-scene] video")?.readyState >= 2);
    await page.locator("[data-auth-scene] video").evaluate(async (video) => {
      video.pause();
      await new Promise((resolve) => { video.addEventListener("seeked", resolve, {once:true}); video.currentTime = 8; });
    });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("[role='tablist']").parentElement.parentElement).opacity) >= .99);
    for (const mode of ["Sign in", "Create account"]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(size.content <= size.viewport, `${name}/${mode}: horizontal overflow`);
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      await page.screenshot({ path: path.join(artifactDir, `${name}-${mode === "Sign in" ? "sign-in" : "create-account"}.png`), fullPage: true, animations: "disabled" });
    }
    console.log(`PASS ${name} ${width}px, both modes: no overflow; screenshots saved`);
  }

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  const reducedVideoRequests = [];
  reducedPage.on("request", (request) => { if (new URL(request.url()).pathname.endsWith(".mp4")) reducedVideoRequests.push(request.url()); });
  await reducedPage.goto(`${baseUrl}/login?next=/valuation`, { waitUntil: "networkidle" });
  assert.equal(await reducedPage.locator("video").count(), 0);
  assert.equal(reducedVideoRequests.length, 0);
  assert.equal(await reducedPage.locator("[data-auth-scene] img").evaluate((image) => image.complete && image.naturalWidth > 0), true);
  assert.equal(await reducedPage.locator("[data-auth-page]").evaluate((root) => root.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0);
  await reducedPage.keyboard.press("Tab");
  assert.equal(await reducedPage.evaluate(() => document.activeElement.textContent), "Skip to content");
  await reducedPage.getByLabel("Email address").focus();
  assert.equal(await reducedPage.getByLabel("Email address").evaluate((input) => getComputedStyle(input).boxShadow !== "none"), true);
  await reducedPage.emulateMedia({ reducedMotion: "no-preference" });
  await reducedPage.waitForFunction(() => document.querySelector("[data-auth-scene] video")?.readyState >= 2);
  await reducedPage.waitForFunction(() => document.querySelector("[data-auth-page]").getAnimations({ subtree: true }).some((animation) => animation.playState === "running"));
  await reducedPage.emulateMedia({ reducedMotion: "reduce" });
  await reducedPage.waitForFunction(() => !document.querySelector("[data-auth-scene] video"));
  assert.equal(await reducedPage.locator("[data-auth-page]").evaluate((element) => element.style.getPropertyValue("--auth-x")), "0px");
  assert.equal(await reducedPage.locator("[data-auth-page]").evaluate((root) => root.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0);
  console.log("PASS reduced motion: decoded poster, no initial video request, immediate live stop/reset; keyboard focus preserved");
  const fallback = await browser.newContext();
  await fallback.route("**/animations/homeloop-login.mp4*", (route) => route.abort());
  const fallbackPage = await fallback.newPage();
  await fallbackPage.goto(`${baseUrl}/login?next=/valuation`, {waitUntil:"networkidle"});
  await fallbackPage.waitForFunction(() => !document.querySelector("[data-auth-scene] video"));
  assert.equal(await fallbackPage.locator("[data-auth-scene] img").isVisible(), true);
  const noScript = await browser.newContext({javaScriptEnabled:false});
  const staticPage = await noScript.newPage();
  await staticPage.goto(`${baseUrl}/login?next=/valuation`, {waitUntil:"networkidle"});
  assert.equal(await staticPage.locator("[data-auth-scene] img").isVisible(), true);
  assert.equal(await staticPage.locator("video").count(), 0);
  assert.equal(await staticPage.getByRole("heading", {name:"Sign in",exact:true}).isVisible(), true);
  console.log("PASS video failure and JavaScript-disabled artwork/content fallback");
  assert.deepEqual(errors, [], "Unexpected browser runtime errors");
  console.log("PASS no browser runtime errors; screenshots:", artifactDir);
} finally {
  await browser.close();
}
