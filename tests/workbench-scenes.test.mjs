import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {listScenes,sceneAsset} from '../.agents/skills/motionlab/scripts/workbench-scenes.mjs';
const skill=resolve('.agents/skills/motionlab');

function fixture(root){
 const folder=join(root,'projects/Структура'),scene=join(folder,'версии/01/сцена');mkdirSync(scene,{recursive:true});
 cpSync(join(skill,'assets/scene.html'),join(scene,'scene.html'));cpSync(join(skill,'assets/fonts'),join(scene,'fonts'),{recursive:true});
 writeFileSync(join(folder,'job.json'),JSON.stringify({title:'Структура',versions:[{number:1,scene:'версии/01/сцена/scene.html'},{number:0,scene:'../outside.html'}],approval:{source:'версии/01/сцена/scene.html'}}));
 return {folder,scene};
}

test('authored scenes resolve only explicit project sources and contained assets',()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab-scenes-'));
 try{
  const {folder,scene}=fixture(root);writeFileSync(join(root,'outside.html'),'private');
  const sources=listScenes(folder);assert.equal(sources.length,1);const s=sources[0];
  assert.equal(s.source,'версии/01/сцена/scene.html');
  assert.throws(()=>sceneAsset(folder,s.id,'fonts/OFL.txt'),/Тип ресурса/);
  assert.equal(sceneAsset(folder,s.id,'scene.html').entry,true);
  assert.throws(()=>sceneAsset(folder,s.id,'../scene.html'));
  assert.throws(()=>sceneAsset(folder,s.id,join(root,'outside.html')));
  assert.throws(()=>sceneAsset(folder,'a'.repeat(24),'scene.html'),/не найдена/);
  writeFileSync(join(folder,'версии/01/сцена/scene.html'),'new');assert.notEqual(listScenes(folder)[0].revision,s.revision);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('Workbench selects real scene elements, copies source context and preserves montage', {timeout:90000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab-scene-web-')),{folder,scene}=fixture(root);
 const jobBefore=readFileSync(join(folder,'job.json'));
 const child=spawn(process.execPath,[join(skill,'scripts/workbench.mjs'),'--project','Структура'],{cwd:root,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  const url=await new Promise((yes,no)=>{let output='';const timer=setTimeout(()=>no(Error('Server did not start')),7000);child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);yes(m[0])}});child.once('exit',code=>{clearTimeout(timer);no(Error('Server exited '+code))})});
  const editBefore=readFileSync(join(folder,'edit.json'));
  const response=await fetch(url+'api/scenes'),{scenes}=await response.json();assert.equal(scenes.length,1);
  const preview=url+scenes[0].previewBase.slice(1);
  const entry=await fetch(preview+'scene.html');assert.match(entry.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.match(await entry.text(),/scene-bridge.js/);
  assert.equal((await fetch(preview+'%2e%2e%2fjob.json')).status,400);
  assert.equal((await fetch(preview+'job.json')).status,400);
  assert.equal((await fetch(url+'scene/'+scenes[0].id+'/scene.html')).status,404);
  const {chromium}=await import('../.agents/skills/motionlab/scripts/node_modules/playwright-core/index.mjs');
  const executablePath=process.env.MOTIONLAB_BROWSER||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.copied=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text}}})});
  await page.goto(url);await page.locator('#mode-scene').click();
  await page.locator('#scene-copy:not([disabled])').waitFor();
  assert.equal(await page.locator('#scene-elements button').count(),6);assert.equal(await page.locator('#scene-view textarea').count(),0);
  const childFrame=page.frameLocator('#scene-frame');
  // Playwright's frame locator does not account for the preview's outer CSS scale.
  const frameBox=await page.locator('#scene-frame').boundingBox();
  const target=await childFrame.locator('[data-element-id="headline"]').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
  const scale=frameBox.width/640;await page.mouse.click(frameBox.x+target.x*scale,frameBox.y+target.y*scale);
  await page.waitForFunction(()=>document.querySelector('#scene-element-name').textContent==='Заголовок');
  await page.locator('#scene-copy').click();await page.waitForFunction(()=>window.copied!==null);
  const copied=await page.evaluate(()=>JSON.parse(window.copied.slice(window.copied.indexOf('{'))));
  assert.equal(copied.element.id,'headline');assert.equal(copied.element.content,'Идея в движении');assert.equal(copied.absoluteSource,join(scene,'scene.html'));assert.equal(copied.sourceSha256,scenes[0].revision);assert.equal(copied.request,undefined);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await page.locator('#scene-copy').click();
  await page.waitForFunction(()=>document.querySelector('#scene-copy-status').textContent.includes('Ctrl+C'));assert.match(await page.evaluate(()=>getSelection().toString()),/headline/);
  assert.equal(await page.locator('#scene-frame').evaluate(el=>{try{void el.contentWindow.document;return false}catch{return true}}),true,'Scene must not access the editor document');
  await page.locator('#scene-play').click();await page.waitForFunction(()=>Number(document.querySelector('#scene-time').value)>1.1);await page.locator('#scene-play').click();
  await page.locator('#scene-time').fill('0.5');assert.match(await page.locator('#scene-clock').textContent(),/0.50/);
  await page.evaluate(()=>window.postMessage({channel:'motionlab-scene',type:'selected',id:'subtitle'},'*'));assert.equal(await page.locator('#scene-element-name').textContent(),'Заголовок');
  const original=readFileSync(join(scene,'scene.html'),'utf8');writeFileSync(join(scene,'scene.html'),original.replace('Идея в движении','Новый заголовок'));
  await page.locator('#scene-copy').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Исходник изменился'));
  await page.locator('#scene-reload').click();await page.locator('#scene-copy:not([disabled])').waitFor();await page.locator('#scene-elements button').nth(1).click();assert.equal(await page.locator('#scene-element-content').textContent(),'Новый заголовок');
  for(const width of [1440,960,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow at '+width)}
  await page.locator('#mode-montage').click();assert.equal(await page.locator('#montage-view').isVisible(),true);assert.equal(await page.locator('#export-top').isVisible(),true);
  assert.deepEqual(readFileSync(join(folder,'edit.json')),editBefore);assert.deepEqual(readFileSync(join(folder,'job.json')),jobBefore);
  // A second authored source exercises source selection and real scene sections.
  writeFileSync(join(scene,'multi.html'),'<!doctype html><body><section data-scene-id="one" data-scene-name="Первая" data-start="0" data-end="2"><h1 data-element-id="first" data-element-name="Первый">Один</h1></section><section data-scene-id="two" data-scene-name="Вторая" data-start="2" data-end="4"><h1 data-element-id="second" data-element-name="Второй">Два</h1></section><script>window.__video={duration:4,fps:24,size:[640,360],async seek(t){document.querySelectorAll("section").forEach((n,i)=>n.hidden=(i===0?t>=2:t<2))}}</script>');
  writeFileSync(join(folder,'job.json'),JSON.stringify({versions:[{number:1,scene:'версии/01/сцена/scene.html'},{number:2,scene:'версии/01/сцена/multi.html'}]}));
  await page.locator('#mode-scene').click();await page.locator('#scene-copy:not([disabled])').waitFor();await page.locator('#scene-source').selectOption({label:'Версия 2 · версии/01/сцена/multi.html'});
  await page.locator('#scene-sections button').nth(1).waitFor();await page.locator('#scene-sections button').nth(1).click();
  assert.equal(await page.locator('#scene-element-content').textContent(),'Два');assert.equal(JSON.parse(await page.locator('#scene-context').textContent()).scene.id,'two');
  assert.match(await page.locator('#scene-clock').textContent(),/3.00/);
  writeFileSync(join(scene,'multi.html'),readFileSync(join(scene,'multi.html'),'utf8').replace('data-element-id="second"','data-element-id="first"'));
  await page.locator('#scene-reload').click();await page.waitForFunction(()=>document.querySelector('#scene-message').textContent.includes('уникальные идентификаторы элементов'));assert.equal(await page.locator('#scene-copy').isEnabled(),false);
  writeFileSync(join(folder,'job.json'),JSON.stringify({versions:[]}));await page.locator('#mode-scene').click();await page.waitForFunction(()=>document.querySelector('#scene-message').textContent.includes('пока нет HTML-сцен'));
  assert.equal(await page.locator('#scene-copy').isEnabled(),false);assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);rmSync(root,{recursive:true,force:true});
 }
});
