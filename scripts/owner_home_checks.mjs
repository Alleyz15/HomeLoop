import assert from "node:assert/strict";
import path from "node:path";

export async function checkOwnerHome(page, { baseUrl, artifacts }) {
  await page.goto(baseUrl+"/home",{waitUntil:"networkidle"});
  await page.getByRole("heading",{name:"Your move, at a glance."}).waitFor();
  assert.equal(await page.locator("[data-home-card]").count(),3);
  const backdrop=page.locator("[data-home-background]");
  assert.equal(await backdrop.getAttribute("aria-hidden"),"true");
  assert.equal(await backdrop.evaluate((element)=>getComputedStyle(element).pointerEvents),"none");
  assert.equal(await page.locator("[data-owner-home]").evaluate((element)=>getComputedStyle(element).isolation),"auto","Backdrop must not paint an isolated opaque layer over the shared footer");
  assert.equal(await backdrop.evaluate((element)=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)");
  assert.equal(await backdrop.locator("a, button, video, canvas").count(),0);
  const motion=await backdrop.evaluate((element)=>{
    const animations=element.getAnimations({subtree:true});
    return animations.map((animation)=>{
      animation.pause();animation.currentTime=1500;
      const before=getComputedStyle(animation.effect.target);
      const first={transform:before.transform,dash:before.strokeDashoffset,opacity:before.opacity};
      animation.currentTime=6500;
      const after=getComputedStyle(animation.effect.target);
      const changed=first.transform!==after.transform || first.dash!==after.strokeDashoffset || first.opacity!==after.opacity;
      animation.play();return changed;
    });
  });
  assert.equal(motion.length,5,"Two lights, two line traces and one travelling light");
  assert.ok(motion.every(Boolean),"Every background animation must visibly change its CSS properties");
  assert.equal(await page.getByRole("heading",{name:/Your Current Home/i}).count(),0);
  assert.equal(await page.locator("[aria-label='Your home-moving progress']").count(),0);
  assert.equal(await page.locator("header a").count(),1);
  assert.equal(await page.getByRole("link",{name:"HomeLoop home",exact:true}).getAttribute("href"),"/home");
  assert.equal(await page.getByRole("link",{name:"Manage Dashboard"}).getAttribute("href"),"/dashboard");
  assert.equal(await page.getByRole("link",{name:"Start Free Valuation"}).getAttribute("href"),"/valuation");
  assert.equal(await page.getByRole("link",{name:"Explore SDP Homes"}).getAttribute("href"),"/new-home");
  await page.waitForFunction(()=>[...document.querySelectorAll("[data-film] video")].length===2 && [...document.querySelectorAll("[data-film] video")].every((video)=>video.readyState>=2 && !video.paused));
  for(const name of ["journey","gallery"]) {
    const film=page.locator(`[data-film='${name}'] video`);
    const result=await film.evaluate(async(video)=>{
      video.pause();const canvas=document.createElement("canvas");canvas.width=180;canvas.height=70;const ctx=canvas.getContext("2d");const frames=[];
      for(const time of [1,4,8]) {await new Promise((resolve)=>{video.addEventListener("seeked",resolve,{once:true});video.currentTime=time;});ctx.drawImage(video,0,0,180,70);frames.push(canvas.toDataURL());}
      const result={frames:new Set(frames).size,controls:video.controls,muted:video.muted,loop:video.loop};await video.play();return result;
    });
    assert.equal(result.frames,3);assert.equal(result.controls,false);assert.equal(result.muted,true);assert.equal(result.loop,true);
  }
  for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[768,1000],[390,1000],[320,1000]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>document.querySelector("[data-owner-home]").getAnimations({subtree:true}).every((animation)=>animation.effect.getTiming().iterations===Infinity || animation.playState!=="running"));
    const dimensions=await page.evaluate(()=>{
      const left=document.querySelector("[data-home-card='valuation']").getBoundingClientRect();const right=document.querySelector("[data-home-card='gallery']").getBoundingClientRect();
      return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,left:left.height,right:right.height};
    });
    assert.ok(dimensions.width<=width,`${width}px Home horizontal overflow`);
    if(width>=1366) {assert.ok(dimensions.height<=height,`${width}x${height} Home should fit one screen; got ${dimensions.height}px`);assert.ok(Math.abs(dimensions.left-dimensions.right)<1);}
    if(width===1366 || width===390) await page.screenshot({path:path.join(artifacts,`owner-home-${width}.png`),fullPage:true});
    assert.equal(await backdrop.evaluate((element)=>Math.round(element.getBoundingClientRect().width)),width,"Backdrop stays within viewport");
    if(width===390) {await page.evaluate(()=>scrollTo(0,600));assert.equal(Math.round(await page.locator("header").evaluate((element)=>element.getBoundingClientRect().top)),0);await page.evaluate(()=>scrollTo(0,0));}
  }
  await page.emulateMedia({reducedMotion:"reduce"});await page.waitForFunction(()=>!document.querySelector("[data-owner-home] video"));
  assert.equal(await page.locator("[data-owner-home]").evaluate((element)=>element.getAnimations({subtree:true}).filter((animation)=>animation.playState==="running").length),0);
  assert.equal(await backdrop.isVisible(),true,"Static architectural artwork remains with reduced motion");
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:1440,height:900});
  assert.equal(await backdrop.evaluate((element)=>element.getAnimations({subtree:true}).filter((animation)=>animation.playState==="running").length),5,"Background restarts after preference changes");
  const staticContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1366,height:768},storageState:await page.context().storageState()});
  try {
    const staticPage=await staticContext.newPage();await staticPage.goto(baseUrl+"/home");
    assert.equal(await staticPage.locator("[data-home-background] svg").isVisible(),true);
    assert.equal(await staticPage.locator("[data-home-card]").count(),3);
    assert.equal(await staticPage.locator("[data-home-background]").evaluate((element)=>element.getAnimations({subtree:true}).filter((animation)=>animation.playState==="running").length),5,"CSS background works without JavaScript");
  } finally {await staticContext.close();}
  await page.emulateMedia({reducedMotion:"no-preference"});await page.waitForFunction(()=>document.querySelectorAll("[data-owner-home] video").length===2);
  await page.locator("[data-film='gallery'] video").evaluate((video)=>video.dispatchEvent(new Event("error")));
  await page.waitForFunction(()=>!document.querySelector("[data-film='gallery'] video"));
  await page.getByRole("link",{name:"Manage Dashboard",exact:true}).click();await page.waitForURL(baseUrl+"/dashboard");
  await page.getByRole("link",{name:"HomeLoop home",exact:true}).click();await page.waitForURL(baseUrl+"/home");
  await page.getByRole("link",{name:"Start Free Valuation"}).click();await page.waitForURL(baseUrl+"/valuation");
  assert.equal(await page.locator("header a").count(),1);
  for(const name of ["Dashboard","Valuation","New home","Plans"]) assert.equal(await page.locator("header").getByRole("link",{name,exact:true}).count(),0);
  await page.getByRole("link",{name:"HomeLoop home",exact:true}).click();await page.waitForURL(baseUrl+"/home");
  await page.goto(baseUrl+"/login");await page.waitForURL(baseUrl+"/home");
  await page.goto(baseUrl+"/");await page.evaluate(()=>scrollTo(0,600));assert.equal(Math.round(await page.locator("header").evaluate((element)=>element.getBoundingClientRect().top)),0);
  await page.goto(baseUrl+"/home");
  console.log("PASS Home: exactly 3 cards; five moving background effects with no interactions or JavaScript; static reduced-motion fallback and live restart; equal-height two-column layout; no desktop scrolling at 1366x768,1440x900,1920x1080; mobile overflow; two decoded moving films; media fallback; sticky Welcome/owner headers; Manage Dashboard/valuation/brand/default-login routing; no owner header step links");
}
