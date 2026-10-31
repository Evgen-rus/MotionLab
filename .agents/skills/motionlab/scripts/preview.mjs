import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {args,localFile,freshOutput,json} from './lib.mjs';
const a=args();
for(const key of Object.keys(a))if(!['in','out'].includes(key))throw Error(`Unknown option: ${key}`);
const manifest=localFile(a.in),views=JSON.parse(readFileSync(manifest,'utf8'));
if(!Array.isArray(views)||views.length<1||views.length>3)throw Error('Provide 1-3 design variants or storyboard views');
for(const v of views)if(typeof v.name!=='string'||!v.name.trim()||typeof v.source!=='string')throw Error('Each view needs name and source');
const out=freshOutput(a.out),cards=[];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(let i=0;i<views.length;i++){
 const v=views[i],source=localFile(resolve(dirname(manifest),v.source)),dest=join(out,`вариант-${i+1}`),times=v.times||[1];
 if(!Array.isArray(times)||times.length<1||times.length>3)throw Error('Use 1-3 stills per view');
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('render.mjs',import.meta.url)),'--in',source,'--out',dest,'--stills',times.join(',')],{stdio:'inherit'});
 if(r.error||r.status!==0)throw Error('Preview failed; partial outputs retained');
 cards.push(`<section><h2>${escape(v.name)}</h2><p>${escape(v.description||'')}</p><div class="frames">${times.map((t,k)=>`<figure><img src="${encodeURIComponent(`вариант-${i+1}`)}/${String(k+1).padStart(4,'0')}.png"><figcaption>${escape(t)} s</figcaption></figure>`).join('')}</div></section>`);
}
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Дизайн до анимации</title><style>body{margin:24px;background:#101522;color:#eef3fa;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto}section{padding:20px;margin-bottom:20px;border:1px solid #43526b;border-radius:16px}h1,h2{margin:0 0 12px}.frames{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;flex:1;min-width:240px}img{width:100%;max-height:65vh;object-fit:contain;background:#080b12}figcaption,p{color:#bbc8df}</style><main><h1>Дизайн до анимации</h1><p>Статичные кадры будущих сцен. Выберите вариант или опишите, что нравится и что изменить. MP4 будет создан после одобрения.</p>${cards.join('')}</main></html>`,{flag:'wx'});
json(join(out,'preview.json'),{manifest,views,approval:'pending'});console.log(join(out,'index.html'));
