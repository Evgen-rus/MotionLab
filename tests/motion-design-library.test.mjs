import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '../.agents/skills/motionlab/scripts/node_modules/playwright-core/index.mjs';
const root=resolve('motion-design-library');
test('catalog preserves all 40 upstream names and categories',()=>{
 const upstream=readFileSync(`${root}/upstream/motion_library.md`,'utf8');
 const names=[...upstream.matchAll(/^\d+\. \*\*(.+?)\.\*\*/gm)].map(m=>m[1]);assert.equal(names.length,40);
 const files=['typography','shapes','3d','camera'],counts=[15,14,7,4];let offset=0;
 for(let i=0;i<files.length;i++){const doc=readFileSync(`${root}/${files[i]}.md`,'utf8');assert.equal((doc.match(/^## \d+\./gm)||[]).length,counts[i]);for(const name of names.slice(offset,offset+counts[i]))assert.ok(doc.includes(name),name);offset+=counts[i]}
 assert.match(readFileSync(`${root}/upstream/LICENSE`,'utf8'),/Copyright \(c\) 2026 Scenario Inc/);
});
test('five effects seek independently in both formats without network',{timeout:90000},async()=>{
 const executablePath=process.env.MOTIONLAB_BROWSER||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 const browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true});
 try{for(const [name,size] of [['landscape',[960,540]],['portrait',[540,960]]]){
 const page=await browser.newPage({viewport:{width:size[0],height:size[1]}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,r=>{errors.push(r.request().url());return r.abort()});
 await page.goto(pathToFileURL(`${root}/demos/${name}.html`).href);
 assert.deepEqual(await page.evaluate(()=>window.__video.size),size);
 const frame=async t=>page.evaluate(async t=>{await window.__video.seek(t);return document.querySelector('canvas').toDataURL()},t);
 const times=[0,.1,.4,2,2.05,2.2,4,4.05,4.2,6,6.2,6.5,8,8.09,8.15,8.4,9.9];
 const expected=new Map();for(const t of times)expected.set(t,await frame(t));
 for(const [a,b] of [[0,.1],[2,2.05],[4,4.2],[6,6.2],[8,8.09]])assert.notEqual(expected.get(a),expected.get(b),'effect changes over time');
 for(const t of [...times].reverse())assert.equal(await frame(t),expected.get(t),`${name} ${t}`);
 await page.evaluate(()=>window.__video.fps=60);
 for(const t of times)assert.equal(await frame(t),expected.get(t),`fps independence ${t}`);
 assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close()}
});
