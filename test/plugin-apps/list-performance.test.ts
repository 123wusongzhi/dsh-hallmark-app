import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('session index and summary queries keep unrelated views and history out of list reads',()=>{
 const store=new RuntimeStore(':memory:');
 try{
  store.transaction(()=>{for(let i=0;i<3000;i++)store.put('views',String(i),{viewId:String(i),ownerSessionId:'session-'+(i%100),design:{text:'x'.repeat(2000)}});
   for(let i=0;i<30;i++){const componentId='c'+i;store.put('components',componentId,{componentId,title:componentId,revision:30,savedAt:'today',view:{text:'x'.repeat(2000)}});for(let revision=1;revision<=30;revision++)store.put('component_versions',componentId+':'+revision,{componentId,title:componentId,revision,savedAt:'today',view:{text:'x'.repeat(2000)}});}});
  const start=performance.now(),old=store.list<any>('views').filter(v=>v.ownerSessionId==='session-1'),oldMs=performance.now()-start;
  const next=performance.now(),views=store.viewsForSession('session-1'),newMs=performance.now()-next;assert.deepEqual(views,old);assert.equal(views.length,30);
  assert.match(JSON.stringify(store.db.prepare("EXPLAIN QUERY PLAN SELECT value_json FROM views WHERE json_extract(value_json,'$.ownerSessionId')=? ORDER BY created_at,id").all('session-1')),/views_owner/);
  const previous={components:store.list<any>('components').map(c=>({...c,revisions:store.list<any>('component_versions').filter(v=>v.componentId===c.componentId)}))};
  const summary={components:store.componentSummaries()};assert.equal(summary.components.length,30);assert.ok(summary.components.every(c=>!('view' in c)&&!('revisions' in c)));
  const history=store.componentSummaries('c1');assert.equal(history.length,30);assert.ok(history.every(c=>c.componentId==='c1'&&!('view' in c)));assert.equal(history[29].revision,30);
  console.log(JSON.stringify({views:3000,oldMs,newMs,oldBytes:JSON.stringify(previous).length,summaryBytes:JSON.stringify(summary).length}));
 }finally{store.close();}
});

test('same-session watchers share polling, pause while hidden, resume immediately and clean up independently',async()=>{
 const dir=mkdtempSync(resolve('artifacts/poll-sharing-')),entry=join(dir,'test.mjs');
 try{await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import assert from 'node:assert/strict';import {watchOwnedAppsViews} from './packages/plugin-apps/client/native-publication.tsx';
 const events=new EventTarget();globalThis.document={hidden:false,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 let calls=0,version=1;globalThis.fetch=async()=>{calls++;return Response.json({views:[{ownerSessionId:'A',viewId:'v',version}]});};
 const wait=()=>new Promise(r=>setTimeout(r,20));let a=0,b=0;const stopA=watchOwnedAppsViews('A',()=>{a++},()=>true,undefined,100),stopB=watchOwnedAppsViews('A',()=>{b++},()=>true,undefined,100);await wait();assert.equal(calls,1);assert.equal(a,1);assert.equal(b,1);
 document.hidden=true;events.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,150));assert.equal(calls,1);
 document.hidden=false;events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,2);assert.equal(a,1);assert.equal(b,1);
 stopA();version++;events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,3);assert.equal(a,1);assert.equal(b,2);
 stopB();events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,3);
 `},bundle:true,platform:'node',format:'esm',outfile:entry,external:['react']});const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
