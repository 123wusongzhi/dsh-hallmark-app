import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {AppsRuntime} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';

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

test('same-session watchers share polling and notify only changed session snapshots, pause while hidden and clean up independently',async()=>{
 const dir=mkdtempSync(resolve('artifacts/poll-sharing-')),entry=join(dir,'test.mjs');
 try{await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import assert from 'node:assert/strict';import {watchOwnedAppsViews} from './packages/plugin-apps/client/native-publication.tsx';
 const events=new EventTarget();globalThis.document={hidden:false,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 const changes=[];globalThis.window=new EventTarget();window.addEventListener('hallmark-view-updated',event=>changes.push(event.detail));
 let calls=0,version=1;globalThis.fetch=async url=>{calls++;const sessionId=new URL(url,'http://fixture').searchParams.get('sessionId');return Response.json({views:[{ownerSessionId:sessionId,viewId:'v'},...(version>1?[{ownerSessionId:sessionId,viewId:'new-draft',version}]:[])]});};
 const wait=()=>new Promise(r=>setTimeout(r,20));let a=0,b=0;const stopA=watchOwnedAppsViews('A',()=>{a++},()=>true,undefined,100),stopB=watchOwnedAppsViews('A',()=>{b++},()=>true,undefined,100);await wait();assert.equal(calls,1);assert.equal(a,1);assert.equal(b,1);
 assert.deepEqual(changes,[]);
 document.hidden=true;events.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,150));assert.equal(calls,1);
 document.hidden=false;events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,2);assert.equal(a,1);assert.equal(b,1);
 assert.deepEqual(changes,[]);
 stopA();version++;events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,3);assert.equal(a,1);assert.equal(b,2);assert.deepEqual(changes,[{sessionId:'A'}]);
 events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,4);assert.deepEqual(changes,[{sessionId:'A'}]);
 stopB();events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,4);
 const stopOther=watchOwnedAppsViews('B',()=>{},()=>true,undefined,100);await wait();assert.equal(calls,5);assert.deepEqual(changes,[{sessionId:'A'}]);version++;events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(calls,6);assert.deepEqual(changes,[{sessionId:'A'},{sessionId:'B'}]);stopOther();
 `},bundle:true,platform:'node',format:'esm',outfile:entry,external:['react']});const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('confirmed panel close and restore outlive older catalogue reads and closed publications never auto-open',async()=>{
 const root=resolve('artifacts'),dir=mkdtempSync(join(root,'panel-poll-state-')),entry=join(dir,'test.mjs');
 try{await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import assert from 'node:assert/strict';import {watchOwnedAppsViews,updateOwnedAppsView,readOwnedPendingPublication} from './packages/plugin-apps/client/native-publication.tsx';
 const events=new EventTarget();globalThis.document={hidden:false,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};globalThis.window=new EventTarget();
 const opened={ownerSessionId:'A',viewId:'v',title:'同名组件',pendingPublicationId:'P',panelState:'open'},closed={...opened,panelState:'closed',closedAt:'2026-10-09T00:00:00Z'};
 let held,reads=0;globalThis.fetch=async()=>{reads++;if(reads===1)return Response.json({views:[opened]});return new Promise(resolve=>held=resolve);};
 const wait=()=>new Promise(resolve=>setTimeout(resolve,10));let first,other,reentered;const stop=watchOwnedAppsViews('A',views=>first=views,()=>true,undefined,10000),stopOther=watchOwnedAppsViews('A',views=>other=views,()=>true,undefined,10000);await wait();
 events.dispatchEvent(new Event('visibilitychange'));await wait();assert.equal(reads,2);updateOwnedAppsView(closed);assert.equal(first[0].panelState,'closed');assert.equal(other[0].panelState,'closed');held(Response.json({views:[opened]}));await wait();assert.equal(first[0].panelState,'closed','an in-flight old list cannot reopen a confirmed closed panel');
 stop();const stopReentered=watchOwnedAppsViews('A',views=>reentered=views,()=>true,undefined,10000);await wait();assert.equal(reentered[0].panelState,'closed','a remount reuses the updated shared catalogue');
 events.dispatchEvent(new Event('visibilitychange'));await wait();updateOwnedAppsView(opened);held(Response.json({views:[closed]}));await wait();assert.equal(reentered[0].panelState,'open','an old closed list cannot undo explicit restoration');
 const before=reads;assert.equal(await readOwnedPendingPublication('A',closed,new AbortController().signal),undefined);assert.equal(reads,before,'closed pending publications must not be discovered or mounted');
 stopOther();stopReentered();globalThis.fetch=async()=>Response.json(closed);assert.equal(await readOwnedPendingPublication('A',opened,new AbortController().signal),undefined,'a view closed during publication inspection stays closed');
 `},bundle:true,platform:'node',format:'esm',outfile:entry,external:['react']});const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);
 }finally{assert.ok(resolve(dir).startsWith(root+sep+'panel-poll-state-'));rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('fixed historical revisions and mounted publications read their indexed snapshot without scanning provider records',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),presentation=new AppsPresentationService({store,runtime});
 const base=presentation.createView('A',{title:'Initial'}),source={buildId:'old-build',directory:'/fixture',entry:'index.html',files:['index.html']},historical={...base,title:'Original revision',viewRevision:2,source};
 const recordId='view-revision:'+canonicalJson(['A',base.viewId,2]);
 store.put('provider_records',recordId,{namespace:'view_revisions',value:historical});
 store.put('views',base.viewId,{...historical,title:'Current revision',viewRevision:3,source:{...source,buildId:'current-build'}});
 store.put('view_publications','P1',{publicationId:'P1',ownerSessionId:'A',viewId:base.viewId,state:'mounted',committedViewRevision:2,candidateBuildId:source.buildId});
 const server=createAppsServer({runtime,presentation,token:'t'.repeat(64)});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const get=async(query:Record<string,string>)=>{const response=await fetch(origin+'/v1/views/'+base.viewId+'?'+new URLSearchParams({sessionId:'A',...query}),{headers:{authorization:'Bearer '+'t'.repeat(64)}});return {status:response.status,value:await response.json()};};
 const originalList=store.list.bind(store);let providerScans=0;
 store.list=<T>(collection:string):T[]=>{if(collection==='provider_records')providerScans++;return originalList<T>(collection);};
 try{
  const accepted:Record<string,string>[]=[{viewRevision:'2'},{viewRevision:'2',buildId:'old-build'},{publicationId:'P1'},{publicationId:'P1',viewRevision:'2',buildId:'old-build'}];
  for(const query of accepted){const result=await get(query);assert.equal(result.status,200);assert.equal(result.value.title,historical.title);assert.equal(result.value.viewRevision,2);assert.equal(result.value.source.buildId,'old-build');}
  const rejected:Record<string,string>[]=[{viewRevision:'2',buildId:'wrong-build'},{viewRevision:'1'},{publicationId:'P1',buildId:'wrong-build'},{publicationId:'P1',viewRevision:'3'},{sessionId:'B',viewRevision:'2'},{sessionId:'B',publicationId:'P1'}];
  for(const query of rejected)assert.notEqual((await get(query)).status,200);
  const current=await get({viewRevision:'3',buildId:'current-build'});assert.equal(current.status,200);assert.equal(current.value.title,'Current revision');assert.equal(providerScans,0);
  const byBuild=await get({buildId:'old-build'});assert.equal(byBuild.status,200);assert.equal(byBuild.value.title,historical.title);assert.equal(providerScans,1);
 }finally{store.list=originalList;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
