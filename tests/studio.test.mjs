import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('copied skill works in an independent project: previews, approval gate, video and reference',()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab studio ')),skill=join(root,'different skill name'),project=join(root,'проект с пробелами');
 cpSync('.agents/skills/reanimate',skill,{recursive:true,filter:p=>!p.includes('node_modules')});
 // Simulate the installed pinned package in the copied skill, with no owning repo dependency.
 cpSync('node_modules/playwright-core',join(skill,'scripts/node_modules/playwright-core'),{recursive:true});
 mkdirSync(project);const scene=join(project,'animations/demo');cpSync(join(skill,'assets'),scene,{recursive:true});
 const source=join(scene,'scene.html');
 function cli(script,flags,ok=true){const r=spawnSync(process.execPath,[join(skill,'scripts',script+'.mjs'),...flags],{cwd:project,encoding:'utf8',timeout:180000});assert.equal(r.status===0,ok,r.stderr);return r;}
 const manifest=join(project,'views.json');writeFileSync(manifest,JSON.stringify([1,2,3].map(i=>({name:`Option ${i} <script>`,source,times:[1.8]}))));
 cli('preview',['--in',manifest,'--out','.reanimate/options']);
 const gallery=readFileSync(join(project,'.reanimate/options/index.html'),'utf8');assert.ok(gallery.includes('&lt;script&gt;'));assert.ok(!gallery.includes('<script>'));
 assert.ok(existsSync(join(project,'.reanimate/options-v3/0001.png')));assert.ok(!existsSync(join(project,'.reanimate/options-v1/video.mp4')));
 cli('preview',['--in',manifest,'--out','.reanimate/options'],false);
 const job=join(project,'job.json');writeFileSync(job,JSON.stringify({stage:'awaiting_storyboard_approval',approval:null}));
 cli('render',['--in',source,'--out','.reanimate/pending-video','--job',job],false);assert.ok(!existsSync(join(project,'.reanimate/pending-video')));
 writeFileSync(job,JSON.stringify({stage:'approved',approval:{message:'Одобряю показанный сториборд, делай ролик',source}}));
 cli('render',['--in',source,'--out','.reanimate/approved-video','--job',job]);assert.ok(existsSync(join(project,'.reanimate/approved-video/video.mp4')));
 cli('reference',['--in',join(project,'.reanimate/approved-video/video.mp4'),'--name','saved','--end','2']);assert.ok(existsSync(join(project,'.reanimate/saved-reference/reference.json')));
 cli('render',['--in',source,'--out','.reanimate/bad-time','--stills','99'],false);
 console.log(`Portable studio gallery: ${join(project,'.reanimate/options/index.html')}`);
});
