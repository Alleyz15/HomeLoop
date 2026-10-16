// Browser QA against a LOCAL Supabase protocol stub. No hosted accounts or writes.
// Builds test configuration, tests the real Next pages/actions, then always restores
// a normal production build. Stop the normal frontend before running.
// Optional: WELCOME_PLAYWRIGHT_MODULE; DASHBOARD_ARTIFACT_DIR; DASHBOARD_QA_PORT.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkOwnerHome } from "./owner_home_checks.mjs";
import { checkOwnerRecords } from "./owner_records_checks.mjs";
import { checkCatalogue } from "./catalogue_checks.mjs";
import { catalogueFixtures } from "./catalogue_fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps/web");
const nextCli = path.join(webDir, "node_modules/next/dist/bin/next");
const baseUrl = `http://127.0.0.1:${Number(process.env.DASHBOARD_QA_PORT ?? 3100)}`;
const artifacts = path.resolve(process.env.DASHBOARD_ARTIFACT_DIR ?? path.join(webDir, ".next/dashboard-qa"));
const accounts = {
  "owner@dashboard.test": { id: "10000000-0000-4000-8000-000000000002", role: "owner" },
  "admin@dashboard.test": { id: "10000000-0000-4000-8000-000000000001", role: "admin" },
};
const valuation = { id:"20000000-0000-4000-8000-000000000001", road_norm:"JLN TEST", scheme:"Saved test township", ptype:"Terrace", estimate:785635.36, low:720000, high:840000, created_at:"2026-10-10T12:00:00Z" };
const application = { id:"30000000-0000-4000-8000-000000000001", valuation_id:valuation.id, launch_id:7, plan:"A", unit_type:"Type A", address_line:"12, Jalan Test", indicative_low:610000, indicative_high:630000, inspection_scheduled_at:"2026-10-20T02:00:00Z", offer_amount:616723, offer_expires_at:new Date(Date.now()+7*86400000).toISOString(), reject_reason:"The property is outside the supported area.", espa_signed_at:null, espa_confirmed_at:null, info_return_status:null, created_at:"2026-10-11T12:00:00Z", updated_at:"2026-10-12T12:00:00Z" };
const caseId=(index)=>"30000000-0000-4000-8000-"+String(index).padStart(12,"0");
const valueId=(index)=>"20000000-0000-4000-8000-"+String(index).padStart(12,"0");
function rowsForScenario() {
  if(scenario==="new" || scenario==="failure")return {valuations:[],applications:[]};
  if(scenario==="many") {
    const valuations=Array.from({length:15},(_,index)=>({...valuation,id:valueId(index+1),scheme:"Saved township "+(index+1),created_at:new Date(Date.UTC(2026,8,index+1)).toISOString()}));
    const statuses=["under_review","handover","rejected","withdrawn","expired"];
    const applications=statuses.map((status,index)=>({...application,id:caseId(index+1),valuation_id:valueId(index+1),status,address_line:(11+index)+", Case Road "+(index+1),updated_at:new Date(Date.UTC(2026,9,20-index)).toISOString(),launch:{project:"Saved SDP project "+(index+1)}}));
    return {valuations,applications};
  }
  return {valuations:[{...valuation,...(scenario==="unpriced"?{estimate:null,low:null,high:null}:{})}],applications:["valued","unpriced"].includes(scenario)?[]:[{...application,status:scenario==="overdue"?"offer_sent":scenario,plan:["listed","buyer_found","guarantee_triggered"].includes(scenario)?"B":"A",launch:{project:"Saved test SDP project"},...(scenario==="overdue"?{offer_expires_at:"2020-01-01T00:00:00Z"}:{})}]};
}
let scenario = "new";
let catalogueScenario = "normal";
let authUrl;
let qaProcess;
let browser;
let changedBuild = false;
let serverLog = "";
const errors = [];
const queries = [];
function userFor(email) { return { ...accounts[email], email, aud:"authenticated", role:"authenticated", email_confirmed_at:"2026-01-01T00:00:00Z", app_metadata:{provider:"email",providers:["email"]}, user_metadata:{}, identities:[], created_at:"2026-01-01T00:00:00Z" }; }
function tokenFor(email) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:accounts[email].id,email,aud:"authenticated",role:"authenticated",iss:authUrl+"/auth/v1",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return token+"."+createHmac("sha256","dashboard-test-secret-only").update(token).digest("base64url");
}
const auth = createServer(async (request,response) => {
  const url = new URL(request.url,authUrl);
  const reply = (status,body,headers={}) => { response.writeHead(status,{"Content-Type":"application/json",...headers}); response.end(body === undefined ? undefined : JSON.stringify(body)); };
  const replyRows=(rows)=>{
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??500);
    const batch=rows.slice(offset,offset+limit);
    return reply(200,batch,{"Content-Range":batch.length?`${offset}-${offset+batch.length-1}/${rows.length}`:`*/${rows.length}`});
  };
  let email;
  try { email = JSON.parse(Buffer.from((request.headers.authorization ?? "").split(".")[1],"base64url")).email; } catch { /* no session */ }
  if (request.method === "POST" && url.pathname === "/auth/v1/token") {
    let raw=""; for await (const chunk of request) raw+=chunk;
    const body=JSON.parse(raw);
    if (!accounts[body.email] || body.password !== "dashboard-test-password") return reply(400,{message:"Invalid test credentials"});
    return reply(200,{access_token:tokenFor(body.email),refresh_token:"test-refresh",token_type:"bearer",expires_in:3600,user:userFor(body.email)});
  }
  if (url.pathname === "/auth/v1/user") return accounts[email] ? reply(200,userFor(email)) : reply(401,{message:"No test session"});
  if (url.pathname === "/auth/v1/logout") return reply(204);
  if (url.pathname === "/rest/v1/profiles") return accounts[email] ? reply(200,[{role:accounts[email].role}]) : reply(401,{message:"No test session"});
  if (request.method !== "GET") { errors.push(`Unexpected write ${request.method} ${url.pathname}`); return reply(405,{}); }
  if (!accounts[email]) return reply(401,{});
  queries.push({path:url.pathname,search:url.search,email});
  if (["/rest/v1/applications","/rest/v1/valuation_requests"].includes(url.pathname) && url.searchParams.get("user_id") !== `eq.${accounts[email].id}`) { errors.push("Missing owner filter"); return reply(403,{}); }
  if (url.pathname === "/rest/v1/valuation_requests") {
    if(scenario==="failure")return reply(500,{message:"Test database failure"});
    return replyRows(rowsForScenario().valuations);
  }
  if (url.pathname === "/rest/v1/applications") return replyRows(rowsForScenario().applications);
  if (url.pathname === "/rest/v1/application_events") {
    const id=(url.searchParams.get("application_id")??"").replace("eq.","");
    const record=rowsForScenario().applications.find((item)=>item.id===id);
    if(!record) {errors.push("Events requested for an unowned application");return reply(403,{});}
    const statuses=record.status==="handover"?["submitted","indicative_sent","inspected","offer_sent","espa_signed","old_home_completed","handover"]:["submitted",record.status];
    return replyRows(statuses.map((status,index)=>({to_status:status,action:"record_"+status,reason:status==="info_requested"?"Please confirm your property address.":null,created_at:new Date(Date.UTC(2026,9,11+index)).toISOString()})));
  }
  if (url.pathname === "/rest/v1/sdp_launches") {
    if (!url.searchParams.has("tier")) return reply(200,[{project:"Saved test SDP project"}]);
    if (url.searchParams.get("tier") !== "in.(selling,upcoming)") {errors.push("Missing catalogue tier filter");return reply(403,{});}
    if (catalogueScenario === "failure") return reply(500,{message:"Local catalogue read failure"});
    let rows=catalogueScenario === "empty" ? [] : catalogueFixtures.filter(row=>["selling","upcoming"].includes(row.tier));
    if(catalogueScenario === "unsafe")rows=[{...rows[0],project:"Unverified image",project_url:"javascript:alert(1)"}];
    return replyRows(rows);
  }
  errors.push(`Unexpected request ${url.pathname}`); reply(404,{});
});
function startNext(args,env) { return spawn(process.execPath,[nextCli,...args],{cwd:webDir,env,stdio:["ignore","pipe","pipe"],windowsHide:true}); }
async function build(env) {
  const child=startNext(["build"],env); let log="";
  child.stdout.on("data",(chunk)=>{log+=chunk;}); child.stderr.on("data",(chunk)=>{log+=chunk;});
  const code=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve);});
  if(code!==0) throw new Error(log);
}
async function stop(child) { if(!child || child.exitCode!==null)return; const done=new Promise((resolve)=>child.once("exit",resolve));child.kill();await done; }
try {
  await new Promise((resolve)=>auth.listen(0,"127.0.0.1",resolve));
  authUrl=`http://127.0.0.1:${auth.address().port}`;
  const env={...process.env,NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:authUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:"dashboard-test-anon-key"};
  changedBuild=true;console.log("Building isolated Dashboard QA frontend…");await build(env);
  qaProcess=startNext(["start","--hostname","127.0.0.1","--port",new URL(baseUrl).port],env);
  qaProcess.stdout.on("data",(chunk)=>{serverLog=(serverLog+chunk).slice(-16000);});
  qaProcess.stderr.on("data",(chunk)=>{serverLog=(serverLog+chunk).slice(-16000);});
  for(let i=0;i<60;i++) { try {if((await fetch(baseUrl+"/login")).ok)break;}catch{} await new Promise((resolve)=>setTimeout(resolve,500)); }
  const modulePath=process.env.WELCOME_PLAYWRIGHT_MODULE;
  const {chromium}=await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
  browser=await chromium.launch({channel:"msedge",headless:true});
  await mkdir(artifacts,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const page=await context.newPage();page.on("pageerror",(error)=>errors.push(error.message));
  await page.goto(baseUrl+"/dashboard");assert.equal(new URL(page.url()).pathname,"/login");
  // Next normalizes loopback hosts in middleware redirects. Keep the test login
  // on one canonical origin so its cookie is available to subsequent page reads.
  await page.goto(baseUrl+"/login?next=/dashboard");
  await page.getByLabel("Email address").fill("owner@dashboard.test");await page.getByLabel("Password",{exact:true}).fill("dashboard-test-password");await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.waitForURL(baseUrl+"/dashboard");
  await checkOwnerHome(page,{baseUrl,artifacts});
  await checkCatalogue(page,{baseUrl,artifacts,setScenario:(state)=>{catalogueScenario=state;}});
  if(process.env.OWNER_HOME_ONLY!=="1") {
    await checkOwnerRecords(page,{baseUrl,artifacts,setScenario:(state)=>{scenario=state;},application,caseId});
    await page.getByRole("button",{name:"Sign out",exact:true}).click();await page.waitForURL((url)=>url.pathname==="/login");
    // Canonical origin after any middleware loopback redirect.
    await page.goto(baseUrl+"/login");
    await page.getByLabel("Email address").fill("admin@dashboard.test");await page.getByLabel("Password",{exact:true}).fill("dashboard-test-password");await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL(baseUrl+"/admin");
    const before=queries.length;
    for(const route of ["/home","/dashboard","/new-home"]) {await page.goto(baseUrl+route);await page.waitForURL(baseUrl+"/admin");}
    assert.equal(queries.slice(before).some((query)=>query.email==="admin@dashboard.test"),false);
    console.log("PASS owner/admin guards and owner-scoped records; no foreign event reads");
  }
  assert.deepEqual(errors,[]);console.log("PASS no browser runtime errors or application writes");console.log(`Screenshots: ${artifacts}`);
} catch(error) {
  console.error("Dashboard QA failure:",error);
  console.error("Browser runtime errors:",errors);
  console.error("Local Next server log:",serverLog);
  const page=browser?.contexts()[0]?.pages()[0];
  if(page) {
    console.error("Current browser URL:",page.url());
    console.error("Pagination text:",await page.getByLabel("Records pagination").innerText().catch(()=>"Unavailable"));
    console.error("Overflow diagnostics:",await page.evaluate(()=>[...document.querySelectorAll("body *")].filter((element)=>{const rect=element.getBoundingClientRect();return rect.width && (rect.right>innerWidth+1 || rect.left< -1);}).map((element)=>({tag:element.tagName,className:element.className,right:element.getBoundingClientRect().right})).slice(0,15)).catch(()=>[]));
    await page.screenshot({path:path.join(artifacts,"dashboard-failure.png"),fullPage:true}).catch(()=>{});
  }
  throw error;
} finally {
  await browser?.close();await stop(qaProcess);await new Promise((resolve)=>auth.close(resolve));
  if(changedBuild) {console.log("Restoring original production environment…");await build({...process.env,NEXT_TELEMETRY_DISABLED:"1"});console.log("PASS normal production build restored");}
}
