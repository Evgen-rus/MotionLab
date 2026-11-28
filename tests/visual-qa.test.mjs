import {after, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {freshOutput} from '../.agents/skills/motionlab/scripts/lib.mjs';

const root=freshOutput(`projects/Проверка кадров ${Date.now()}-${process.pid}`);
after(()=>rmSync(root,{recursive:true,force:true}));

function audit(name, {html='', seek='', times='0.2,0.8,0.2'}){
 const scene=join(root,`${name}.html`), out=join(root,name);
 writeFileSync(scene,`<!doctype html><html lang="ru"><meta charset="utf-8">
 <style>body{margin:0;background:#234;color:white;font:18px sans-serif}main{position:absolute;inset:0;overflow:hidden}p{margin:0}</style>
 <main>${html}</main><script>
 let turns=0;
 window.__video={duration:1,fps:24,size:[400,240],seek(t){
  document.body.style.background=t<0.5?'#234':'#456';
  ${seek}
 }};
 </script></html>`,{flag:'wx'});
 const rendered=spawnSync(process.execPath,['.agents/skills/motionlab/scripts/render.mjs','--in',scene,'--out',out,'--stills',times,'--qa','yes'],{encoding:'utf8',timeout:45000});
 assert.ifError(rendered.error);
 let report;
 assert.doesNotThrow(()=>report=JSON.parse(readFileSync(join(out,'qa.json'),'utf8')),rendered.stderr);
 return {report,code:rendered.status,out};
}

test('audits repeated seeks and Russian text within the frame, ignoring hidden elements',()=>{
 const {report,code,out}=audit('safe',{html:`
  <p data-qa-safe style="position:absolute;top:60px;left:30px">Менеджер готов к встрече</p>
  <p data-qa-safe style="opacity:0;position:absolute;left:-200px">Скрытый слой</p>`});
 assert.equal(code,0);
 assert.equal(report.status,'passed');
 assert.equal(report.checks.geometry.inspected,3);
 assert.deepEqual(report.checks.determinism.comparisons,[{time:.2,frames:[1,3],identical:true}]);
 assert.notDeepEqual(readFileSync(join(out,'0001.png')),readFileSync(join(out,'0002.png')));
});

test('reports altered repeated frames, text clipping, overlap and a missing resource',()=>{
 const {report,code}=audit('problem',{html:`
  <p data-qa-safe data-qa-disjoint="text" id="answer" style="position:absolute;left:30px;top:60px;width:48px;overflow:hidden;white-space:nowrap">Подтверждённый ответ</p>
  <p data-qa-safe data-qa-disjoint="text" id="contact" style="position:absolute;left:42px;top:62px">Контакт</p>
  <p data-qa-safe id="edge" style="position:absolute;left:0;top:120px">У края</p>
  <img src="missing.png" alt="Материал">`,seek:`document.querySelector('#contact').textContent='Действие '+(++turns);`});
 assert.equal(code,1);
 assert.equal(report.status,'problem');
 assert.equal(report.checks.determinism.status,'problem');
 assert.equal(report.checks.determinism.comparisons[0].identical,false);
 const issues=report.checks.geometry.issues;
 assert.ok(issues.some(issue=>issue.type==='clipped-text' && issue.id==='answer'));
 assert.ok(issues.some(issue=>issue.type==='outside-safe-area' && issue.id==='edge'));
 assert.ok(issues.some(issue=>issue.type==='overlap' && issue.ids.includes('contact')));
 assert.ok(report.checks.resources.issues.some(issue=>issue.url.endsWith('/missing.png')));
});

test('uninspected geometry, absent A-B-A and interrupted capture cannot pass',()=>{
 const absent=audit('absent',{times:'0.2,0.2'});
 assert.equal(absent.code,2);
 assert.equal(absent.report.status,'not-run');
 assert.equal(absent.report.checks.capture.status,'passed');
 assert.equal(absent.report.checks.determinism.status,'not-run');
 assert.equal(absent.report.checks.geometry.status,'not-run');

 const interrupted=audit('interrupted',{html:'<p data-qa-safe style="position:absolute;left:20px;top:30px">Остановка</p>',seek:`if(t>0.5)throw Error('seek interrupted');`});
 assert.equal(interrupted.code,2);
 assert.equal(interrupted.report.status,'not-run');
 assert.equal(interrupted.report.checks.capture.captured,1);
 assert.match(interrupted.report.checks.capture.error,/seek interrupted/);
 assert.equal(interrupted.report.checks.resources.status,'not-run');
});
