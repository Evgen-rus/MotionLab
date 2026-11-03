import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {emptyEdit,applyEdit,naturalCommand,validateEdit} from '../.agents/skills/motionlab/scripts/workbench-core.mjs';

const script=resolve('.agents/skills/motionlab/scripts/workbench.mjs');
const testMedia={id:'11111111-1111-4111-8111-111111111111',name:'Файл.mp4',file:'11111111-1111-4111-8111-111111111111.mp4',duration:9,width:320,height:180,hasAudio:true};

test('legacy projects, detached audio, persistent history and safe source removal',()=>{
 const legacy={version:1,revision:0,media:[testMedia],clips:[],output:{width:1280,height:720,fps:30},exports:[]};
 let state=validateEdit(legacy);assert.equal(state.version,2);assert.equal(legacy.version,1);
 state=applyEdit(state,{type:'append',mediaId:testMedia.id});
 state=applyEdit(state,{type:'detach',index:1});
 assert.equal(state.clips[0].muted,true);assert.equal(state.audio[0].at,0);
 assert.throws(()=>applyEdit(state,{type:'detach',index:1}),/уже/);
 assert.throws(()=>applyEdit(state,{type:'mute',index:1,muted:false}),/отдельной/);
 const id=state.audio[0].id;
 state=applyEdit(state,{type:'audio',id,at:2,start:1,end:7,rate:1.5,gain:.5});
 assert.throws(()=>applyEdit(state,{type:'audio',id,rate:0}),/звук/);
 assert.throws(()=>applyEdit(state,{type:'audio',id,at:-1}),/звук/);
 assert.throws(()=>applyEdit(state,{type:'audio',id,gain:3}),/звук/);
 assert.throws(()=>applyEdit(state,{type:'removeMedia',mediaId:testMedia.id}),/используется/);
 state=applyEdit(state,{type:'splitAudio',id,at:4});
 assert.equal(state.audio[1].at,4);assert.equal(state.audio[0].end,4);
 state=applyEdit(JSON.parse(JSON.stringify(state)),{type:'undo'});assert.equal(state.audio.length,1);
 state=applyEdit(state,{type:'redo'});assert.equal(state.audio.length,2);
 state=applyEdit(state,{type:'remove',index:1});
 for(const c of [...state.audio])state=applyEdit(state,{type:'removeAudio',id:c.id});
 state=applyEdit(state,{type:'removeMedia',mediaId:testMedia.id});assert.equal(state.media.length,0);
 state=applyEdit(state,{type:'undo'});assert.equal(state.media.length,1);
 state=applyEdit(state,{type:'append',mediaId:testMedia.id});assert.equal(state.history.future.length,0);
 for(let i=0;i<35;i++)state=applyEdit(state,{type:'mute',index:1,muted:Boolean(i%2)});
 assert.equal(state.history.past.length,30);
 const silent=emptyEdit();silent.media.push({...testMedia,hasAudio:false});const s=applyEdit(silent,{type:'append',mediaId:testMedia.id});
 assert.throws(()=>applyEdit(s,{type:'detach',index:1}),/нет звука/);
});

test('timeline edits validate boundaries and interpret basic Russian commands',()=>{
 let state=emptyEdit();
 const media={id:'11111111-1111-4111-8111-111111111111',name:'Файл.mp4',file:'11111111-1111-4111-8111-111111111111.mp4',duration:9,width:320,height:180,hasAudio:true};
 state.media.push(media);
 state=applyEdit(state,{type:'append',mediaId:media.id});
 state=applyEdit(state,naturalCommand('Обрежь клип 1 с 1,5 до 7'));
 assert.equal(state.clips[0].start,1.5);
 state=applyEdit(state,naturalCommand('Раздели клип 1 на 3'));
 assert.equal(state.clips.length,2);
 assert.equal(state.clips[1].start,3);
 state=applyEdit(state,naturalCommand('Перемести клип 2 на позицию 1'));
 assert.equal(state.clips[0].start,3);
 state=applyEdit(state,naturalCommand('Убери звук у клипа 1'));
 assert.equal(state.clips[0].muted,true);
 assert.throws(()=>applyEdit(state,{type:'trim',index:1,start:10,end:11}),/границы/);
 assert.throws(()=>naturalCommand('Сделай эффектный переход'),/Codex/);
 assert.throws(()=>naturalCommand('Обрежь клип 1 с 1 до 2 и удали клип 2'),/Codex/);
 assert.throws(()=>applyEdit(state,{type:'mute',index:1,muted:'false'}),/muted/);
 assert.throws(()=>validateEdit({...state,output:{width:1279,height:720,fps:30}}),/формат/);
});

test('workbench imports two real videos and exports a playable joined MP4', {timeout:120000},()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab-workbench-'));
 try {
  const first=join(root,'первый.mp4'),second=join(root,'второй.mp4');
  function ffmpeg(argv){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-n',...argv],{encoding:'utf8',timeout:40000});assert.equal(r.status,0,r.stderr||r.error?.message);}
  ffmpeg(['-f','lavfi','-i','color=c=red:s=320x180:r=24:d=1.6','-f','lavfi','-i','sine=frequency=440:duration=1.6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',first]);
  ffmpeg(['-f','lavfi','-i','color=c=green:s=320x180:r=24:d=1.4','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',second]);
  function cli(opts,ok=true){const r=spawnSync(process.execPath,[script,'--project','Монтаж тест',...opts],{cwd:root,encoding:'utf8',timeout:90000});assert.equal(r.status===0,ok,r.stderr);return r.stdout;}
  cli(['--import',first]);cli(['--import',second]);
  const path=join(root,'projects/Монтаж тест/edit.json');
  let state=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(state.media.length,2);assert.equal(state.clips.length,2);
  assert.equal(state.media[0].hasAudio,true);assert.equal(state.media[1].hasAudio,false);
  cli(['--command','Обрежь клип 1 с 0.2 до 1.1']);
  const out=cli(['--export','yes']).trim().split('\n').at(-1);
  assert.ok(existsSync(out));assert.ok(statSync(out).size>1000);
  state=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(state.exports.length,1);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',out],{encoding:'utf8'});
  assert.equal(probe.status,0,probe.stderr);
  const info=JSON.parse(probe.stdout);
  assert.ok(info.streams.some(s=>s.codec_type==='video'));
  assert.ok(info.streams.some(s=>s.codec_type==='audio'));
  assert.ok(Math.abs(Number(info.format.duration)-(0.9+1.4))<0.2);
  assert.equal(info.streams.find(s=>s.codec_type==='video').width,1280);
  const audio=spawnSync('ffmpeg',['-hide_banner','-ss','0.3','-i',out,'-t','0.3','-vn','-af','volumedetect','-f','null','-'],{encoding:'utf8'});
  assert.equal(audio.status,0,audio.stderr);
  const volume=Number(audio.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  assert.ok(Number.isFinite(volume)&&volume>-50,'Original audible audio must survive montage');
  // Detached audio: leading silence, source trim, tempo and gain must reach the actual MP4.
  cli(['--action',JSON.stringify({type:'detach',index:1})]);
  state=JSON.parse(readFileSync(path,'utf8'));const detached=state.audio[0];
  cli(['--action',JSON.stringify({type:'audio',id:detached.id,at:.6,rate:1.5,gain:.5,start:.2,end:1.1})]);
  const mixed=cli(['--export','yes']).trim().split('\n').at(-1);
  function maxVolume(start){const r=spawnSync('ffmpeg',['-hide_banner','-ss',String(start),'-i',mixed,'-t','0.15','-vn','-af','volumedetect','-f','null','-'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return Number(r.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);}
  assert.ok(maxVolume(.1)<-60,'Detached original must not sound at its old position');
  assert.ok(maxVolume(.7)>-50,'Detached audio must sound at its new position');
  assert.ok(maxVolume(1.4)<-60,'Tempo must shorten the audio to 0.6 seconds');
  const detachedFile=join(root,'projects/Монтаж тест/исходники',state.media[0].file);
  cli(['--action',JSON.stringify({type:'remove',index:1})]);
  cli(['--action',JSON.stringify({type:'removeAudio',id:detached.id})]);
  cli(['--action',JSON.stringify({type:'removeMedia',mediaId:state.media[0].id})]);
  assert.ok(existsSync(detachedFile),'Removing a source from project must keep its local file');
  cli(['--action',JSON.stringify({type:'undo'})]);
  assert.equal(JSON.parse(readFileSync(path,'utf8')).media.length,2);
  assert.ok(existsSync(first),'Source file must remain untouched');
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('local workbench serves UI, rejects cross-site commands and accepts approved actions', {timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab-web-'));
 const child=spawn(process.execPath,[script,'--project','Проверка браузера'],{cwd:root,stdio:['ignore','pipe','pipe']});
 try{
  let output='';
  const url=await new Promise((yes,no)=>{
   const timer=setTimeout(()=>no(Error('Server did not start')),7000);
   child.stdout.on('data',chunk=>{output+=chunk.toString();const m=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);yes(m[0]);}});
   child.once('exit',code=>{clearTimeout(timer);no(Error(`Server exited ${code}`));});
  });
  const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/MotionLab/);
  const state=await (await fetch(url+'api/state')).json();assert.equal(state.title,'Проверка браузера');
  const denied=await fetch(url+'api/action',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({revision:0,command:'формат 9:16'})});
  assert.equal(denied.status,403);
  const allowed=await fetch(url+'api/action',{method:'POST',headers:{Origin:url.slice(0,-1),'Content-Type':'application/json'},body:JSON.stringify({revision:0,command:'формат 9:16'})});
  assert.equal(allowed.status,200);
  const changed=await allowed.json();assert.equal(changed.output.height,1280);
  const sample=join(root,'sample.mp4');
  const made=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=yellow:s=160x90:r=25:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:a','aac','-c:v','libx264','-pix_fmt','yuv420p','-shortest',sample],{encoding:'utf8'});
  assert.equal(made.status,0,made.stderr);
  const uploaded=await fetch(url+'api/import',{method:'POST',headers:{Origin:url.slice(0,-1),'X-File-Name':encodeURIComponent('исходник.mp4'),'Content-Type':'application/octet-stream'},body:readFileSync(sample)});
  assert.equal(uploaded.status,200,await uploaded.clone().text());
  const after=await uploaded.json();assert.equal(after.media.length,1);
  const partial=await fetch(url+'api/media/'+after.media[0].id,{headers:{Range:'bytes=0-15'}});
  assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,16);
  const {chromium}=await import('../.agents/skills/motionlab/scripts/node_modules/playwright-core/index.mjs');
  const executablePath=process.env.MOTIONLAB_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  const browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true});
  try {
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);
   async function seekClip(index){const clip=page.locator('#track .clip').nth(index);await clip.scrollIntoViewIfNeeded();const b=await clip.boundingBox(),r=await page.locator('#ruler').boundingBox();await page.mouse.click(b.x+10,r.y+10);}
   await page.waitForFunction(()=>document.querySelector('#video').readyState>=1);
   await page.locator('#mute').check();
   await page.waitForFunction(()=>document.querySelector('#video').muted);
   await page.locator('.media-add').click();
   await page.waitForFunction(()=>document.querySelectorAll('.clip').length===2);
   await page.locator('.clip').nth(1).click();
   await seekClip(1);
   await page.waitForFunction(()=>!document.querySelector('#video').muted);
   await page.locator('#move-left').click();
   await page.waitForFunction(()=>document.querySelector('#selected-index').textContent.startsWith('Клип 1'));
   // Test the actual editor controls, not only API state.
   await page.locator('#back').click();
   await page.locator('#timeline-scroll').focus();
   await page.keyboard.press('ArrowRight');
   await page.waitForFunction(()=>Math.abs(document.querySelector('#video').currentTime-1/30)<.01);
   await page.locator('#play').click();
   await page.waitForFunction(()=>!document.querySelector('#video').paused);
   await page.locator('.clip').nth(1).click();
   assert.equal(await page.locator('#video').evaluate(el=>el.paused),true,'Selecting a clip must pause playback');
   await page.locator('#trim-start').fill('0.2');await page.locator('#trim-end').fill('2.2');
   await page.locator('#apply-trim').click();
   await page.waitForFunction(()=>document.querySelector('#trim-start').value==='0.20');
   const splitRuler=await page.locator('#ruler').boundingBox();
   await page.mouse.click(splitRuler.x+20+3.8*34,splitRuler.y+10);
   await page.locator('#split').click();
   await page.waitForFunction(()=>document.querySelectorAll('.clip').length===3);
   await page.locator('#format').selectOption('9:16');
   await page.waitForFunction(()=>document.querySelector('#preview-resolution').textContent.startsWith('720'));
   const ratio=await page.locator('#output-frame').evaluate(el=>el.clientWidth/el.clientHeight);
   assert.ok(Math.abs(ratio-9/16)<.02,'Preview frame must match export aspect ratio');
   assert.equal(await page.locator('.commandbar').count(),0);
   await page.locator('#export-top').click();
   await page.locator('#exports a').first().waitFor({timeout:30000});
   const download=await fetch(url+(await page.locator('#exports a').first().getAttribute('href')).slice(1));
   assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>1000);
   await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.clip').length===3);
   // External CLI writes and UI continue from one persisted edit.json.
   const cliChange=spawnSync(process.execPath,[script,'--project','Проверка браузера','--command','Формат 1:1'],{cwd:root,encoding:'utf8'});
   assert.equal(cliChange.status,0,cliChange.stderr);
   await page.waitForFunction(()=>document.querySelector('#preview-resolution').textContent.startsWith('1080 × 1080'));
   // A second source catches stale video URLs after reordering at the same index.
   await page.locator('#file-input').setInputFiles(sample);
   await page.waitForFunction(()=>document.querySelectorAll('.media-item').length===2);
   await page.locator('.clip').last().click();
   await seekClip(3);
   const sourceBefore=await page.locator('#video').getAttribute('src');
   await page.locator('#move-left').click();
   await page.waitForFunction(()=>document.querySelector('#selected-index').textContent.startsWith('Клип 3'));
   await page.locator('.clip').last().click();
   await seekClip(3);
   await page.waitForFunction(old=>document.querySelector('#video').getAttribute('src')!==old,sourceBefore);
   await page.locator('#track .clip').first().click();
   await page.locator('#detach').click();
   await page.locator('.audio-clip').waitFor();
   await page.locator('#audio-rate').selectOption('1.5');await page.locator('#audio-at').fill('0.5');await page.locator('#audio-gain').fill('50');await page.locator('#apply-audio').click();
   await page.waitForFunction(()=>document.querySelector('#audio-at').value==='0.50');
   const audioState=await (await fetch(url+'api/state')).json();assert.equal(audioState.audio[0].rate,1.5);assert.equal(audioState.audio[0].gain,.5);
   await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#audio-rate').value==='1');
   await page.locator('#redo').click();await page.waitForFunction(()=>document.querySelector('#audio-rate').value==='1.5');
   await page.locator('#back').click();
   const rulerBox=await page.locator('#ruler').boundingBox();await page.mouse.click(rulerBox.x+20+34,rulerBox.y+10);
   await page.locator('#play').click();
   await page.waitForFunction(()=>{const p=document.querySelector('audio[data-audio-id]');return p&&!p.paused&&p.currentTime>0&&p.volume===.5&&p.playbackRate===1.5;});
   await page.locator('#play').click();assert.equal(await page.locator('audio[data-audio-id]').first().evaluate(el=>el.paused),true);
   const audioClip=page.locator('.audio-clip').first();await audioClip.scrollIntoViewIfNeeded();let box=await audioClip.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+25);await page.mouse.down();await page.mouse.move(box.x+box.width/2+34,box.y+25,{steps:8});await page.mouse.up();
   await page.waitForFunction(()=>document.querySelector('#audio-at').value==='1.50');
   const endBefore=Number(await page.locator('#trim-end').inputValue());
   box=await audioClip.boundingBox();await page.mouse.move(box.x+box.width-4,box.y+25);await page.mouse.down();await page.mouse.move(box.x+box.width-21,box.y+25,{steps:8});await page.mouse.up();
   await page.waitForFunction(end=>Math.abs(Number(document.querySelector('#trim-end').value)-(end-.75))<.03,endBefore);
   await page.locator('.media-remove').first().click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('используется'));
   for(const width of [1280,960,390]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No page overflow at ${width}px`);
    assert.equal(await page.locator('#split').isVisible(),true);
   }
   assert.deepEqual(errors,[]);
  } finally {await browser.close();}
 }finally{
  child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1000))]);
  rmSync(root,{recursive:true,force:true});
 }
});

