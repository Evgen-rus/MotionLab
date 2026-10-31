import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';

test('copied skill works in an independent project: previews, approval gate, video and reference',()=>{
 const root=mkdtempSync(join(tmpdir(),'motionlab studio ')),skill=join(root,'different skill name'),project=join(root,'проект с пробелами');
 cpSync('.agents/skills/motionlab',skill,{recursive:true,filter:p=>!p.includes('node_modules')});
 // Simulate the installed pinned package in the copied skill, with no owning repo dependency.
 cpSync('.agents/skills/motionlab/scripts/node_modules/playwright-core',join(skill,'scripts/node_modules/playwright-core'),{recursive:true});
 after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(project);const videoFolder=join(project,'projects/Русский ролик'),scene=join(videoFolder,'версии/01/сцена');cpSync(join(skill,'assets'),scene,{recursive:true});
 const source=join(scene,'scene.html');
 function cli(script,flags,ok=true){const r=spawnSync(process.execPath,[join(skill,'scripts',script+'.mjs'),...flags],{cwd:project,encoding:'utf8',timeout:180000});assert.equal(r.status===0,ok,r.stderr);return r;}
 const manifest=join(project,'views.json');writeFileSync(manifest,JSON.stringify([1,2,3].map(i=>({name:`Option ${i} <script>`,source,times:[1.8]}))));
 cli('preview',['--in',manifest,'--out','projects/Русский ролик/options']);
 const gallery=readFileSync(join(project,'projects/Русский ролик/options/index.html'),'utf8');assert.ok(gallery.includes('&lt;script&gt;'));assert.ok(!gallery.includes('<script>'));
 for(const match of gallery.matchAll(/<img src="([^"]+)"/g))assert.ok(existsSync(join(videoFolder,'options',decodeURIComponent(match[1]))));
 assert.ok(existsSync(join(project,'projects/Русский ролик/options/вариант-3/0001.png')));assert.ok(!existsSync(join(project,'projects/Русский ролик/options/вариант-1/video.mp4')));
 cli('preview',['--in',manifest,'--out','projects/Русский ролик/options'],false);
 const job=join(videoFolder,'job.json');writeFileSync(job,JSON.stringify({stage:'awaiting_storyboard_approval',approval:null}));
 cli('render',['--in',source,'--out','projects/Русский ролик/pending-video','--job',job],false);assert.ok(!existsSync(join(project,'projects/Русский ролик/pending-video')));
 writeFileSync(job,JSON.stringify({stage:'approved',approval:{message:'Одобряю показанный сториборд, делай ролик',source:relative(videoFolder,source)}}));
 cli('render',['--in',source,'--out','projects/Русский ролик/approved-video','--job',job]);assert.ok(existsSync(join(project,'projects/Русский ролик/approved-video/video.mp4')));
 cli('reference',['--in',join(project,'projects/Русский ролик/approved-video/video.mp4'),'--out','projects/Русский ролик/saved','--end','2']);assert.ok(existsSync(join(project,'projects/Русский ролик/saved/reference.json')));
 cli('render',['--in',source,'--out','projects/Русский ролик/bad-time','--stills','99'],false);
 const saved=readFileSync(join(videoFolder,'approved-video/video.mp4'));
 const scene2=join(videoFolder,'версии/02/сцена');cpSync(scene,scene2,{recursive:true});
 const source2=join(scene2,'scene.html');
 cli('render',['--in',source2,'--out','projects/Русский ролик/version-2','--job',job],false);
 writeFileSync(job,JSON.stringify({stage:'approved',revision:2,approval:{message:'Вторая версия одобрена',source:relative(videoFolder,source2)}}));
 cli('render',['--in',source2,'--out','projects/Русский ролик/version-2','--job',job]);
 assert.deepEqual(readFileSync(join(videoFolder,'approved-video/video.mp4')),saved);
 const moved=join(project,'projects/Перенесённый ролик');renameSync(videoFolder,moved);
 cli('render',['--in',join(moved,'версии/02/сцена/scene.html'),'--out','projects/Перенесённый ролик/повторный-рендер','--job',join(moved,'job.json')]);
 assert.ok(existsSync(join(moved,'повторный-рендер/video.mp4')));
 console.log('Portable project: Cyrillic paths, nested gallery, two revisions and moved-folder render verified');
});
