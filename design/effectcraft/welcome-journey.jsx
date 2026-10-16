// Original HomeLoop scene. Rebuild with the commands in README.md.
// 0–9 seconds: cinematic assembly. 9–13 seconds: a seamless living-garden loop.
app.beginUndoGroup("HomeLoop — a neighbourhood comes to life");
app.run("comp.new", {
  name: "HomeLoop Journey", width: 760, height: 700,
  frameRate: 24, duration: 13, background: "#e8eddf"
});
var layers = [];
function art(name, body) {
  var layer = app.run("edit.pasteSvg", {
    name: name,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="700" viewBox="0 0 760 700">' + body + '</svg>'
  }).layer;
  layers.push(layer);
  return layer;
}
function set(layer, path, value) {
  app.run("prop.set", {layer: layer, path: path, value: value});
}
function key(layer, path, time, value, linear) {
  app.run("prop.addKey", {layer: layer, path: path, time: time, value: value});
  if (!linear) {
    app.run("keys.setEase", {layer: layer, path: path, time: time, side: "in", speed: 0, influence: 65});
    app.run("keys.setEase", {layer: layer, path: path, time: time, side: "out", speed: 0, influence: 65});
  }
}
function pivot(layer, x, y) {
  set(layer, "transform/anchor", [x,y]);
  set(layer, "transform/position", [x,y]);
}
function fade(layer, start, end, opacity) {
  key(layer, "transform/opacity", 0, 0);
  if (start > 0) key(layer, "transform/opacity", start, 0);
  key(layer, "transform/opacity", end, opacity === undefined ? 100 : opacity);
}
function rise(layer, x, y, start, end) {
  pivot(layer,x,y);
  fade(layer,start,start+0.3);
  key(layer,"transform/scale",start,[96,0]);
  key(layer,"transform/scale",end-0.15,[101,105]);
  key(layer,"transform/scale",end,[100,100]);
}
function drop(layer, x, y, start, end) {
  pivot(layer,x,y);
  fade(layer,start,start+0.25);
  key(layer,"transform/position",start,[x-10,y-95]);
  key(layer,"transform/position",end-0.2,[x,y+7]);
  key(layer,"transform/position",end,[x,y]);
  key(layer,"transform/rotation",start,-7);
  key(layer,"transform/rotation",end,0);
}
function grow(layer, x, y, start, end) {
  pivot(layer,x,y);
  fade(layer,start,start+0.3);
  key(layer,"transform/scale",start,[0,0]);
  key(layer,"transform/scale",end-0.15,[108,108]);
  key(layer,"transform/scale",end,[100,100]);
}

var ground = art("01 — garden unfolds", '<ellipse cx="394" cy="460" rx="300" ry="144" fill="#dce3d2"/>' +
  '<ellipse cx="394" cy="460" rx="262" ry="120" fill="none" stroke="#c7d1bc"/>' +
  '<ellipse cx="394" cy="460" rx="224" ry="98" fill="none" stroke="#c7d1bc"/>' +
  '<path d="M111 478L390 316L670 478L390 640Z" fill="#d2dcc7"/>' +
  '<path d="M111 478L390 640L390 651L111 489Z" fill="#b9c8ac"/>' +
  '<path d="M390 640L670 478L670 489L390 651Z" fill="#c3cfb8"/>' +
  '<path d="M188 500L390 383L594 501L390 618Z" fill="#eaf0e1"/>' +
  '<path d="M183 478L389 359L599 480" fill="none" stroke="#b4c4a4" stroke-width="2"/>');
pivot(ground,390,480);
key(ground,"transform/scale",0,[35,8]);
key(ground,"transform/scale",0.8,[100,100]);
key(ground,"transform/rotation",0,-8);
key(ground,"transform/rotation",0.8,0);

var shadows = art("02 — soft landing shadows", '<ellipse cx="226" cy="466" rx="104" ry="33" fill="#c4d0b8"/>' +
  '<ellipse cx="493" cy="408" rx="146" ry="44" fill="#bdcdb0"/>');
fade(shadows,0.4,1.3);

var guide = art("03 — the possibility of a path", '<path d="M220 478C211 560 472 588 520 430" fill="none" stroke="#8b9d7b" stroke-width="2.5" stroke-dasharray="4 9"/>');
fade(guide,1.8,2.6,65);

// Native Bezier + Trim Paths: the connection actually draws, rather than fading in.
var path = app.run("layer.newShape", {kind:"none",name:"04 — connection draws"}).layer;
layers.push(path);
app.run("shape.newPath", {layer:path,vertices:[[220,478],[520,430]],outTangents:[[-9,82],[0,0]],inTangents:[[0,0],[-48,158]],closed:false,space:"comp",fill:false,stroke:"#c8e994",strokeWidth:5});
var trim = app.run("layer.addShapeItem", {layer:path,kind:"trim"});
key(path,trim.path+"/end",2.15,0,true);
key(path,trim.path+"/end",6.6,100,true);
fade(path,2,2.2);
key(path,"transform/opacity",7.2,100);
key(path,"transform/opacity",9,25);

var oldWalls = art("05 — current home walls rise", '<path d="M151 376L226 332L305 377L230 421Z" fill="#f9f5e9"/>' +
  '<path d="M151 376L230 421L230 481L151 435Z" fill="#f1eddf"/>' +
  '<path d="M230 421L305 377L305 437L230 481Z" fill="#d3d8c8"/>');
rise(oldWalls,228,480,0.45,1.55);
var oldRoof = art("06 — current roof settles", '<path d="M139 377L216 298L230 306L230 430Z" fill="#758774"/>' +
  '<path d="M216 298L295 343L319 384L230 430L230 350Z" fill="#476756"/>' +
  '<path d="M216 298L295 343L319 384L230 333Z" fill="#66806b"/>');
drop(oldRoof,228,365,1.1,2.15);
var oldWindows = art("07 — familiar windows", '<path d="M172 405L195 418L195 445L172 432Z" fill="#9bb5aa"/>' +
  '<path d="M207 425L223 434L223 476L207 467Z" fill="#52725e"/>' +
  '<path d="M249 427L277 411L277 438L249 454Z" fill="#7e9c89"/>' +
  '<path d="M263 419L263 446M249 441L277 425" stroke="#dae5d7" stroke-width="2"/>');
fade(oldWindows,1.35,2);

var newWalls = art("08 — next home walls rise", '<path d="M367 275L474 213L605 289L499 352Z" fill="#fbf9ed"/>' +
  '<path d="M367 275L499 352L499 442L367 366Z" fill="#fbf8ed"/>' +
  '<path d="M499 352L605 289L605 381L499 442Z" fill="#d1deca"/>' +
  '<path d="M443 412L479 433L479 445L443 424Z" fill="#c1cbb4"/>' +
  '<path d="M432 420L479 447L479 454L432 427Z" fill="#b2c0a3"/>');
rise(newWalls,495,442,4.0,5.25);
var newRoof = art("09 — next roof arrives", '<path d="M352 279L459 155L478 166L501 365Z" fill="#3f624e"/>' +
  '<path d="M459 155L590 231L621 294L478 211Z" fill="#53775c"/>' +
  '<path d="M478 211L621 294L501 365Z" fill="#264d3b"/>');
drop(newRoof,485,270,4.7,5.95);
var chimney = art("10 — final architectural detail", '<path d="M460 191L472 176L486 184L486 226Z" fill="#789369"/>');
drop(chimney,474,214,5.4,6.15);
var newWindows = art("11 — next home windows", '<path d="M391 319L421 336L421 369L391 351Z" fill="#adc7b3"/>' +
  '<path d="M406 328L406 360M391 335L421 352" stroke="#edf1df" stroke-width="3"/>' +
  '<path d="M449 355L478 372L478 429L449 412Z" fill="#40664f"/>' +
  '<path d="M455 370L470 379L470 398L455 389Z" fill="#bed6ac"/>' +
  '<path d="M523 354L580 321L580 360L523 393Z" fill="#70997f"/>' +
  '<path d="M550 338L550 378M523 373L580 340" stroke="#ecf2dd" stroke-width="3"/>');
fade(newWindows,5.05,5.9);
var warmth = art("12 — a warm welcome", '<path d="M392 320L420 336L420 367L392 351Z" fill="#e1df9b"/>' +
  '<path d="M524 355L579 323L579 359L524 391Z" fill="#d9e6a6"/>');
fade(warmth,7,8.1,30);
key(warmth,"transform/opacity",9,30);
key(warmth,"transform/opacity",11,43);
key(warmth,"transform/opacity",13,30);

var treeBack = art("13 — garden tree", '<path d="M616 366L616 413" stroke="#607a54" stroke-width="6"/>' +
  '<ellipse cx="617" cy="344" rx="29" ry="47" fill="#9ab579"/>' +
  '<ellipse cx="607" cy="337" rx="16" ry="32" fill="#abc58a"/>');
grow(treeBack,616,413,5.6,6.6);
var treeFront = art("14 — foreground tree", '<path d="M335 438L335 477" stroke="#718763" stroke-width="5"/>' +
  '<ellipse cx="336" cy="418" rx="23" ry="36" fill="#87a56c"/>' +
  '<ellipse cx="328" cy="412" rx="13" ry="27" fill="#9fbb7c"/>');
grow(treeFront,335,477,1.8,2.65);
var shrubs = art("15 — garden grows", '<ellipse cx="148" cy="472" rx="20" ry="13" fill="#a5bb8c"/>' +
  '<ellipse cx="163" cy="479" rx="14" ry="10" fill="#8da773"/>' +
  '<ellipse cx="570" cy="456" rx="25" ry="14" fill="#a0b984"/>' +
  '<ellipse cx="591" cy="447" rx="18" ry="12" fill="#89a772"/>');
grow(shrubs,380,480,5.9,7);

var marker = art("16 — moving toward possibility", '<circle cx="380" cy="350" r="19" fill="#d5f18c" fill-opacity=".25"/>' +
  '<circle cx="380" cy="350" r="11" fill="#d5f18c"/>' +
  '<circle cx="380" cy="350" r="4" fill="#31533f"/>');
for (var i=0;i<=32;i++) {
  var t=i/32, u=1-t;
  var x=u*u*u*220+3*u*u*t*211+3*u*t*t*472+t*t*t*520;
  var y=u*u*u*478+3*u*u*t*560+3*u*t*t*588+t*t*t*430;
  key(marker,"transform/position",2.15+4.45*t,[x,y],true);
}
fade(marker,2,2.3);
key(marker,"transform/opacity",6.7,100);
key(marker,"transform/opacity",7.4,0);
var arrival = art("17 — arrival ripple", '<circle cx="520" cy="430" r="25" fill="none" stroke="#c8e994" stroke-width="3"/>');
pivot(arrival,520,430);
fade(arrival,6.5,6.65,80);
key(arrival,"transform/scale",6.5,[30,30]);
key(arrival,"transform/scale",7.7,[230,230]);
key(arrival,"transform/opacity",7.7,0);
var glint = art("18 — roof highlight", '<path d="M459 155L590 231" stroke="#d5edb4" stroke-width="3"/>');
fade(glint,7.3,7.8,70);
key(glint,"transform/opacity",8.6,0);

// Real parent rig provides a coherent push-in without moving HTML labels/text.
var rig = app.run("layer.newNull", {name:"Camera — gentle push toward the next chapter"}).layer;
pivot(rig,380,350);
app.run("layer.setParent", {layers:layers,parent:rig,compensate:true});
key(rig,"transform/scale",0,[94,94]);
key(rig,"transform/scale",2,[100,100]);
key(rig,"transform/scale",7.2,[100,100]);
key(rig,"transform/scale",9,[104,104]);
key(rig,"transform/position",7.2,[380,350]);
key(rig,"transform/position",9,[371,350]);
// Both ends of the ambient segment match for a clean 9→13→9 loop.
for (var j=0;j<=4;j++) {
  var angle = [0,1.7,0,-1.7,0][j];
  key(treeBack,"transform/rotation",9+j,angle);
  key(treeFront,"transform/rotation",9+j,-angle*0.7);
}
app.endUndoGroup();
writeLn("HomeLoop Journey v2: layered assembly, native Trim Paths, moving marker, warm windows, arrival ripple, camera rig and ambient garden.");
