import {initSceneEditor} from './scene-editor.js';
const $=selector=>document.querySelector(selector);
let state=null,selected=null,playhead=0,activeIndex=-1,playing=false,pendingSeek=null,busy=false,toastTimer=null;
let pixelsPerSecond=34,exporting=false;
let dragging=false;
const audioPlayers=new Map();
const selectedAudio=()=>state?.audio.find(c=>c.id===selected);
const selectedVideoIndex=()=>state?.clips.findIndex(c=>c.id===selected)??-1;
const audioDuration=c=>(c.end-c.start)/c.rate;
const thumbnails=new Map();
const icon=name=>{const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.classList.add('icon');el.setAttribute('aria-hidden','true');const use=document.createElementNS(el.namespaceURI,'use');use.setAttribute('href','#i-'+name);el.append(use);return el;};
const thumbnailObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const node=entry.target;node.src=node.dataset.src;thumbnailObserver.unobserve(node);}}, {root:$('#media-list')});
function updateControls(){
 for(const id of ['import-top','import-library','import-preview','format','apply-trim','mute','remove','apply-audio'])$('#'+id).disabled=busy||dragging;
 for(const id of ['play','back','forward','split'])$('#'+id).disabled=busy||!state?.clips.length;
 $('#export-top').disabled=busy||exporting||!state?.clips.length;
 document.querySelectorAll('.media-add').forEach(el=>el.disabled=busy);
 document.querySelectorAll('.media-remove').forEach(el=>el.disabled=busy);
 $('#undo').disabled=busy||dragging||!state?.history.past.length;
 $('#redo').disabled=busy||dragging||!state?.history.future.length;
 const clip=state?.clips[selectedVideoIndex()];
 $('#detach').disabled=busy||dragging||!clip||clip.audioDetached||!byId(clip.mediaId).hasAudio;
 if(clip?.audioDetached)$('#mute').disabled=true;
 document.querySelector('.main-grid').setAttribute('aria-busy',String(busy));
}
function setBusy(value){busy=value;updateControls();}
function pause(){playing=false;if(pendingSeek)pendingSeek.autoplay=false;video.pause();for(const p of audioPlayers.values())p.pause();updatePlay();}
const video=$('#video');
const duration=()=>state?.clips.reduce((n,c)=>n+c.end-c.start,0)||0;
const clipDuration=c=>c.end-c.start;
const byId=id=>state.media.find(m=>m.id===id);
const seconds=n=>{const min=Math.floor(n/60),sec=Math.floor(n%60),cs=Math.floor((n%1)*100);return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;};
const safeText=(el,t)=>{el.textContent=t;};

function toast(message,isError=false){const el=$('#toast');safeText(el,message);el.classList.toggle('error',isError);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
async function api(url,options){
 const response=await fetch(url,options);
 $('#connection').hidden=true;
 const json=await response.json();
 if(!response.ok)throw Error(json.error||`Ошибка ${response.status}`);
 return json;
}
async function refresh(initial=false){
 if(busy||dragging)return;
 let incoming;try{incoming=await api('/api/state');}catch(e){$('#connection').hidden=false;throw e;}
 if(!state||incoming.revision!==state.revision){state=incoming;render();if(!initial)toast('Изменения из проекта загружены');}
}
async function action(next){
 if(busy)return;
 setBusy(true);
 try{state=await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,action:next})});if(next.type==='detach')selected=state.audio.at(-1).id;render();safeText($('#last-edit'),({undo:'Действие отменено',redo:'Действие повторено',detach:'Звук отделён от видео',removeMedia:'Материал убран из проекта. Файл сохранён.',audio:'Звук изменён',trim:'Границы изменены',removeAudio:'Звук убран с таймлайна'}[next.type]||'Монтаж изменён')+' · Сохранено локально');}
 catch(error){toast(error.message,true);setBusy(false);await refresh(true);}
 finally{setBusy(false);}
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
 if(playhead>=total){pause();autoplay=false;}
 if(!autoplay)video.pause();
 const next=activeClipAt(Math.min(playhead,Math.max(0,total-0.003)));
 if(!next)return;
 const targetTime=next.clip.start+next.local;
 video.muted=next.clip.muted;
 if(activeIndex!==next.i || !video.src.endsWith('/api/media/'+next.clip.mediaId)){
  activeIndex=next.i;pendingSeek={time:targetTime,autoplay};video.src='/api/media/'+next.clip.mediaId;video.load();
 }else{
  if(video.readyState>=1){if(Math.abs(video.currentTime-targetTime)>0.001)video.currentTime=targetTime;if(autoplay)video.play().catch(()=>{playing=false;updatePlay();});}
  else pendingSeek={time:targetTime,autoplay};
 }
 updateClock();
}
function updateClock(){
 $('#timecode').innerHTML=`${seconds(playhead)} <i>/</i> <span class="total">${seconds(duration())}</span>`;
 const pointer=$('#playhead');pointer.style.display=state?.clips.length?'block':'none';pointer.style.left=(20+playhead*pixelsPerSecond)+'px';
 syncAudio();
}
function syncAudio(){
 for(const [id,p] of audioPlayers)if(!state?.audio.some(c=>c.id===id)){p.pause();p.removeAttribute('src');p.load();p.remove();audioPlayers.delete(id);}
 for(const c of state?.audio||[]){
  let p=audioPlayers.get(c.id);
  const active=playhead>=c.at&&playhead<c.at+audioDuration(c)&&playhead<duration()&&!c.muted;
  if(!active){p?.pause();continue;}
  if(!p){p=new Audio('/api/media/'+c.mediaId);p.preload='auto';p.preservesPitch=true;p.dataset.audioId=c.id;p.hidden=true;document.body.append(p);p.onloadedmetadata=()=>syncAudio();p.onerror=()=>toast('Не удалось воспроизвести отдельный звук. Попробуйте MP4 с AAC.',true);audioPlayers.set(c.id,p);}
  p.volume=c.gain;p.playbackRate=c.rate;
  const target=c.start+(playhead-c.at)*c.rate;
  if(p.readyState>=1&&Math.abs(p.currentTime-target)>(playing?.12:.005))p.currentTime=target;
  if(playing&&p.paused)p.play().catch(()=>{pause();toast('Браузер не разрешил воспроизведение звука. Нажмите «Воспроизвести» ещё раз.',true);});
  if(!playing)p.pause();
 }
}
function updatePlay(){$('#play').replaceChildren(icon(playing?'pause':'play'));$('#play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести');}
function togglePlay(){
 if(!state?.clips.length)return;
 if(playing){pause();}
 else{if(playhead>=duration()-0.01)playhead=0;playing=true;seek(playhead,true);}
 updatePlay();
}
function renderMedia(){
 for(const [id,p] of thumbnails)if(!state.media.some(m=>m.id===id)){thumbnailObserver.unobserve(p);p.pause();p.removeAttribute('src');p.load();thumbnails.delete(id);}
 const container=$('#media-list');container.replaceChildren();
 safeText($('#media-count'),String(state.media.length));
 for(const media of state.media){
  const row=document.createElement('div');row.className='media-item';row.draggable=true;
  const thumb=document.createElement('div');thumb.className='media-icon';thumb.append(icon('film'));
  let preview=thumbnails.get(media.id);
  if(!preview){preview=document.createElement('video');preview.muted=true;preview.playsInline=true;preview.preload='metadata';preview.setAttribute('aria-hidden','true');preview.dataset.src='/api/media/'+media.id;preview.addEventListener('loadedmetadata',()=>{preview.currentTime=Math.min(.1,media.duration/2);},{once:true});preview.addEventListener('error',()=>{preview.style.display='none';});thumbnails.set(media.id,preview);}
  thumb.append(preview);if(!preview.src)thumbnailObserver.observe(preview);
  const meta=document.createElement('div');meta.className='media-meta';
  const name=document.createElement('strong');safeText(name,media.name);name.title=media.name;
  const info=document.createElement('small');safeText(info,`${seconds(media.duration)} · ${media.width}×${media.height}`);
  meta.append(name,info);
  const add=document.createElement('button');add.className='media-add';add.append(icon('plus'));add.title='Добавить на таймлайн';add.setAttribute('aria-label','Добавить '+media.name);
  add.onclick=()=>action({type:'append',mediaId:media.id});
  row.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','media:'+media.id);e.dataTransfer.effectAllowed='copy';});
  const remove=document.createElement('button');remove.className='media-remove';remove.textContent='Убрать';remove.title='Убрать из проекта, сохранив файл';remove.setAttribute('aria-label','Убрать '+media.name+' из проекта');
  remove.onclick=()=>{if([...state.clips,...state.audio].some(c=>c.mediaId===media.id)){toast('Исходник используется на таймлайне. Сначала уберите его фрагменты. Файл на диске останется.',true);return;}action({type:'removeMedia',mediaId:media.id});};
  row.append(thumb,meta,add,remove);container.append(row);
 }
}
function renderTimeline(){
 const track=$('#track'),ruler=$('#ruler');track.replaceChildren();ruler.replaceChildren();
 const total=Math.max(duration(),...state.audio.map(c=>c.at+audioDuration(c)));const totalPixels=Math.max(620,Math.ceil(total*pixelsPerSecond)+40);
 $('#timeline-content').style.width=totalPixels+'px';
 const step=[1,2,5,10,15,30,60,120,300].find(n=>n*pixelsPerSecond>=65)||300;
 for(let t=0;t<=Math.max(total,20);t+=step){const tick=document.createElement('span');tick.className='tick';tick.textContent=seconds(t).slice(0,5);tick.style.left=(20+t*pixelsPerSecond)+'px';ruler.append(tick);}
 safeText($('#clip-count'),`${state.clips.length} фрагм.`);
 safeText($('#duration-info'),`${seconds(total)} · ${state.clips.length} клипов`);
 if(!state.clips.length){const empty=document.createElement('div');empty.className='track-empty';empty.textContent='Добавьте видео из библиотеки — клипы появятся здесь';track.append(empty);}
 else state.clips.forEach((clip,i)=>{
  const media=byId(clip.mediaId),element=document.createElement('div');
  element.className='clip'+(clip.id===selected?' selected':'');
  element.style.width=Math.max(1,clipDuration(clip)*pixelsPerSecond)+'px';element.style.flexShrink='0';element.draggable=true;
  element.tabIndex=0;element.setAttribute('role','button');element.setAttribute('aria-pressed',String(clip.id===selected));element.setAttribute('aria-label',`Клип ${i+1}: ${media.name}`);
  element.title=`${i+1}. ${media.name}: ${seconds(clip.start)} — ${seconds(clip.end)}`;
  const content=document.createElement('span');content.className='clip-content';
  const name=document.createElement('strong');safeText(name,media.name);
  const time=document.createElement('small');safeText(time,`${seconds(clipDuration(clip))}${clip.muted?' · без звука':''}`);
  content.append(name,time);element.append(content);
  element.onclick=()=>{if(busy||dragging)return;pause();selected=clip.id;renderTimeline();renderInspector();updateControls();};
  addTrimHandles(element,clip,'video');
  element.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();element.click();}});
  element.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','clip:'+clip.id);e.dataTransfer.effectAllowed='move';});
  element.addEventListener('dragover',e=>{e.preventDefault();element.classList.add('dragover');});
  element.addEventListener('dragleave',()=>element.classList.remove('dragover'));
  element.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();element.classList.remove('dragover');const payload=e.dataTransfer.getData('text/plain');if(payload.startsWith('clip:')){const from=state.clips.findIndex(c=>c.id===payload.slice(5));if(from>=0&&from!==i)action({type:'move',index:from+1,to:i+1});}else if(payload.startsWith('media:'))action({type:'append',mediaId:payload.slice(6)});});
  track.append(element);
 });
 renderAudioTrack();updateClock();
}
function addTrimHandles(element,clip,kind){
 if(clip.id!==selected)return;
 for(const side of ['left','right']){const h=document.createElement('span');h.className='trim-handle '+side;h.title='Потяните для обрезки';h.onpointerdown=e=>dragClip(e,clip,kind,side);element.append(h);}
}
function renderAudioTrack(){
 const track=$('#audio-track');track.replaceChildren();
 if(!state.audio.length){const hint=document.createElement('span');hint.className='audio-empty';hint.textContent='A1 · Выберите видео → «Отделить звук»';track.append(hint);track.style.height='48px';return;}
 const rows=[];
 for(const c of [...state.audio].sort((a,b)=>a.at-b.at)){
  let row=rows.findIndex(end=>end<=c.at);if(row<0)row=rows.length;rows[row]=c.at+audioDuration(c);
  const el=document.createElement('div');el.className='clip audio-clip'+(c.id===selected?' selected':'');el.style.left=(20+c.at*pixelsPerSecond)+'px';el.style.top=(8+row*68)+'px';el.style.width=Math.max(1,audioDuration(c)*pixelsPerSecond)+'px';el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Звук: '+byId(c.mediaId).name);el.setAttribute('aria-pressed',String(c.id===selected));
  const content=document.createElement('span');content.className='clip-content';const name=document.createElement('strong');name.textContent=byId(c.mediaId).name;const info=document.createElement('small');info.textContent=`${seconds(audioDuration(c))} · ${c.muted?'без звука':Math.round(c.gain*100)+'%'} · ${c.rate}×`;content.append(name,info);el.append(content);addTrimHandles(el,c,'audio');
  el.onpointerdown=e=>{if(!e.target.closest('.trim-handle'))dragClip(e,c,'audio','move');};
  el.onclick=()=>{if(busy||dragging)return;pause();selected=c.id;renderTimeline();renderInspector();updateControls();};el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.click();}};track.append(el);
 }
 track.style.height=(rows.length*68+12)+'px';
}
function dragClip(e,clip,kind,side){
 if(busy||dragging||e.button!==0)return;e.preventDefault();e.stopPropagation();pause();dragging=true;selected=clip.id;updateControls();
 const origin={...clip},x=e.clientX,element=e.currentTarget.closest('.clip');let candidate={...clip},moved=false;
 const move=ev=>{const delta=(ev.clientX-x)/pixelsPerSecond;moved||=Math.abs(ev.clientX-x)>2;candidate={...origin};
  if(side==='move')candidate.at=Math.max(0,Math.min(3600-audioDuration(origin),origin.at+delta));
  else if(side==='left'){candidate.start=Math.max(0,Math.min(origin.end-.04,origin.start+delta*(origin.rate||1)));if(kind==='audio'){candidate.at=Math.max(0,origin.at+(candidate.start-origin.start)/origin.rate);candidate.start=origin.start+(candidate.at-origin.at)*origin.rate;}}
  else candidate.end=Math.min(byId(origin.mediaId).duration,Math.max(origin.start+.04,origin.end+delta*(origin.rate||1)));
  element.style.width=((candidate.end-candidate.start)/(candidate.rate||1)*pixelsPerSecond)+'px';if(kind==='audio')element.style.left=(20+candidate.at*pixelsPerSecond)+'px';
  safeText($('#last-edit'),`Границы: ${seconds(candidate.start)} — ${seconds(candidate.end)}${kind==='audio'?' · позиция '+seconds(candidate.at):''}`);
 };
 const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);dragging=false;if(!moved){renderTimeline();renderInspector();updateControls();return;}action(kind==='audio'?{type:'audio',id:clip.id,start:candidate.start,end:candidate.end,at:candidate.at}:{type:'trim',index:state.clips.findIndex(c=>c.id===clip.id)+1,start:candidate.start,end:candidate.end});};
 const cancel=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);dragging=false;render();};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
}
function renderInspector(){
 const i=selectedVideoIndex(),audio=selectedAudio(),clip=audio||state.clips[i];
 $('#inspector-empty').hidden=Boolean(clip);$('#inspector-edit').hidden=!clip;
 if(!clip)return;
 const media=byId(clip.mediaId);
 safeText($('#selected-name'),media.name);safeText($('#selected-index'),audio?`Звук · ${seconds(audioDuration(audio))} · A1`:`Клип ${i+1} из ${state.clips.length} · ${seconds(media.duration)} исходник`);
 $('#trim-start').value=clip.start.toFixed(2);$('#trim-end').value=clip.end.toFixed(2);$('#mute').checked=clip.muted;
 $('#move-left').disabled=i===0;$('#move-right').disabled=i===state.clips.length-1;
 $('#audio-controls').hidden=!audio;$('#detach').hidden=Boolean(audio);document.querySelector('.inspector-row').hidden=Boolean(audio);
 if(audio){$('#audio-at').value=audio.at.toFixed(2);$('#audio-gain').value=Math.round(audio.gain*100);$('#audio-gain-value').textContent=Math.round(audio.gain*100)+'%';$('#audio-rate').value=audio.rate;}
 $('#detach').textContent=clip.audioDetached?'Звук уже отделён':'Отделить звук';
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
 if(![...state.clips,...state.audio].some(c=>c.id===selected))selected=state.clips[0]?.id||state.audio[0]?.id||null;
 renderMedia();renderTimeline();renderInspector();renderExports();
 const hasClips=state.clips.length>0;
 $('#output-frame').hidden=!hasClips;$('#output-frame').style.setProperty('--output-ratio',state.output.width/state.output.height);
 $('#empty-preview').style.display=hasClips?'none':'flex';video.style.display=hasClips?'block':'none';
 for(const button of ['#play','#back','#forward','#split','#export-top'])$(button).disabled=!hasClips;
 if(!hasClips){video.pause();video.removeAttribute('src');activeIndex=-1;selected=null;playhead=0;playing=false;updateClock();updatePlay();}
 else {pause();seek(Math.min(playhead,Math.max(0,duration()-0.005)),false);renderInspector();}
 $('#import-library').hidden=state.media.length>0;
 if(!busy&&!exporting)safeText($('#saved'),'Сохранено локально');
 updateControls();
}
async function upload(files){
 if(!files.length||busy)return;
 for(const file of files){
  if(file.size>1024**3){toast(`${file.name}: больше 1 ГБ`,true);continue;}
  setBusy(true);safeText($('#saved'),`Загрузка: ${file.name}`);
  try{state=await api('/api/import',{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name),'Content-Type':'application/octet-stream'},body:file});render();toast(`Добавлено: ${file.name}`);}
  catch(e){toast(`${file.name}: ${e.message}`,true);}
  finally{setBusy(false);safeText($('#saved'),exporting?'Выполняется экспорт…':'Сохранено локально');}
 }
 $('#file-input').value='';
}
async function startExport(){
 if(busy||exporting||!state.clips.length)return;
 try{exporting=true;updateControls();await api('/api/export',{method:'POST'});toast('Экспорт запущен. Не закрывайте окно до завершения.');checkExport();}
 catch(e){exporting=false;updateControls();toast(e.message,true);}
}
async function checkExport(){
 try{
  const status=await api('/api/export-status');exporting=status.running;updateControls();
  if(status.running){safeText($('#saved'),`Экспорт ${status.percent}%`);$('#export-top').disabled=true;setTimeout(checkExport,900);}
  else{safeText($('#saved'),'Сохранено локально');$('#export-top').disabled=!state?.clips.length;if(status.error)toast(status.error,true);if(status.output){toast('MP4 готов — ссылка в панели «Вывод»');await refresh(true);}}
 }catch(e){toast(e.message,true);if(exporting)setTimeout(checkExport,2000);}
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
video.addEventListener('ended',()=>{if(playing&&activeIndex>=0){const end=state.clips.slice(0,activeIndex+1).reduce((n,c)=>n+clipDuration(c),0);seek(end+.001,true);}});
video.addEventListener('error',()=>{if(video.src)toast('Не удалось воспроизвести этот формат в браузере. MP4/WebM подходят лучше.',true);});
for(const id of ['import-top','import-library','import-preview'])$('#'+id).onclick=()=>$('#file-input').click();
$('#file-input').addEventListener('change',e=>upload([...e.target.files]));
$('#play').onclick=togglePlay;
$('#back').onclick=()=>{playing=false;video.pause();seek(0,false);updatePlay();};
$('#forward').onclick=()=>{playing=false;video.pause();seek(duration(),false);updatePlay();};
$('#export-top').onclick=startExport;
$('#split').onclick=()=>{
 const audio=selectedAudio();
 if(audio){const at=audio.start+(playhead-audio.at)*audio.rate;if(at<audio.start+.04||at>audio.end-.04)return toast('Поставьте курсор внутри выбранного звука',true);return action({type:'splitAudio',id:audio.id,at});}
 const located=activeClipAt(playhead);if(!located)return;
 if(located.clip.id!==selected)return toast('Выберите видео под курсором или переместите курсор внутрь выбранного клипа',true);
 const at=located.clip.start+located.local;
 if(at<located.clip.start+0.04||at>located.clip.end-0.04)return toast('Поставьте курсор внутри фрагмента',true);
 action({type:'split',index:located.i+1,at:Number(at.toFixed(3))});
};
$('#track').addEventListener('dragover',e=>e.preventDefault());
$('#track').addEventListener('drop',e=>{if(e.target!==$('#track'))return;const value=e.dataTransfer.getData('text/plain');if(value.startsWith('media:'))action({type:'append',mediaId:value.slice(6)});});
$('#ruler').addEventListener('click',e=>{playing=false;video.pause();const x=e.clientX-$('#ruler').getBoundingClientRect().left;seek((x-20)/pixelsPerSecond,false);updatePlay();});
$('#ruler').addEventListener('pointerdown',e=>{if(busy||dragging||e.button!==0)return;pause();const move=ev=>seek((ev.clientX-$('#ruler').getBoundingClientRect().left-20)/pixelsPerSecond,false);move(e);const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);});
$('#zoom').addEventListener('input',e=>{pixelsPerSecond=Number(e.target.value);renderTimeline();});
$('#fit').onclick=()=>{pixelsPerSecond=Math.max(1,Math.min(90,($('#timeline-scroll').clientWidth-40)/Math.max(duration(),...state.audio.map(c=>c.at+audioDuration(c)),1)));$('#zoom').min=Math.min(12,pixelsPerSecond);$('#zoom').value=pixelsPerSecond;renderTimeline();};
$('#undo').onclick=()=>action({type:'undo'});$('#redo').onclick=()=>action({type:'redo'});
$('#detach').onclick=()=>{const index=selectedVideoIndex();if(index>=0)action({type:'detach',index:index+1});};
$('#audio-gain').oninput=e=>$('#audio-gain-value').textContent=e.target.value+'%';
$('#apply-audio').onclick=()=>{const c=selectedAudio();if(c)action({type:'audio',id:c.id,at:Number($('#audio-at').value),gain:Number($('#audio-gain').value)/100,rate:Number($('#audio-rate').value)});};
$('#apply-trim').onclick=()=>{const audio=selectedAudio(),index=selectedVideoIndex();if(!audio&&index<0)return;action({type:audio?'audio':'trim',...(audio?{id:audio.id}:{index:index+1}),start:Number($('#trim-start').value),end:Number($('#trim-end').value)});};
$('#mute').onchange=e=>{const audio=selectedAudio(),index=selectedVideoIndex();if(audio)action({type:'audio',id:audio.id,muted:e.target.checked});else if(index>=0)action({type:'mute',index:index+1,muted:e.target.checked});};
$('#remove').onclick=()=>{const audio=selectedAudio(),index=selectedVideoIndex();if(audio)action({type:'removeAudio',id:audio.id});else if(index>=0)action({type:'remove',index:index+1});};
$('#move-left').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>0)action({type:'move',index:index+1,to:index});};
$('#move-right').onclick=()=>{const index=state.clips.findIndex(c=>c.id===selected);if(index>=0&&index<state.clips.length-1)action({type:'move',index:index+1,to:index+2});};
$('#format').onchange=e=>action({type:'format',format:e.target.value});
document.addEventListener('keydown',e=>{
 if(!$('#scene-view').hidden)return;
 const tag=document.activeElement.tagName;
 if(!e.isComposing&&!['INPUT','TEXTAREA','SELECT'].includes(tag)&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(!busy&&!dragging)action({type:e.shiftKey?'redo':'undo'});return;}
 if(e.isComposing||['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(tag)||busy)return;
 if(e.code==='Space'){e.preventDefault();togglePlay();}
 if(e.key==='Delete'&&selected){e.preventDefault();$('#remove').click();}
 if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();pause();seek(playhead+(e.key==='ArrowRight'?1:-1)/state.output.fps,false);}
});
initSceneEditor({pause,toast});
setInterval(()=>{if(document.visibilityState==='visible'&&!busy)refresh(true).catch(()=>{});},3500);
try{await refresh(true);await checkExport();}catch(error){$('#connection').hidden=false;toast(error.message,true);}


