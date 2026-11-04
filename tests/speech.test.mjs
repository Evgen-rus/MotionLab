import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanSpeech,createSpeechProvider,deliverSpeech} from '../.agents/skills/motionlab/scripts/speech.mjs';

const model={id:'fish-audio/s2.1-pro-free:free',architecture:{output_modalities:['speech']},pricing:{prompt:'0',completion:'0'}};
const env={OWNER_VOICE_ENABLED:'true',OPENROUTER_API_KEY:'test-secret',OPENROUTER_TTS_VOICE:'voice-id'};
function mock(entry=model,status=200){
 const calls=[];
 return {calls,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return url.includes('/models?')?Response.json({data:[entry]}):new Response(status===200?'ID3audio':'test-secret provider error',{status,headers:{'content-type':'audio/mpeg'}});
 }};
}
test('speech request, cache and expiry',async()=>{
 const api=mock();let time=0;
 const synth=createSpeechProvider({env,...api,now:()=>time});
 assert.equal((await synth('**Привет**')).toString(),'ID3audio');await synth('Ещё');
 assert.equal(api.calls.length,3);
 assert.equal(api.calls[1].options.headers.Authorization,'Bearer test-secret');
 assert.deepEqual(JSON.parse(api.calls[1].options.body),{model:model.id,input:'Привет',voice:'voice-id',response_format:'mp3'});
 time=900001;await synth('Снова');assert.equal(api.calls.length,5);
});

test('availability check validates access and model without synthesis',async()=>{
 const api=mock(),synth=createSpeechProvider({env,...api});
 await synth('',{checkOnly:true});
 assert.equal(api.calls.length,1);assert.match(api.calls[0].url,/\/models\?/);
 await synth('Текст');assert.equal(api.calls.length,2);
 for(const status of [401,403,503]){
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response('test-secret',{status});};
  await assert.rejects(createSpeechProvider({env,fetchImpl})('',{checkOnly:true}),new RegExp(`^Error: openrouter_http_${status}$`));
  assert.equal(calls,1);
 }
 const paid=mock({...model,pricing:{prompt:'0',completion:'1'}});
 await assert.rejects(createSpeechProvider({env,...paid})('',{checkOnly:true}),/no_model_within_cost_limit/);
 assert.equal(paid.calls.length,1);
});
test('unknown, malformed and paid prices never synthesize',async()=>{
 for(const pricing of [undefined,{}, {prompt:'0',completion:'0.1'}, {prompt:'NaN',completion:'0'}, {prompt:'0',completion:'0',audio:'1'}, {prompt:null,completion:'0'}, {prompt:'-1',completion:'0'}]){
  const api=mock({...model,pricing});
  await assert.rejects(createSpeechProvider({env,...api})('Текст'),/no_model_within_cost_limit/);
  assert.equal(api.calls.length,1);
 }
});
test('provider failure is secret-free and leaves text delivered first',async()=>{
 const api=mock(model,503),events=[];
 const result=await deliverSpeech('Текст',{synthesize:createSpeechProvider({env,...api}),sendText:async t=>events.push(t),sendAudio:async()=>events.push('audio')});
 assert.deepEqual(events,['Текст']);assert.deepEqual(result,{ok:false,error:'openrouter_http_503'});
});
test('audio delivery failure preserves text',async()=>{
 const events=[];
 const result=await deliverSpeech('Текст',{synthesize:async()=>Buffer.from('mp3'),sendText:async t=>events.push(t),sendAudio:async()=>{throw Error('test-secret');}});
 assert.deepEqual(events,['Текст']);assert.equal(result.error,'audio_delivery_failed');
});
test('cleanup removes markup and paths and bounds Unicode text',()=>{
 assert.equal(cleanSpeech('# Привет **мир** [сцена](D:/local/file) `D:\\private\\file.mp4` /home/private/file projects/test/video.mp4\n```js\nsecret\n```'),'Привет мир сцена');
 assert.equal([...cleanSpeech('я'.repeat(13000))].length,12000);
});
test('disabled voice makes no API call',async()=>{
 const api=mock();await assert.rejects(createSpeechProvider({env:{...env,OWNER_VOICE_ENABLED:'false'},...api})('Текст'),/disabled/);assert.equal(api.calls.length,0);
});
test('oversized audio and invalid types are rejected',async()=>{
 for(const [body,type,error] of [[Buffer.alloc(10*1024*1024+1),'audio/mpeg','too_large'],['{}','application/json','unsupported_audio'],['','audio/mpeg','empty_audio']]){
  const fetchImpl=async url=>url.includes('/models?')?Response.json({data:[model]}):new Response(body,{headers:{'content-type':type}});
  await assert.rejects(createSpeechProvider({env,fetchImpl})('Текст'),new RegExp(error));
 }
});
