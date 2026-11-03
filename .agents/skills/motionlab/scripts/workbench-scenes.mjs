import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,dirname,extname,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

const hash=text=>createHash('sha256').update(text).digest('hex');
function localFile(root,name){
 if(typeof name!=='string'||!name||isAbsolute(name))throw Error('Нужен относительный путь сцены');
 const file=resolve(root,name),rel=relative(root,file);
 if(!rel||rel.startsWith('..')||isAbsolute(rel)||realpathSync(file).toLowerCase()!==file.toLowerCase()||!statSync(file).isFile())throw Error('Файл вне папки сцены или является ссылкой');
 return file;
}

export function listScenes(folder){
 const job=JSON.parse(readFileSync(resolve(folder,'job.json'),'utf8'));
 const entries=[...(Array.isArray(job.versions)?job.versions:[]).map(v=>({source:v.scene,name:`Версия ${v.number??'—'}`})),{source:job.approval?.source,name:'Текущая сцена'}];
 const found=new Map();
 for(const entry of entries){
  if(typeof entry.source!=='string'||extname(entry.source).toLowerCase()!=='.html')continue;
  const source=entry.source.replaceAll('\\','/');
  if(found.has(source))continue;
  try{
   const file=localFile(folder,source);
   found.set(source,{id:hash(source).slice(0,24),name:entry.name,source,absoluteSource:file,revision:hash(readFileSync(file))});
  }catch{/* An unavailable version must not prevent opening the other scenes. */}
 }
 return [...found.values()].reverse();
}

export const sceneTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
export function sceneAsset(folder,id,name){
 const scene=listScenes(folder).find(s=>s.id===id);if(!scene)throw Error('Сцена не найдена');
 const root=dirname(scene.absoluteSource),file=localFile(root,name),type=sceneTypes[extname(file).toLowerCase()];
 if(!type)throw Error('Тип ресурса не поддерживается');
 return {scene,file,type,entry:file===scene.absoluteSource};
}
