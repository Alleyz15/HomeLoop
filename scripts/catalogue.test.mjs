import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const source=await readFile(new URL("../apps/web/src/lib/catalogue-model.ts",import.meta.url),"utf8");
const {catalogueView,catalogueHref,cataloguePrice,catalogueSize,catalogueCheckedDate,officialProjectUrl}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const launch=(id,tier="selling",extra={})=>({id,tier,project:"Project "+id,township:"Serenia City",area:"Sepang",state:"Selangor",category:"landed",property_type:"Terrace",price_from_rm:809888,built_up_min_sqft:1731,built_up_max_sqft:2088,tenure:"Freehold",expected_completion:null,project_url:"https://www.simedarbyproperty.com/serenia-city/serenia-baleria/",checked_on:"2026-10-14",...extra});
test("catalogue only lists selling/upcoming records and counts remain independent of filters",()=>{
  const rows=[launch(1),launch(2,"upcoming"),launch(3,"check"),launch(4,"under_construction"),launch(-1),launch(6,"selling",{project:""})];
  const view=catalogueView(rows,{});assert.deepEqual(view.counts,{selling:1,upcoming:1});assert.deepEqual(view.rows.map(r=>r.id),[1]);
  const searched=catalogueView(rows,{q:"missing",tier:"upcoming"});assert.equal(searched.rows.length,0);assert.deepEqual(searched.counts,view.counts);
});
test("catalogue supports literal bounded search, location/type filters and encoded URLs",()=>{
  const rows=[launch(1),launch(2,"selling",{township:"Putra Heights",category:"high-rise",project:"Serasi & Park"})];
  assert.equal(catalogueView(rows,{q:"SERENIA"}).rows[0].id,1);
  assert.equal(catalogueView(rows,{location:"Putra Heights",type:"high-rise"}).rows[0].id,2);
  assert.equal(catalogueView(rows,{q:"%_.*"}).rows.length,0);
  const safe=catalogueView(rows,{tier:"check",location:"foreign",type:"bad",q:"x".repeat(110)}).filters;
  assert.equal(safe.tier,"selling");assert.equal(safe.location,"");assert.equal(safe.type,"all");assert.equal(safe.query.length,100);
  assert.equal(catalogueHref({tier:"upcoming",query:"Road & Park",location:"Putra Heights",type:"high-rise"}),"/new-home?tier=upcoming&q=Road+%26+Park&location=Putra+Heights&type=high-rise");
  assert.equal(catalogueView(rows,{q:["bad"],tier:["upcoming"]}).filters.query,"");
});
test("unpublished amounts and dates are honest; official project links are strictly validated",()=>{
  assert.equal(cataloguePrice(809888),"RM809,888");
  for(const value of [null,0,-1,NaN,Infinity])assert.equal(cataloguePrice(value),null);
  assert.equal(catalogueSize(launch(1)),"1,731–2,088 sq ft");
  assert.equal(catalogueSize({built_up_min_sqft:null,built_up_max_sqft:null}),"Size not published");
  assert.equal(catalogueCheckedDate("2026-10-14"),"Checked 14 Oct 2026");
  for(const value of [null,"2026-02-30","bad"])assert.equal(catalogueCheckedDate(value),"Check date not recorded");
  assert.ok(officialProjectUrl(launch(1).project_url));
  for(const url of [null,"javascript:alert(1)","//www.simedarbyproperty.com/","http://www.simedarbyproperty.com/","https://www.simedarbyproperty.com.evil.test/","https://evil.test/","https://user:pass@www.simedarbyproperty.com/","https://www.simedarbyproperty.com:444/"])assert.equal(officialProjectUrl(url),null);
});
const reader=(await readFile(new URL("../apps/web/src/lib/catalogue.ts",import.meta.url),"utf8")).replace('import "server-only";',"").replace('import { createClient } from "@/lib/supabase/server";',"const createClient=()=>globalThis.__catalogueTestClient;");
const {getCatalogue}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(reader)).toString("base64")}`);
function clientFor(responder){const calls=[];return {calls,from(table){const call={table,methods:[]};calls.push(call);const chain={};for(const method of ["select","in","order","range"])chain[method]=(...args)=>{call.methods.push([method,...args]);return chain;};chain.then=(resolve,reject)=>Promise.resolve().then(()=>responder(call)).then(resolve,reject);return chain;}};}
test("catalogue reader batches past provider caps with explicit tier filtering and no user/inventory fields",async()=>{
  const rows=Array.from({length:5},(_,i)=>launch(i+1));
  const client=clientFor(call=>{const offset=call.methods.find(m=>m[0]==="range")[1];return {data:rows.slice(offset,offset+2),count:rows.length,error:null};});globalThis.__catalogueTestClient=client;
  assert.equal((await getCatalogue()).launches.length,5);assert.equal(client.calls.length,3);
  for(const call of client.calls){assert.equal(call.table,"sdp_launches");assert.deepEqual(call.methods.find(m=>m[0]==="in"),["in","tier",["selling","upcoming"]]);const select=call.methods.find(m=>m[0]==="select");assert.equal(select[2].count,"exact");assert.equal(/user_id|units|\*/.test(select[1]),false);}
});
test("catalogue failures are errors rather than false empty or truncated listings",async()=>{
  for(const result of [{data:[],count:0,error:{}},{data:[],count:null,error:null},{data:[],count:4,error:null}]){globalThis.__catalogueTestClient=clientFor(()=>result);assert.equal((await getCatalogue()).error,true);}
  globalThis.__catalogueTestClient=clientFor(()=>({data:[],count:0,error:null}));assert.deepEqual(await getCatalogue(),{launches:[],error:false});
});
