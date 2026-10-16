import assert from "node:assert/strict";
import path from "node:path";

export async function checkDevelopment(page,{baseUrl,artifacts,valuation,setScenario,setCatalogueScenario}) {
  const query="?valuation="+valuation.id;
  const detail=async(id=2,suffix=query)=>{await page.goto(`${baseUrl}/new-home/${id}${suffix}`,{waitUntil:"networkidle"});await page.locator("[data-development-page]").waitFor();};
  const settle=()=>page.waitForFunction(()=>document.querySelector("[data-development-page]").getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations===Infinity||a.playState!=="running"));
  const preview=()=>page.locator("[data-price-preview]");
  const quote=()=>page.getByLabel("New-home price quoted by SDP sales (optional)",{exact:true});
  setScenario("valued");setCatalogueScenario("normal");await page.setViewportSize({width:1440,height:1100});
  await page.goto(baseUrl+"/new-home"+query,{waitUntil:"networkidle"});
  await page.locator("[data-valuation-context='ready']").waitFor();
  for(const link of await page.locator("[data-launch] a").all()){assert.match(await link.getAttribute("href"),/^\/new-home\/\d+\?valuation=/);assert.equal(await link.getAttribute("target"),null);}
  await page.getByLabel("Search developments",{exact:true}).fill("Baleria");await page.getByRole("button",{name:"Apply",exact:true}).click();await page.waitForURL(url=>url.searchParams.get("q")==="Baleria");assert.equal(new URL(page.url()).searchParams.get("valuation"),valuation.id);
  await page.getByRole("link",{name:"Coming soon 3",exact:true}).click();await page.waitForURL(url=>url.searchParams.get("tier")==="upcoming");assert.equal(new URL(page.url()).searchParams.get("valuation"),valuation.id);
  await page.getByRole("link",{name:"Clear filters",exact:true}).click();await page.waitForURL(url=>!url.searchParams.has("q"));assert.equal(new URL(page.url()).searchParams.get("valuation"),valuation.id);
  await page.getByRole("link",{name:"Available developments 6",exact:true}).click();await page.waitForURL(url=>!url.searchParams.has("tier"));
  await page.getByRole("link",{name:"View development: Serenia Baleria 1 & 2",exact:true}).click();await page.waitForURL(baseUrl+"/new-home/2"+query);await settle();
  await page.getByRole("heading",{name:"Serenia Baleria 1 & 2",exact:true}).waitFor();
  assert.match(await page.locator("[data-valuation-context]").innerText(),/RM720,000 – RM840,000/);assert.match(await page.locator("[data-valuation-context]").innerText(),/Middle estimate RM785,635/);
  assert.equal(await page.getByRole("link",{name:/View saved valuation/i}).count(),0);assert.equal(await page.locator("a[href^='/plans']").count(),0);
  assert.ok(await page.getByRole("button",{name:"Choose this home",exact:true}).isDisabled());
  assert.match(await preview().innerText(),/-RM30,112 – RM89,888/);await page.getByText("Plan comparison coming next.",{exact:true}).waitFor();
  await page.getByLabel("Home type",{exact:true}).selectOption("Type A2");assert.match(await preview().innerText(),/-RM30,112 – RM89,888/);
  await quote().fill("850,000.25");await preview().getByText("RM10,000.25 – RM130,000.25",{exact:true}).waitFor();assert.match(await preview().innerText(),/your sales quotation/);
  await quote().fill("800000");await preview().getByText("-RM40,000 – RM80,000",{exact:true}).waitFor();assert.match(await preview().innerText(),/negative figure/);
  await quote().fill("850,00");await page.locator("#quote-error").waitFor();await preview().getByText("Not calculated yet",{exact:true}).waitFor();assert.equal(await quote().getAttribute("aria-invalid"),"true");
  await quote().fill("");await preview().getByText("-RM30,112 – RM89,888",{exact:true}).waitFor();
  await page.getByRole("link",{name:"Back to developments",exact:true}).click();await page.waitForURL(baseUrl+"/new-home"+query);
  await detail(9);assert.equal(await page.getByLabel("Home type",{exact:true}).inputValue(),"Standard home type");assert.ok(await page.getByLabel("Home type",{exact:true}).getAttribute("readonly")!==null);await preview().getByText("Not calculated yet",{exact:true}).waitFor();
  await quote().fill("850000");await preview().getByText("RM10,000 – RM130,000",{exact:true}).waitFor();
  await detail(15);await page.getByLabel("Home type",{exact:true}).selectOption("Type C (SAMM)");await page.getByText(/Affordable-home eligibility requirements apply/).waitFor();
  await detail(32);assert.ok(await page.getByRole("button",{name:"Choose this home",exact:true}).isDisabled());await page.getByText(/not open for selection or plan quoting/).waitFor();assert.match(await page.getByRole("link",{name:"Back to developments",exact:true}).getAttribute("href"),/tier=upcoming&valuation=/);
  setScenario("unpriced");await detail();await page.locator("[data-valuation-context='unpriced']").waitFor();assert.doesNotMatch(await preview().innerText(),/RM\d/);
  await page.goto(baseUrl+"/new-home"+query);assert.equal(await page.locator("[data-launch='2'] a").getAttribute("href"),"/new-home/2"+query);
  setScenario("valued");
  for(const id of ["invalid","20000000-0000-4000-8000-000000000099"]){await detail(2,"?valuation="+id);await page.locator("[data-valuation-context='missing']").waitFor();assert.doesNotMatch(await page.locator("[data-development-page]").innerText(),/Saved test township|RM720,000|RM840,000/);await preview().getByText("Not calculated yet",{exact:true}).waitFor();}
  setScenario("failure");await detail();await page.locator("[data-valuation-context='error']").waitFor();setScenario("valued");
  await detail(2,"");assert.equal(await page.locator("[data-valuation-context]").count(),0);await page.getByText(/browsing without a saved valuation/).waitFor();await preview().getByText("Not calculated yet",{exact:true}).waitFor();
  setCatalogueScenario("failure");await page.goto(baseUrl+"/new-home/2"+query);await page.locator("[data-development-page] [role='alert']").waitFor();setCatalogueScenario("normal");
  for(const route of ["0","999999","101","102","bad"]){const response=await page.goto(baseUrl+"/new-home/"+route+query);assert.equal(response.status(),404,route);}
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1100});await detail();await settle();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px details overflow`);
    await page.waitForFunction(()=>[...document.querySelectorAll("[data-project-image] img")].every(img=>img.complete&&img.naturalWidth>0));
    await page.evaluate(()=>scrollTo(0,500));assert.equal(Math.round(await page.locator("header").evaluate(el=>el.getBoundingClientRect().top)),0);await page.evaluate(()=>scrollTo(0,0));
    if([1440,390].includes(width))await page.screenshot({path:path.join(artifacts,`development-${width===1440?"desktop":"mobile"}.png`),fullPage:true});
  }
  const moving=await page.locator("[data-focus-reveal]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations===Infinity).map(a=>{a.pause();a.currentTime=0;const first=getComputedStyle(a.effect.target).transform;a.currentTime=3000;const changed=first!==getComputedStyle(a.effect.target).transform;a.play();return changed;}));assert.deepEqual(moving,[true]);
  await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator("[data-development-page]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==="running").length),0);await page.emulateMedia({reducedMotion:"no-preference"});
  await page.locator("[data-project-image] img").evaluate(img=>img.dispatchEvent(new Event("error")));await page.getByText("Project imagery unavailable",{exact:true}).waitFor();
  const plainContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1440,height:1100},storageState:await page.context().storageState()});
  try{const plain=await plainContext.newPage();await plain.goto(baseUrl+"/new-home/2"+query);await plain.getByRole("heading",{name:"Serenia Baleria 1 & 2",exact:true}).waitFor();assert.ok(await plain.getByRole("button",{name:"Choose this home",exact:true}).isDisabled());await plain.getByText(/Live quotation and layout previews require JavaScript/).waitFor();await plain.getByRole("link",{name:"Back to developments",exact:true}).click();await plain.waitForURL(baseUrl+"/new-home"+query);}finally{await plainContext.close();}
  setScenario("new");await page.setViewportSize({width:1440,height:1100});
  console.log("PASS Development details: owner-scoped valuation context across catalogue filters/tabs, internal navigation, verified/Standard home types, quotation override/cents/validation, range/negative differences, missing prices, unpriced/missing/failed valuations, browse-only entry, upcoming/hidden/404 projects, permanently disabled plan CTA, no saved-valuation link, responsive 1440/768/390/320 layouts, focus reveal/lens motion, image fallback, sticky header, reduced motion and no-JavaScript fallback");
}
