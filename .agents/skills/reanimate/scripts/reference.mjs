import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {args,localFile,freshOutput,json} from './lib.mjs';
const a=args();
for(const key of Object.keys(a))if(!['in','name','start','end','fps','width','brief'].includes(key))throw Error(`Unknown option: ${key}`);
if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,60}$/.test(a.name||''))throw Error('--name must be a short letters/digits/dashes identifier');
const input=localFile(a.in),base=`.reanimate/${a.name}`;
const out=freshOutput(base+'-reference');
function child(script,argv){const r=spawnSync(process.execPath,[fileURLToPath(new URL(`${script}.mjs`,import.meta.url)),...argv],{stdio:'inherit'});if(r.error||r.status!==0)throw Error(`${script} failed; partial artifacts retained`);}
const flags=['--in',input,'--out',base+'-frames'];
for(const key of ['start','end','fps','width'])if(a[key]!==undefined)flags.push('--'+key,a[key]);
child('frames',flags);child('sheet',['--frames',base+'-frames','--out',base+'-sheets']);
const hash=createHash('sha256');for await(const chunk of createReadStream(input))hash.update(chunk);
json(join(out,'reference.json'),{name:a.name,source:input,sha256:hash.digest('hex'),frames:resolve(base+'-frames'),sheets:resolve(base+'-sheets'),sampling:JSON.parse(readFileSync(base+'-frames/frames.json')),brief:a.brief||'',analysisStatus:'pending-human-or-Codex-visual-review'});
writeFileSync(join(out,'analysis.md'),'# Motion reference: '+a.name+'\n\nStatus: awaiting visual analysis. This file is not an automatic interpretation.\n\nBrief: '+(a.brief||'not supplied')+'\n\nRecord composition, element timeline (start/duration/distance/easing/stagger), loops, cuts, assets and uncertainty here after inspecting sheets and transition frames. Distinguish source timestamps from clip-relative time.\n',{flag:'wx'});
console.log(out);
