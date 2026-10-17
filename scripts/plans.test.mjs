import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const file=name=>readFile(new URL("../apps/web/src/lib/"+name,import.meta.url),"utf8");
const moduleFor=source=>import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const development=await moduleFor(await file("development-model.ts"));
globalThis.__planDevelopment=development;
const source=(await file("plans-model.ts")).replace('import { validValuationId, pricePreview } from "./development-model";',"const {validValuationId,pricePreview}=globalThis.__planDevelopment;");
const model=await moduleFor(source);
globalThis.__planModel=model;
const id="20000000-0000-4000-8000-000000000001";
const params={valuation:id,launch:"2",home_type:"Type A2",sales_quote:"850,000.25"};
test("selection parses only bounded IDs/layout/quotation input, never client valuations or eligibility",()=>{
  const selected=model.parsePlanSelection({...params,estimate:"1",is_sdp:"true"});
  assert.deepEqual(selected,{valuation:id,launch:2,homeType:"Type A2",salesQuote:"850000.25"});
  for(const invalid of [{valuation:"foreign"},{launch:"1e6"},{launch:"0"},{launch:"99999999999999999999"},{home_type:"x".repeat(81)},{sales_quote:"1e6"},{sales_quote:"0"},{sales_quote:"850,00"},{valuation:[id,id]},{home_type:["Type A2"]}])assert.equal(model.parsePlanSelection({...params,...invalid}),null,JSON.stringify(invalid));
});
test("navigation retains only selection and explicit guidance, never recalculated financial amounts",()=>{
  const selection=model.parsePlanSelection(params);
  assert.equal(model.planHref(selection,"b","yes"),`/plans/b?valuation=${id}&launch=2&home_type=Type+A2&sales_quote=850000.25&deposit=yes`);
  assert.equal(model.selectionDevelopmentHref(selection),`/new-home/2?valuation=${id}&home_type=Type+A2&sales_quote=850000.25`);
  assert.equal(model.depositAnswer(["yes"]),null);assert.equal(model.depositAnswer("no"),"no");
});
test("recommendation never bypasses eligibility or promises zero cash",()=>{
  assert.equal(model.recommendation("yes",true,true).plan,"B");
  assert.equal(model.recommendation("no",true,true).plan,"A");assert.match(model.recommendation("no",true,true).message,/remaining cash gap/);
  assert.equal(model.recommendation("no",false,true).plan,null);assert.match(model.recommendation("no",false,true).message,/still requires/);
  assert.equal(model.recommendation(null,true,true).plan,null);
});
const quote={new_home:{name:"Test",price:850000,price_source:"sales_quote"},plan_a:{eligible:true,reasons:[],offer:616723,offer_low:565200,offer_high:659400,price_gap:233277,rpgt_retention:18502,deposit:{cash_gap:23328,new_home_deposit:85000,old_home_deposit_offset:61672,note:"Assumed offset"}},plan_b:{eligible:true,floor:589226,floor_low:540000,floor_high:630000,expected_net:751067,expected_net_low:688320,expected_net_high:803040,net_at_floor:589226,deposit_gap:85000,price_gap:98933,rpgt_retention:23569}};
test("reply guard supports legacy totals but rejects malformed breakdowns and undefined/nonfinite money",()=>{
  assert.ok(model.validPlanQuote(quote));assert.equal(model.validPlanQuote({}),false);
  for(const invalid of [{...quote,plan_a:{...quote.plan_a,offer:undefined}},{...quote,plan_b:{...quote.plan_b,floor:NaN}},{...quote,plan_a:{...quote.plan_a,reasons:undefined}},{...quote,plan_a:{...quote.plan_a,breakdown:{basis:785635,result:1,rounding_adjustment:0,deductions:[]}}}])assert.equal(model.validPlanQuote(invalid),false);
});
const saved={id,scheme:"Test township",road_norm:"JLN TEST",ptype:"Terrace",tenure:"Freehold",confidence:"medium",estimate:785635.36,low:720000,high:840000};
const launch={id:2,tier:"selling",project:"Serenia Baleria 1 & 2",project_url:"https://www.simedarbyproperty.com/serenia-city/serenia-baleria/",price_from_rm:809888};
const catalogue=await moduleFor(await file("catalogue-model.ts"));
globalThis.__planRuntime={...development,...model,officialProjectUrl:catalogue.officialProjectUrl};
const reader=(await file("plans.ts")).replace('import "server-only";',"")
  .replace('import { createClient } from "@/lib/supabase/server";',"const createClient=()=>globalThis.__planClient;")
  .replace('import { getCatalogue } from "./catalogue";',"const getCatalogue=()=>globalThis.__planCatalogue;")
  .replace(/import \{ officialProjectUrl \} from "\.\/catalogue-model";/,"const {officialProjectUrl}=globalThis.__planRuntime;")
  .replace(/import \{ hasValuationRange[^;]+;/,"const {hasValuationRange,publishedLayouts,pricePreview}=globalThis.__planRuntime;")
  .replace(/import \{ parsePlanSelection[^;]+;/,"const {parsePlanSelection,validPlanQuote}=globalThis.__planRuntime;")
  .replace(/import \{ quotePlans[^;]+;/,"const quotePlans=input=>globalThis.__planQuote(input);");
const {getPlanJourney}=await moduleFor(reader);
function fixture({valuation=saved,metadata={data:[{is_sdp:true}],error:null},launches=[launch],dataError=null}={}){
  const calls=[],quotes=[];globalThis.__planCatalogue={launches,error:false};
  globalThis.__planQuote=input=>{quotes.push(input);return quote;};
  globalThis.__planClient={from(table){const call={table,steps:[]};calls.push(call);const chain={};for(const name of ["select","eq","order","limit"])chain[name]=(...args)=>{call.steps.push([name,...args]);return chain;};chain.maybeSingle=()=>({data:valuation,error:dataError});chain.then=(resolve,reject)=>Promise.resolve(metadata).then(resolve,reject);return chain;}};
  return {calls,quotes};
}
test("reader reloads owned saved inputs and verified metadata; client-supplied amounts/flags ignored",async()=>{
  const f=fixture();const result=await getPlanJourney({...params,is_sdp:"false",estimate:"1"},"owner-1");assert.ok(result.journey);
  assert.ok(f.calls[0].steps.some(row=>row[0]==="eq"&&row[1]==="user_id"&&row[2]==="owner-1"));
  assert.ok(f.calls[0].steps.some(row=>row[0]==="eq"&&row[1]==="id"&&row[2]===id));
  assert.deepEqual(f.calls[1].steps.filter(row=>row[0]==="eq").map(row=>row.slice(1)),[["scheme",saved.scheme],["ptype",saved.ptype],["road_norm",saved.road_norm]]);
  assert.equal(f.quotes[0].valuation.estimate,785635.36);assert.equal(f.quotes[0].valuation.is_sdp,true);assert.equal(f.quotes[0].new_home.sales_quote_rm,850000.25);
});
test("foreign, unpriced, incomplete, missing-type, upcoming, missing-price and failed-metadata inputs never quote",async()=>{
  const scenarios=[{valuation:null},{valuation:{...saved,estimate:null}},{valuation:{...saved,confidence:null}},{launches:[{...launch,tier:"upcoming"}]},{metadata:{data:[],error:null}},{metadata:{data:null,error:{}}},{dataError:{}}];
  for(const options of scenarios){const f=fixture(options);assert.ok((await getPlanJourney(params,"owner-1")).error);assert.equal(f.quotes.length,0);}
  let f=fixture();assert.ok((await getPlanJourney({...params,home_type:"Injected unit"},"owner-1")).error);assert.equal(f.quotes.length,0);
  f=fixture({launches:[{...launch,price_from_rm:null}]});assert.ok((await getPlanJourney({...params,sales_quote:""},"owner-1")).error);assert.equal(f.quotes.length,0);
  f=fixture();assert.ok((await getPlanJourney({...params,valuation:"invalid"},"owner-1")).error);assert.equal(f.calls.length,0);
});
test("quote failures are retry states; missing metadata is never silently outside SDP",async()=>{
  fixture();globalThis.__planQuote=()=>{throw Error("Offline");};assert.match((await getPlanJourney(params,"owner-1")).error,/try again/);
  fixture({metadata:{data:[],error:null}});assert.match((await getPlanJourney(params,"owner-1")).error,/not been assumed/);
  fixture();globalThis.__planQuote=()=>({plan_a:{}});assert.ok((await getPlanJourney(params,"owner-1")).error);
});
