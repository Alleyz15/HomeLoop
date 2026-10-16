// Successful-login regression using the real production Next.js actions/layouts
// against a LOCAL auth/profile stub. Never connects to the hosted Supabase API.
// Builds once with test-only public configuration, tests on port 3100, then
// restores a production build using the original environment even if QA fails.
// Stop the normal frontend before running. No real credentials are required.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps/web");
const nextCli = path.join(webDir, "node_modules/next/dist/bin/next");
const qaPort = Number(process.env.AUTH_QA_PORT ?? 3100);
const baseUrl = `http://127.0.0.1:${qaPort}`;
const accounts = {
  "admin@navigation.test": { id: "10000000-0000-4000-8000-000000000001", role: "admin" },
  "owner@navigation.test": { id: "10000000-0000-4000-8000-000000000002", role: "owner" },
};
const errors = [];
let authUrl;
let qaProcess;
let browser;
let changedBuild = false;

function tokenFor(email) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:accounts[email].id,email,aud:"authenticated",role:"authenticated",iss:authUrl+"/auth/v1",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return token + "." + createHmac("sha256", "navigation-test-secret-only").update(token).digest("base64url");
}

function userFor(email) {
  return { id: accounts[email].id, email, aud:"authenticated", role:"authenticated", email_confirmed_at:"2026-01-01T00:00:00Z", app_metadata:{provider:"email",providers:["email"]}, user_metadata:{}, identities:[], created_at:"2026-01-01T00:00:00Z" };
}

const auth = createServer(async (request, response) => {
  const url = new URL(request.url, authUrl);
  const reply = (status, body) => { response.writeHead(status, {"Content-Type":"application/json"}); response.end(body === undefined ? undefined : JSON.stringify(body)); };
  let email;
  try { email = JSON.parse(Buffer.from((request.headers.authorization ?? "").split(".")[1], "base64url")).email; } catch { /* no bearer session */ }
  if (request.method === "POST" && url.pathname === "/auth/v1/token") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    if (!accounts[body.email] || body.password !== "navigation-test-password") return reply(400, {error:"invalid_grant",error_description:"Invalid login credentials"});
    return reply(200, {access_token:tokenFor(body.email),refresh_token:"test-refresh-"+accounts[body.email].role,token_type:"bearer",expires_in:3600,user:userFor(body.email)});
  }
  if (url.pathname === "/auth/v1/user") return accounts[email] ? reply(200, userFor(email)) : reply(401, {message:"No test session"});
  if (url.pathname === "/auth/v1/logout") return reply(204);
  if (url.pathname === "/rest/v1/profiles") return accounts[email] ? reply(200, [{role:accounts[email].role}]) : reply(401, {message:"No test session"});
  // The owner landing page now reads its saved records; this account is new.
  if (request.method === "GET" && ["/rest/v1/valuation_requests", "/rest/v1/applications"].includes(url.pathname)) return accounts[email] ? reply(200, []) : reply(401, {message:"No test session"});
  errors.push(`Unexpected local auth request: ${request.method} ${url.pathname}`);
  reply(404, {message:"No test endpoint"});
});

function startNext(args, env) {
  return spawn(process.execPath, [nextCli, ...args], {cwd:webDir,env,stdio:["ignore","pipe","pipe"],windowsHide:true});
}

async function build(env) {
  const child = startNext(["build"], env);
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  const status = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  if (status !== 0) { console.error(log); throw new Error(`Next.js build exited ${status}`); }
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await exited;
}

try {
  await new Promise((resolve) => auth.listen(0, "127.0.0.1", resolve));
  authUrl = `http://127.0.0.1:${auth.address().port}`;
  const originalEnv = {...process.env,NEXT_TELEMETRY_DISABLED:"1"};
  const testEnv = {...originalEnv,NEXT_PUBLIC_SUPABASE_URL:authUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:"navigation-test-anon-key"};
  changedBuild = true;
  console.log("Building isolated auth QA frontend (test configuration only)…");
  await build(testEnv);
  qaProcess = startNext(["start","--hostname","127.0.0.1","--port",String(qaPort)], testEnv);
  let serverLog = "";
  qaProcess.stdout.on("data", (chunk) => { serverLog += chunk; });
  qaProcess.stderr.on("data", (chunk) => { serverLog += chunk; });
  let ready = false;
  for (let attempt=0;attempt<60;attempt++) {
    try { if ((await fetch(baseUrl+"/login")).ok) { ready=true; break; } } catch { /* starting */ }
    if (qaProcess.exitCode !== null) throw new Error(serverLog);
    await new Promise((resolve) => setTimeout(resolve,500));
  }
  assert.ok(ready, "Isolated frontend did not start: "+serverLog);
  const modulePath = process.env.WELCOME_PLAYWRIGHT_MODULE;
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
  browser = await chromium.launch({channel:"msedge",headless:true});

  for (const [email,{role}] of Object.entries(accounts)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl+"/login?next=/valuation");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password",{exact:true}).fill("navigation-test-password");
    await page.getByRole("button",{name:"Sign in",exact:true}).click();
    const destination = role === "admin" ? "/admin" : "/valuation";
    await page.waitForURL(baseUrl+destination);
    if (role === "admin") {
      await page.getByRole("heading",{name:"Applications",exact:true}).waitFor();
    } else {
      await page.getByRole("heading",{name:"Where is your home?",exact:true}).waitFor();
      await page.getByRole("textbox",{name:"Road, township or scheme name"}).fill("a");
      await page.getByRole("button",{name:"Search",exact:true}).click();
      await page.getByText("Type at least two characters.",{exact:true}).waitFor();
    }
    assert.match(await page.locator("header").innerText(), new RegExp(email.replaceAll(".","\\.")));
    const landing = role === "admin" ? "/admin" : "/home";
    assert.equal(await page.getByRole("link",{name:"HomeLoop home",exact:true}).getAttribute("href"), landing);
    assert.equal(await page.locator("footer a").getAttribute("href"), landing);
    await page.locator("footer a").click();
    await page.waitForURL(baseUrl+landing);

    await page.goto(baseUrl+"/");
    const header = page.locator("header");
    assert.equal(await header.getByRole("link").count(),1);
    assert.equal(await header.getByRole("button",{name:"Sign out",exact:true}).count(),0);
    assert.equal((await header.innerText()).includes(email),false);
    assert.equal(await header.getByRole("link").getAttribute("href"),"/");
    assert.equal(await page.locator("footer a").getAttribute("href"),"/");
    const returnLink = page.getByRole("link",{name:role === "admin" ? "Open applications" : "Go to my HomeLoop",exact:true}).first();
    await returnLink.click();
    await page.waitForURL(baseUrl+landing);
    await page.getByRole("button",{name:"Sign out",exact:true}).waitFor();
    await page.goBack();
    await page.waitForURL(baseUrl+"/");
    assert.equal(await page.locator("header").getByRole("button").count(),0);
    await page.goForward();
    await page.waitForURL(baseUrl+landing);
    await page.getByRole("button",{name:"Sign out",exact:true}).waitFor();
    console.log(`PASS ${role}: successful login, correct destination, header/footer logos, clean Welcome, retained session and Back/Forward navigation`);

    await page.goto(baseUrl+"/login?next=/valuation");
    await page.waitForURL(baseUrl+destination);
    if (role === "owner") {
      await page.goto(baseUrl+"/admin");
      await page.waitForURL(baseUrl+"/home");
      await page.goto(baseUrl+"/login?next=/admin");
      await page.waitForURL(baseUrl+"/home");
    }
    await page.getByRole("button",{name:"Sign out",exact:true}).click();
    await page.waitForURL(baseUrl+"/login");
    await page.goto(baseUrl+landing);
    await page.waitForURL((url) => url.pathname === "/login");
    console.log(`PASS ${role}: signed-in login redirect, role guard and explicit sign-out/session clearing`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log("PASS no browser runtime errors; no real accounts/data/settings used or changed");
} finally {
  await browser?.close();
  await stop(qaProcess);
  await new Promise((resolve) => auth.close(resolve));
  if (changedBuild) {
    console.log("Restoring the production build with the original environment…");
    await build({...process.env,NEXT_TELEMETRY_DISABLED:"1"});
    console.log("PASS production build restored (lint and TypeScript included)");
  }
}
