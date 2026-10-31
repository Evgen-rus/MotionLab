// Time-based seek -> screenshot -> ffmpeg. See ../NOTICE.md for provenance.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, realpathSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, extname, isAbsolute } from 'node:path';
import { args, number, localFile, freshOutput, json, run } from './lib.mjs';

const a=args();
for(const key of Object.keys(a)) if(!['in','out','audio','stills','job'].includes(key)) throw Error(`Unknown option: ${key}`);
const source=localFile(a.in), root=realpathSync(dirname(source));
if(extname(source).toLowerCase()!=='.html') throw Error('Render input must be authored local HTML, not a website or reference recording');
const audio=a.audio ? localFile(a.audio) : null;
const executablePath=process.env.MOTIONLAB_BROWSER || [
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if(!executablePath) throw Error('Install Edge/Chrome or set MOTIONLAB_BROWSER to the executable');
const stills=a.stills===undefined ? null : a.stills.split(',').map(t=>number(t,undefined,0,120));
if(stills && (stills.length<1||stills.length>6))throw Error('Use 1-6 still times');
if(a.job && !stills){
 const job=JSON.parse(readFileSync(localFile(a.job),'utf8'));
 if(job.stage!=='approved'||!job.approval?.message||realpathSync(job.approval.source)!==source)throw Error('Job needs explicit user approval for this scene before MP4 rendering');
}
const out=freshOutput(a.out);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
// Only this authored scene directory is served, on a random loopback port. No directory listing.
const server=createServer((req,res)=>{
 try {
  const path=realpathSync(resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
  const rel=relative(root,path);
  if(rel.startsWith('..')||isAbsolute(rel)||!statSync(path).isFile()) throw Error('Outside scene');
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(path));
 } catch {res.writeHead(404);res.end('Not found');}
});
let browser;
try {
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/${encodeURIComponent(source.slice(dirname(source).length+1))}`,{waitUntil:'load'});
 await page.waitForFunction(()=>window.__video && typeof window.__video.seek==='function',null,{timeout:15000});
 const info=await page.evaluate(()=>({duration:window.__video.duration,fps:window.__video.fps,size:window.__video.size}));
 const duration=number(info.duration,undefined,0.1,120),fps=number(info.fps,undefined,1,60,true);
 const width=number(info.size?.[0],undefined,64,1920,true),height=number(info.size?.[1],undefined,64,1920,true);
 if(width%2||height%2)throw Error('MP4 dimensions must be even');
 const count=Math.ceil(duration*fps);if(count>3600)throw Error('Maximum 3600 frames per render');
 await page.setViewportSize({width,height});
 await page.evaluate(()=>document.fonts.ready);
 if(stills?.some(t=>t>=duration))throw Error('Still time must be within scene duration');
 const times=stills || Array.from({length:count},(_,i)=>i/fps);
 for(let i=0;i<times.length;i++){
  await page.evaluate(async t=>{
   await window.__video.seek(t);
   await Promise.all([...document.images].map(img=>img.decode()));
  },times[i]);
  if(errors.length)throw Error(errors.join('\n'));
  const png=await page.screenshot({animations:'allow',timeout:15000});
  writeFileSync(join(out,`${i+1}`.padStart(4,'0')+'.png'),png,{flag:'wx'});
  if(i%fps===0)console.log(`render ${i}/${times.length}`);
 }
 await browser.close();browser=null;
 if(stills){json(join(out,'preview.json'),{source,...info,times});console.log(out);}
 else {
 const encode=['-n','-framerate',String(fps),'-i',join(out,'%04d.png')];
 if(audio)encode.push('-i',audio);
 encode.push('-map','0:v');if(audio)encode.push('-map','1:a:0','-af','apad','-c:a','aac');
 encode.push('-t',String(count/fps),'-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-c:v','libx264','-preset','medium','-crf','18','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-movflags','+faststart',join(out,'video.mp4'));
 run(encode);
 json(join(out,'frames.json'),{input:source,fps,start:0,count,width,height,duration:count/fps});
 json(join(out,'render.json'),{source,audio,...info,frames:count,output:join(out,'video.mp4')});
 console.log(join(out,'video.mp4'));
 }
} finally {
 if(browser)await browser.close();
 server.closeAllConnections();await new Promise(r=>server.close(r));
}
