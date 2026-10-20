import assert from "node:assert/strict";
import path from "node:path";

export async function checkPlans(page,{baseUrl,artifacts,valuation,setScenario,setPlanScenario,quoteRequests}) {
  const params=new URLSearchParams({valuation:valuation.id,launch:"2",home_type:"Type A2",sales_quote:"850000"});
  const url=(plan="",extra={})=>{const query=new URLSearchParams(params);for(const [key,value] of Object.entries(extra))value==null?query.delete(key):query.set(key,value);return baseUrl+"/plans"+(plan?"/"+plan:"")+"?"+query.toString();};
  const load=async(state="normal",plan="",extra={})=>{setPlanScenario(state);await page.goto(url(plan,extra),{waitUntil:"networkidle"});};
  const settle=()=>page.waitForFunction(()=>document.querySelector("[data-plans-page]").getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations===Infinity||a.playState!=="running"));
  const waitArt=()=>page.waitForFunction(()=>[...document.querySelectorAll("[data-adviser] img")].length===4&&[...document.querySelectorAll("[data-adviser] img")].every(img=>img.complete&&img.naturalWidth>0));
  setScenario("valued");setPlanScenario("normal");await page.setViewportSize({width:1440,height:1100});
  await page.goto(baseUrl+"/new-home/2?valuation="+valuation.id,{waitUntil:"networkidle"});
  await page.getByLabel("Home type",{exact:true}).selectOption("Type A2");await page.getByLabel("New-home price quoted by SDP sales (optional)",{exact:true}).fill("850,000");
  await page.getByRole("button",{name:"Choose this home",exact:true}).click();await page.waitForURL(current=>current.pathname==="/plans");
  await page.getByRole("heading",{name:"Compare your trade-in options",exact:true}).waitFor();await waitArt();await settle();
  assert.equal(new URL(page.url()).searchParams.get("home_type"),"Type A2");assert.equal(await page.locator("[data-plan]").filter({has:page.locator("h2")}).count(),2);
  assert.match(await page.locator("[data-plan='A'] article,article[data-plan='A']").innerText(),/RM565,200 – RM659,400/);
  const a=page.locator("article[data-plan='A']"),b=page.locator("article[data-plan='B']");
  assert.match(await a.innerText(),/RM616,723/);assert.match(await a.innerText(),/RM23,328/);
  assert.match(await b.innerText(),/RM688,320 – RM803,040/);assert.match(await b.innerText(),/RM751,067/);assert.match(await b.innerText(),/RM589,226/);assert.match(await b.innerText(),/RM85,000/);
  assert.equal(await page.locator("[data-plans-page]").getAttribute("data-recommended"),"none");
  await page.getByRole("button",{name:"Yes, I can",exact:true}).click();assert.equal(await page.locator("[data-plans-page]").getAttribute("data-recommended"),"B");assert.equal(await b.getAttribute("data-highlighted"),"true");
  const headB=await page.locator("[data-adviser-layer='head-turn']").evaluate(el=>getComputedStyle(el).transform);
  await page.getByRole("button",{name:"No, I need support",exact:true}).click();await page.waitForFunction(()=>document.querySelector("[data-plans-page]").dataset.recommended==="A");await page.getByRole("status").filter({hasText:/remaining cash gap/}).waitFor();
  await page.waitForFunction(before=>getComputedStyle(document.querySelector("[data-adviser-layer='head-turn']")).transform!==before,headB);
  await page.getByRole("link",{name:"View Plan A calculation",exact:true}).click();await page.waitForURL(current=>current.pathname==="/plans/a");
  assert.equal(new URL(page.url()).searchParams.get("deposit"),"no");await page.getByText("Assumed cost allowance",{exact:false}).waitFor();await page.getByText(/Assumed risk buffer/).waitFor();await page.getByText("RM233,277",{exact:true}).waitFor();assert.match(await page.getByRole("link",{name:"Confirm this plan",exact:true}).getAttribute("href"),/^\/apply\?/);
  await settle();await page.screenshot({path:path.join(artifacts,"plan-a-calculation.png"),fullPage:true});
  await page.getByRole("link",{name:"Back to comparison",exact:true}).click();await page.waitForURL(current=>current.pathname==="/plans");assert.equal(await page.getByRole("button",{name:"No, I need support",exact:true}).getAttribute("aria-pressed"),"true");
  await page.getByRole("link",{name:"View Plan B calculation",exact:true}).click();await page.waitForURL(current=>current.pathname==="/plans/b");await page.getByText(/Assumed seller agent fee/).waitFor();await page.getByText(/Assumed seller legal fee/).waitFor();await page.getByRole("heading",{name:"Indicative guarantee floor",exact:true}).waitFor();await page.getByText("RM98,933",{exact:true}).waitFor();
  await page.getByRole("link",{name:"Back to comparison",exact:true}).click();await page.waitForURL(current=>current.pathname==="/plans");await page.getByRole("link",{name:"Back to development",exact:true}).click();await page.waitForURL(current=>current.pathname==="/new-home/2");
  assert.equal(await page.getByLabel("Home type",{exact:true}).inputValue(),"Type A2");assert.equal(await page.getByLabel("New-home price quoted by SDP sales (optional)",{exact:true}).inputValue(),"850000");
  await load("non_sdp");assert.ok(await page.getByRole("button",{name:"Plan A unavailable",exact:true}).isDisabled());assert.equal(await page.getByRole("link",{name:"View Plan A calculation",exact:true}).count(),0);await page.getByRole("button",{name:"No, I need support",exact:true}).click();await page.getByRole("status").filter({hasText:/neither option resolves/}).waitFor();assert.equal(await page.locator("[data-plans-page]").getAttribute("data-recommended"),"none");
  await load("non_sdp","a");await page.getByRole("heading",{name:"Plan A is unavailable.",exact:true}).waitFor();
  await load("normal","",{sales_quote:"700000"});assert.ok(await page.getByRole("button",{name:"Plan A unavailable",exact:true}).isDisabled());await page.getByText("Plan A requires the old-home valuation to be no higher than the new-home price.",{exact:true}).waitFor();
  for(const state of ["metadata_missing","metadata_failure","quote_failure","malformed"]){await load(state);await page.locator("[data-plans-page] [role='alert']").waitFor();assert.equal(await page.locator("article[data-plan]").count(),0);}
  await load("legacy","a");await page.getByRole("heading",{name:"The itemised breakdown is not available yet.",exact:true}).waitFor();await page.getByText("Midpoint RM616,723 · before outstanding loans and RPGT retention.",{exact:true}).waitFor();
  const count=quoteRequests.length;
  for(const extra of [{valuation:"20000000-0000-4000-8000-000000000099"},{valuation:"bad"},{home_type:"Injected"},{launch:"32"},{sales_quote:"-1"},{launch:"9",sales_quote:null}]){await load("normal","",extra);await page.locator("[data-plans-page] [role='alert']").waitFor();}
  setScenario("unpriced");await load();await page.locator("[data-plans-page] [role='alert']").waitFor();assert.equal(quoteRequests.length,count);setScenario("valued");
  await load("normal","",{launch:"9",home_type:"Standard home type"});await page.getByRole("heading",{name:"Compare your trade-in options",exact:true}).waitFor();
  await load("normal","",{sales_quote:"850000.25"});assert.match(await page.locator("[data-plan-context]").innerText(),/RM850,000.25/);assert.equal(quoteRequests.at(-1).new_home.sales_quote_rm,850000.25);
  await load("normal","",{sales_quote:null});assert.match(await page.locator("[data-plan-context]").innerText(),/published project starting price/);assert.equal("sales_quote_rm" in quoteRequests.at(-1).new_home,false);
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1100});await load();await settle();await waitArt();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px plans overflow`);
    assert.ok(await page.locator("article[data-plan='A']").evaluate(el=>getComputedStyle(el).zIndex==="1"&&getComputedStyle(el.parentElement,"::before").zIndex==="0"),"backing layer must stay behind the ivory card face");
    await page.evaluate(()=>scrollTo(0,600));assert.equal(Math.round(await page.locator(".site-header").evaluate(el=>el.getBoundingClientRect().top)),0);await page.evaluate(()=>scrollTo(0,0));
    if([1440,390].includes(width))await page.screenshot({path:path.join(artifacts,`plans-${width===1440?"desktop":"mobile"}.png`),fullPage:true});
    await load("normal","a");await settle();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px calculation overflow`);
  }
  await page.setViewportSize({width:1440,height:1100});await load();await waitArt();await settle();
  await a.hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector("article[data-plan='A']")).translate.includes("-5px"));assert.notEqual(await a.evaluate(el=>getComputedStyle(el).boxShadow),"none");await page.mouse.move(0,0);
  const tracks=await page.locator("[data-adviser]").evaluate(el=>el.getAnimations({subtree:true}).filter(animation=>animation.effect.getTiming().iterations===Infinity).map(animation=>{animation.pause();const target=animation.effect.target;animation.currentTime=0;const before=getComputedStyle(target).transform+getComputedStyle(target).opacity;animation.currentTime=animation.effect.getTiming().duration*.455;const changed=before!==getComputedStyle(target).transform+getComputedStyle(target).opacity;animation.play();return {name:animation.animationName,changed};}));assert.equal(tracks.length,4);assert.ok(tracks.every(track=>track.changed),JSON.stringify(tracks));
  await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator("[data-plans-page]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==="running").length),0);await page.emulateMedia({reducedMotion:"no-preference"});
  await page.locator("[data-adviser] img").first().evaluate(img=>img.dispatchEvent(new Event("error")));await page.locator("[data-adviser='unavailable']").waitFor();assert.equal(await page.locator("[data-adviser] img").count(),0);
  const plainContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1440,height:1100},storageState:await page.context().storageState()});
  try{const plain=await plainContext.newPage();await plain.goto(url());assert.equal(await plain.locator("[data-adviser]").getAttribute("data-motion"),"static");assert.equal(await plain.locator("[data-adviser]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==="running").length),0);await plain.getByRole("button",{name:"No, I need support",exact:true}).click();await plain.waitForURL(current=>current.searchParams.get("deposit")==="no");assert.equal(await plain.locator("[data-plans-page]").getAttribute("data-recommended"),"A");await plain.getByRole("link",{name:"View Plan A calculation",exact:true}).click();await plain.waitForURL(current=>current.pathname==="/plans/a");assert.match(await plain.getByRole("link",{name:"Confirm this plan",exact:true}).getAttribute("href"),/^\/apply\?/);}finally{await plainContext.close();}
  setScenario("new");setPlanScenario("normal");
  console.log("PASS Compare Plans: real local Python quote engine, Development GET handoff and return selection, ranges/fees/deposit gaps, eligibility and direct-route guards, honest guidance, additive/legacy breakdowns, quote/metadata failures, no client money trust, both detail routes, 1440/768/390/320 layouts, layered hover, 4 independent adviser tracks, live reduced motion, image fallback and no-JavaScript guidance/calculation navigation; no application submission");
}
