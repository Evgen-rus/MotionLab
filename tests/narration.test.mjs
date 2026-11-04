import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {freshOutput,run} from '../.agents/skills/motionlab/scripts/lib.mjs';
import {checkNarration} from '../.agents/skills/motionlab/scripts/check-audio.mjs';

const root=freshOutput(`projects/Проверка речи ${Date.now()}`);
after(()=>{
 const rel=relative(resolve('projects'),root);
 assert.ok(rel&&!rel.startsWith('..'));rmSync(root,{recursive:true,force:true});
});
test('final narration check rejects silence, missing speech and cut speech',()=>{
 const file=name=>join(root,name);
 // An off-bin tone plus unrelated music exercises decoded AAC, delays and correlation.
 run(['-f','lavfi','-i','sine=frequency=317:duration=1','-af','volume=2','-n',file('voice.wav')]);
 run(['-i',file('voice.wav'),'-af','adelay=500:all=1,apad=whole_dur=2.5','-n',file('aligned.wav')]);
 run(['-f','lavfi','-i','sine=frequency=101:duration=2.5','-af','volume=0.1','-n',file('music.wav')]);
 run(['-i',file('aligned.wav'),'-i',file('music.wav'),'-filter_complex','amix=inputs=2:normalize=0','-n',file('mix.wav')]);
 const video=(audio,name,seconds)=>run(['-f','lavfi','-i','color=s=64x64:r=10','-i',file(audio),'-t',String(seconds),'-c:v','libx264','-c:a','aac','-n',file(name)]);
 video('mix.wav','good.mp4',2.5);video('music.wav','missing.mp4',2.5);video('mix.wav','cut.mp4',1);
 run(['-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','2.5','-n',file('silent.wav')]);
 const input={source:file('voice.wav'),narration:file('aligned.wav'),video:file('good.mp4')};
 assert.ok(checkNarration(input).minCorrelation>0.9);
 assert.throws(()=>checkNarration({...input,source:file('silent.wav')}),/Original narration is silent/);
 assert.throws(()=>checkNarration({...input,narration:file('silent.wav')}),/Aligned narration is silent/);
 assert.throws(()=>checkNarration({...input,video:file('missing.mp4')}),/Narration missing/);
 assert.throws(()=>checkNarration({...input,video:file('cut.mp4')}),/cuts narration/);
 const cli=spawnSync(process.execPath,['.agents/skills/motionlab/scripts/check-audio.mjs','--source',input.source,'--narration',input.narration,'--video',file('missing.mp4')],{encoding:'utf8',windowsHide:true});
 assert.equal(cli.status,1);assert.match(cli.stderr,/Narration missing/);
});
