import {statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {args, freshOutput, localFile} from './lib.mjs';

const CHUNK = 60, OVERLAP = 5, MAX_SECONDS = 3600, MAX_BYTES = 150 * 1024 * 1024;

export function chunkRanges(duration) {
 if(!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw Error('invalid_duration');
 const ranges=[];
 for(let start=0; start<duration; start+=CHUNK-OVERLAP) {
  const end=Math.min(start+CHUNK,duration); ranges.push({start,end});
  if(end===duration) break;
 }
 return ranges;
}

function command(program, argv, maxBuffer) {
 const r=spawnSync(program,argv,{maxBuffer,timeout:120000,windowsHide:true});
 if(r.error || r.status!==0) throw Error('media_decode_failed');
 return r.stdout;
}

function durationOf(file) {
 const data=command(process.env.MOTIONLAB_FFPROBE || 'ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],65536);
 return Number(data.toString().trim());
}

function audioOf(file,{start,end}) {
 return command(process.env.MOTIONLAB_FFMPEG || 'ffmpeg',['-hide_banner','-nostdin','-v','error','-protocol_whitelist','file,pipe','-ss',String(start),'-i',file,'-t',String(end-start),'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-f','wav','pipe:1'],4*1024*1024);
}

export function createTranscriber({env=process.env,fetchImpl=fetch}={}) {
 const key=env.OPENAI_API_KEY?.trim(), model=env.TRANSCRIPTION_MODEL?.trim() || 'gpt-transcribe';
 if(!key) throw Error('openai_not_configured');
 if(!/^[a-zA-Z0-9._-]+$/.test(model)) throw Error('invalid_model');
 async function request(url, options={}) {
  let response;
  try { response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(180000),headers:{Authorization:`Bearer ${key}`}}); }
  catch { throw Error('openai_request_failed'); }
  if(!response.ok) {await response.body?.cancel(); throw Error(`openai_http_${response.status}`);}
  try { return await response.json(); } catch { throw Error('openai_invalid_response'); }
 }
 return {
  model,
  async check() { await request(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`); },
  async transcribe(audio) {
   const body=new FormData(); body.append('file',new Blob([audio],{type:'audio/wav'}),'audio.wav'); body.append('model',model);
   if(model==='gpt-transcribe') body.append('languages[]','ru'); else body.append('language','ru');
   const result=await request('https://api.openai.com/v1/audio/transcriptions',{method:'POST',body});
   if(typeof result.text!=='string') throw Error('openai_invalid_response');
   return result.text.trim();
  }
 };
}

export async function transcribeRecording({file, duration, api, decode=audioOf}) {
 const segments=[];
 for(const range of chunkRanges(duration)) {
  const audio=decode(file,range);
  const text=await api.transcribe(audio);
  segments.push({...range,text});
 }
 if(!segments.some(s=>s.text)) throw Error('empty_transcript');
 return segments;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {
  const a=args(); for(const key of Object.keys(a)) if(!['in','out'].includes(key)) throw Error('invalid_option');
  const file=localFile(a.in); if(statSync(file).size>MAX_BYTES) throw Error('input_too_large');
  const duration=durationOf(file); chunkRanges(duration);
  const api=createTranscriber(); await api.check();
  const out=freshOutput(a.out);
  const segments=await transcribeRecording({file,duration,api});
  const transcript=segments.map(s=>`[${s.start.toFixed(1)}–${s.end.toFixed(1)} с]\n${s.text || '(речь не распознана)'}`).join('\n\n');
  writeFileSync(join(out,'transcript.txt'),transcript+'\n',{flag:'wx'});
  writeFileSync(join(out,'transcript.json'),JSON.stringify({model:api.model,duration,overlapSeconds:OVERLAP,segments},null,2)+'\n',{flag:'wx'});
  console.log(`Расшифровка сохранена: ${out}`);
 } catch(e) { console.error(`Транскрибация: ${/^(openai_(?:http_\d+|not_configured|request_failed|invalid_response)|invalid_(?:duration|model|option)|input_too_large|media_decode_failed|empty_transcript)$/.test(e.message)?e.message:'local_error'}`); process.exitCode=1; }
}
