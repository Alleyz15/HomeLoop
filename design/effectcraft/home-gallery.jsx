// Original HomeLoop architectural gallery. Decorative, not advertised properties.
app.beginUndoGroup("HomeLoop — a gallery of possibilities");
app.run("comp.new", {name:"HomeLoop Gallery",width:720,height:280,frameRate:24,duration:12,background:"#e8eddf"});
function art(name,body) { return app.run("edit.pasteSvg",{name:name,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="720" height="280" viewBox="0 0 720 280">'+body+'</svg>'}).layer; }
function set(layer,path,value) { app.run("prop.set",{layer:layer,path:path,value:value}); }
function key(layer,path,time,value) { app.run("prop.addKey",{layer:layer,path:path,time:time,value:value}); }
function pivot(layer,x,y) { set(layer,"transform/anchor",[x,y]);set(layer,"transform/position",[x,y]); }
art("01 — plinth and shadow",'<ellipse cx="366" cy="247" rx="255" ry="20" fill="#d7dfcb"/><path d="M101 229L397 203L636 225L349 265Z" fill="#f6f7ed"/><path d="M101 229L349 265V273L101 237Z" fill="#c5cfb6"/><path d="M349 265L636 225V233L349 273Z" fill="#b8c7a4"/>');
var origins=[[148,68],[310,34],[488,58]];
for(var n=0;n<3;n++) {
  var x=origins[n][0], y=origins[n][1], width=n===1?164:132, height=n===1?201:170;
  var svg='<path d="M'+x+' '+y+'L'+(x+width)+' '+(y-13)+'V'+(y+height)+'L'+x+' '+(y+height+13)+'Z" fill="'+(n===1?'#f5f6eb':'#d5dfc7')+'" stroke="#afbf9c"/>';
  svg+='<path d="M'+(x+width)+' '+(y-13)+'L'+(x+width+6)+' '+(y-10)+'V'+(y+height+3)+'L'+(x+width)+' '+(y+height)+'Z" fill="#9cad8b"/>';
  // Windows and a canopy establish a miniature modern facade, not a doorway.
  if(n===1) {
    svg+='<path d="M'+(x+15)+' '+(y+75)+'L'+(x+149)+' '+(y+25)+'V'+(y+63)+'L'+(x+15)+' '+(y+111)+'Z" fill="#4f6b50"/>';
    svg+='<path d="M'+(x+20)+' '+(y+114)+'L'+(x+144)+' '+(y+69)+'V'+(y+165)+'L'+(x+20)+' '+(y+176)+'Z" fill="#aabd9c"/>';
    for(var w=0;w<5;w++) svg+='<path d="M'+(x+26+w*25)+' '+(y+110-w*9)+'V'+(y+175-w*2)+'" stroke="#eaf0de" stroke-width="3"/>';
    svg+='<path d="M'+(x+10)+' '+(y+73)+'L'+(x+148)+' '+(y+21)+'L'+(x+157)+' '+(y+29)+'L'+(x+15)+' '+(y+84)+'Z" fill="#c4b99b"/>';
  } else {
    for(var z=0;z<11;z++) svg+='<path d="M'+(x+9+z*11)+' '+(y+4-z)+'V'+(y+height-9-z)+'" stroke="'+(z%2?'#9aaa88':'#eef2e4')+'" stroke-width="5"/>';
    svg+='<path d="M'+(x+8)+' '+(y+height-35)+'L'+(x+width-8)+' '+(y+53)+'V'+(y+height-7)+'L'+(x+8)+' '+(y+height+5)+'Z" fill="#ecf0e1"/>';
  }
  // Botanical silhouettes stay inside the decorative panel surface.
  svg+='<path d="M'+(x+width-21)+' '+(y+height-4)+'Q'+(x+width-49)+' '+(y+height-70)+' '+(x+width-20)+' '+(y+height-120)+'M'+(x+width-22)+' '+(y+height-32)+'L'+(x+width-48)+' '+(y+height-58)+'M'+(x+width-26)+' '+(y+height-56)+'L'+(x+width-8)+' '+(y+height-84)+'" stroke="#728d5d" fill="none" stroke-width="2"/>';
  for(var leaf=0;leaf<5;leaf++) svg+='<ellipse cx="'+(x+width-22+(leaf%2?12:-13))+'" cy="'+(y+height-36-leaf*17)+'" rx="13" ry="5" fill="#93aa77" transform="rotate(-32 '+(x+width-22+(leaf%2?12:-13))+' '+(y+height-36-leaf*17)+')"/>';
  var panel=art("02 — floating facade " + n,svg);pivot(panel,x+width/2,y+height/2);
  for(var f=0;f<=96;f++) {
    var time=f/8, phase=f/96*Math.PI*2;
    key(panel,"transform/position",time,[x+width/2+Math.sin(phase+n*.7)*10,y+height/2+Math.sin(phase+n)*5]);
    key(panel,"transform/scale",time,[100+Math.sin(phase+n)*3,100]);
    key(panel,"transform/rotation",time,Math.sin(phase+n)*1.3);
  }
}
var light=art("03 — sweeping warm light",'<path d="M170 22L202 19L399 244L367 249Z" fill="#fff9db" opacity=".3"/>');
pivot(light,285,130);
for(var t=0;t<=96;t++) { var angle=t/96*Math.PI*2;key(light,"transform/position",t/8,[285+Math.sin(angle)*180,130]);key(light,"transform/opacity",t/8,35+Math.sin(angle)*25); }
app.endUndoGroup();
