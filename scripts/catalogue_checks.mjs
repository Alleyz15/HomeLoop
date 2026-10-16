import assert from "node:assert/strict";
import path from "node:path";

export async function checkCatalogue(page,{baseUrl,artifacts,setScenario}) {
  const load=async(state="normal",suffix="")=>{setScenario(state);await page.goto(baseUrl+"/new-home"+suffix,{waitUntil:"networkidle"});await page.getByRole("heading",{name:"Find a place for your next chapter."}).waitFor();};
  const settle=async()=>page.waitForFunction(()=>document.querySelector("[data-catalogue-page]").getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations===Infinity||a.playState!=="running"));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(baseUrl+"/home");await page.getByRole("link",{name:"Explore SDP Homes",exact:true}).click();await page.waitForURL(baseUrl+"/new-home");await settle();
  assert.equal(await page.locator("[data-launch]").count(),6);
  assert.equal(await page.locator("header a").count(),1);
  assert.equal(await page.getByRole("navigation",{name:"Development categories"}).getByRole("link",{name:"Available developments 6"}).getAttribute("aria-current"),"page");
  await page.getByText("Catalogue listings · not live unit availability",{exact:true}).waitFor();
  await page.locator("[data-launch='9']").getByText("Contact sales for pricing",{exact:true}).waitFor();
  assert.equal(await page.getByText("Hidden unconfirmed project",{exact:true}).count(),0);
  assert.equal(await page.getByRole("link",{name:/Compare plans|Select home|Reserve|Register interest/}).count(),0);
  for(const link of await page.locator("[data-launch] a").all()) {
    assert.equal(new URL(await link.getAttribute("href")).hostname,"www.simedarbyproperty.com");
    assert.equal(await link.getAttribute("target"),"_blank");assert.match(await link.getAttribute("rel"),/noopener/);
  }
  await page.waitForFunction(()=>[...document.querySelectorAll("[data-launch] img")].slice(0,3).every(img=>img.complete&&img.naturalWidth>0));
  const motion=await page.locator("[data-photo-shutters]").evaluate(element=>element.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations===Infinity).map(a=>{
    a.pause();a.currentTime=1000;const before=getComputedStyle(a.effect.target).transform;a.currentTime=8000;const changed=before!==getComputedStyle(a.effect.target).transform;a.play();return changed;
  }));
  assert.equal(motion.length,3);assert.ok(motion.every(Boolean));
  const first=page.locator("[data-launch]").first();await first.hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector("[data-launch]")).translate.includes("-5px"));
  assert.notEqual(await first.evaluate(element=>getComputedStyle(element).boxShadow),"none");await page.mouse.move(0,0);
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
  await page.screenshot({path:path.join(artifacts,"catalogue-desktop.png"),fullPage:true});
  await page.context().route("https://www.simedarbyproperty.com/**",route=>route.fulfill({status:200,contentType:"text/html",body:"<title>Local destination check</title><p>Official destination intercepted for local QA.</p>"}));
  const popupPromise=page.waitForEvent("popup");await page.locator("[data-launch='2'] a").click();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(popup.url(),"https://www.simedarbyproperty.com/serenia-city/serenia-baleria/");await popup.close();await page.context().unroute("https://www.simedarbyproperty.com/**");
  await page.getByLabel("Search developments",{exact:true}).fill("avira");await page.getByRole("button",{name:"Apply",exact:true}).click();await page.waitForURL(url=>url.searchParams.get("q")==="avira");assert.equal(await page.locator("[data-launch]").count(),1);
  await page.getByRole("link",{name:"Reset",exact:true}).click();await page.waitForURL(baseUrl+"/new-home");
  await page.getByLabel("Location",{exact:true}).selectOption("Putra Heights");await page.getByLabel("Home type",{exact:true}).selectOption("high-rise");await page.getByRole("button",{name:"Apply",exact:true}).click();await page.waitForURL(url=>url.searchParams.get("location")==="Putra Heights");assert.equal(await page.locator("[data-launch]").count(),1);
  await page.getByRole("link",{name:"Coming soon 3",exact:true}).click();await page.waitForURL(url=>url.searchParams.get("tier")==="upcoming");await page.getByRole("heading",{name:"A different view might be the one."}).waitFor();
  await page.getByRole("link",{name:"Clear filters",exact:true}).click();await page.waitForURL(baseUrl+"/new-home?tier=upcoming");assert.equal(await page.locator("[data-launch]").count(),3);assert.equal(await page.getByRole("link",{name:/View launch updates:/}).count(),3);
  await load("normal","?q=%25_.*");assert.equal(await page.locator("[data-launch]").count(),0);
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});await load();await settle();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px catalogue overflow`);
    const columns=await page.getByRole("region",{name:"SDP developments"}).evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(columns,width>950?3:width>620?2:1);
    await page.evaluate(()=>scrollTo(0,700));assert.equal(Math.round(await page.locator("header").evaluate(el=>el.getBoundingClientRect().top)),0);
    if(width===390)for(const image of await page.locator("[data-launch] img").all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.complete?Promise.resolve():new Promise(resolve=>img.addEventListener("load",resolve,{once:true})));}
    await page.evaluate(()=>scrollTo(0,0));if(width===390)await page.screenshot({path:path.join(artifacts,"catalogue-mobile.png"),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator("[data-catalogue-page]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==="running").length),0);
  await page.emulateMedia({reducedMotion:"no-preference"});assert.equal(await page.locator("[data-photo-shutters]").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations===Infinity).length),3);
  await page.locator("[data-launch] img").first().evaluate(img=>img.dispatchEvent(new Event("error")));assert.equal(await page.locator("[data-launch]").first().locator("img").count(),0);await page.locator("[data-launch]").first().getByText("Project imagery unavailable",{exact:true}).waitFor();
  await load("unsafe");assert.equal(await page.locator("[data-launch] a").count(),0);await page.getByText("Project link unavailable",{exact:true}).waitFor();assert.equal(await page.locator("[data-launch] img").count(),0);
  await load("empty");assert.equal(await page.locator("[data-launch]").count(),0);await page.getByText("No developments are listed in this category yet. Check the other category or visit again later.",{exact:true}).waitFor();
  await load("failure");await page.locator("[data-catalogue-page] [role='alert']").waitFor();assert.equal(await page.getByRole("navigation",{name:"Development categories"}).count(),0);
  setScenario("normal");const plainContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000},storageState:await page.context().storageState()});
  try{const plain=await plainContext.newPage();await plain.goto(baseUrl+"/new-home");assert.equal(await plain.locator("[data-launch]").count(),6);await plain.getByRole("link",{name:"Coming soon 3",exact:true}).click();await plain.waitForURL(baseUrl+"/new-home?tier=upcoming");assert.equal(await plain.locator("[data-launch]").count(),3);await plain.getByLabel("Search developments",{exact:true}).fill("Emilia");await plain.getByRole("button",{name:"Apply",exact:true}).click();await plain.waitForURL(url=>url.searchParams.get("q")==="Emilia");assert.equal(await plain.locator("[data-launch]").count(),1);}finally{await plainContext.close();}
  await load();await page.getByRole("link",{name:"Back to Home",exact:true}).click();await page.waitForURL(baseUrl+"/home");
  console.log("PASS Catalogue: Home entry, selling/upcoming counts, literal search, combined filters, tab/reset state, no-result/empty/error, safe official destinations, decoded local imagery/fallback, three independent moving shutters, hover depth, responsive 3/2/1 columns, sticky header, reduced-motion stop/restart and no-JavaScript browsing; no selection/registration/application actions");
}
