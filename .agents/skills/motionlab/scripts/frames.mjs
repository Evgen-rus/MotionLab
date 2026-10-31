// Local reference frame extraction. See ../NOTICE.md for provenance.
import {join} from 'node:path';
import {readdirSync} from 'node:fs';
import {args,number,run,localFile,freshOutput,json} from './lib.mjs';
const a=args();
for(const k of Object.keys(a))if(!['in','out','fps','start','end','width','max-frames'].includes(k))throw Error(`Unknown option: ${k}`);
const input=localFile(a.in), fps=number(a.fps,10,0.1,60), start=number(a.start,0,0,86400), end=number(a.end,start+10,start+0.001,start+120), width=number(a.width,800,32,1920,true), max=number(a['max-frames'],600,1,1200,true);
const out=freshOutput(a.out);
run(['-n','-ss',String(start),'-i',input,'-t',String(end-start),'-an','-vf',`fps=${fps},scale=${width}:-2`,'-frames:v',String(max),join(out,'%04d.png')]);
const count=readdirSync(out).filter(f=>/^\d{4}\.png$/.test(f)).length;
if(!count)throw Error('No video frames decoded; partial output retained');
json(join(out,'frames.json'),{input,fps,start,end,width,count,maxFrames:max,limitReached:count===max,note:'File 0001 is sample 0; nominal source time = start + index/fps; encoding/seek may shift sampling.'});
console.log(out);
