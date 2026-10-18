// Browser acceptance checks. Requires Playwright and an installed Edge browser.
// Start the web app first. Optional environment variables:
// WELCOME_BASE_URL, WELCOME_ARTIFACT_DIR, WELCOME_PLAYWRIGHT_MODULE.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.WELCOME_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const baseUrl = process.env.WELCOME_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = path.resolve(process.env.WELCOME_ARTIFACT_DIR ?? "apps/web/.next/welcome-qa");
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator("h1").count(), 1);
  assert.match(await page.locator("h1").innerText(), /Your next chapter/);
  assert.equal(await page.getByRole("link", { name: "Value my home for free", exact: true }).getAttribute("href"), "/login?next=/valuation");
  assert.equal(await page.getByRole("link", { name: "Get my free valuation", exact: true }).getAttribute("href"), "/login?next=/valuation");
  assert.equal(await page.locator("#how-it-works ol > li").count(), 4);
  assert.equal(await page.locator("#our-plans article").count(), 2);
  assert.match(await page.locator("footer").innerText(), /Act 242/);
  for (const name of ["How it works", "Our plans", "See how it works", "Sign in"]) {
    assert.equal(await page.getByRole("link", { name, exact: true }).count(), 0);
  }
  assert.equal(await page.locator("a[href='#how-it-works'], a[href='/#how-it-works'], a[href='#our-plans'], a[href='/#our-plans'], a[href='/login']").count(), 0);
  assert.equal(await page.locator("[data-hero-scene] button").count(), 0);
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && video.readyState >= 2 && video.videoWidth > 0;
  });
  const videoInfo = await page.locator("video").evaluate((video) => ({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, muted: video.muted, loop: video.loop }));
  assert.equal(videoInfo.width, 760);
  assert.equal(videoInfo.height, 700);
  assert.ok(videoInfo.duration > 12 && videoInfo.duration < 14);
  assert.equal(videoInfo.muted, true);
  assert.equal(videoInfo.loop, false);
  // Playback starts automatically; there are no user-facing playback controls.
  assert.equal(await page.locator("video").evaluate((video) => video.controls), false);
  await page.waitForFunction(() => !document.querySelector("video").paused);
  const frameHashes = await page.locator("video").evaluate(async (video) => {
    video.pause(); // Test-only pause to sample decoded frames deterministically.
    const canvas = document.createElement("canvas");
    canvas.width = 190; canvas.height = 175;
    const context = canvas.getContext("2d");
    const hashes = [];
    for (const time of [0.6,1.5,3.4,5.4,8.8]) {
      await new Promise((resolve) => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = time; });
      context.drawImage(video,0,0,190,175);
      const pixels = context.getImageData(0,0,190,175).data;
      let hash = 2166136261;
      for (let i=0;i<pixels.length;i+=16) hash = Math.imul(hash ^ pixels[i],16777619);
      hashes.push(hash);
    }
    return hashes;
  });
  assert.equal(new Set(frameHashes).size, 5, "The five construction/travel/arrival frames should visibly differ");
  await page.locator("video").evaluate(async (video) => { video.currentTime = 12.7; await video.play(); });
  await page.waitForFunction(() => document.querySelector("[data-scene-phase]")?.dataset.scenePhase === "ambient");
  await page.waitForFunction(() => { const v = document.querySelector("video"); return !v.paused && v.currentTime >= 9 && v.currentTime < 11; });
  assert.equal(await page.locator("[data-hero-scene] button").count(), 0);
  const scene = page.locator("[data-hero-scene]");
  const rect = await scene.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height * 0.6);
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector("[data-hero-scene]").style.getPropertyValue("--scene-x"))) > 0.1);
  assert.ok((await scene.evaluate((element) => element.style.getPropertyValue("--scene-x"))).endsWith("px"));
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector("[data-hero-scene]").style.getPropertyValue("--scene-x") === "0px");
  console.log("PASS requested links/controls absent; automatic playback, cinematic frames, ambient loop and pointer depth unchanged");

  await page.locator("#how-it-works ol").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#how-it-works ol").dataset.revealed === "true");
  await page.locator("#our-plans article").first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#our-plans article")).every((element) => element.dataset.revealed === "true" && element.getAnimations().length === 0));
  await page.locator("#our-plans article").first().hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#our-plans article")).transform !== "none");
  await page.getByRole("link", { name: "Get my free valuation", exact: true }).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("section[aria-labelledby='start-heading']").dataset.revealed === "true");
  console.log("PASS scroll reveals, workflow line, plan hover and final CTA path trigger");
  await page.getByRole("link", { name: "HomeLoop home", exact: true }).click();
  await page.waitForURL(baseUrl + "/");

  for (const [name, width, height] of [["desktop",1440,1000],["tablet",768,1024],["mobile",390,844],["small-mobile",320,800]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0,0));
    await page.locator("video").evaluate(async (video) => {
      video.pause();
      if (Math.abs(video.currentTime - 9) > 0.01) {
        await new Promise((resolve) => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = 9; });
      }
    });
    // Inspect the settled layout after responsive navigation changes.
    await page.waitForFunction(() => {
      const copy = document.querySelector("h1").parentElement;
      const visual = document.querySelector("video")?.closest("section > div:last-child")
        ?? document.querySelector("img[alt^='Two illustrated homes']")?.closest("section > div:last-child");
      return Number(getComputedStyle(copy).opacity) >= 0.99
        && (!visual || Number(getComputedStyle(visual).opacity) >= 0.99);
    });
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(dimensions.content <= dimensions.viewport, `${name} horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true, animations: "disabled" });
    if (name === "desktop") {
      await page.screenshot({ path: path.join(artifactDir, "desktop-hero.png"), animations: "disabled" });
    }
    console.log(`PASS ${name} ${width}px: no horizontal overflow; screenshot saved`);
  }

  await page.getByRole("link", { name: "Value my home for free", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  assert.equal(new URL(page.url()).searchParams.get("next"), "/valuation");
  assert.equal(await page.getByRole("heading", { name: "Sign in", exact: true }).isVisible(), true);
  console.log("PASS valuation CTA opens login and preserves the valuation destination");

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  const videoRequests = [];
  reducedPage.on("request", (request) => { if (new URL(request.url()).pathname.endsWith(".mp4")) videoRequests.push(request.url()); });
  await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await reducedPage.locator("video").count(), 0);
  assert.equal(videoRequests.length, 0);
  assert.equal(await reducedPage.getByAltText(/Two illustrated homes/).isVisible(), true);
  assert.equal(await reducedPage.getByAltText(/Two illustrated homes/).evaluate((image) => image.complete && image.naturalWidth > 0), true);
  await reducedPage.screenshot({ path: path.join(artifactDir, "reduced-motion.png"), fullPage: true });
  await reducedPage.keyboard.press("Tab");
  assert.equal(await reducedPage.evaluate(() => document.activeElement.textContent), "Skip to content");
  await reducedPage.keyboard.press("Enter");
  assert.equal(new URL(reducedPage.url()).hash, "#main-content");
  console.log("PASS reduced motion: static artwork, no video request; keyboard skip link works");

  await reducedPage.emulateMedia({ reducedMotion: "no-preference" });
  await reducedPage.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  await reducedPage.emulateMedia({ reducedMotion: "reduce" });
  await reducedPage.waitForFunction(() => !document.querySelector("video"));
  assert.equal(await reducedPage.evaluate(() => document.querySelector("[data-welcome-page]").getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0);
  console.log("PASS changing reduced-motion preference stops scene and page animations immediately");

  const noVideo = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await noVideo.route("**/animations/*.mp4*", (route) => route.abort());
  const fallbackPage = await noVideo.newPage();
  await fallbackPage.goto(baseUrl, { waitUntil: "networkidle" });
  await fallbackPage.waitForFunction(() => !document.querySelector("video"));
  assert.equal(await fallbackPage.getByAltText(/Two illustrated homes/).isVisible(), true);
  console.log("PASS video failure: static artwork remains visible");
  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const staticPage = await noScript.newPage();
  await staticPage.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await staticPage.locator("h1").isVisible(), true);
  assert.equal(await staticPage.locator("#how-it-works li").count(), 4);
  assert.equal(await staticPage.getByAltText(/Two illustrated homes/).isVisible(), true);
  assert.equal(await staticPage.locator("video").count(), 0);
  console.log("PASS JavaScript disabled: introduction, steps, artwork and links remain available");
  assert.deepEqual(errors, [], "Unexpected browser runtime errors");
  console.log("PASS no browser runtime errors; screenshots:", artifactDir);
} finally {
  await browser.close();
}
