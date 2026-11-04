import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {args,localFile} from './lib.mjs';

const rate=8000;
function decode(path){
 const r=spawnSync(process.env.MOTIONLAB_FFMPEG||'ffmpeg',[
  '-hide_banner','-nostdin','-loglevel','error','-protocol_whitelist','file,pipe',
  '-i',localFile(path),'-t','121','-vn','-ac','1','-ar',String(rate),'-f','f32le','pipe:1'
 ],{maxBuffer:4*1024*1024,timeout:120000,windowsHide:true});
 if(r.error||r.status!==0)throw Error('Audio decode failed: '+(r.error?.message||r.stderr?.toString()||r.status));
 if(!r.stdout.length||r.stdout.length%4||r.stdout.length>rate*120*4)throw Error('Audio must contain 0–120 seconds of samples');
 return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset,r.stdout.byteOffset+r.stdout.length));
}
function energy(samples){
 let sum=0;for(const x of samples)sum+=x*x;
 return Math.sqrt(sum/samples.length);
}
function correlation(a,b){
 let x=0,y=0,xx=0,yy=0,xy=0;
 for(let i=0;i<a.length;i++){x+=a[i];y+=b[i];xx+=a[i]*a[i];yy+=b[i]*b[i];xy+=a[i]*b[i];}
 const n=a.length,den=Math.sqrt(Math.max(0,xx-x*x/n)*Math.max(0,yy-y*y/n));
 return den?(xy-x*y/n)/den:0;
}
export function checkNarration({source,narration,video}){
 const original=decode(source),voice=decode(narration),final=decode(video);
 if(energy(original)<0.0001)throw Error('Original narration is silent');
 const rms=energy(voice);
 if(rms<0.0001)throw Error('Aligned narration is silent');
 let windows=0,minCorrelation=1;
 for(let i=0;i<voice.length;i+=rate){
  const part=voice.subarray(i,i+rate);
  if(energy(part)<Math.max(0.0001,rms*0.1))continue;
  // Allow decoder rounding, but never a truncated spoken interval.
  if(final.length<i+part.length-rate*0.02)throw Error('Final video cuts narration');
  const length=Math.min(part.length,final.length-i);
  const value=correlation(part.subarray(0,length),final.subarray(i,i+length));
  if(value<0.5)throw Error(`Narration missing, masked or misaligned at ${i/rate}s (correlation ${value.toFixed(3)})`);
  windows++;minCorrelation=Math.min(minCorrelation,value);
 }
 if(!windows)throw Error('No non-silent narration intervals');
 return {windows,minCorrelation:Number(minCorrelation.toFixed(4))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const a=args();for(const key of Object.keys(a))if(!['source','narration','video'].includes(key))throw Error(`Unknown option: ${key}`);
  console.log('Narration check passed: '+JSON.stringify(checkNarration(a)));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
