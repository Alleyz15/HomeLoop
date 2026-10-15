// HomeLoop Sign in — the doorway to your next chapter.
// EffectCraft Classic 3D leaf rotates about its left hinge, not a 2D slide.
// 0–1.8s: outline/frame entrance. 1.8–6.8s: slow inward opening.
// 8–14s: matched light/shadow loop; the door never closes automatically.
app.beginUndoGroup("HomeLoop — a doorway to the next chapter");
app.run("comp.new",{name:"HomeLoop Sign In",width:960,height:600,frameRate:24,duration:14,background:"#f7f7ef"});
var layers=[];
function art(name,body){
  var layer=app.run("edit.pasteSvg",{name:name,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">'+body+'</svg>'}).layer;
  layers.push(layer);return layer;
}
function set(l,p,v){app.run("prop.set",{layer:l,path:p,value:v});}
function key(l,p,t,v,linear){
  app.run("prop.addKey",{layer:l,path:p,time:t,value:v});
  if(!linear){
    app.run("keys.setEase",{layer:l,path:p,time:t,side:"in",speed:0,influence:55});
    app.run("keys.setEase",{layer:l,path:p,time:t,side:"out",speed:0,influence:55});
  }
}
function fade(l,a,b,target){
  key(l,"transform/opacity",0,0);
  if(a>0)key(l,"transform/opacity",a,0);
  key(l,"transform/opacity",b,target===undefined?100:target);
}
function pivot(l,x,y){set(l,"transform/anchor",[x,y]);set(l,"transform/position",[x,y]);}
function arch(left,right,top,base){
  var radius=(right-left)/2,cy=top+radius;
  return "M"+left+" "+base+"V"+cy+"A"+radius+" "+radius+" 0 0 1 "+right+" "+cy+"V"+base+"Z";
}
var outer=arch(281,679,20,502);
var mid=arch(307,653,46,502);
var inner=arch(330,630,72,502);
var reveal=arch(346,614,88,502);
var opening=arch(354,606,99,502);
var defs='<defs>'+
 '<linearGradient id="stone" x1="281" y1="200" x2="679" y2="360" gradientUnits="userSpaceOnUse"><stop stop-color="#edf0e2"/><stop offset=".42" stop-color="#dbe2cf"/><stop offset="1" stop-color="#c0ceb0"/></linearGradient>'+
 '<linearGradient id="sage" x1="307" y1="240" x2="653" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#a8ba96"/><stop offset=".45" stop-color="#91a77f"/><stop offset="1" stop-color="#789064"/></linearGradient>'+
 '<linearGradient id="bevel" x1="330" y1="200" x2="630" y2="360" gradientUnits="userSpaceOnUse"><stop stop-color="#6c875e"/><stop offset=".4" stop-color="#bbc9a5"/><stop offset="1" stop-color="#d5debd"/></linearGradient>'+
 '<linearGradient id="room" x1="354" y1="220" x2="606" y2="380" gradientUnits="userSpaceOnUse"><stop stop-color="#edeed7"/><stop offset=".5" stop-color="#fffbe7"/><stop offset="1" stop-color="#fff9df"/></linearGradient>'+
 '<linearGradient id="leaf" x1="354" y1="240" x2="606" y2="360" gradientUnits="userSpaceOnUse"><stop stop-color="#193b2b"/><stop offset=".42" stop-color="#284c37"/><stop offset="1" stop-color="#3b5d43"/></linearGradient>'+
 '<linearGradient id="spill" x1="540" y1="493" x2="480" y2="600" gradientUnits="userSpaceOnUse"><stop stop-color="#fff8d9" stop-opacity=".95"/><stop offset=".5" stop-color="#fff7d7" stop-opacity=".65"/><stop offset="1" stop-color="#fff8df" stop-opacity="0"/></linearGradient>'+
 '<radialGradient id="ground"><stop stop-color="#aebba1" stop-opacity=".32"/><stop offset="1" stop-color="#aebba1" stop-opacity="0"/></radialGradient>'+
 '<radialGradient id="warmth"><stop stop-color="#fff5ce" stop-opacity=".7"/><stop offset="1" stop-color="#fff5ce" stop-opacity="0"/></radialGradient>'+
 '<linearGradient id="shadow" x1="370" y1="496" x2="260" y2="600" gradientUnits="userSpaceOnUse"><stop stop-color="#7f9471" stop-opacity=".25"/><stop offset="1" stop-color="#7f9471" stop-opacity="0"/></linearGradient>'+
 '</defs>';

var floor=art("01 — grounded soft architectural floor",defs+'<ellipse cx="480" cy="508" rx="330" ry="77" fill="url(#ground)"/><path d="M90 502H870" stroke="#dce2d1" stroke-opacity=".65"/>');
fade(floor,0,.8);
var halo=art("02 — soft reflected interior light",defs+'<ellipse cx="533" cy="405" rx="275" ry="190" fill="url(#warmth)"/>');
fade(halo,1.8,6.8,40);

// Real native Trim Paths outline: it draws before the solid frame arrives.
var outline=app.run("layer.newShape",{kind:"none",name:"03 — architectural outline draws"}).layer;
layers.push(outline);
app.run("shape.newPath",{layer:outline,vertices:[[281,502],[281,219],[480,20],[679,219],[679,502]],inTangents:[[0,0],[0,0],[-110,0],[0,-110],[0,0]],outTangents:[[0,0],[0,-110],[110,0],[0,0],[0,0]],closed:false,space:"comp",fill:false,stroke:"#91a67e",strokeWidth:2});
var trim=app.run("layer.addShapeItem",{layer:outline,kind:"trim"});
key(outline,trim.path+"/end",0,0,true);key(outline,trim.path+"/end",1.6,100,true);
key(outline,"transform/opacity",1.2,100);key(outline,"transform/opacity",2,0);

var cast=art("04 — door shadow turns into the floor",defs+'<path d="M354 501L489 493L426 597H152Z" fill="url(#shadow)"/>');
pivot(cast,354,502);fade(cast,1.8,6.8,75);
key(cast,"transform/scale",1.8,[1,25]);key(cast,"transform/scale",6.8,[100,100]);
key(cast,"transform/rotation",1.8,10);key(cast,"transform/rotation",6.8,-6);

var spill=art("05 — light widens with the opening",defs+'<path d="M484 498L606 498L833 600H161Z" fill="url(#spill)"/>');
pivot(spill,606,502);fade(spill,1.8,6.8,90);
key(spill,"transform/scale",1.8,[1,20]);key(spill,"transform/scale",6.8,[100,100]);

var frame=art("06 — dimensional stone and sage arch",defs+
 '<path d="'+outer+'" transform="translate(18 9)" fill="#c3ceb4"/>'+
 '<path d="'+outer+'" fill="url(#stone)" stroke="#e3e8d6" stroke-width="1.5"/>'+
 '<path d="'+mid+'" fill="url(#sage)"/>'+
 '<path d="'+inner+'" fill="url(#bevel)"/>'+
 '<path d="'+reveal+'" fill="#dce2c6"/>'+
 '<path d="'+opening+'" fill="url(#room)"/>'+
 '<path d="M354 502V225A126 126 0 0 1 606 225V502" fill="none" stroke="#b6c49c" stroke-width="2"/>'+
 '<path d="M357 500H605L570 480H386Z" fill="#f2edd4"/>'+
 '<path d="M583 242V480L605 500V226A125 125 0 0 0 480 101" fill="none" stroke="#e4e2c3" stroke-width="1.4"/>'+
 '<path d="M294 499V219A186 186 0 0 1 666 219" fill="none" stroke="#f2f4e9" stroke-width="1.2"/>');
fade(frame,.55,1.8);
pivot(frame,480,502);key(frame,"transform/scale",.55,[98,96]);key(frame,"transform/scale",1.8,[100,100]);

// The entire leaf INCLUDING its handle is ONE 3D layer, anchored on the hinge.
// Rotating Y away from the viewer shortens the free edge in perspective.
var door=art("07 — hinged arched door and attached handle",defs+
 '<path d="'+opening+'" fill="url(#leaf)" stroke="#1b3827" stroke-width="2"/>'+
 '<path d="M368 487V228A112 112 0 0 1 592 228V487" fill="none" stroke="#749164" stroke-opacity=".23" stroke-width="1.2"/>'+
 '<path d="M356 502V225A124 124 0 0 1 480 101" fill="none" stroke="#59794f" stroke-opacity=".55"/>'+
 '<rect x="575" y="363" width="8" height="64" rx="4" fill="#abb28b"/>'+
 '<rect x="576" y="365" width="2" height="60" rx="1" fill="#d6d8b4"/>'+
 '<path d="M604 227V500" stroke="#182f23" stroke-width="3"/>');
app.run("layer.setSwitch",{layers:[door],switch:"threeD",value:true});
set(door,"transform/anchor",[354,300,0]);
set(door,"transform/position",[354,300,0]);
fade(door,1.05,1.75);
key(door,"transform/rotationY",1.8,0);
key(door,"transform/rotationY",6.8,-58);
key(door,"transform/rotationY",14,-58);

var threshold=art("08 — reflected threshold",defs+'<path d="M345 502H615L634 510H327Z" fill="#e7e7d7"/><path d="M348 502H614" stroke="#f6f1dc" stroke-width="2"/>');
fade(threshold,1,1.8);
var reflection=art("09 — ambient floor light",defs+'<ellipse cx="524" cy="540" rx="195" ry="54" fill="url(#warmth)"/>');
fade(reflection,1.8,6.8,25);
for(var j=0;j<=6;j++){
  key(halo,"transform/opacity",8+j,[40,42,45,46,45,42,40][j]);
  key(spill,"transform/opacity",8+j,[90,92,95,96,95,92,90][j]);
  key(reflection,"transform/opacity",8+j,[25,27,29,30,29,27,25][j]);
  key(cast,"transform/opacity",8+j,[75,74,72,71,72,74,75][j]);
}
app.endUndoGroup();
writeLn("HomeLoop doorway: real Classic 3D Y hinge, five-second inward opening, attached handle, coordinated floor light/shadow and 8–14s ambient loop.");
