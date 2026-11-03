// This script is injected only into the sandboxed editor preview, never into rendered sources.
(()=>{
 const channel='motionlab-scene';
 const send=(type,data={})=>parent.postMessage({channel,type,...data},'*');
 let selected=null,overlay=null,ready=false,pending=null,seeking=false,info;
 const nodes=new Map();
 const bounds=(node,duration,range={start:0,end:duration})=>{
  const start=node.hasAttribute('data-start')?Number(node.dataset.start):range.start;
  const end=node.hasAttribute('data-end')?Number(node.dataset.end):range.end;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<range.start||end<=start||end>range.end)throw Error('Неверное время элемента или сцены');
  return {start,end};
 };
 function highlight(){
  if(!overlay)return;
  const node=nodes.get(selected),rect=node?.getBoundingClientRect();
  overlay.hidden=!rect||rect.width===0||rect.height===0||getComputedStyle(node).visibility==='hidden'||Number(getComputedStyle(node).opacity)===0;
  if(!overlay.hidden)Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 }
 async function seek(){
  if(seeking||!ready)return;seeking=true;
  try{while(pending!==null){const time=pending;pending=null;await window.__video.seek(time);document.querySelectorAll('video,audio').forEach(p=>{p.muted=true;p.pause()});highlight();}}
  catch(e){pending=null;send('error',{message:'Не удалось показать кадр: '+e.message})}
  finally{seeking=false}
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.data?.channel!==channel||!ready)return;
  const m=event.data;
  if(m.type==='seek'&&Number.isFinite(m.time)){pending=Math.max(0,Math.min(info.duration,m.time));seek()}
  if(m.type==='select'&&nodes.has(m.id)){selected=m.id;highlight()}
 });
 document.addEventListener('click',event=>{
  event.preventDefault();event.stopImmediatePropagation();
  const node=event.target.closest('[data-element-id]');
  if(node&&nodes.get(node.dataset.elementId)===node){selected=node.dataset.elementId;highlight();send('selected',{id:selected})}
 },true);
 async function init(){
  try{
   const video=window.__video;
   if(!video||typeof video.seek!=='function')throw Error('У сцены нет контракта window.__video.seek');
   const {duration,fps,size}=video;
   if(!Number.isFinite(duration)||duration<=0||duration>120||!Number.isFinite(fps)||fps<1||fps>60||!Array.isArray(size)||size.length!==2||size.some(n=>!Number.isInteger(n)||n<64||n>1920))throw Error('Неверные параметры HTML-сцены');
   await document.fonts.ready;await video.seek(0);
   const groups=[...document.querySelectorAll('[data-scene-id]')];
   const scenes=groups.length?groups.map(node=>({id:node.dataset.sceneId,name:node.dataset.sceneName||node.dataset.sceneId,...bounds(node,duration)})):[{id:'all',name:'Весь ролик',start:0,end:duration}];
   const validId=id=>/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(id);
   if(scenes.some(s=>!validId(s.id))||new Set(scenes.map(s=>s.id)).size!==scenes.length)throw Error('Нужны уникальные идентификаторы сцен: латинские буквы, цифры, дефис или подчёркивание');
   const elements=[...document.querySelectorAll('[data-element-id]')].map(node=>{
    const id=node.dataset.elementId;
    if(!validId(id)||nodes.has(id))throw Error('Нужны уникальные идентификаторы элементов: латинские буквы, цифры, дефис или подчёркивание');
    nodes.set(id,node);
    const style=getComputedStyle(node),group=node.closest('[data-scene-id]');
    return {id,name:node.dataset.elementName||id,type:node.dataset.elementType||(node.tagName==='IMG'?'Изображение':'Элемент'),sceneId:group?.dataset.sceneId||'all',selector:'[data-element-id='+JSON.stringify(id)+']',content:node.tagName==='IMG'?node.getAttribute('src'):(node.textContent||'').trim().slice(0,4000),...bounds(node,duration,group?bounds(group,duration):undefined),motion:node.dataset.motion||'Не описана',appearance:{font:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,color:style.color,background:style.backgroundColor}};
   });
   if(elements.length>500)throw Error('Слишком много элементов: максимум 500');
   overlay=document.createElement('div');overlay.setAttribute('aria-hidden','true');Object.assign(overlay.style,{position:'fixed',border:'2px solid #69a7ff',boxShadow:'0 0 0 1px #102c52',pointerEvents:'none',zIndex:2147483647,boxSizing:'border-box'});overlay.hidden=true;document.body.append(overlay);
   document.querySelectorAll('video,audio').forEach(p=>{p.muted=true;p.pause()});
   info={duration,fps,size,scenes,elements};ready=true;send('ready',{info});
  }catch(e){send('error',{message:e.message})}
 }
 if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
