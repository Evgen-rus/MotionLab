import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {emptyEdit,applyEdit,naturalCommand,validateEdit} from '../.agents/skills/motionlab/scripts/workbench-core.mjs';

const script=resolve('.agents/skills/motionlab/scripts/workbench.mjs');

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
  const made=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=yellow:s=160x90:r=25:d=3','-c:v','libx264','-pix_fmt','yuv420p',sample],{encoding:'utf8'});
  assert.equal(made.status,0,made.stderr);
  const uploaded=await fetch(url+'api/import',{method:'POST',headers:{Origin:url.slice(0,-1),'X-File-Name':encodeURIComponent('исходник.mp4'),'Content-Type':'application/octet-stream'},body:readFileSync(sample)});
  assert.equal(uploaded.status,200,await uploaded.clone().text());
  const after=await uploaded.json();assert.equal(after.media.length,1);
  const partial=await fetch(url+'api/media/'+after.media[0].id,{headers:{Range:'bytes=0-15'}});
  assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,16);
  const {chromium}=await import('../.agents/skills/motionlab/scripts/node_modules/playwright-core/index.mjs');
  const executablePath=process.env.MOTIONLAB_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  const browser=await chromium.launch({executablePath,headless:true});
  try {
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);
   await page.waitForFunction(()=>document.querySelector('#video').readyState>=1);
   await page.locator('#mute').check();
   await page.waitForFunction(()=>document.querySelector('#video').muted);
   await page.locator('.media-add').click();
   await page.waitForFunction(()=>document.querySelectorAll('.clip').length===2);
   await page.locator('.clip').nth(1).click();
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
   await page.locator('#command').fill('Раздели клип 2 на 1');
   await page.locator('#command-submit').click();
   await page.waitForFunction(()=>document.querySelectorAll('.clip').length===3);
   await page.locator('#format').selectOption('9:16');
   await page.waitForFunction(()=>document.querySelector('#preview-resolution').textContent.startsWith('720'));
   const ratio=await page.locator('#output-frame').evaluate(el=>el.clientWidth/el.clientHeight);
   assert.ok(Math.abs(ratio-9/16)<.02,'Preview frame must match export aspect ratio');
   const frame=await page.locator('#timeline-scroll').boundingBox(),command=await page.locator('.commandbar').boundingBox();
   assert.ok(command.y>=frame.y+frame.height,'Command bar must not cover clips');
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
   const sourceBefore=await page.locator('#video').getAttribute('src');
   await page.locator('#move-left').click();
   await page.waitForFunction(()=>document.querySelector('#selected-index').textContent.startsWith('Клип 3'));
   await page.locator('.clip').last().click();
   await page.waitForFunction(old=>document.querySelector('#video').getAttribute('src')!==old,sourceBefore);
   for(const width of [1280,960,390]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No page overflow at ${width}px`);
    assert.equal(await page.locator('#command-submit').isVisible(),true);
   }
   assert.deepEqual(errors,[]);
  } finally {await browser.close();}
 }finally{
  child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1000))]);
  rmSync(root,{recursive:true,force:true});
 }
});

