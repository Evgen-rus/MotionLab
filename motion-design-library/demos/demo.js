// All positions and echoes are functions of source time, never previous frames.
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height,U=Math.min(W,H),cx=W/2,cy=H/2;
const ready=document.fonts.load('800 64px Manrope').then(f=>{if(!f.length)throw Error('Manrope failed to load');});
const clamp=x=>Math.max(0,Math.min(1,x)),expo=p=>p===1?1:1-2**(-10*p),out4=p=>1-(1-p)**4;
const names=['Letter Rise Stagger','Smear Slam','Punctuation Portal','Spring Morph + Ghost Outlines','Whip Pan with Smear Frame'];
function text(word,x,y,size=U*.13,color='#f5f0df'){
 ctx.font=`800 ${size}px Manrope`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(word,x,y);
}
function spring(t){if(t<=0)return 0;const w=Math.sqrt(267),d=w*Math.sqrt(1-.3**2);return 1-Math.exp(-.3*w*t)*(Math.cos(d*t)+.3*w/d*Math.sin(d*t));}
// Sample polygon perimeters uniformly; both shapes share winding and point count.
function polygon(sides,r){return Array.from({length:128},(_,i)=>{const u=i/128*sides,j=Math.floor(u),f=u-j,a=j*2*Math.PI/sides-Math.PI/2,b=(j+1)*2*Math.PI/sides-Math.PI/2;return [r*((1-f)*Math.cos(a)+f*Math.cos(b)),r*((1-f)*Math.sin(a)+f*Math.sin(b))];});}
const A=polygon(3,U*.24),B=polygon(4,U*.24);
function morph(t,stroke){const e=t>=1.6?1:spring(t);ctx.beginPath();A.forEach((a,i)=>{const x=cx+a[0]+(B[i][0]-a[0])*e,y=cy+a[1]+(B[i][1]-a[1])*e;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}else{ctx.fillStyle='#f3bd42';ctx.fill()}}
function panel(word,x,color){ctx.save();ctx.translate(x,0);ctx.fillStyle=color;ctx.fillRect(0,0,W,H);text(word,cx,cy);ctx.restore()}
window.__video={duration:10,fps:30,size:[W,H],async seek(t){
 await ready;t=Math.max(0,Math.min(10,t));const part=Math.min(4,Math.floor(t/2)),dt=t-part*2;
 ctx.resetTransform();ctx.globalAlpha=1;ctx.fillStyle='#142c32';ctx.fillRect(0,0,W,H);
 if(part===0){const word='ДВИЖЕНИЕ',step=U*.095;for(let i=0;i<word.length;i++){const p=clamp((dt-i*2/60)/(14/60)),e=1-(1-p)**5;ctx.save();ctx.beginPath();ctx.rect(0,cy-U*.13,W,U*.25);ctx.clip();text(word[i],cx+(i-(word.length-1)/2)*step,cy+U*.23*(1-e),U*.115);ctx.restore()}}
 if(part===1){const p=clamp(dt/(8/60)),e=expo(p);for(let j=3;j>=0;j--){ctx.save();ctx.translate(cx-j*.06*W*(1-e),cy);ctx.scale(1.6-.6*e,1.6-.6*e);ctx.globalAlpha=j?[0,.35,.2,.1][j]*Math.max(0,1-dt/.1):1;text('ИМПУЛЬС',0,0,U*.12);ctx.restore()}if(dt<1/60){ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(0,0,W,H)}}
 if(part===2){ctx.fillStyle='#e95531';ctx.fillRect(0,0,W,H);text('ДАЛЬШЕ',cx,cy,U*.12);const p=clamp((dt-.2)/.1),e=p===0?0:2**(10*(p-1));ctx.save();ctx.beginPath();ctx.arc(cx+U*.28,cy+U*.04,U*.018+(Math.hypot(W,H))*e,0,Math.PI*2);ctx.clip();ctx.fillStyle='#f3bd42';ctx.fillRect(0,0,W,H);ctx.restore();if(dt<.2){ctx.save();ctx.translate(-W*clamp((dt-(.2-4/60))/(4/60)),0);text('ВПЕРЁД',cx,cy);ctx.restore()}}
 if(part===3){for(let j=4;j>=1;j--)morph(Math.max(0,dt-j/60),`rgba(245,240,223,${.45/j})`);morph(dt)}
 if(part===4){if(dt<5/60)panel('СЦЕНА A',-W*(clamp(dt/(5/60))**4),'#23606b');else if(dt<6/60){ctx.save();ctx.translate(cx,cy);ctx.scale(5,.85);text('СЦЕНА A',0,0,U*.12,'#f3bd42');ctx.restore()}else panel('СЦЕНА B',W*(1-out4(clamp((dt-6/60)/(6/60)))),'#9c3828')}
 text(names[part],cx,H*.12,Math.min(U*.037,W*.042),'#ffffff');
 }};
window.__video.seek(0);
