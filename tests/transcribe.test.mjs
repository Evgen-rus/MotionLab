import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chunkRanges,createTranscriber,transcribeRecording} from '../.agents/skills/motionlab/scripts/transcribe.mjs';

test('recordings are split with overlap and bounded duration',()=>{
 assert.deepEqual(chunkRanges(120),[{start:0,end:60},{start:55,end:115},{start:110,end:120}]);
 assert.deepEqual(chunkRanges(60),[{start:0,end:60}]);
 for(const value of [0,NaN,3601]) assert.throws(()=>chunkRanges(value),/invalid_duration/);
});

test('checks access then sends audio with model and language',async()=>{
 const calls=[];
 const api=createTranscriber({env:{OPENAI_API_KEY:'test-secret',TRANSCRIPTION_MODEL:'gpt-transcribe'},fetchImpl:async(url,options)=>{
  calls.push({url,options}); return Response.json(url.endsWith('/gpt-transcribe')?{id:'gpt-transcribe'}:{text:' Привет '});
 }});
 await api.check();
 const result=await transcribeRecording({file:'local',duration:61,api,decode:()=>Buffer.from('wav')});
 assert.deepEqual(result,[{start:0,end:60,text:'Привет'},{start:55,end:61,text:'Привет'}]);
 assert.equal(calls.length,3);
 assert.equal(calls[1].options.body.get('model'),'gpt-transcribe');
 assert.equal(calls[1].options.body.get('languages[]'),'ru');
 assert.equal(calls[1].options.body.get('file').name,'audio.wav');
});

test('errors do not expose provider content or a secret',async()=>{
 const api=createTranscriber({env:{OPENAI_API_KEY:'test-secret'},fetchImpl:async()=>new Response('test-secret',{status:401})});
 await assert.rejects(api.check(),/^Error: openai_http_401$/);
 await assert.rejects(transcribeRecording({file:'local',duration:20,api:{transcribe:async()=>''},decode:()=>Buffer.from('')}),/empty_transcript/);
});
