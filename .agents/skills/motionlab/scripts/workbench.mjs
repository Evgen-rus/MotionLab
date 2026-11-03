import {createServer} from 'node:http';
import {createReadStream,createWriteStream,copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,statSync,unlinkSync,writeFileSync,constants} from 'node:fs';
import {join,resolve,relative,sep,extname,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {args,freshOutput} from './lib.mjs';
import {emptyEdit,validateEdit,applyEdit,naturalCommand,rememberEdit} from './workbench-core.mjs';
import {listScenes,sceneAsset} from './workbench-scenes.mjs';

const options=args();
for(const key of Object.keys(options)) if(!['project','import','action','command','export','port'].includes(key)) throw Error(`Неизвестная опция: ${key}`);
const title=options.project;
if(!title || title==='.' || title==='..' || /[<>:"|?*\\/\x00-\x1f]/.test(title) || /[. ]$/.test(title) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title)) throw Error('Укажите короткое название проекта: --project "Мой ролик"');

const base=resolve('projects'),folder=join(base,title),stateFile=join(folder,'edit.json');
const scriptRoot=dirname(fileURLToPath(import.meta.url));
const siteRoot=join(scriptRoot,'workbench-ui');
const maxFile=1024*1024*1024; // 1 GB per uploaded source
const mediaTypes={'.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mkv':'video/x-matroska'};
const ffmpeg=process.env.MOTIONLAB_FFMPEG || 'ffmpeg';
const ffprobe=process.env.MOTIONLAB_FFPROBE || 'ffprobe';

function ensureProject(){
 if(!existsSync(folder)) {
  freshOutput(join('projects',title));
  const job=JSON.parse(readFileSync(join(scriptRoot,'../assets/job.example.json'),'utf8'));
  job.title=title;
  writeFileSync(join(folder,'job.json'),JSON.stringify(job,null,2)+'\n',{flag:'wx'});
 } else {
  for(const path of [base,folder]) if(lstatSync(path).isSymbolicLink() || realpathSync(path)!==path) throw Error('Папка проекта не должна быть ссылкой');
  if(!existsSync(join(folder,'job.json'))) throw Error('Существующая папка не является проектом MotionLab');
 }
 if(!existsSync(stateFile)) writeFileSync(stateFile,JSON.stringify(emptyEdit(),null,2)+'\n',{flag:'wx'});
}
function readState(){return validateEdit(JSON.parse(readFileSync(stateFile,'utf8')));}
function sourcePath(media){
 const path=join(folder,'исходники',media.file);
 if(lstatSync(path).isSymbolicLink() || realpathSync(path).toLowerCase()!==path.toLowerCase() || !statSync(path).isFile()) throw Error('Исходный файл недоступен или является ссылкой');
 return path;
}
function saveState(state){
 validateEdit(state);
 const temp=join(folder,`edit-${randomUUID()}.tmp`);
 writeFileSync(temp,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
 try{renameSync(temp,stateFile);}catch(e){unlinkSync(temp);throw e;}
}
function inspectVideo(path){
 const result=spawnSync(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_type,width,height','-of','json',path],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024,windowsHide:true});
 if(result.error || result.status!==0) throw Error(`Не удалось прочитать видео: ${result.stderr||result.error?.message||'ffprobe'}`);
 const data=JSON.parse(result.stdout),video=data.streams?.find(s=>s.codec_type==='video');
 const duration=Number(data.format?.duration);
 if(!video || !Number.isFinite(duration) || duration<0.04 || duration>14400) throw Error('Требуется видео длительностью от 0,04 секунды до 4 часов');
 return {duration,width:Number(video.width),height:Number(video.height),hasAudio:Boolean(data.streams?.some(s=>s.codec_type==='audio'))};
}
function registerMedia(name,file,id){
 const info=inspectVideo(join(folder,'исходники',file));
 const state=readState(),previous=structuredClone(state);
 if(state.media.length>=200 || state.clips.length>=60) throw Error('Достигнут лимит исходников или фрагментов');
 state.media.push({id,name:name.slice(0,255),file,...info});
 state.clips.push({id:randomUUID(),mediaId:id,start:0,end:info.duration,muted:false});
 if(state.clips.length===1){
  const portrait=info.height>info.width;
  state.output={width:portrait?720:1280,height:portrait?1280:720,fps:30};
 }
 rememberEdit(previous,state);
 saveState(state);return state;
}
async function importFile(inputName,readable){
 const name=basename(inputName).slice(0,255),ext=extname(name).toLowerCase();
 if(!mediaTypes[ext]) throw Error('Поддерживаются MP4, M4V, WebM, MOV и MKV');
 const inputDir=join(folder,'исходники');mkdirSync(inputDir,{recursive:true});
 if(lstatSync(inputDir).isSymbolicLink()) throw Error('Папка исходников не должна быть ссылкой');
 const id=randomUUID(),file=id+ext,dest=join(inputDir,file);
 let size=0;
 const limiter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;callback(size>maxFile?Error('Максимальный размер файла — 1 ГБ'):null,chunk);}});
 try {
  await pipeline(readable,limiter,createWriteStream(dest,{flags:'wx'}));
  if(!size) throw Error('Пустой файл');
  return registerMedia(name,file,id);
 } catch(e) {if(existsSync(dest)) unlinkSync(dest);throw e;}
}
async function importLocal(path){
 const source=realpathSync(resolve(path));
 if(!statSync(source).isFile() || statSync(source).size>maxFile) throw Error('Укажите видеофайл размером до 1 ГБ');
 const ext=extname(source).toLowerCase();if(!mediaTypes[ext]) throw Error('Недопустимый формат файла');
 const dir=join(folder,'исходники');mkdirSync(dir,{recursive:true});
 if(lstatSync(dir).isSymbolicLink()) throw Error('Папка исходников не должна быть ссылкой');
 const id=randomUUID(),file=id+ext,dest=join(dir,file);
 try {copyFileSync(source,dest,constants.COPYFILE_EXCL);return registerMedia(basename(source),file,id);}
 catch(e){if(existsSync(dest))unlinkSync(dest);throw e;}
}

let exportStatus={running:false,percent:0,error:null,output:null};
async function exportVideo(){
 if(exportStatus.running) throw Error('Экспорт уже выполняется');
 const snapshot=readState();if(!snapshot.clips.length) throw Error('Добавьте хотя бы один фрагмент');
 const total=snapshot.clips.reduce((n,c)=>n+c.end-c.start,0);
 let target=snapshot.exports.length+1;
 while(existsSync(join(folder,'монтаж',`экспорт-${String(target).padStart(3,'0')}`)))target++;
 const outputDir=freshOutput(join('projects',title,'монтаж',`экспорт-${String(target).padStart(3,'0')}`));
 const output=join(outputDir,'video.mp4');
 const {width,height,fps}=snapshot.output;
 const argv=['-hide_banner','-nostdin','-n','-loglevel','error','-progress','pipe:2'];
 for(const clip of snapshot.clips){
  const media=snapshot.media.find(m=>m.id===clip.mediaId);
  argv.push('-protocol_whitelist','file,pipe','-i',sourcePath(media));
 }
 for(const clip of snapshot.audio)argv.push('-protocol_whitelist','file,pipe','-i',sourcePath(snapshot.media.find(m=>m.id===clip.mediaId)));
 const filters=[],streams=[];
 snapshot.clips.forEach((clip,i)=>{
  const duration=clip.end-clip.start,media=snapshot.media.find(m=>m.id===clip.mediaId);
  filters.push(`[${i}:v:0]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps},format=yuv420p[v${i}]`);
  if(media.hasAudio && !clip.muted) filters.push(`[${i}:a:0]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${duration}[a${i}]`);
  else filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${i}]`);
  streams.push(`[v${i}][a${i}]`);
 });
 filters.push(`${streams.join('')}concat=n=${snapshot.clips.length}:v=1:a=1[outv][baseaudio]`);
 const audioStreams=['[baseaudio]'];
 snapshot.audio.forEach((clip,i)=>{
  const delay=Math.round(clip.at*48000);
  filters.push(`[${snapshot.clips.length+i}:a:0]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS,atempo=${clip.rate},aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${clip.muted?0:clip.gain},adelay=${delay}S:all=1[detached${i}]`);
  audioStreams.push(`[detached${i}]`);
 });
 filters.push(`${audioStreams.join('')}amix=inputs=${audioStreams.length}:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1,atrim=duration=${total}[outa]`);
 argv.push('-filter_complex',filters.join(';'),'-map','[outv]','-map','[outa]','-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-b:a','160k','-movflags','+faststart','-pix_fmt','yuv420p',output);
 exportStatus={running:true,percent:0,error:null,output:null};
 try {
  const child=spawn(ffmpeg,argv,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let stderr='';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',chunk=>{
   stderr=(stderr+chunk).slice(-8000);
   for(const match of chunk.matchAll(/out_time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)){
    const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
    exportStatus.percent=Math.min(99,Math.round(seconds/total*100));
   }
  });
  const exit=await new Promise((yes,no)=>{child.once('error',no);child.once('close',yes);});
  if(exit!==0 || !existsSync(output)) throw Error(`FFmpeg завершился с ошибкой: ${stderr.slice(-2500)||exit}`);
  const latest=readState();
  const record={id:randomUUID(),path:relative(folder,output).split(sep).join('/'),createdAt:new Date().toISOString(),duration:total,width,height,fps};
  latest.exports.push(record);latest.revision++;saveState(latest);
  exportStatus={running:false,percent:100,error:null,output:record};
  return record;
 }catch(e){exportStatus={running:false,percent:0,error:e.message,output:null};throw e;}
}

function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
function error(res,e,status=400){send(res,status,{error:e.message||String(e)});}
async function readJson(req){
 let size=0,chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw Error('Слишком большой запрос');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function streamFile(req,res,path,mime){
 const size=statSync(path).size;
 let start=0,end=size-1,status=200;
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!match || (!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
  if(!match[1]){const suffix=Number(match[2]);start=Math.max(0,size-suffix);}
  else {start=Number(match[1]);end=match[2]?Number(match[2]):end;}
  if(start>end||start>=size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
  end=Math.min(end,size-1);status=206;
 }
 const headers={'Content-Type':mime,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 res.writeHead(status,headers);createReadStream(path,{start,end}).pipe(res);
}
function startServer(){
 const sceneSession=randomUUID(); // Opaque-origin font/module requests need CORS; keep scene URLs unguessable.
 const server=createServer(async(req,res)=>{
  try{
   const host=`127.0.0.1:${server.address().port}`;
   if(req.headers.host!==host) return error(res,Error('Недопустимый адрес'),403);
   if(!['GET','HEAD'].includes(req.method) && req.headers.origin!==`http://${host}`) return error(res,Error('Недопустимый источник запроса'),403);
   const path=new URL(req.url,`http://${host}`).pathname;
   if(req.method==='GET' && path==='/api/scenes')return send(res,200,{title,scenes:listScenes(folder).map(s=>({...s,previewBase:`/scene/${sceneSession}/${s.id}/`}))});
   if(req.method==='GET' && path==='/scene-bridge.js'){
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'});res.end(readFileSync(join(siteRoot,'scene-bridge.js')));return;
   }
   const sceneMatch=/^\/scene\/([a-f\d-]{36})\/([a-f\d]{24})\/(.+)$/.exec(path);
   if(req.method==='GET' && sceneMatch && sceneMatch[1]===sceneSession){
    const asset=sceneAsset(folder,sceneMatch[2],decodeURIComponent(sceneMatch[3]));
    const scope=`http://${host}/scene/${sceneSession}/${sceneMatch[2]}/`;
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src ${scope} http://${host}/scene-bridge.js 'unsafe-inline'; style-src ${scope} 'unsafe-inline'; img-src ${scope} data: blob:; font-src ${scope} data:; media-src ${scope} blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts`);
    if(asset.entry){
     res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src ${scope} http://${host}/scene-bridge.js 'unsafe-inline'; style-src ${scope} 'unsafe-inline'; img-src ${scope} data: blob:; font-src ${scope} data:; media-src ${scope} blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts`});
     res.end(readFileSync(asset.file,'utf8')+'\n<script src="/scene-bridge.js"></script>');return;
    }
    return streamFile(req,res,asset.file,asset.type);
   }
   if(req.method==='GET' && path==='/font.ttf') return streamFile(req,res,join(scriptRoot,'../assets/fonts/Manrope-Variable.ttf'),'font/ttf');
   if(req.method==='GET' && ['/','/app.js','/scene-editor.js','/style.css'].includes(path)){
    const file=join(siteRoot,path==='/'?'index.html':path.slice(1));
    const content=readFileSync(file);
    res.writeHead(200,{'Content-Type':path==='/'?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; media-src 'self' blob:; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"});res.end(content);return;
   }
   if(req.method==='GET' && path==='/api/state') return send(res,200,{title,...readState()});
   if(req.method==='GET' && path==='/api/export-status') return send(res,200,exportStatus);
   const mediaMatch=/^\/api\/media\/([a-f\d-]+)$/.exec(path);
   if(req.method==='GET' && mediaMatch){
    const media=readState().media.find(m=>m.id===mediaMatch[1]);if(!media)return error(res,Error('Не найдено'),404);
    return streamFile(req,res,sourcePath(media),mediaTypes[extname(media.file)]);
   }
   const fileMatch=/^\/api\/download\/([a-f\d-]+)$/.exec(path);
   if(req.method==='GET' && fileMatch){
    const entry=readState().exports.find(e=>e.id===fileMatch[1]);if(!entry)return error(res,Error('Не найдено'),404);
    const file=resolve(folder,entry.path),rel=relative(folder,file);
    if(rel.startsWith('..') || !rel || !existsSync(file) || realpathSync(file)!==file)return error(res,Error('Недоступный экспорт'),404);
    res.setHeader('Content-Disposition',`attachment; filename="motionlab-${entry.id.slice(0,8)}.mp4"`);
    return streamFile(req,res,file,'video/mp4');
   }
   if(req.method==='POST' && path==='/api/import'){
    const name=decodeURIComponent(String(req.headers['x-file-name']||''));
    if(!name)throw Error('Не указано имя видео');
    return send(res,200,{title,...await importFile(name,req)});
   }
   if(req.method==='POST' && path==='/api/action'){
    const body=await readJson(req),state=readState();
    if(body.revision!==state.revision)return error(res,Error('Проект изменился. Обновите таймлайн.'),409);
    const action=body.command?naturalCommand(body.command):body.action;
    const next=applyEdit(state,action);saveState(next);return send(res,200,{title,...next});
   }
   if(req.method==='POST' && path==='/api/export'){
    if(exportStatus.running)return error(res,Error('Экспорт уже выполняется'),409);
    exportVideo().catch(e=>console.error(e.message));return send(res,202,{started:true});
   }
   return error(res,Error('Не найдено'),404);
  }catch(e){error(res,e);}
 });
 const port=options.port===undefined?0:Number(options.port);
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Некорректный порт');
 server.listen(port,'127.0.0.1',()=>console.log(`MotionLab Workbench: http://127.0.0.1:${server.address().port}/\nПроект: ${title}`));
}

ensureProject();
if(options.import){await importLocal(options.import);console.log('Видео добавлено в '+stateFile);}
else if(options.action || options.command){const state=readState();const act=options.command?naturalCommand(options.command):JSON.parse(options.action);saveState(applyEdit(state,act));console.log('Таймлайн обновлён: '+stateFile);}
else if(options.export){const record=await exportVideo();console.log(join(folder,record.path));}
else startServer();
