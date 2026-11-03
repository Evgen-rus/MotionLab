import {writeFileSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {args, freshOutput, localFile} from './lib.mjs';

export function cleanSpeech(text) {
 return [...String(text).replace(/```[\s\S]*?```/g,' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/(?:file:\/\/\/|[A-Za-z]:[\\/]|\\\\)[^\s<>"']+/g,' ')
  .replace(/(?:^|\s)(?:\/(?!\/)|(?:\.\.\/|\.\/)?(?:projects|Users|home|tmp)\/)[^\s<>"']+/g,' ')
  .replace(/<[^>]*>|::[\w-]+\{[^}]*\}/g,' ').replace(/https?:\/\/\S+/g,' ')
  .replace(/^[ \t]*[#>+*-]+\s*/gm,'').replace(/[*_`~]/g,'').replace(/\s+/g,' ').trim()].slice(0,12000).join('');
}

async function bounded(response, limit) {
 if(!response.ok) {await response.body?.cancel();throw Error(`openrouter_http_${response.status}`);}
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('openrouter_response_too_large');chunks.push(chunk);}
 return Buffer.concat(chunks);
}

// Paid output duration/token counts cannot be bounded reliably before synthesis.
export function quoteSpeech(model) {
 if(!model?.architecture?.output_modalities?.includes('speech'))return null;
 const p=model.pricing;
 if(!p || !Object.hasOwn(p,'prompt') || !Object.hasOwn(p,'completion'))return null;
 const prices=Object.values(p).map(v=> typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v)?Number(v):NaN);
 return prices.length && prices.every(v=>Number.isFinite(v)&&v===0)?0:null;
}

export function createSpeechProvider({env=process.env, fetchImpl=fetch, now=Date.now}={}) {
 let catalog,expires=0;
 return async text=>{
  if(!['true','1','yes'].includes((env.OWNER_VOICE_ENABLED||'').toLowerCase()))throw Error('owner_voice_disabled');
  const key=env.OPENROUTER_API_KEY?.trim(),voice=env.OPENROUTER_TTS_VOICE?.trim();
  const model=env.OPENROUTER_TTS_MODEL?.trim()||'fish-audio/s2.1-pro-free:free';
  const timeout=Number(env.OPENROUTER_TTS_TIMEOUT_SECONDS??120),limit=Number(env.OWNER_VOICE_MAX_COST_USD??0);
  if(!key || !voice)throw Error('openrouter_not_configured');
  if(!Number.isFinite(timeout)||timeout<=0||timeout>2147483 || !Number.isFinite(limit)||limit<0)throw Error('openrouter_invalid_config');
  const input=cleanSpeech(text);if(!input)throw Error('empty_speech_text');
  async function request(path,body,max){
   try {
    const response=await fetchImpl('https://openrouter.ai/api/v1'+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(timeout*1000),headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(body && response.ok && !/^audio\/(mpeg|mp3)(?:;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('unsupported_audio_response');}
    return await bounded(response,max);
   }catch(e){if(/^(openrouter_http_\d+|openrouter_response_too_large|unsupported_audio_response)$/.test(e.message))throw e;throw Error('openrouter_request_failed');}
  }
  if(!catalog || now()>=expires){
   const bytes=await request('/models?output_modalities=speech',null,8*1024*1024);
   try{const parsed=JSON.parse(bytes);if(!Array.isArray(parsed.data))throw Error();catalog=parsed.data;}catch{throw Error('openrouter_invalid_catalog');}
   expires=now()+900000;
  }
  const cost=quoteSpeech(catalog.find(m=>m.id===model));
  if(cost===null || cost>limit)throw Error('no_model_within_cost_limit');
  const audio=await request('/audio/speech',{model,input,voice,response_format:'mp3'},10*1024*1024);
  if(!audio.length)throw Error('empty_audio_response');
  return audio;
 };
}

export async function deliverSpeech(text,{sendText,sendAudio,synthesize=createSpeechProvider()}={}) {
 await sendText(text);
 try{await sendAudio(await synthesize(text));return {ok:true};}
 catch(e){return {ok:false,error:/^(?:openrouter_http_\d+|openrouter_(?:response_too_large|request_failed|invalid_catalog|invalid_config|not_configured)|owner_voice_disabled|empty_speech_text|no_model_within_cost_limit|unsupported_audio_response|empty_audio_response)$/.test(e.message)?e.message:'audio_delivery_failed'};}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const a=args();for(const key of Object.keys(a))if(!['in','out'].includes(key))throw Error(`Unknown option: ${key}`);
 const text=cleanSpeech(readFileSync(localFile(a.in),'utf8'));if(!text)throw Error('empty_speech_text');
 const out=freshOutput(a.out);
 const result=await deliverSpeech(text,{
  sendText:async value=>{writeFileSync(join(out,'text.txt'),value+'\n',{flag:'wx'});console.log(value);console.log(join(out,'text.txt'));},
  sendAudio:async audio=>{writeFileSync(join(out,'voice.mp3'),audio,{flag:'wx'});console.log(join(out,'voice.mp3'));}
 });
 if(!result.ok){console.error('Озвучка недоступна: '+result.error);process.exitCode=1;}
}
