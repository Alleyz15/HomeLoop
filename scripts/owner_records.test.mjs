import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const modelSource=await readFile(new URL("../apps/web/src/lib/owner-records-model.ts",import.meta.url),"utf8");
const {buildOwnerRecords,recordSummary,selectRecordPage,recordReference,recordsHref,valuationPresentation}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(modelSource)).toString("base64")}`);
const now=Date.parse("2026-10-16T12:00:00Z");
const value=(id)=>({id,scheme:`Property ${id}`,road_norm:`Road ${id}`,ptype:"Terrace",estimate:785635.36,low:720000,high:840000,created_at:"2026-10-01T00:00:00Z"});
const app=(id,status="under_review",valuationId="v1")=>({id,valuation_id:valuationId,launch_id:7,plan:"A",status,address_line:`Address ${id}`,unit_type:"Type A",offer_amount:616723,offer_expires_at:"2026-10-30T00:00:00Z",created_at:"2026-10-02T00:00:00Z",updated_at:"2026-10-03T00:00:00Z",launch:{project:`Project ${id}`}});

test("saved unpriced submissions remain records, not unfinished forms or attention tasks",()=>{
  const priced=value("priced"), unpriced={...value("unpriced"),estimate:null,low:null,high:null};
  const records=buildOwnerRecords([priced,unpriced],[],now);
  assert.equal(records.length,2);
  assert.equal(records.find((record)=>record.id==="unpriced").statusLabel,"Estimate unavailable");
  assert.equal(records.find((record)=>record.id==="priced").statusLabel,"Valuation saved");
  assert.deepEqual(recordSummary(records),{total:2,progress:0,attention:0,completed:0});
  assert.equal(selectRecordPage(records,"","valuation","1").total,2);
  assert.equal(selectRecordPage(records,"Estimate unavailable","all","1").total,1);
  assert.deepEqual(valuationPresentation(priced),{statusLabel:"Valuation saved",actionLabel:"View valuation"});
  assert.deepEqual(valuationPresentation(unpriced),{statusLabel:"Estimate unavailable",actionLabel:"View explanation"});
  for(const amount of [null,undefined,0,-1,NaN,Infinity]) {
    for(const field of ["estimate","low","high"]) assert.equal(valuationPresentation({...priced,[field]:amount}).actionLabel,"View explanation");
  }
  assert.equal(valuationPresentation(null).actionLabel,"View explanation");
});

test("invalid or failed valuation submissions are not saved; unpriced responses are saved only after submission",async()=>{
  const source=(await readFile(new URL("../apps/web/src/app/valuation/actions.ts",import.meta.url),"utf8"))
    .replace('import { redirect } from "next/navigation";', 'const redirect=(url)=>{throw new Error("redirect:"+url);};')
    .replace('import { searchRoads, valuate } from "@/lib/valuation";', 'const searchRoads=()=>[];const valuate=(input)=>globalThis.__valuationSubmitTest.valuate(input);')
    .replace('import { getRoadMeta, saveValuation } from "@/lib/valuations";', 'const getRoadMeta=()=>null;const saveValuation=(input)=>globalThis.__valuationSubmitTest.save(input);');
  const {createValuation}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
  let reads=0,saves=0;
  globalThis.__valuationSubmitTest={valuate:async()=>{reads++;return {estimate:null,low:null,high:null,comparables:[]};},save:async(input)=>{saves++;assert.equal(input.estimate,null);return "saved-unpriced";}};
  const form=(fields)=>{const data=new FormData();for(const [key,value] of Object.entries(fields))data.set(key,value);return data;};
  for(const fields of [{},{scheme:"Town",property_type:"Terrace"},{scheme:"Town",property_type:"Terrace",unit_position:"corner_end"}]) {
    assert.ok((await createValuation({},form(fields))).error);
  }
  assert.equal(reads,0);assert.equal(saves,0);
  const complete={scheme:"Town",property_type:"Terrace",unit_position:"custom",land_sqm:"200",floor_sqm:"150"};
  await assert.rejects(createValuation({},form(complete)),/redirect:\/valuation\/result\/saved-unpriced/);
  assert.equal(reads,1);assert.equal(saves,1);
  globalThis.__valuationSubmitTest.valuate=async()=>{throw new Error("service unavailable");};
  assert.equal((await createValuation({},form(complete))).error,"service unavailable");assert.equal(saves,1);
});

test("all records retained without double-counting valuations linked to applications",()=>{
  const records=buildOwnerRecords([value("v1"),value("v2"),value("v3"),value("v3")],[app("a1"),app("a2","rejected","v1"),app("a2","rejected","v1")],now);
  assert.equal(records.length,4);assert.equal(records.filter((record)=>record.kind==="valuation").length,2);
  assert.equal(records.find((record)=>record.id==="a1").valuation.id,"v1");
  assert.equal(records.find((record)=>record.id==="a2").project,"Project a2");
  assert.equal(records.find((record)=>record.id==="v3").application,null);
});

test("summary separates attention overlap, completed moves, closed cases and valuations",()=>{
  const applications=[app("a1","info_requested"),app("a2","under_review"),app("a3","handover"),app("a4","declined"),app("a5","offer_sent")];
  applications[4].offer_expires_at="2026-10-01T00:00:00Z";
  const records=buildOwnerRecords([value("v1"),value("v2")],applications,now);
  assert.deepEqual(recordSummary(records),{total:6,progress:2,attention:1,completed:1});
  assert.equal(records.find((record)=>record.id==="a5").status,"expired");
  assert.equal(applications[4].status,"offer_sent");
});

test("literal search, filters and pagination cover all records and clamp invalid input",()=>{
  const records=buildOwnerRecords(Array.from({length:23},(_,index)=>value(`v${index}`)),[app("a1","handover","v0")],now);
  assert.equal(selectRecordPage(records,"","all","1").rows.length,10);
  assert.equal(selectRecordPage(records,"","all","999").page,3);
  assert.equal(selectRecordPage(records,"","all","3").rows.length,3);
  assert.equal(selectRecordPage(records,"","completed","1").total,1);
  assert.equal(selectRecordPage(records,"PROPERTY V22","all","1").total,1);
  assert.equal(selectRecordPage(records,recordReference(records[0]),"all","1").total,1);
  assert.equal(selectRecordPage(records,"%_.*","all","1").total,0);
  for(const page of ["-1","0","1.5","abc","9999999999999999999999"]) assert.equal(selectRecordPage(records,"","bad-filter",page).page,1);
  assert.equal(recordsHref("Road & Park","attention",2,"app-1"),"/dashboard?q=Road+%26+Park&filter=attention&page=2&case=app-1");
});

globalThis.__recordBuilder=buildOwnerRecords;
const readerSource=(await readFile(new URL("../apps/web/src/lib/owner-records.ts",import.meta.url),"utf8"))
  .replace('import "server-only";',"")
  .replace('import { createClient } from "@/lib/supabase/server";',"const createClient=()=>globalThis.__recordsTestClient;")
  .replace('import { buildOwnerRecords, type ApplicationRecord, type OwnerRecord } from "@/lib/owner-records-model";',"const buildOwnerRecords=globalThis.__recordBuilder;");
const {getOwnerRecords,getRecordProgress}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readerSource)).toString("base64")}`);
function clientFor(responder) {
  const calls=[];
  return {calls,from(table){const call={table,methods:[]};calls.push(call);const chain={};for(const method of ["select","eq","order","range"])chain[method]=(...args)=>{call.methods.push([method,...args]);return chain;};chain.then=(resolve,reject)=>Promise.resolve().then(()=>responder(call)).then(resolve,reject);return chain;}};
}

test("reader traverses provider row caps and keeps explicit ownership on every batch",async()=>{
  const values=Array.from({length:5},(_,index)=>value(`v${index}`));
  const applications=[app("a1","under_review","v0"),app("a2","rejected","v1"),app("a3","handover","v2")];
  const client=clientFor((call)=>{const rows=call.table==="applications"?applications:values;const offset=call.methods.find(([method])=>method==="range")[1];return {data:rows.slice(offset,offset+2),count:rows.length,error:null};});
  globalThis.__recordsTestClient=client;
  const result=await getOwnerRecords("owner-1");assert.equal(result.error,false);assert.equal(result.records.length,5);
  assert.equal(client.calls.length,5);
  for(const call of client.calls) {
    assert.ok(call.methods.some(([method,key,val])=>method==="eq"&&key==="user_id"&&val==="owner-1"));
    const select=call.methods.find(([method])=>method==="select");assert.equal(select[2].count,"exact");assert.equal(select[1].includes("note"),false);assert.equal(select[1].includes("payload"),false);
  }
});

test("reader failures never masquerade as an empty account or incomplete total",async()=>{
  for(const result of [{data:[],count:0,error:{message:"test error"}},{data:[],count:null,error:null},{data:[],count:3,error:null}]) {
    globalThis.__recordsTestClient=clientFor(()=>result);assert.equal((await getOwnerRecords("owner-1")).error,true);
  }
  globalThis.__recordsTestClient=clientFor(()=>{throw new Error("network failure");});assert.equal((await getOwnerRecords("owner-1")).error,true);
});

test("progress reads only the selected application's events and excludes internal notes",async()=>{
  const record=buildOwnerRecords([value("v1")],[app("a1")],now)[0];
  const client=clientFor(()=>({data:[{to_status:"submitted",created_at:"2026-10-02T00:00:00Z",action:"submit_application",reason:null}],count:1,error:null}));globalThis.__recordsTestClient=client;
  const result=await getRecordProgress(record);assert.equal(result.application.id,"a1");assert.equal(result.valuation.id,"v1");assert.equal(result.contextError,false);
  assert.deepEqual(client.calls[0].methods.find(([method])=>method==="eq"),["eq","application_id","a1"]);
  const fields=client.calls[0].methods.find(([method])=>method==="select")[1];assert.equal(fields.includes("note"),false);assert.equal(fields.includes("payload"),false);
  globalThis.__recordsTestClient=clientFor(()=>({data:null,error:{message:"test failure"}}));assert.equal((await getRecordProgress(record)).contextError,true);
});
