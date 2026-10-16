import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {createServer,get} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {AppsView} from '../../packages/app-presentation/src/types.ts';
import type {AuthoringDraft} from '../../packages/app-presentation/src/authoring-types.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';

async function listen(server:ReturnType<typeof createAppsServer>):Promise<string>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((accept,reject)=>{const ready=()=>{server.off('error',failed);accept();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};server.once('error',failed);server.once('listening',ready);server.listen(randomInt(20000,65536),'127.0.0.1');});
      return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No fixture port available');
}
function portFixture(t:{after:(fn:()=>Promise<void>)=>void}){
  const server=createServer((_request,response)=>response.end('fixture-ready'));
  t.after(async()=>{server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));});
  return server;
}
const readFixture=(url:string)=>new Promise<{status:number|undefined;body:string}>((accept,reject)=>{get(url,response=>{let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('error',reject);response.on('end',()=>accept({status:response.statusCode,body}));}).on('error',reject);});

test('directory fixture retries denied ports and reaches real HTTP without retaining attempt listeners',async t=>{
  const server=portFixture(t),nativeListen=server.listen.bind(server),observed:Error[]=[];
  server.on('error',error=>observed.push(error));
  const events=['error','listening'] as const,before=events.map(event=>server.listeners(event)),attemptListeners:Array<{event:typeof events[number];listener:Function}>=[];
  let attempts=0;
  Object.defineProperty(server,'listen',{value:(port:number,host:string)=>{
    assert.ok(Number.isInteger(port)&&port>=20000&&port<=65535);assert.equal(host,'127.0.0.1');attempts++;
    for(const [index,event]of events.entries())for(const listener of server.listeners(event))if(!before[index].includes(listener))attemptListeners.push({event,listener});
    if(attempts<=2)queueMicrotask(()=>server.emit('error',Object.assign(new Error('Controlled local port denial'),{code:'EACCES'})));
    else nativeListen(0,'127.0.0.1');
    return server;
  }});
  const url=await listen(server);assert.equal(attempts,3);assert.equal(observed.length,2);
  assert.deepEqual(await readFixture(url),{status:200,body:'fixture-ready'});
  for(const {event,listener}of attemptListeners)assert.equal(server.listeners(event).includes(listener as (...args:unknown[])=>void),false,'retired attempt listener must be removed');
  for(const [index,event]of events.entries())for(const listener of before[index])assert.ok(server.listeners(event).includes(listener),'existing server listeners remain');
});

for(const code of['EACCES','EADDRINUSE'])test(`directory fixture fails after twenty ${code} attempts`,async t=>{
  const server=portFixture(t),before={error:server.listeners('error'),listening:server.listeners('listening')};let attempts=0;
  Object.defineProperty(server,'listen',{value:()=>{attempts++;queueMicrotask(()=>server.emit('error',Object.assign(new Error('Controlled unavailable port'),{code})));return server;}});
  await assert.rejects(listen(server),/^Error: No fixture port available$/);assert.equal(attempts,20);assert.equal(server.listening,false);
  assert.deepEqual(server.listeners('error'),before.error);assert.deepEqual(server.listeners('listening'),before.listening);
});

test('directory fixture propagates unrelated listen errors immediately',async t=>{
  const server=portFixture(t),error=Object.assign(new Error('Controlled non-port failure'),{code:'EIO'}),before={error:server.listeners('error'),listening:server.listeners('listening')};let attempts=0;
  Object.defineProperty(server,'listen',{value:()=>{attempts++;queueMicrotask(()=>server.emit('error',error));return server;}});
  await assert.rejects(listen(server),cause=>cause===error);assert.equal(attempts,1);assert.equal(server.listening,false);
  assert.deepEqual(server.listeners('error'),before.error);assert.deepEqual(server.listeners('listening'),before.listening);
});

test('directory fixture still retries a genuinely occupied loopback port',async t=>{
  const occupied=portFixture(t);await new Promise<void>((accept,reject)=>{const ready=()=>{occupied.off('error',reject);accept();};occupied.once('error',reject);occupied.once('listening',ready);occupied.listen(0,'127.0.0.1');});
  const occupiedPort=(occupied.address() as {port:number}).port,server=portFixture(t),nativeListen=server.listen.bind(server),errors:NodeJS.ErrnoException[]=[];let attempts=0;
  server.on('error',error=>errors.push(error));
  Object.defineProperty(server,'listen',{value:()=>{attempts++;nativeListen(attempts===1?occupiedPort:0,'127.0.0.1');return server;}});
  const url=await listen(server);assert.equal(attempts,2);assert.equal(errors[0]?.code,'EADDRINUSE');assert.equal(occupied.listening,true);
  assert.deepEqual(await readFixture(url),{status:200,body:'fixture-ready'});
});

async function fixture(t:{after:(fn:()=>Promise<void>)=>void}){
  const directory=mkdtempSync(join(tmpdir(),'directory-draft-etag-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'sources')),presentation=new AppsPresentationService({store,runtime,sources}),token='directory-draft-etag-token'.repeat(3),server=createAppsServer({runtime,presentation,token});
  let clock=Date.parse('2026-10-10T00:00:00Z');const authoring=presentation.configureAuthoring({clock:()=>new Date(clock+=1000)});
  t.after(async()=>{server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();assert.match(resolve(directory),/directory-draft-etag-[^\\/]+$/);rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
  const url=await listen(server),headers={Authorization:`Bearer ${token}`};
  const get=(etag?:string,sessionId='A',bearer=token)=>fetch(`${url}/v1/views?sessionId=${sessionId}`,{headers:{Authorization:`Bearer ${bearer}`,...(etag?{'If-None-Match':etag}:{})}});
  const post=(path:string,value:unknown)=>fetch(url+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(value)});
  return {directory,store,runtime,sources,presentation,authoring,url,headers,get,post};
}

test('real HTTP directory invalidates for draft-only building and preview_failed while idle reads parse neither collection',async t=>{
  const f=await fixture(t),project=join(f.directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<h1>previous confirmed build</h1>');
  const original=f.presentation.openSource('A',project,{title:'Confirmed component'}),buildId=original.source!.buildId;
  f.store.put('views',original.viewId,{...original,activeBuildId:buildId,lastGoodBuildId:buildId,validationStatus:'verified'});
  const edit=f.authoring.begin('A',{mode:'edit',viewId:original.viewId}),legacy=f.presentation.createView('A',{title:'Legacy view'}),closed=f.presentation.createView('A',{title:'Closed work'}),foreign=f.authoring.begin('B',{mode:'new',title:'Foreign work'});
  f.store.put('views',closed.viewId,{...closed,panelState:'closed',closedAt:'2026-10-10T00:00:00Z'});
  const storedView=f.store.get<AppsView>('views',original.viewId),viewsVersion=f.store.collectionVersion('views');
  let viewReads=0,draftReads=0;const readViews=f.store.viewsForSession.bind(f.store),readDrafts=f.store.authoringDraftSummaries.bind(f.store);
  f.store.viewsForSession=<T>(sessionId:string)=>{viewReads++;return readViews<T>(sessionId);};f.store.authoringDraftSummaries=sessionId=>{draftReads++;return readDrafts(sessionId);};
  const first=await f.get();assert.equal(first.status,200);const etag=first.headers.get('ETag')!;assert.ok(etag);
  const initial=(await first.json()).views as AppsView[];assert.equal(initial.find(view=>view.viewId===original.viewId)!.authoringState,'editing');assert.deepEqual(initial.find(view=>view.viewId===legacy.viewId),legacy);assert.equal(initial.find(view=>view.viewId===closed.viewId)!.panelState,'closed');assert.equal(initial.some(view=>view.viewId===foreign.view.viewId),false);
  for(let i=0;i<10;i++){const idle=await f.get(etag);assert.equal(idle.status,304);assert.equal(await idle.text(),'');}assert.equal(viewReads,1);assert.equal(draftReads,1);

  const building=await f.post('/v1/authoring/markBuilding',{sessionId:'A',params:{attemptId:edit.attempt.attemptId,epoch:edit.attempt.epoch}});assert.equal(building.status,200,await building.clone().text());
  assert.equal(f.store.collectionVersion('views'),viewsVersion,'markBuilding changes only authoring state, not the confirmed view');
  const changed=await f.get(etag);assert.equal(changed.status,200);const buildingTag=changed.headers.get('ETag')!;assert.notEqual(buildingTag,etag);
  const buildingView=((await changed.json()).views as AppsView[]).find(view=>view.viewId===original.viewId)!;assert.equal(buildingView.authoringState,'building');assert.equal(buildingView.activeBuildId,buildId);assert.equal(buildingView.source!.buildId,buildId);assert.equal(buildingView.validationStatus,'verified');assert.equal(buildingView.authoringEpoch,edit.draft.epoch);
  assert.equal((await f.get(buildingTag)).status,304);assert.equal(viewReads,2);assert.equal(draftReads,2);

  // Isolate the directory's dependency: only the persisted draft projection changes here.
  const draft=f.store.get<AuthoringDraft>('authoring_drafts',edit.draft.draftId)!;const failed={...draft,status:'preview_failed' as const,updatedAt:'2026-10-10T00:01:00Z'};f.store.put('authoring_drafts',draft.draftId,failed);
  assert.equal(f.store.collectionVersion('views'),viewsVersion);
  const preview=await f.get(buildingTag);assert.equal(preview.status,200);const previewTag=preview.headers.get('ETag')!;assert.notEqual(previewTag,buildingTag);
  const failedView=((await preview.json()).views as AppsView[]).find(view=>view.viewId===original.viewId)!;assert.equal(failedView.authoringState,'preview_failed');assert.equal(failedView.authoringUpdatedAt,failed.updatedAt);assert.equal(failedView.authoringEpoch,failed.epoch);assert.equal(failedView.activeBuildId,buildId);assert.equal(failedView.lastGoodBuildId,buildId);assert.equal(failedView.validationStatus,'verified');
  assert.equal((await f.get(previewTag)).status,304);assert.equal(viewReads,3);assert.equal(draftReads,3);
  assert.deepEqual(f.store.get('views',original.viewId),storedView,'directory metadata must never mutate the stored confirmed view');assert.equal(Object.hasOwn(storedView!,'authoringState'),false);
  const other=await f.get(previewTag,'B');assert.equal(other.status,200);assert.deepEqual(((await other.json()).views as AppsView[]).map(view=>view.viewId),[foreign.view.viewId]);
  assert.equal((await f.get(previewTag,'A','invalid-token')).status,401);assert.equal(f.store.list('invocations').length,0);
});

test('favorites keep profile reference semantics and do not invalidate unchanged directory collections',async t=>{
  const f=await fixture(t),view=f.presentation.createView('A',{title:'Saved static view'}),saved=f.presentation.saveComponent('A',view.viewId,'Save component',{mode:'save_as'});
  const first=await f.get(),etag=first.headers.get('ETag')!;assert.equal(first.status,200);const beforeViews=f.store.list('views'),beforeComponents=f.store.list('components');
  const starred=await f.post('/v1/favorites',{sessionId:'A',componentId:saved.componentId,favorite:true});assert.equal(starred.status,200);const favorites=await starred.json();assert.equal(favorites.favorites[0].componentId,saved.componentId);assert.equal(favorites.favorites[0].title,saved.title);
  const other=await fetch(f.url+'/v1/favorites?sessionId=B',{headers:f.headers});assert.equal(other.status,200);assert.deepEqual(await other.json(),{sessionId:'B',favorites:favorites.favorites});
  const idle=await f.get(etag);assert.equal(idle.status,304);assert.equal(await idle.text(),'');
  const removed=await f.post('/v1/favorites',{sessionId:'B',componentId:saved.componentId,favorite:false});assert.equal(removed.status,200);assert.deepEqual((await removed.json()).favorites,[]);assert.equal((await f.get(etag)).status,304);
  assert.deepEqual(f.store.list('views'),beforeViews);assert.deepEqual(f.store.list('components'),beforeComponents);assert.equal(f.store.list('session_app_bindings').length,0);assert.equal(f.store.list('invocations').length,0);
});
