// Local contact sheets, based on reanimate sheet.ts; ffmpeg replaces Chromium.
import {join} from 'node:path';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {args,number,run,freshOutput,json} from './lib.mjs';
const a=args();
for(const k of Object.keys(a))if(!['frames','out','cols','per-sheet','width'].includes(k))throw Error(`Unknown option: ${k}`);
const dir=realpathSync(a.frames), meta=JSON.parse(readFileSync(join(dir,'frames.json'),'utf8'));
const fps=number(meta.fps,10,0.1,60),start=number(meta.start,0,0,86400),count=number(meta.count,0,1,1200,true);
const cols=number(a.cols,4,1,8,true),per=number(a['per-sheet'],16,1,64,true),width=number(a.width,240,64,480,true);
const frames=readdirSync(dir).filter(f=>/^\d{4}\.png$/.test(f));
if(frames.length!==count)throw Error('Frame count differs from metadata');
for(let i=1;i<=count;i++){const p=join(dir,`${i}`.padStart(4,'0')+'.png');if(realpathSync(p)!==p)throw Error('Frame links refused');}
const out=freshOutput(a.out),sheets=[];
for(let i=0;i<count;i+=per){
 const n=Math.min(per,count-i),name=`sheet-${String(sheets.length+1).padStart(2,'0')}.png`;
 const vf=`scale=${width}:-2,pad=iw:ih+24:0:0:color=black,setpts=PTS+${start+i/fps}/TB,drawtext=font=Arial:text='%{pts\\:flt}s':x=6:y=h-20:fontsize=14:fontcolor=white,tile=${cols}x${Math.ceil(n/cols)}:nb_frames=${n}:padding=4:margin=4:color=black`;
 run(['-n','-framerate',String(fps),'-start_number',String(i+1),'-i',join(dir,'%04d.png'),'-vf',vf,'-frames:v','1',join(out,name)]);
 sheets.push({file:name,first:i+1,last:i+n,start:start+i/fps});
}
json(join(out,'sheets.json'),{frames:dir,fps,sheets});console.log(out);
