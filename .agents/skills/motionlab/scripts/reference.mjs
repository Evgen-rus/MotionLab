import {spawnSync} from 'node:child_process';
import {join,resolve,basename,extname} from 'node:path';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {args,localFile,freshOutput,json,run,number} from './lib.mjs';
const a=args();
for(const key of Object.keys(a))if(!['in','out','start','end','fps','width','brief','roles'].includes(key))throw Error(`Unknown option: ${key}`);
const input=localFile(a.in),out=freshOutput(a.out),name=basename(out);
function child(script,argv){const r=spawnSync(process.execPath,[fileURLToPath(new URL(`${script}.mjs`,import.meta.url)),...argv],{stdio:'inherit'});if(r.error||r.status!==0)throw Error(`${script} failed; partial artifacts retained`);}
const flags=['--in',input,'--out',join(out,'кадры')];
for(const key of ['start','end','fps','width'])if(a[key]!==undefined)flags.push('--'+key,a[key]);
const kind=['.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff'].includes(extname(input).toLowerCase())?'image':'video';
if(kind==='image'){
 const dir=freshOutput(join(out,'кадры'));
 run(['-n','-i',input,'-vf',`scale=${number(a.width,800,32,1920,true)}:-2`,'-frames:v','1',join(dir,'0001.png')]);
 json(join(dir,'frames.json'),{input,fps:1,start:0,count:1,kind});
}else child('frames',flags);
child('sheet',['--frames',join(out,'кадры'),'--out',join(out,'листы')]);
const hash=createHash('sha256');for await(const chunk of createReadStream(input))hash.update(chunk);
json(join(out,'reference.json'),{name,kind,roles:a.roles?a.roles.split(',').map(s=>s.trim()).filter(Boolean):[],source:input,sha256:hash.digest('hex'),frames:resolve(join(out,'кадры')),sheets:resolve(join(out,'листы')),sampling:JSON.parse(readFileSync(join(out,'кадры','frames.json'))),brief:a.brief||'',analysisStatus:'pending-human-or-Codex-visual-review'});
writeFileSync(join(out,'analysis.md'),'# Motion reference: '+name+'\n\nStatus: awaiting visual analysis. This file is not an automatic interpretation.\n\nBrief: '+(a.brief||'not supplied')+'\n\nRecord composition, element timeline (start/duration/distance/easing/stagger), loops, cuts, assets and uncertainty here after inspecting sheets and transition frames. Distinguish source timestamps from clip-relative time.\n',{flag:'wx'});
console.log(out);
