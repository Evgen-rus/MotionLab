import {mkdirSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {resolve, relative, join, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
export function args() {
 const out={}; const argv=process.argv.slice(2);
 for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--') || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('Expected --name value'); const key=argv[i].slice(2); if(key in out) throw Error('Duplicate option'); out[key]=argv[++i];} return out;
}
export function number(v, fallback, min, max, integer=false) {const n=Number(v ?? fallback); if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))) throw Error(`Invalid number: ${v}`); return n;}
export function run(argv) {
 const r=spawnSync(process.env.REANIMATE_FFMPEG || 'ffmpeg', ['-hide_banner','-nostdin','-loglevel','error','-protocol_whitelist','file,pipe',...argv], {encoding:'utf8',maxBuffer:16<<20,timeout:120000,windowsHide:true});
 if(r.error || r.status!==0) throw Error(r.error?.message || r.stderr || `ffmpeg exited ${r.status}`); return r;
}
export function localFile(p){if(!p)throw Error('Missing --in'); const f=realpathSync(resolve(p)); if(!statSync(f).isFile())throw Error('Input must be a local file');return f;}
export function freshOutput(p){
 if(!p)throw Error('Missing --out');
 const root=resolve('.reanimate'); mkdirSync(root,{recursive:true});
 if(realpathSync(root).toLowerCase()!==root.toLowerCase())throw Error('Output root cannot be a link');
 const out=resolve(p); const rel=relative(root,out);
 if(!rel || rel.startsWith('..') || rel.includes(sep))throw Error('Use a NEW direct child of .reanimate');
 mkdirSync(out); // Exclusive creation: existing directories, files and links are refused.
 writeFileSync(join(out,'.reanimate-owned'),'MotionLab local video output\n',{flag:'wx'});
 return out;
}
export function json(p,data){writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}
