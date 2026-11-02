const $=selector=>document.querySelector(selector);
let state=null,selected=null,playhead=0,activeIndex=-1,playing=false,pendingSeek=null,busy=false,toastTimer=null;
let pixelsPerSecond=34;
const video=$('#video');
const duration=()=>state?.clips.reduce((n,c)=>n+c.end-c.start,0)||0;
const clipDuration=c=>c.end-c.start;
const byId=id=>state.media.find(m=>m.id===id);
const seconds=n=>{const min=Math.floor(n/60),sec=Math.floor(n%60),cs=Math.floor((n%1)*100);return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;};
const safeText=(el,t)=>{el.textContent=t;};

function toast(message,isError=false){const el=$('#toast');safeText(el,message);el.classList.toggle('error',isError);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
async function api(url,options){
 const response=await fetch(url,options);
 const json=await response.json();
 if(!response.ok)throw Error(json.error||`Ошибка ${response.status}`);
 return json;
}
async function refresh(initial=false){
 if(busy)return;
 const incoming=await api('/api/state');
 if(!state||incoming.revision!==state.revision){state=incoming;render();if(!initial)toast('Изменения из проекта загружены');}
}
async function action(next){
 if(busy)return;
 busy=true;
 try{state=await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,action:next})});render();}
 catch(error){toast(error.message,true);busy=false;await refresh(true);}
 finally{busy=false;}
}
function activeClipAt(time){
 let start=0;
 for(let i=0;i<state.clips.length;i++){
  const end=start+clipDuration(state.clips[i]);
  if(time<end-0.002||i===state.clips.length-1)return {i,clip:state.clips[i],local:Math.min(clipDuration(state.clips[i]),Math.max(0,time-start)),start};
  start=end;
 }
 return null;
}
function seek(time,autoplay=playing){
 if(!state?.clips.length){playhead=0;updateClock();return;}
 const total=duration();playhead=Math.max(0,Math.min(total,time));
 if(playhead>=total){playing=false;video.pause();autoplay=false;}
 const next=activeClipAt(Math.min(playhead,Math.max(0,total-0.003)));
 if(!next)return;
 const targetTime=next.clip.start+next.local;
 video.muted=next.clip.muted;
 if(activeIndex!==next.i || !video.src.endsWith('/api/media/'+next.clip.mediaId)){
  activeIndex=next.i;pendingSeek={time:targetTime,autoplay};video.src='/api/media/'+next.clip.mediaId;video.load();
 }else{
  if(video.readyState>=1){if(Math.abs(video.currentTime-targetTime)>0.12)video.currentTime=targetTime;if(autoplay)video.play().catch(()=>{playing=false;updatePlay();});}
  else pendingSeek={time:targetTime,autoplay};
 }
 updateClock();
}
function updateClock(){
 $('#timecode').innerHTML=`${seconds(playhead)} <i>/</i> ${seconds(duration())}`;
 const pointer=$('#playhead');pointer.style.display=state?.clips.length?'block':'none';pointer.style.left=(20+playhead*pixelsPerSecond)+'px';
}
function updatePlay(){safeText($('#play'),playing?'Ⅱ':'▶');$('#play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести');}
function togglePlay(){
 if(!state?.clips.length)return;
 if(playing){playing=false;video.pause();}
 else{if(playhead>=duration()-0.01)playhead=0;playing=true;seek(playhead,true);}
 updatePlay();
}
function renderMedia(){
 const container=$('#media-list');container.replaceChildren();
 safeText($('#media-count'),String(state.media.length));
 for(const media of state.media){
  const row=document.createElement('div');row.className='media-item';row.draggable=true;
  const icon=document.createElement('div');icon.className='media-icon';icon.textContent='▣';
  const meta=document.createElement('div');meta.className='media-meta';
  const name=document.createElement('strong');safeText(name,media.name);name.title=media.name;
  const info=document.createElement('small');safeText(info,`${seconds(media.duration)} · ${media.width}×${media.height}`);
  meta.append(name,info);
  const add=document.createElement('button');add.className='media-add';add.textContent='+';add.title='Добавить на таймлайн';add.setAttribute('aria-label','Добавить '+media.name);
  add.onclick=()=>action({type:'append',mediaId:media.id});
  row.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','media:'+media.id);e.dataTransfer.effectAllowed='copy';});
  row.append(icon,meta,add);container.append(row);
 }
}
function renderTimeline(){
 const track=$('#track'),ruler=$('#ruler');track.replaceChildren();ruler.replaceChildren();
 const total=duration();const totalPixels=Math.max(620,Math.ceil(total*pixelsPerSecond)+40);
 $('#timeline-content').style.width=totalPixels+'px';
 const step=pixelsPerSecond>=45?5:10;
 for(let t=0;t<=Math.max(total,20);t+=step){const tick=document.createElement('span');tick.className='tick';tick.textContent=seconds(t).slice(0,5);tick.style.left=(20+t*pixelsPerSecond)+'px';ruler.append(tick);}
 safeText($('#clip-count'),`${state.clips.length} фрагм.`);
 safeText($('#duration-info'),`${seconds(total)} · ${state.clips.length} клипов`);
 if(!state.clips.length){const empty=document.createElement('div');empty.className='track-empty';empty.textContent='Добавьте видео из библиотеки — клипы появятся здесь';track.append(empty);}
 else state.clips.forEach((clip,i)=>{
  const media=byId(clip.mediaId),element=document.createElement('div');
  element.className='clip'+(clip.id===selected?' selected':'');
  element.style.width=Math.max(1,clipDuration(clip)*pixelsPerSecond)+'px';element.style.flexShrink='0';element.draggable=true;
  element.title=`${i+1}. ${media.name}: ${seconds(clip.start)} — ${seconds(clip.end)}`;
  const content=document.createElement('span');content.className='clip-content';
  const name=document.createElement('strong');safeText(name,media.name);
  const time=document.createElement('small');safeText(time,`${seconds(clipDuration(clip))}${clip.muted?' · без звука':''}`);
  content.append(name,time);element.append(content);
  element.onclick=()=>{selected=clip.id;renderTimeline();renderInspector();const preceding=state.clips.slice(0,i).reduce((n,c)=>n+clipDuration(c),0);seek(preceding,false);};
  element.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','clip:'+clip.id);e.dataTransfer.effectAllowed='move';});
  element.addEventListener('dragover',e=>{e.preventDefault();element.classList.add('dragover');});
  element.addEventListener('dragleave',()=>element.classList.remove('dragover'));
  element.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();element.classList.remove('dragover');const payload=e.dataTransfer.getData('text/plain');if(payload.startsWith('clip:')){const from=state.clips.findIndex(c=>c.id===payload.slice(5));if(from>=0&&from!==i)action({type:'move',index:from+1,to:i+1});}else if(payload.startsWith('media:'))action({type:'append',mediaId:payload.slice(6)});});
  track.append(element);
 });
 updateClock();
}
function renderInspector(){
 const i=state.clips.findIndex(c=>c.id===selected),clip=state.clips[i];
 $('#inspector-empty').hidden=Boolean(clip);$('#inspector-edit').hidden=!clip;
 if(!clip)return;
 const media=byId(clip.mediaId);
 safeText($('#selected-name'),media.name);safeText($('#selected-index'),`Клип ${i+1} из ${state.clips.length} · ${seconds(media.duration)} исходник`);
 $('#trim-start').value=clip.start.toFixed(2);$('#trim-end').value=clip.end.toFixed(2);$('#mute').checked=clip.muted;
 $('#move-left').disabled=i===0;$('#move-right').disabled=i===state.clips.length-1;
}
function renderExports(){
 const container=$('#exports');container.replaceChildren();
 if(!state.exports.length){container.textContent='Пока нет экспортов';return;}
 for(const entry of [...state.exports].reverse()){
  const link=document.createElement('a');link.href='/api/download/'+entry.id;link.textContent=`MP4 · ${seconds(entry.duration)} · ${new Date(entry.createdAt).toLocaleString('ru-RU')}`;link.download='motionlab.mp4';container.append(link);
 }
}
function render(){
 safeText($('#project-title'),state.title);
 safeText($('#preview-resolution'),`${state.output.width} × ${state.output.height} / ${state.output.fps} FPS`);
 const ratio=`${state.output.width}:${state.output.height}`;
 $('#format').value=state.output.width===1920?'1080p':ratio==='1280:720'?'16:9':ratio==='720:1280'?'9:16':'1:1';
 if(!state.clips.some(c=>c.id===selected))selected=state.clips[0]?.id||null;
 renderMedia();renderTimeline();renderInspector();renderExports();
 const hasClips=state.clips.length>0;
 $('#empty-preview').style.display=hasClips?'none':'flex';video.style.display=hasClips?'block':'none';
 for(const button of ['#play','#back','#forward','#split','#export-top'])$(button).disabled=!hasClips;
 if(!hasClips){video.pause();video.removeAttribute('src');activeIndex=-1;selected=null;playhead=0;playing=false;updateClock();updatePlay();}
 else {playing=false;video.pause();updatePlay();seek(Math.min(playhead,Math.max(0,duration()-0.005)),false);renderInspector();}
}
async function upload(files){
 if(!files.length)return;
 for(const file of files){
  if(file.size>1024**3){toast(`${file.name}: больше 1 ГБ`,true);continue;}
  busy=true;safeText($('#saved'),`Загрузка: ${file.name}`);
  try{state=await api('/api/import',{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name),'Content-Type':'application/octet-stream'},body:file});render();toast(`Добавлено: ${file.name}`);}
  catch(e){toast(`${file.name}: ${e.message}`,true);}
  finally{busy=false;safeText($('#saved'),'Сохранено локально');}
 }
 $('#file-input').value='';
}
async function startExport(){
 if(busy||!state.clips.length)return;
 try{await api('/api/export',{method:'POST'});toast('Экспорт запущен. Не закрывайте окно до завершения.');checkExport();}
 catch(e){toast(e.message,true);}
}
async function checkExport(){
 try{
  const status=await api('/api/export-status');
  if(status.running){safeText($('#saved'),`Экспорт ${status.percent}%`);$('#export-top').disabled=true;setTimeout(checkExport,900);}
  else{safeText($('#saved'),'Сохранено локально');$('#export-top').disabled=!state?.clips.length;if(status.error)toast(status.error,true);if(status.output){toast('MP4 готов — ссылка в панели «Вывод»');await refresh(true);}}
 }catch(e){toast(e.message,true);}
}

video.addEventListener('loadedmetadata',()=>{
 if(!pendingSeek)return;
 const requested=pendingSeek;pendingSeek=null;
 video.currentTime=Math.min(Math.max(requested.time,0),Math.max(0,video.duration-0.001));
 if(requested.autoplay)video.play().catch(e=>{playing=false;updatePlay();toast(e.message,true);});
});
video.addEventListener('timeupdate',()=>{
 if(!playing||activeIndex<0)return;
 const clip=state.clips[activeIndex];if(!clip)return;
 const before=state.clips.slice(0,activeIndex).reduce((n,c)=>n+clipDuration(c),0);
 playhead=before+Math.max(0,Math.min(clipDuration(clip),video.currentTime-clip.start));updateClock();
 if(video.currentTime>=clip.end-0.035){if(activeIndex===state.clips.length-1){playing=false;video.pause();playhead=duration();updatePlay();updateClock();}else seek(before+clipDuration(clip)+0.001,true);}
});
video.addEventListener('ended',()=>{if(playing)seek(playhead+0.04,true);});
video.addEventListener('error',()=>{if(video.src)toast('Не удалось воспроизвести этот формат в браузере. MP4/WebM подходят лучше.',true);});
$('#file-input').addEventListener('change',e=>upload([...e.target.files]));
$('#play').onclick=togglePlay;
$('#back').onclick=()=>{playing=false;video.pause();seek(0,false);updatePlay();};
$('#forward').onclick=()=>{playing=false;video.pause();seek(duration(),false);updatePlay();};
$('#export-top').onclick=startExport;
$('#split').onclick=()=>{
 const located=activeClipAt(playhead);if(!located)return;
 const at=located.clip.start+located.local;
 if(at<located.clip.start+0.04||at>located.clip.end-0.04)return toast('Поставьте курсор внутри фрагмента',true);
 action({type:'split',index:located.i+1,at:Number(at.toFixed(3))});
};
$('#track').addEventListener('dragover',e=>e.preventDefault());
$('#track').addEventListener('drop',e=>{if(e.target!==$('#track'))return;const value=e.dataTransfer.getData('text/plain');if(value.startsWith('media:'))action({type:'append',mediaId:value.slice(6)});});
$('#ruler').addEventListener('click',e=>{playing=false;video.pause();const x=e.clientX-$('#ruler').getBoundingClientRect().left;seek((x-20)/pixelsPerSecond,false);updatePlay();});
$('#zoom').addEventListener('input',e=>{pixelsPerSecond=Number(e.target.value);renderTimeline();});
$('#apply-trim').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index<0)return;action({type:'trim',index:index+1,start:Number($('#trim-start').value),end:Number($('#trim-end').value)});};
$('#mute').onchange=e=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>=0)action({type:'mute',index:index+1,muted:e.target.checked});};
$('#remove').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>=0)action({type:'remove',index:index+1});};
$('#move-left').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>0)action({type:'move',index:index+1,to:index});};
$('#move-right').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>=0&&index<state.clips.length-1)action({type:'move',index:index+1,to:index+2});};
$('#format').onchange=e=>action({type:'format',format:e.target.value});
$('#command-form').onsubmit=async e=>{
 e.preventDefault();const command=$('#command').value.trim();if(!command||busy)return;
 busy=true;
 try{state=await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,command})});$('#command').value='';render();toast('Команда применена');}
 catch(e){toast(e.message,true);}
 finally{busy=false;}
};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();togglePlay();}if(e.key==='Delete'&&selected&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))$('#remove').click();});
setInterval(()=>{if(document.visibilityState==='visible'&&!busy)refresh(true).catch(()=>{});},3500);
try{await refresh(true);await checkExport();}catch(error){toast(error.message,true);}


