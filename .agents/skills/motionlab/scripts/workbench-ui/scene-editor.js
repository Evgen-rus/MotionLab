const $=s=>document.querySelector(s);
export function initSceneEditor({pause,toast}){
 const frame=$('#scene-frame');
 let active=false,sources=[],source=null,info=null,section=null,selected=null,time=0,playing=false,last=0,loadingTimer=null,loadToken=0;
 const post=data=>frame.contentWindow?.postMessage({channel:'motionlab-scene',...data},'*');
 const button=(text,fn,chosen=false)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;b.setAttribute('aria-pressed',chosen);return b};
 const elements=()=>info?.elements.filter(e=>e.sceneId==='all'||e.sceneId===section?.id)||[];
 const message=text=>{$('#scene-message').textContent=text;$('#scene-message').hidden=!text};
 function stop(){playing=false;$('#scene-play').textContent='Воспроизвести'}
 function fit(){if(!info)return;frame.style.width=info.size[0]+'px';frame.style.height=info.size[1]+'px';frame.style.transform=`scale(${$('#scene-viewport').clientWidth/info.size[0]})`}
 new ResizeObserver(fit).observe($('#scene-viewport'));
 function seek(value){
  if(!info)return;time=Math.max(section.start,Math.min(section.end,value));
  $('#scene-time').value=time;$('#scene-clock').textContent=time.toFixed(2)+' / '+info.duration.toFixed(2)+' с';
  document.querySelectorAll('.scene-cursor').forEach(node=>node.style.left=(time-section.start)/(section.end-section.start)*100+'%');
  post({type:'seek',time});if(selected)updateContext();
 }
 function context(){
  return {project:$('#project-title').textContent,source:source.source,absoluteSource:source.absoluteSource,sourceSha256:source.revision,scene:{id:section.id,name:section.name,start:section.start,end:section.end},element:selected,previewTimeSeconds:Number(time.toFixed(3))};
 }
 function updateContext(){$('#scene-context').textContent=JSON.stringify(context(),null,2)}
 function choose(id){
  const e=elements().find(e=>e.id===id);if(!e)return;stop();selected=e;
  if(time<e.start||time>=e.end)seek(Math.max(section.start,Math.min(section.end,e.start+.65)));
  post({type:'select',id});renderElements();renderSelection();
 }
 function renderSelection(){
  $('#scene-selection-empty').hidden=Boolean(selected);$('#scene-selection').hidden=!selected;$('#scene-copy').disabled=!selected;
  $('#scene-copy-status').textContent='';if(!selected)return;
  $('#scene-element-name').textContent=selected.name;$('#scene-element-type').textContent=selected.type;$('#scene-element-content').textContent=selected.content||'Без текстового содержимого';
  const a=selected.appearance;
  const props=[['Появление',`${selected.start.toFixed(2)} — ${selected.end.toFixed(2)} с`],['Анимация',selected.motion],['Шрифт',`${a.font} · ${a.fontSize} · ${a.fontWeight}`],['Цвет',a.color]];
  $('#scene-properties').replaceChildren(...props.flatMap(([name,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;return [dt,dd]}));updateContext();
 }
 function renderElements(){
  const list=elements();
  $('#scene-elements').replaceChildren(...list.map(e=>button(e.name,()=>choose(e.id),e.id===selected?.id)));
  const ruler=document.createElement('div');ruler.className='scene-track scene-ruler';
  const label=document.createElement('span'),ticks=document.createElement('div');label.textContent='Элемент';ticks.className='scene-ticks';
  for(let i=0;i<=4;i++){const tick=document.createElement('span');tick.textContent=(section.start+(section.end-section.start)*i/4).toFixed(1)+' с';ticks.append(tick)}ruler.append(label,ticks);
  $('#scene-tracks').replaceChildren(ruler,...list.map(e=>{
   const row=document.createElement('div');row.className='scene-track';
   const name=button(e.name,()=>choose(e.id),e.id===selected?.id),lane=document.createElement('div');lane.className='scene-lane';
   const block=button(e.name,()=>choose(e.id),e.id===selected?.id);block.className='scene-block';
   const start=Math.max(section.start,e.start),end=Math.min(section.end,e.end),duration=section.end-section.start;
   block.style.left=(start-section.start)/duration*100+'%';block.style.width=Math.max(0,(end-start)/duration*100)+'%';block.title=`${e.start.toFixed(2)} — ${e.end.toFixed(2)} с`;block.setAttribute('aria-label',`Дорожка: ${e.name}`);const cursor=document.createElement('span');cursor.className='scene-cursor';cursor.style.left=(time-section.start)/duration*100+'%';lane.append(block,cursor);row.append(name,lane);return row;
  }));
 }
 function selectSection(id){
  stop();section=info.scenes.find(s=>s.id===id)||info.scenes[0];selected=null;
  $('#scene-sections').replaceChildren(...info.scenes.map(s=>button(s.name,()=>selectSection(s.id),s.id===section.id)));
  $('#scene-heading').textContent=section.name;$('#scene-duration').textContent=`${section.start.toFixed(2)} — ${section.end.toFixed(2)} с`;
  $('#scene-time').min=section.start;$('#scene-time').max=section.end;
  const list=elements();seek(Math.min(section.end,section.start+1));
  renderElements();renderSelection();if(list.length)choose(list[0].id);
 }
 function reset(){
  stop();clearTimeout(loadingTimer);info=null;section=null;selected=null;
  $('#scene-viewport').hidden=true;$('#scene-play').disabled=true;$('#scene-time').disabled=true;$('#scene-copy').disabled=true;
  for(const id of ['scene-elements','scene-sections','scene-tracks'])$('#'+id).replaceChildren();
  $('#scene-size').textContent='—';$('#scene-clock').textContent='0.00 / 0.00 с';$('#scene-duration').textContent='';renderSelection();frame.removeAttribute('src');
 }
 function openSource(id){
  reset();source=sources.find(s=>s.id===id);if(!source)return;
  message('Загрузка HTML-сцены…');frame.style.width='1280px';frame.style.height='720px';
  const name=source.source.split('/').at(-1);frame.src=source.previewBase+encodeURIComponent(name)+'?v='+source.revision;
  loadingTimer=setTimeout(()=>message('Сцена не ответила. Проверьте исходник с Codex и нажмите «Обновить сцену».'),15000);
 }
 async function loadSources(){
  const token=++loadToken;reset();message('Загрузка сцен…');
  try{
   const response=await fetch('/api/scenes');const data=await response.json();if(token!==loadToken||!active)return;
   if(!response.ok)throw Error(data.error||'Не удалось загрузить сцены');
   sources=data.scenes;$('#scene-source').replaceChildren(...sources.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name+' · '+s.source;return o}));
   $('#scene-source').disabled=!sources.length;
   if(!sources.length){source=null;message('В этом проекте пока нет HTML-сцен. Попросите Codex создать сцену или открыть проект с исходником ролика. Импортированный MP4 не содержит отдельных элементов.');return}
   $('#scene-source').value=sources.some(s=>s.id===source?.id)?source.id:sources[0].id;openSource($('#scene-source').value);
  }catch(e){if(token===loadToken)message(e.message)}
 }
 window.addEventListener('message',event=>{
  if(!active||!source||event.source!==frame.contentWindow||event.data?.channel!=='motionlab-scene')return;
  const m=event.data;
  if(m.type==='error'){reset();message(m.message);return}
  if(m.type==='selected'){const e=info?.elements.find(e=>e.id===m.id);if(e){if(e.sceneId!=='all'&&e.sceneId!==section.id)selectSection(e.sceneId);choose(e.id)}return}
  if(m.type!=='ready')return;
  const value=m.info;
  if(!value||!Array.isArray(value.elements)||value.elements.length>500||!Array.isArray(value.scenes)||!value.scenes.length||!Array.isArray(value.size)||value.size.length!==2||value.size.some(n=>!Number.isFinite(n)||n<64||n>1920)||!Number.isFinite(value.duration)||value.duration<=0)return;
  info=value;clearTimeout(loadingTimer);$('#scene-viewport').hidden=false;$('#scene-viewport').style.aspectRatio=info.size.join('/');$('#scene-viewport').style.setProperty('--scene-ratio',info.size[0]/info.size[1]);fit();
  $('#scene-size').textContent=info.size.join(' × ')+' / '+info.fps+' FPS';$('#scene-play').disabled=false;$('#scene-time').disabled=false;
  message(info.elements.length?'':'В исходнике ещё не размечены элементы. Попросите Codex добавить идентификаторы для выбора текста, изображений и других частей сцены.');
  selectSection(info.scenes[0].id);
 });
 function setMode(value){
  active=value;pause();stop();$('#montage-view').hidden=value;$('#scene-view').hidden=!value;
  $('#mode-montage').setAttribute('aria-pressed',!value);$('#mode-scene').setAttribute('aria-pressed',value);
  for(const id of ['undo','redo','export-top'])$('#'+id).hidden=value;
  document.querySelector('.project-subtitle').textContent=value?'Структура сцены':'Монтаж';
  if(value)loadSources();else{loadToken++;reset();message('')}
 }
 $('#mode-scene').onclick=()=>setMode(true);$('#mode-montage').onclick=()=>setMode(false);
 $('#scene-source').onchange=()=>openSource($('#scene-source').value);$('#scene-reload').onclick=loadSources;
 $('#scene-time').oninput=e=>{stop();seek(Number(e.target.value))};
 $('#scene-play').onclick=()=>{if(!info)return;if(playing){stop();return}if(time>=section.end)seek(section.start);playing=true;last=performance.now();$('#scene-play').textContent='Пауза';requestAnimationFrame(tick)};
 function tick(now){if(!playing||!active)return;seek(time+(now-last)/1000);last=now;if(time>=section.end)stop();else requestAnimationFrame(tick)}
 $('#scene-copy').onclick=async()=>{
  if(!selected||!info)return;stop();$('#scene-copy').disabled=true;
  const copiedContext=context(),chosenSource=source;
  try{
   const response=await fetch('/api/scenes');if(!response.ok)throw Error('Не удалось проверить версию сцены');
   const fresh=(await response.json()).scenes.find(s=>s.id===chosenSource.id);
   if(!active||source!==chosenSource||selected?.id!==copiedContext.element.id)return;
   if(fresh?.revision!==chosenSource.revision)throw Error('Исходник изменился. Нажмите «Обновить сцену» и выберите элемент снова.');
   const text='Элемент сгенерированного ролика MotionLab:\n'+JSON.stringify(copiedContext,null,2);
   $('#scene-context').textContent=text;
   try{await navigator.clipboard.writeText(text);$('#scene-copy-status').textContent='Элемент скопирован. Вставьте в чат.'}
   catch{const pre=$('#scene-context');pre.parentElement.open=true;const range=document.createRange();range.selectNodeContents(pre);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);pre.focus();$('#scene-copy-status').textContent='Браузер запретил копирование. Нажмите Ctrl+C — контекст выделен ниже.'}
  }catch(e){toast(e.message,true)}finally{$('#scene-copy').disabled=!selected}
 };
}
