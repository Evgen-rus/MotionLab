import {mkdirSync, realpathSync, statSync, writeFileSync, existsSync, lstatSync} from 'node:fs';
import {resolve, relative, join, sep, isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
export function args() {
 const out={}; const argv=process.argv.slice(2);
 for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--') || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('Expected --name value'); const key=argv[i].slice(2); if(key in out) throw Error('Duplicate option'); out[key]=argv[++i];} return out;
}
export function number(v, fallback, min, max, integer=false) {const n=Number(v ?? fallback); if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))) throw Error(`Invalid number: ${v}`); return n;}
export function run(argv) {
 const r=spawnSync(process.env.MOTIONLAB_FFMPEG || 'ffmpeg', ['-hide_banner','-nostdin','-loglevel','error','-protocol_whitelist','file,pipe',...argv], {encoding:'utf8',maxBuffer:16<<20,timeout:120000,windowsHide:true});
 if(r.error || r.status!==0) throw Error(r.error?.message || r.stderr || `ffmpeg exited ${r.status}`); return r;
}
export function localFile(p){if(!p)throw Error('Missing --in'); const f=realpathSync(resolve(p)); if(!statSync(f).isFile())throw Error('Input must be a local file');return f;}
export function freshOutput(p){
 if(!p)throw Error('Missing --out');
 const root=resolve('projects'),out=resolve(p),rel=relative(root,out);
 if(!rel || rel==='..' || rel.startsWith('..'+sep) || isAbsolute(rel))throw Error('Use a NEW directory inside projects/<working title>');
 const parts=rel.split(sep);
 if(parts.some(part=>/[<>:"|?*\x00-\x1f]/.test(part)||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))throw Error('Invalid output folder name');
 mkdirSync(root,{recursive:true});
 if(realpathSync(root).toLowerCase()!==root.toLowerCase()||lstatSync(root).isSymbolicLink())throw Error('Output root cannot be a link');
 let parent=root;
 for(const part of parts.slice(0,-1)){
  parent=join(parent,part);
  if(!existsSync(parent))mkdirSync(parent);
  if(lstatSync(parent).isSymbolicLink()||realpathSync(parent).toLowerCase()!==parent.toLowerCase())throw Error('Output parents cannot be links');
 }
 mkdirSync(out); // Exclusive creation: existing directories, files and links are refused.
 writeFileSync(join(out,'.motionlab-owned'),'MotionLab local video output\n',{flag:'wx'});
 return out;
}
export function json(p,data){writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}
