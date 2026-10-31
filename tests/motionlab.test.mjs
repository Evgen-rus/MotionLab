import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {freshOutput,number} from '../.agents/skills/motionlab/scripts/lib.mjs';
const id=Date.now().toString();
const base=resolve('.motionlab');mkdirSync(base,{recursive:true});
function cli(script,argv,ok=true){const r=spawnSync(process.execPath,[`.agents/skills/motionlab/scripts/${script}.mjs`,...argv],{encoding:'utf8'});assert.equal(r.status===0,ok,r.stderr);return r;}
test('local video extraction, sheets, no overwrite and bounded output',()=>{
 const input=join(base,`тест видео ${id}.mp4`);
 const r=spawnSync(process.env.MOTIONLAB_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-n','-f','lavfi','-i','testsrc2=size=320x180:rate=10','-t','2','-c:v','libx264',input],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const ref=join(base,`test-ref-${id}`),sheets=join(base,`test-sheets-${id}`);
 cli('frames',['--in',input,'--out',ref,'--start','0.5','--end','1.5','--fps','10','--width','320']);
 const meta=JSON.parse(readFileSync(join(ref,'frames.json')));assert.equal(meta.count,10);assert.equal(meta.start,0.5);
 const first=readFileSync(join(ref,'0001.png'));assert.equal(first.subarray(1,4).toString(),'PNG');
 cli('sheet',['--frames',ref,'--out',sheets,'--per-sheet','6']);
 const sheet=readFileSync(join(sheets,'sheet-01.png'));assert.equal(sheet.subarray(1,4).toString(),'PNG');assert.ok(existsSync(join(sheets,'sheet-02.png')));
 writeFileSync(join(ref,'foreign.png'),'keep me');
 cli('frames',['--in',input,'--out',ref],false);assert.equal(readFileSync(join(ref,'foreign.png'),'utf8'),'keep me');assert.deepEqual(readFileSync(join(ref,'0001.png')),first);
 cli('sheet',['--frames',ref,'--out',sheets],false);assert.deepEqual(readFileSync(join(sheets,'sheet-01.png')),sheet);
 assert.throws(()=>freshOutput('.'));assert.throws(()=>freshOutput('.motionlab'));assert.throws(()=>freshOutput('.motionlab/a/b'));assert.throws(()=>number('0',1,1,60));
 cli('frames',['--in',input,'--out',join(base,`bad-${id}`),'--fps','NaN'],false);
 cli('frames',['--in','https://example.com/a.mp4','--out',join(base,`url-${id}`)],false);
 console.log(`Preview: ${sheets}`);
});
