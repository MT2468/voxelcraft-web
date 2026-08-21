export function createTextureAtlas(THREE,blocks,{tileSize=24,columns=8}={}){
  const entries=[...blocks.values()].sort((a,b)=>a.id-b.id),rows=Math.ceil((Math.max(...entries.map((e)=>e.id))+1)/columns),canvas=document.createElement('canvas');canvas.width=columns*tileSize;canvas.height=rows*tileSize;const ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=false;
  for(const def of entries)drawTile(ctx,def,(def.id%columns)*tileSize,Math.floor(def.id/columns)*tileSize,tileSize);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestMipmapLinearFilter;texture.generateMipmaps=true;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  const uvRect=(id)=>{const col=id%columns,row=Math.floor(id/columns),u0=col/columns,u1=(col+1)/columns,v1=1-row/rows,v0=1-(row+1)/rows,pad=0.001;return[u0+pad,v0+pad,u1-pad,v1-pad];};
  return{canvas,texture,uvRect,columns,rows,tileSize};
}

function drawTile(ctx,def,x,y,s){const base=hex(def.color||0x999999);ctx.clearRect(x,y,s,s);if(def.transparent||def.liquid)ctx.globalAlpha=def.liquid?0.82:0.9;ctx.fillStyle=base;ctx.fillRect(x,y,s,s);ctx.globalAlpha=1;const rnd=lcg(def.id*2654435761>>>0);
  if(def.liquid){ctx.fillStyle=rgba(lighten(def.color,0.25),0.3);for(let i=0;i<4;i++){const yy=y+3+i*5;ctx.fillRect(x+(i%2)*4,yy,s-8,1);}return;}
  if(def.name.includes('Vidro')){ctx.clearRect(x+2,y+2,s-4,s-4);ctx.strokeStyle=rgba(lighten(def.color,0.3),0.8);ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,s-2,s-2);return;}
  if(def.name.includes('Folhas')||def.name.includes('Plantação')||def.name.includes('Flor')||def.name.includes('Muda')){for(let i=0;i<22;i++){ctx.fillStyle=rnd()>0.5?hex(darken(def.color,0.15)):hex(lighten(def.color,0.12));ctx.fillRect(x+Math.floor(rnd()*s),y+Math.floor(rnd()*s),1+Math.floor(rnd()*3),1+Math.floor(rnd()*3));}return;}
  if(def.name.includes('Tijolos')){ctx.strokeStyle=hex(darken(def.color,0.28));ctx.lineWidth=1;for(let yy=6;yy<s;yy+=6){ctx.beginPath();ctx.moveTo(x,y+yy);ctx.lineTo(x+s,y+yy);ctx.stroke();for(let xx=(yy/6)%2?5:10;xx<s;xx+=12){ctx.beginPath();ctx.moveTo(x+xx,y+yy-6);ctx.lineTo(x+xx,y+yy);ctx.stroke();}}return;}
  if(def.name.includes('Minério')){for(let i=0;i<9;i++){ctx.fillStyle=hex(lighten(def.color,0.2+rnd()*0.25));const q=2+Math.floor(rnd()*3);ctx.fillRect(x+Math.floor(rnd()*(s-q)),y+Math.floor(rnd()*(s-q)),q,q);}return;}
  if(def.name.includes('Madeira')||def.name.includes('Tábuas')||def.name.includes('Estante')){ctx.strokeStyle=hex(darken(def.color,0.18));for(let yy=4;yy<s;yy+=5){ctx.beginPath();ctx.moveTo(x,y+yy);ctx.bezierCurveTo(x+s*.3,y+yy-1,x+s*.7,y+yy+1,x+s,y+yy);ctx.stroke();}return;}
  for(let i=0;i<18;i++){const delta=(rnd()-.5)*0.22;ctx.fillStyle=hex(delta>0?lighten(def.color,delta):darken(def.color,-delta));const q=1+Math.floor(rnd()*3);ctx.fillRect(x+Math.floor(rnd()*(s-q)),y+Math.floor(rnd()*(s-q)),q,q);}
}
function lcg(seed){let s=seed||1;return()=>{s=Math.imul(1664525,s)+1013904223>>>0;return s/4294967296;};}
function components(n){return[(n>>16)&255,(n>>8)&255,n&255];}
function lighten(n,a){const[r,g,b]=components(n);return((Math.min(255,r+(255-r)*a)<<16)|(Math.min(255,g+(255-g)*a)<<8)|Math.min(255,b+(255-b)*a))>>>0;}
function darken(n,a){const[r,g,b]=components(n);return((Math.max(0,r*(1-a))<<16)|(Math.max(0,g*(1-a))<<8)|Math.max(0,b*(1-a)))>>>0;}
function hex(n){return`#${Math.floor(n>>>0).toString(16).padStart(6,'0').slice(-6)}`;}
function rgba(n,a){const[r,g,b]=components(n);return`rgba(${r},${g},${b},${a})`;}
