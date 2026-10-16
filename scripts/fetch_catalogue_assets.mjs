// Explicitly curated public SDP marketing images. Never run during app requests.
// Keeps page/image provenance; does not change the database or infer inventory.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(path.join(root,"apps/web/package.json"));
const sharp=require("sharp");
const checkedOn=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const entries=[
  ["Adira","bandar-bukit-raja/adira/","9701eeaa-e460-4899-f87a-1c0ea5094c00"],
  ["Avira Hills 2","bandar-ainsdale/avira-hills-2/","d3f40971-229d-4278-3ef5-a619ac632700"],
  ["Casira 3","bandar-bukit-raja/casira-3","f625b9d0-0ab5-419f-3720-fe2474568e00"],
  ["Damayan Residences","putra-heights/damayan/","f59e5c11-6ec4-4734-9b08-6777ff9b9c00"],
  ["East 61","kl-east/east-61/","c28119fa-2958-4070-6c7a-686081793f00"],
  ["Elmina Ridge 2","city-of-elmina/elmina-ridge-1","e24ac808-974a-4e71-a90f-8038bf7b4e00"],
  ["Emilia","nilai-impian/emilia","8495ed2b-cb58-49c5-bc74-fa6dda997400"],
  ["Emilia Lakeside","nilai-impian/emilia-lakeside/","c9c41eb9-6449-4fc3-1040-9a4aeb789b00"],
  ["Harmoni Permai 2","bandar-universiti-pagoh/harmoni-permai","8f647811-0964-4cf5-f376-15194c5a4600"],
  ["Hype Residences","sj7/hype-residences","42150f7c-5c51-4a4f-5ca5-397681158600"],
  ["Kanopi Residences","city-of-elmina/elmina-city-centre/kanopi-residences/","90475c0b-25b7-4b03-5f28-0252fe787300"],
  ["Lanai Lakeside","bandar-bukit-raja/lanai-lakeside/","ca678528-94d7-41bc-8de1-67a128698900"],
  ["Serasi Residences","putra-heights/serasi-residences/","231e8b53-38ea-4b3c-95bf-63344179a100"],
  ["Serenia Baleria 1 & 2","serenia-city/serenia-baleria/","8b58d39e-7485-4b7e-1239-1414d904fa00"],
  ["Seroja Gardens Phase 2","nilai-impian/seroja-gardens","f3ab0302-b64d-45d5-8299-1560a1576800"],
  ["SJCC East One","sjcc/east1/","46310cfa-9300-4cec-0af3-0519494b0a00"],
  ["Suasana","bandar-ainsdale/suasana-ainsdale","f856824a-0228-4443-562a-ed0fece7b700"],
  ["The Nine, Elmina Green","city-of-elmina/the-nine-elmina-green/","./images/nine-facede-front-view.png"],
  ["The Ophera","klgcc-resort/theophera/","./images/ophera-facade.jpg?v3"],
  ["The Reya","kl-east/the-reya/","168aa6bf-761a-4606-72a0-e0270b964700"],
  ["Tiara Residences 1","bukit-jelutong/tiara-residences/","dad740c6-81ba-4e76-2212-39f8b9409800"],
  ["Tiara Residences 2","bukit-jelutong/tiara-residences/","ff54d3c0-43f5-4fac-c2d0-fb55fd225300"],
  ["Triara Residences","ara-damansara/triara","./new_img/triara-full-facade-crop.jpg"],
];
const dir=path.join(root,"apps/web/public/catalogue");
await mkdir(dir,{recursive:true});
const sources={};const thumbs=[];
for(const [project,pagePath,image] of entries) {
  const page="https://www.simedarbyproperty.com/"+pagePath;
  const response=await fetch(page,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Project page HTTP ${response.status}: ${project}`);
  const html=await response.text();
  if(!html.includes(image))throw Error(`Curated image no longer present on page: ${project}`);
  const source=image.startsWith("./")?new URL(image,response.url+ (new URL(response.url).pathname.endsWith("/")?"":"/")).href:`https://imagedelivery.net/TdjZsXzzZt_je48pBzV3SA/${image}/public`;
  const photo=await fetch(source,{signal:AbortSignal.timeout(20000)});
  if(!photo.ok || !photo.headers.get("content-type")?.startsWith("image/"))throw Error(`Invalid project image: ${project}`);
  const bytes=Buffer.from(await photo.arrayBuffer());
  const slug=project.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/u,"");
  const output=await sharp(bytes).rotate().flatten({background:"#e6eadf"}).resize({width:1100,height:700,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true});
  await writeFile(path.join(dir,slug+".webp"),output.data);
  const captions={"Emilia":"Published floor plan","Tiara Residences 2":"Development master plan","Serasi Residences":"Development facilities","Seroja Gardens Phase 2":"Official launch announcement","Suasana":"Township setting"};
  sources[project]={src:`/catalogue/${slug}.webp`,sourcePage:page,sourceImage:source,caption:captions[project]??"Artist’s impression",checkedOn,width:output.info.width,height:output.info.height};
  thumbs.push({input:await sharp(output.data).resize(240,140,{fit:"cover"}).extend({bottom:30,background:"#f7f7ef"}).composite([{input:Buffer.from(`<svg width="240" height="30"><text x="8" y="20" font-size="12" fill="#203e32">${project.replaceAll("&","&amp;")}</text></svg>`),top:140,left:0}]).png().toBuffer(),left:((thumbs.length)%4)*240,top:Math.floor(thumbs.length/4)*170});
  console.log(`Downloaded ${project} (${Math.round(output.data.length/1024)}KB)`);
}
await writeFile(path.join(dir,"sources.json"),JSON.stringify(sources,null,2)+"\n");
const sheet=process.env.CATALOGUE_CONTACT_SHEET;
if(sheet)await sharp({create:{width:960,height:Math.ceil(thumbs.length/4)*170,channels:3,background:"#f7f7ef"}}).composite(thumbs).png().toFile(sheet);
console.log(`Saved ${entries.length} images and provenance. Rights remain with SDP; publication permissions must be checked separately.`);
