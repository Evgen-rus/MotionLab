import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {args,number,freshOutput,json} from './lib.mjs';
const a=args();
for(const key of Object.keys(a))if(!['ref','clone','out'].includes(key))throw Error(`Unknown option: ${key}`);
// Compare activity in time, not changed text/branding pixel identity. This is a diagnostic, not a fidelity verdict.
function activity(dir){
 dir=realpathSync(dir);const meta=JSON.parse(readFileSync(join(dir,'frames.json')));
 const fps=number(meta.fps,undefined,0.1,60),count=number(meta.count,undefined,2,3600,true);
 const r=spawnSync(process.env.REANIMATE_FFMPEG||'ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file,pipe','-framerate',String(fps),'-i',join(dir,'%04d.png'),'-frames:v',String(count),'-vf','scale=64:36,format=gray','-f','rawvideo','pipe:1'],{maxBuffer:16<<20,timeout:120000,windowsHide:true});
 if(r.error||r.status!==0||r.stdout.length!==count*2304)throw Error('Unable to decode complete frame sequence');
 const curve=[];
 for(let i=1;i<count;i++){let sum=0;for(let p=0;p<2304;p++)sum+=Math.abs(r.stdout[i*2304+p]-r.stdout[(i-1)*2304+p]);curve.push(sum/(2304*255));}
 const peak=Math.max(...curve),threshold=Math.max(0.002,peak*0.1),active=curve.flatMap((v,i)=>v>=threshold?[i+1]:[]);
 return {fps,count,duration:count/fps,peak,firstMotion:active.length?active[0]/fps:null,lastMotion:active.length?active.at(-1)/fps:null,curve};
}
const ref=activity(a.ref),clone=activity(a.clone),out=freshOutput(a.out);
const delta=(x,y)=>x===null||y===null?null:y-x;
json(join(out,'report.json'),{ref,clone,deltaSeconds:{duration:clone.duration-ref.duration,firstMotion:delta(ref.firstMotion,clone.firstMotion),lastMotion:delta(ref.lastMotion,clone.lastMotion)},verdict:'visual-review-required',limitations:'Global activity only: changed content, cuts and layout affect it. Does not measure element trajectories or prove matching easing. Curves use clip-relative seconds.'});
writeFileSync(join(out,'review.md'),'# Motion comparison\n\nAutomatic global activity diagnostics: report.json. Inspect reference and variant sheets and transition frames. Fill per-element measured timing, direction, distance/size, sequence and easing estimates; list deviations. No automatic similarity pass is assigned.\n',{flag:'wx'});
console.log(out);
