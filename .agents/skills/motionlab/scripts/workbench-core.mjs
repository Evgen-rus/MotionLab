import {randomUUID} from 'node:crypto';

const finite = (value, label) => {
 if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()))throw Error(`Некорректное значение: ${label}`);
 const n = Number(value);
 if (!Number.isFinite(n)) throw Error(`Некорректное значение: ${label}`);
 return n;
};

export const emptyEdit = () => ({version:2, revision:0, media:[], clips:[], audio:[], history:{past:[],future:[]}, output:{width:1280,height:720,fps:30}, exports:[]});
const editSnapshot = state => structuredClone({media:state.media,clips:state.clips,audio:state.audio,output:state.output});
export function rememberEdit(previous,next) {
 next.history={past:[...previous.history.past,editSnapshot(previous)].slice(-30),future:[]};
 next.revision=previous.revision+1;
 return validateEdit(next);
}

export function validateEdit(value) {
 if(value?.version===1)value={...structuredClone(value),version:2,audio:[],history:{past:[],future:[]}};
 if (!value || value.version !== 2 || !Array.isArray(value.media) || !Array.isArray(value.clips) || !Array.isArray(value.audio) || !Array.isArray(value.exports)) throw Error('Некорректный файл монтажа');
 if(value.audio.length>60)throw Error('Лимит: 60 звуковых фрагментов');
 if (value.media.length > 200 || value.clips.length > 60) throw Error('Лимит: 200 исходников и 60 фрагментов');
 const known = new Set();
 for (const m of value.media) {
  if (!/^[a-f\d-]{16,64}$/i.test(m.id) || known.has(m.id) || !/^[a-f\d-]{16,64}\.(mp4|m4v|webm|mov|mkv)$/i.test(m.file)) throw Error('Некорректный исходник');
  known.add(m.id);
  if (typeof m.name !== 'string' || m.name.length > 255 || !Number.isFinite(m.duration) || m.duration <= 0 || m.duration > 14400) throw Error('Некорректная длительность исходника');
  if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 1 || m.height < 1 || typeof m.hasAudio !== 'boolean') throw Error('Некорректные параметры видео');
 }
 const ids = new Set();
 for (const c of value.clips) {
  if (!/^[a-f\d-]{16,64}$/i.test(c.id) || ids.has(c.id) || !known.has(c.mediaId)) throw Error('Фрагмент с неизвестным исходником');
  ids.add(c.id);
  const m = value.media.find(x => x.id === c.mediaId);
  if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end - c.start < 0.04 || c.end > m.duration + 0.005 || typeof c.muted !== 'boolean') throw Error('Неверные границы фрагмента');
  if(c.audioDetached!==undefined&&(typeof c.audioDetached!=='boolean'||c.audioDetached&&!c.muted))throw Error('Отделённый звук должен быть отключён у видео');
 }
 for(const c of value.audio){
  const m=value.media.find(m=>m.id===c.mediaId);
  if(!/^[a-f\d-]{16,64}$/i.test(c.id)||ids.has(c.id)||!m?.hasAudio)throw Error('Звук с неизвестным исходником');
  ids.add(c.id);
  if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.04||c.end>m.duration+.005||!Number.isFinite(c.at)||c.at<0||!Number.isFinite(c.rate)||c.rate<.5||c.rate>2||!Number.isFinite(c.gain)||c.gain<0||c.gain>1||c.at+(c.end-c.start)/c.rate>3600||typeof c.muted!=='boolean')throw Error('Неверные параметры звука');
 }
 const o = value.output;
 if (!o || !Number.isInteger(o.width) || !Number.isInteger(o.height) || o.width < 64 || o.height < 64 || o.width > 1920 || o.height > 1920 || o.width % 2 || o.height % 2 || ![24,25,30,60].includes(o.fps)) throw Error('Неверный формат экспорта');
 const duration = value.clips.reduce((sum,c) => sum+c.end-c.start,0);
 if (duration > 3600) throw Error('Максимальная длина монтажа — 60 минут');
 if (!Number.isInteger(value.revision) || value.revision < 0) throw Error('Некорректная версия проекта');
 if(!value.history||!Array.isArray(value.history.past)||!Array.isArray(value.history.future)||value.history.past.length>30||value.history.future.length>30)throw Error('Некорректная история');
 for(const entry of [...value.history.past,...value.history.future]){
  validateEdit({version:2,revision:0,media:entry.media,clips:entry.clips,audio:entry.audio,output:entry.output,exports:[],history:{past:[],future:[]}});
 }
 return value;
}

export function applyEdit(current, action) {
 current=validateEdit(current);
 if (!action || typeof action.type !== 'string') throw Error('Нужна команда монтажа');
 const next = structuredClone(current), clips = next.clips;
 const index = action.index === undefined ? -1 : finite(action.index,'номер клипа')-1;
 const clip = clips[index];
 const audio = next.audio.find(c=>c.id===action.id);
 switch(action.type) {
  case 'undo': case 'redo': {
   const from=action.type==='undo'?'past':'future',to=from==='past'?'future':'past';
   const entry=next.history[from].pop();if(!entry)throw Error('История пуста');
   next.history[to].push(editSnapshot(current));next.history[to]=next.history[to].slice(-30);
   Object.assign(next,entry);next.revision++;return validateEdit(next);
  }
  case 'removeMedia': {
   if(!next.media.some(m=>m.id===action.mediaId))throw Error('Исходник не найден');
   if([...clips,...next.audio].some(c=>c.mediaId===action.mediaId))throw Error('Исходник используется на таймлайне. Сначала уберите его фрагменты.');
   next.media=next.media.filter(m=>m.id!==action.mediaId);break;
  }
  case 'detach': {
   if(!clip)throw Error('Клип не найден');
   if(clip.audioDetached)throw Error('Звук уже отделён');
   if(!next.media.find(m=>m.id===clip.mediaId).hasAudio)throw Error('В исходнике нет звука');
   next.audio.push({id:randomUUID(),mediaId:clip.mediaId,start:clip.start,end:clip.end,at:clips.slice(0,index).reduce((n,c)=>n+c.end-c.start,0),rate:1,gain:1,muted:clip.muted});
   clip.audioDetached=true;clip.muted=true;break;
  }
  case 'audio': {
   if(!audio)throw Error('Звуковой фрагмент не найден');
   for(const key of ['start','end','at','rate','gain'])if(action[key]!==undefined)audio[key]=finite(action[key],key);
   if(action.muted!==undefined){if(typeof action.muted!=='boolean')throw Error('Нужно логическое значение muted');audio.muted=action.muted;}break;
  }
  case 'removeAudio': {
   if(!audio)throw Error('Звуковой фрагмент не найден');next.audio=next.audio.filter(c=>c.id!==action.id);break;
  }
  case 'splitAudio': {
   if(!audio)throw Error('Звуковой фрагмент не найден');const at=finite(action.at,'время разделения');
   if(at<=audio.start+.04||at>=audio.end-.04)throw Error('Разделение должно быть внутри клипа');
   next.audio.push({...audio,id:randomUUID(),start:at,at:audio.at+(at-audio.start)/audio.rate});audio.end=at;break;
  }
  case 'append': {
   const media = next.media.find(m => m.id === action.mediaId);
   if (!media) throw Error('Исходник не найден');
   clips.push({id:randomUUID(),mediaId:media.id,start:0,end:media.duration,muted:false});
   break;
  }
  case 'trim': {
   if (!clip) throw Error('Клип не найден');
   clip.start = finite(action.start,'начало');clip.end = finite(action.end,'конец');
   break;
  }
  case 'split': {
   if (!clip) throw Error('Клип не найден');
   const at = finite(action.at,'время разделения');
   if (at <= clip.start+0.04 || at >= clip.end-0.04) throw Error('Разделение должно быть внутри клипа');
   const second = {...clip,id:randomUUID(),start:at};clip.end=at;
   clips.splice(index+1,0,second);break;
  }
  case 'remove': {
   if (!clip) throw Error('Клип не найден');clips.splice(index,1);break;
  }
  case 'move': {
   if (!clip) throw Error('Клип не найден');
   const to = finite(action.to,'позиция')-1;
   if (!Number.isInteger(to) || to < 0 || to >= clips.length) throw Error('Позиция вне таймлайна');
   clips.splice(index,1);clips.splice(to,0,clip);break;
  }
  case 'mute': {
   if (!clip) throw Error('Клип не найден');
   if (typeof action.muted !== 'boolean') throw Error('Нужно логическое значение muted');
   if(clip.audioDetached&&!action.muted)throw Error('Звук уже на отдельной дорожке. Используйте отмену, чтобы вернуть его к видео.');
   clip.muted=action.muted;break;
  }
  case 'format': {
   const formats = {'16:9':[1280,720],'9:16':[720,1280],'1:1':[1080,1080],'1080p':[1920,1080]};
   const size = formats[action.format];if (!size) throw Error('Доступно: 16:9, 9:16, 1:1, 1080p');
   [next.output.width,next.output.height]=size;break;
  }
  default: throw Error(`Неизвестное действие: ${action.type}`);
 }
 return rememberEdit(current,next);
}

// Deliberately small and deterministic; free-form creative requests belong to the Codex conversation.
export function naturalCommand(command) {
 const s=String(command||'').trim().toLowerCase().replace(/,/g,'.');
 let m;
 if(/^(отмени|отменить|undo)$/.test(s))return {type:'undo'};
 if(/^(повтори|повторить|redo)$/.test(s))return {type:'redo'};
 if((m=s.match(/^(?:отдели звук|detach audio)\s+(?:у\s+)?(?:клипа|клип|clip)?\s*(\d+)$/)))return {type:'detach',index:Number(m[1])};
 if ((m=s.match(/^(?:удали|убери|remove|delete)\s+(?:клип|фрагмент|clip)?\s*(\d+)$/))) return {type:'remove',index:Number(m[1])};
 if ((m=s.match(/^(?:обрежь|trim)\s+(?:клип|фрагмент|clip)?\s*(\d+)\s+(?:с|from)\s+(\d+(?:\.\d+)?)\s+(?:до|to)\s+(\d+(?:\.\d+)?)$/))) return {type:'trim',index:Number(m[1]),start:Number(m[2]),end:Number(m[3])};
 if ((m=s.match(/^(?:раздели|разрежь|split)\s+(?:клип|фрагмент|clip)?\s*(\d+)\s+(?:на|at)\s+(\d+(?:\.\d+)?)$/))) return {type:'split',index:Number(m[1]),at:Number(m[2])};
 if ((m=s.match(/^(?:перемести|move)\s+(?:клип|clip)?\s*(\d+)\s+(?:на|to)\s+(?:позицию|position)?\s*(\d+)$/))) return {type:'move',index:Number(m[1]),to:Number(m[2])};
 if ((m=s.match(/^(?:выключи звук|убери звук|mute)\s+(?:у\s+)?(?:клипа|клип|clip)?\s*(\d+)$/))) return {type:'mute',index:Number(m[1]),muted:true};
 if ((m=s.match(/^(?:включи звук|unmute)\s+(?:у\s+)?(?:клипа|клип|clip)?\s*(\d+)$/))) return {type:'mute',index:Number(m[1]),muted:false};
 if ((m=s.match(/^(?:формат|format|сделай формат)\s+(16:9|9:16|1:1|1080p)$/))) return {type:'format',format:m[1]};
 throw Error('Не понял команду. Пример: «Обрежь клип 1 с 2 до 5». Для сложного монтажа напишите Codex в чате.');
}
