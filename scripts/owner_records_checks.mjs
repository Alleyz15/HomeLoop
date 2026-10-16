import assert from "node:assert/strict";
import path from "node:path";

export async function checkOwnerRecords(page,{baseUrl,artifacts,setScenario,application,caseId}) {
  async function load(state,suffix="") {setScenario(state);await page.goto(baseUrl+"/dashboard"+suffix,{waitUntil:"networkidle"});await page.getByRole("heading",{name:"Every case. One clear view."}).waitFor();}
  async function screenshot(name) {await page.waitForFunction(()=>document.querySelector("[data-dashboard-page]").getAnimations({subtree:true}).every((animation)=>animation.effect.getTiming().iterations===Infinity||animation.playState!=="running"));await page.screenshot({path:path.join(artifacts,name),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await load("new");
  await page.getByText("Your next chapter starts with one estimate.",{exact:true}).waitFor();
  assert.equal(await page.locator("[data-summary='Total records'] > strong").innerText(),"0");
  assert.equal(await page.locator("[aria-label=\"This application's home-moving progress\"]").count(),0);
  for(const state of ["valued","unpriced"]) {await load(state);assert.equal(await page.locator("[data-record]").count(),1);await page.getByText("Valuation only",{exact:true}).waitFor();assert.equal(await page.getByRole("link",{name:"View progress"}).count(),0);await page.getByRole("link",{name:"View result"}).waitFor();}
  const expected={under_review:"Your application is with our team.",info_requested:"A little more detail, a clearer next step.",indicative_sent:"A first look at your way forward.",inspection_scheduled:"Your home visit is arranged.",offer_sent:"Your formal offer is ready.",overdue:"This offer’s response period has ended.",listed:"Your home is finding its next owner.",rejected:"An update on your application.",handover:"Welcome to your next chapter."};
  for(const [state,title] of Object.entries(expected)) {
    await load(state,`?case=${application.id}`);await page.getByRole("heading",{name:title,exact:true}).waitFor();
    assert.equal(await page.locator("[data-record]").count(),1);
    assert.equal(await page.locator("[aria-label=\"This application's home-moving progress\"] > li").count(),8);
    if(state==="info_requested")await page.getByText("Please confirm your property address.",{exact:true}).waitFor();
    if(state==="listed")await page.getByLabel("Plan B selling progress").waitFor();
    if(state==="handover")assert.equal(await page.locator("[data-complete='true']").count(),8);
  }
  console.log("PASS Dashboard empty, valuation-only, unpriced, review, information request, indicative, inspection, formal/overdue offer, Plan B, rejection and completed states");

  await load("many");
  assert.equal(await page.locator("[data-summary='Total records'] > strong").innerText(),"15");
  assert.equal(await page.locator("[data-summary='In progress'] > strong").innerText(),"1");
  assert.equal(await page.locator("[data-summary='Completed moves'] > strong").innerText(),"1");
  assert.equal(await page.locator("[data-record]").count(),10);
  assert.equal(await page.locator("[aria-label=\"This application's home-moving progress\"]").count(),0);
  await screenshot("records-desktop.png");
  assert.equal(await page.getByRole("link",{name:"Next",exact:true}).getAttribute("href"),"/dashboard?page=2");
  await page.getByRole("link",{name:"Next",exact:true}).click();
  await page.waitForURL((url)=>url.searchParams.get("page")==="2");
  await page.locator("[data-record-page='2']").waitFor();assert.equal(await page.locator("[data-record]").count(),5);
  await page.getByRole("link",{name:"Previous",exact:true}).click();await page.getByText("Page 1 of 2",{exact:true}).waitFor();
  await page.getByLabel("Search records").fill("Saved township 15");await page.getByRole("button",{name:"Apply filters"}).click();await page.getByText("Showing 1–1 of 1 records",{exact:true}).waitFor();assert.equal(await page.locator("[data-record]").count(),1);await page.getByText("Saved township 15",{exact:true}).waitFor();
  assert.equal(await page.locator("[data-summary='Total records'] > strong").innerText(),"15");
  await page.getByRole("link",{name:"Clear",exact:true}).click();await page.getByText("Showing 1–10 of 15 records",{exact:true}).waitFor();assert.equal(await page.getByLabel("Search records").inputValue(),"");
  await page.getByLabel("Show",{exact:true}).selectOption("completed");await page.getByRole("button",{name:"Apply filters"}).click();await page.getByText("Showing 1–1 of 1 records",{exact:true}).waitFor();await page.getByRole("link",{name:"View progress"}).click();await page.getByRole("heading",{name:"Welcome to your next chapter."}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("filter"),"completed");assert.equal(await page.locator("[data-complete='true']").count(),8);
  await load("many",`?case=${caseId(1)}`);await page.getByRole("heading",{name:"Your application is with our team."}).waitFor();await page.getByRole("region",{name:"Progress for 11, Case Road 1",exact:true}).waitFor();
  assert.equal(await page.locator("[aria-label=\"This application's home-moving progress\"]").count(),1);
  await screenshot("records-expanded-desktop.png");
  const foreign="99999999-0000-4000-8000-000000000099";
  await load("many",`?case=${foreign}`);assert.equal(await page.locator("[aria-label=\"This application's home-moving progress\"]").count(),0);
  await load("many","?q=not-a-real-property");await page.getByText("No records match this view.",{exact:true}).waitFor();
  await page.getByRole("link",{name:"Clear filters",exact:true}).click();await page.getByText("Showing 1–10 of 15 records",{exact:true}).waitFor();
  console.log("PASS multi-case totals, linked-valuation deduplication, search/reset, filters, pagination, per-case expansion and foreign-ID isolation");
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});await load("many",`?case=${caseId(1)}`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px records overflow`);
    if(width===390)await screenshot("records-expanded-mobile.png");
    await page.evaluate(()=>scrollTo(0,600));assert.equal(Math.round(await page.locator("header").evaluate((element)=>element.getBoundingClientRect().top)),0);
  }
  await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator("[data-dashboard-page]").evaluate((element)=>element.getAnimations({subtree:true}).filter((animation)=>animation.playState==="running").length),0);await page.emulateMedia({reducedMotion:"no-preference"});
  await load("failure");await page.locator("[data-dashboard-page] [role='alert']").waitFor();assert.equal(await page.locator("[data-summary]").count(),0);
  setScenario("many");
  const noJs=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000}});
  await noJs.addCookies(await page.context().cookies());
  try {
    const plain=await noJs.newPage();await plain.goto(baseUrl+"/dashboard");
    await plain.getByRole("link",{name:"Next",exact:true}).click();await plain.waitForURL((url)=>url.searchParams.get("page")==="2");assert.equal(await plain.locator("[data-record]").count(),5);
    await plain.getByRole("link",{name:"Previous",exact:true}).click();await plain.waitForURL((url)=>!url.searchParams.has("page"));
    await plain.getByRole("link",{name:"View progress"}).first().click();await plain.getByRole("region",{name:"Progress for 11, Case Road 1",exact:true}).waitFor();
  } finally {await noJs.close();}
  console.log("PASS responsive record cards, expanded mobile timelines, sticky header, reduced motion and honest failed-read state");
  console.log("PASS record pagination and case expansion with JavaScript disabled");
}
