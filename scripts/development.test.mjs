import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const file=(name)=>readFile(new URL("../apps/web/src/"+name,import.meta.url),"utf8");
const moduleFor=(source)=>import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const urlFor=(source)=>`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const unitsUrl=urlFor(await file("lib/units.ts"));
const model=(await file("lib/development-model.ts")).replace('"./units"',JSON.stringify(unitsUrl));
const {validValuationId,hasValuationRange,valuationJourneyState,canContinueWithValuation,INSUFFICIENT_DATA_MESSAGE,pricePreview,publishedLayouts,developmentHref,marketRm}=await moduleFor(model);
const id="20000000-0000-4000-8000-000000000001";
const valuation={id,scheme:"Saved property",road_norm:"JLN TEST",valuation_status:"ok",estimate:785635.36,low:720000,high:840000};
test("valuation routes accept IDs only, and range validation rejects incomplete/unordered data",()=>{
  assert.ok(validValuationId(id));
  for(const invalid of [undefined,"","../../secret",id+"&x=1"])assert.equal(validValuationId(invalid),false);
  assert.equal(developmentHref(2,id),`/new-home/2?valuation=${id}`);
  assert.equal(developmentHref(2,"invalid"),"/new-home/2");
  assert.ok(hasValuationRange(valuation));
  for(const value of [null,{...valuation,low:null},{...valuation,estimate:0},{...valuation,estimate:Infinity},{...valuation,high:700000},{...valuation,low:800000}])assert.equal(hasValuationRange(value),false);
});
test("only priced and insufficient-data valuations may continue to home selection",()=>{
  assert.equal(valuationJourneyState(valuation),"ready");
  assert.equal(valuationJourneyState({...valuation,valuation_status:"insufficient_data",estimate:null,low:null,high:null}),"manual");
  for(const valuation_status of ["not_found","unsupported_property_type"]){
    const state=valuationJourneyState({...valuation,valuation_status,estimate:null,low:null,high:null});
    assert.equal(state,"unavailable");assert.equal(canContinueWithValuation(state),false);
  }
  assert.equal(canContinueWithValuation("ready"),true);
  assert.equal(canContinueWithValuation("manual"),true);
  assert.equal(INSUFFICIENT_DATA_MESSAGE,"Not enough recent sales to estimate automatically. You can still apply — a registered valuer will value your home after you agree to proceed.");
});
test("preview uses published or overriding sales price and whole-RM monetary formatting",()=>{
  assert.equal(marketRm(720000),"RM720,000");assert.equal(marketRm(-40000.25),"-RM40,000");
  assert.deepEqual(pricePreview(2789000,"",valuation).range,{low:1949000,high:2069000});
  const quote=pricePreview(2789000,"850,000.25",valuation);
  assert.equal(quote.source,"sales_quote");assert.equal(quote.price,850000.25);assert.deepEqual(quote.range,{low:10000.25,high:130000.25});
  assert.deepEqual(pricePreview(null,"800000",valuation).range,{low:-40000,high:80000});
  assert.deepEqual(pricePreview(600000,"",valuation).range,{low:-240000,high:-120000});
  assert.deepEqual(pricePreview(900000,"",{...valuation,low:720000.36,high:840000.62}).range,{low:59999,high:180000});
});
test("invalid quotation never silently falls back, and missing inputs never become zero estimates",()=>{
  for(const quote of ["0","-1","1e6","850,00","1.234","RM100","NaN","9007199254740992"]){const result=pricePreview(900000,quote,valuation);assert.ok(result.error,quote);assert.equal(result.price,null);assert.equal(result.range,null);}
  for(const price of [null,0,-1,Infinity])assert.equal(pricePreview(price,"",valuation).range,null);
  assert.equal(pricePreview(900000,"",null).range,null);
  assert.equal(pricePreview(900000,"",{...valuation,estimate:null}).range,null);
});
test("verified published layouts are source-matched; all other projects use Standard home type",()=>{
  const baleria=publishedLayouts("Serenia Baleria 1 & 2","https://www.simedarbyproperty.com/serenia-city/serenia-baleria/");assert.equal(baleria.layouts.length,4);
  const serasi=publishedLayouts("Serasi Residences","https://www.simedarbyproperty.com/putra-heights/serasi-residences/");assert.match(serasi.layouts[2].note,/eligibility/);
  for(const row of [...baleria.layouts,...serasi.layouts])assert.equal("price" in row,false);
  for(const result of [publishedLayouts("East 61",null),publishedLayouts("Serasi Residences","https://evil.test/")])assert.deepEqual(result,{source:null,layouts:[{value:"Standard home type",label:"Standard home type"}]});
});
const reader=(await file("lib/development.ts")).replace('import "server-only";',"").replace('import { createClient } from "@/lib/supabase/server";',"const createClient=()=>globalThis.__developmentClient;").replace(/import \{[^;]+from "\.\/development-model";/s,"const {validValuationId,valuationJourneyState}=globalThis.__developmentModel;");
globalThis.__developmentModel={hasValuationRange,validValuationId,valuationJourneyState};
const {getJourneyValuation}=await moduleFor(reader);
function clientFor(result){const calls=[];return {calls,from(table){calls.push(["from",table]);const chain={};for(const method of ["select","eq"])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};chain.maybeSingle=()=>{calls.push(["maybeSingle"]);return result;};return chain;}};}
test("valuation reader uses explicit ID + owner filters, and distinguishes ready, manual, unavailable, missing and failure",async()=>{
  for(const [result,state] of [[{data:valuation,error:null},"ready"],[{data:{...valuation,valuation_status:"insufficient_data",estimate:null,low:null,high:null},error:null},"manual"],[{data:{...valuation,valuation_status:"not_found",estimate:null,low:null,high:null},error:null},"unavailable"],[{data:null,error:null},"missing"],[{data:null,error:{}},"error"]]){
    const client=clientFor(result);globalThis.__developmentClient=client;const context=await getJourneyValuation(id,"owner-1");assert.equal(context.state,state);
    assert.ok(client.calls.some(call=>JSON.stringify(call)===JSON.stringify(["eq","id",id])));assert.ok(client.calls.some(call=>JSON.stringify(call)===JSON.stringify(["eq","user_id","owner-1"])));
    assert.equal(client.calls[1][1],"id,scheme,road_norm,valuation_status,estimate,low,high");
  }
  const client=clientFor({});globalThis.__developmentClient=client;
  assert.equal((await getJourneyValuation(undefined,"owner-1")).state,"none");assert.equal((await getJourneyValuation("invalid","owner-1")).state,"missing");assert.equal(client.calls.length,0);
  globalThis.__developmentClient={from(){throw Error("Offline");}};assert.equal((await getJourneyValuation(id,"owner-1")).state,"error");
});
test("development phase handoff: validated GET selection, no writes and no saved-valuation link",async()=>{
  const panel=await file("app/new-home/[project]/price-panel.tsx");
  assert.match(panel,/<button type="submit" disabled=\{!canCompare\}/);assert.match(panel,/<form action="\/plans" method="get"/);
  assert.match(panel,/canContinueWithValuation\(context.state\)/);
  assert.doesNotMatch(panel,/quotePlans|localStorage|sessionStorage|fetch\(/);
  assert.doesNotMatch(await file("app/new-home/valuation-context.tsx"),/href=|View saved valuation/);
  const resultPage=await file("app/valuation/result/[id]/page.tsx");
  assert.match(resultPage,/new-home\?valuation=\$\{encodeURIComponent\(valuation.id\)\}/);
  assert.match(resultPage,/larger land area does not always produce a higher preliminary estimate/i);
  const {catalogueHref}=await moduleFor(await file("lib/catalogue-model.ts"));
  assert.equal(catalogueHref({tier:"upcoming",query:"",location:"",type:"all"},id),`/new-home?tier=upcoming&valuation=${id}`);
});
