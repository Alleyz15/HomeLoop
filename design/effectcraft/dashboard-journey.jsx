// Original HomeLoop Dashboard artwork: a flowing route between layered landmarks.
// Twelve-second seamless loop, authored/rendered by EffectCraft 0.10.0.
app.beginUndoGroup("HomeLoop — your moving journey");
app.run("comp.new", { name: "HomeLoop Dashboard", width: 720, height: 260, frameRate: 24, duration: 12, background: "#fdfdf8" });
function art(name, body) {
  return app.run("edit.pasteSvg", { name: name, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">' + body + '</svg>' }).layer;
}
function set(layer, path, value) { app.run("prop.set", {layer: layer, path: path, value: value}); }
function key(layer, path, time, value) { app.run("prop.addKey", {layer: layer, path: path, time: time, value: value}); }
function pivot(layer, x, y) { set(layer,"transform/anchor",[x,y]); set(layer,"transform/position",[x,y]); }
var contours = art("01 — architectural contours", '<path d="M-30 166C80 20 200 250 365 117S600 14 760 125M-30 184C80 38 200 268 365 135S600 32 760 143M-30 202C80 56 200 286 365 153S600 50 760 161" fill="none" stroke="#e1e7d6" stroke-width="1"/>');
pivot(contours,360,130);
key(contours,"transform/position",0,[360,130]); key(contours,"transform/position",6,[360,117]); key(contours,"transform/position",12,[360,130]);
art("02 — connection shadow", '<path d="M45 160C160 65 235 225 355 137S550 38 670 130" fill="none" stroke="#edf0e5" stroke-width="22"/>');
art("03 — sage ribbon", '<path d="M45 154C160 59 235 219 355 131S550 32 670 124" fill="none" stroke="#d6e1c3" stroke-width="13"/>');
art("04 — ribbon highlight", '<path d="M45 149C160 54 235 214 355 126S550 27 670 119" fill="none" stroke="#9eb97b" stroke-width="1.5"/>');
var locations = [[132,132],[362,111],[575,99]];
for (var n=0;n<3;n++) {
  var x=locations[n][0], y=locations[n][1];
  art("05 — landmark shadow " + n, '<ellipse cx="'+x+'" cy="'+(y+34)+'" rx="53" ry="14" fill="#e7ecdc"/>');
  var body = '<path d="M'+(x-38)+' '+(y+14)+'L'+x+' '+(y-7)+'L'+(x+38)+' '+(y+14)+'L'+x+' '+(y+36)+'Z" fill="#c5d4b3"/>' +
    '<path d="M'+(x-38)+' '+(y+8)+'L'+x+' '+(y-13)+'L'+(x+38)+' '+(y+8)+'L'+x+' '+(y+30)+'Z" fill="#e5ecd8" stroke="#bdcda8"/>' +
    '<path d="M'+(x-28)+' '+(y-1)+'L'+x+' '+(y-17)+'L'+(x+28)+' '+(y-1)+'L'+x+' '+(y+15)+'Z" fill="#f5f7eb" stroke="#cbd8ba"/>' +
    '<ellipse cx="'+x+'" cy="'+(y-6)+'" rx="17" ry="9" fill="none" stroke="#759653" stroke-width="1.5"/>' +
    '<path d="M'+x+' '+(y-16)+'V'+(y-56)+'" stroke="#a9bd8f"/>' +
    '<circle cx="'+x+'" cy="'+(y-57)+'" r="5" fill="#6e8f50"/>' +
    '<circle cx="'+x+'" cy="'+(y-57)+'" r="11" fill="none" stroke="#c2d3ac"/>';
  var landmark=art("06 — floating landmark " + n,body); pivot(landmark,x,y);
  for (var k=0;k<=4;k++) key(landmark,"transform/position",k*3,[x,y+Math.sin(k*Math.PI/2+n)*7]);
  var halo=art("07 — orbit " + n,'<ellipse cx="'+x+'" cy="'+(y-6)+'" rx="29" ry="15" fill="none" stroke="#bacfa0" stroke-width="1"/>');
  pivot(halo,x,y-6);
  key(halo,"transform/scale",0,[100,100]); key(halo,"transform/scale",6,[123,123]); key(halo,"transform/scale",12,[100,100]);
  key(halo,"transform/opacity",0,55); key(halo,"transform/opacity",6,20); key(halo,"transform/opacity",12,55);
}
// A cubic route sampled into linear keyframes produces a continuous travelling light.
function cubic(t,a,b,c,d) { var u=1-t; return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d; }
function route(t) {
  if(t<.5) { t=t*2; return [cubic(t,45,160,235,355),cubic(t,149,54,214,126)]; }
  t=(t-.5)*2; return [cubic(t,355,475,550,670),cubic(t,126,38,27,119)];
}
for(var j=0;j<3;j++) {
  var light=art("08 — travelling light " + j,'<circle cx="0" cy="0" r="12" fill="#cce5a2" opacity=".26"/><circle cx="0" cy="0" r="5" fill="#92b85b"/><circle cx="-1" cy="-1" r="2" fill="#faffed"/>');
  set(light,"transform/anchor",[0,0]);
  for(var frame=0;frame<=144;frame++) {
    var progress=((frame/144)+j/3)%1;
    key(light,"transform/position",frame/12,route(progress));
    key(light,"transform/opacity",frame/12,Math.min(100,progress*1400,(1-progress)*1400));
  }
}
app.endUndoGroup();
