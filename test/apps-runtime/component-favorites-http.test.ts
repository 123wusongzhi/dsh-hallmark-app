import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {componentFavorites} from '../../packages/service/src/component-favorites.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';

function setup(store:RuntimeStore){
 const runtime=new AppsRuntime(store);let reads=0;
 runtime.register({manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[{capabilityId:'sample.products.list',version:'1.0.0',title:'Products',description:'Products',effect:'query',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]}],execute:async context=>{reads++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:[]}};},dispose:async()=>{}});
 if(!runtime.getConnection('sample','shop'))runtime.addConnection({appId:'sample',connectionId:'shop',displayName:'Shop',config:{},configRevision:1,enabled:true});
 const presentation=new AppsPresentationService({store,runtime});
 const save=(title:string)=>{
  const view=presentation.createView('A',{title,bindings:[{bindingId:'products',appId:'sample',connectionId:'shop',capabilityId:'sample.products.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
  return presentation.saveComponent('A',view.viewId,'保存组件',{mode:'save_as'});
 };
 return {runtime,presentation,save,favorites:componentFavorites(runtime),reads:()=>reads};
}
async function listen(server:ReturnType<typeof createAppsServer>):Promise<string>{
 for(let attempt=0;attempt<20;attempt++){
  try{await new Promise<void>((accept,reject)=>{const ready=()=>{server.off('error',failed);accept();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};server.once('error',failed);server.once('listening',ready);server.listen(randomInt(20000,65536),'127.0.0.1');});return `http://127.0.0.1:${(server.address() as {port:number}).port}`;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;}
 }
 throw new Error('No fixture port available');
}

test('favorites are explicit profile references, persist across restart and sessions without business reads or source copies',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'apps-favorites-')),path=join(directory,'apps.db');let store=new RuntimeStore(path),fixture=setup(store);
 try{
  const saved=fixture.save('商品采购'),other=fixture.save('未收藏组件');
  fixture.presentation.workbenches.pinComponent('sample',{componentId:other.componentId,revision:other.revision,expectedRevision:0});
  assert.deepEqual(fixture.favorites.list('A'),{sessionId:'A',favorites:[]},'neither saving nor workbench pinning implies a favorite');
  const beforeViews=store.list('views'),beforeComponents=store.list('components');
  const originalList=store.list.bind(store),originalPut=store.put.bind(store);let writes=0;
  store.list=()=>{throw new Error('Favorites must not scan any complete table');};
  store.put=(collection,id,value)=>{if(id==='component-favorites:profile')writes++;return originalPut(collection,id,value);};
  const first=fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true});
  assert.equal(first.favorites.length,1);assert.equal(first.favorites[0].title,'商品采购');assert.equal(first.favorites[0].appId,'sample');assert.equal(first.favorites[0].available,true);assert.equal(first.favorites[0].hasPreview,false);
  assert.deepEqual(fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true}),first);assert.equal(writes,1,'repeated starring never rewrites storage');
  assert.deepEqual(fixture.favorites.list('B'),{sessionId:'B',favorites:first.favorites});
  assert.deepEqual(store.get('saved_assets','component-favorites:profile'),{kind:'component-favorites',items:[{componentId:saved.componentId,createdAt:first.favorites[0].createdAt}]});
  store.list=originalList;store.put=originalPut;
  assert.deepEqual(store.list('views'),beforeViews);assert.deepEqual(store.list('components'),beforeComponents);assert.equal(store.list('session_app_bindings').length,0);assert.equal(store.list('invocations').length,0);assert.equal(fixture.reads(),0);
  await fixture.runtime.dispose();store.close();store=new RuntimeStore(path);fixture=setup(store);
  assert.deepEqual(fixture.favorites.list('B').favorites,first.favorites,'saved favorites survive a Runtime restart');
  const isolatedStore=new RuntimeStore(':memory:'),isolated=setup(isolatedStore);
  try{assert.deepEqual(isolated.favorites.list('A').favorites,[],'another profile has its own favorites');}finally{await isolated.runtime.dispose();isolatedStore.close();}
  assert.deepEqual(fixture.favorites.set({sessionId:'B',componentId:saved.componentId,favorite:false}).favorites,[]);assert.deepEqual(fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:false}).favorites,[]);
  assert.ok(store.get('components',saved.componentId));assert.ok(store.get('component_versions',`${saved.componentId}:1`));assert.equal(fixture.presentation.getWorkbench('sample').savedComponents?.[0].componentId,other.componentId);
 }finally{await fixture.runtime.dispose();store.close();assert.match(resolve(directory),/apps-favorites-[^\\/]+$/);rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('favorites resolve latest metadata, preserve disabled entries and omit deleted components',async()=>{
 const store=new RuntimeStore(':memory:'),fixture=setup(store);
 try{
  const saved=fixture.save('初版');fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true});
  const updated={...saved,title:'新标题',revision:2};store.put('components',saved.componentId,updated);
  assert.equal(fixture.favorites.list('A').favorites[0].title,'新标题');assert.equal(fixture.favorites.list('B').favorites[0].revision,2);
  store.put('components',saved.componentId,{...updated,view:{...updated.view,bindings:[...updated.view.bindings,{...updated.view.bindings[0],bindingId:'other',connectionId:'missing'}]}});
  assert.equal(fixture.favorites.list('A').favorites[0].available,false);
  assert.throws(()=>fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true}),{code:'SAVED_CONNECTION_MISSING'},'all original connections must remain available');
  store.put('components',saved.componentId,updated);
  await fixture.runtime.updateConnection({appId:'sample',connectionId:'shop',expectedConfigRevision:1,enabled:false});
  assert.equal(fixture.favorites.list('A').favorites[0].available,false);
  assert.throws(()=>fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true}),{code:'SAVED_CONNECTION_DISABLED'});
  assert.deepEqual(fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:false}).favorites,[],'unfavorite remains usable for unavailable entries');
  await fixture.runtime.updateConnection({appId:'sample',connectionId:'shop',expectedConfigRevision:2,enabled:true});fixture.favorites.set({sessionId:'B',componentId:saved.componentId,favorite:true});
  store.delete('components',saved.componentId);assert.deepEqual(fixture.favorites.list('A').favorites,[]);assert.throws(()=>fixture.favorites.set({sessionId:'A',componentId:saved.componentId,favorite:true}),{code:'COMPONENT_NOT_FOUND'});
  assert.deepEqual(fixture.favorites.set({sessionId:'B',componentId:saved.componentId,favorite:false}).favorites,[]);assert.equal(fixture.reads(),0);
 }finally{await fixture.runtime.dispose();store.close();}
});

test('Host and Runtime validate favorites, preserve errors and require known sessions without changing bindings',async()=>{
 const store=new RuntimeStore(':memory:'),fixture=setup(store),token='favorites-fixture-token'.repeat(3),server=createAppsServer({...fixture,token});let host:AppsHost|undefined;
 try{
  const saved=fixture.save('收藏组件'),url=await listen(server),transport=new HttpAppsHostTransport(url,token);
  host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>['A','B'].includes(id)?{id}:undefined}},transport);
  const get=(query:Record<string,string>)=>host!.ui(new Request('http://localhost/api/dsh-apps?'+new URLSearchParams({resource:'favorites',...query})));
  const post=(value:Record<string,unknown>)=>host!.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'favorite',sessionId:'A',componentId:saved.componentId,favorite:true,...value})}));
  assert.equal((await fetch(`${url}/v1/favorites?sessionId=A`)).status,401);
  assert.equal((await get({sessionId:'unknown'})).status,400);assert.equal((await get({})).status,400);assert.equal((await get({sessionId:'A',profile:'other'})).status,400);
  assert.equal((await post({sessionId:'unknown'})).status,400);assert.equal((await post({title:'forged'})).status,400);assert.equal((await post({favorite:'true'})).status,400);assert.equal((await post({componentId:'../private'})).status,400);
  const missing=await post({componentId:'missing'});assert.equal(missing.status,404);assert.equal((await missing.json()).error.code,'COMPONENT_NOT_FOUND');
  assert.deepEqual((await (await get({sessionId:'A'})).json()).favorites,[]);
  const added=await post({});assert.equal(added.status,200);const first=await added.json();assert.equal(first.sessionId,'A');assert.equal(first.favorites[0].componentId,saved.componentId);
  const savedLibrary=await host.ui(new Request('http://localhost/api/dsh-apps?resource=saved'));assert.equal((await savedLibrary.json()).assets.length,1,'favorites never leak into the material library assets');
  const second=await get({sessionId:'B'});assert.equal(second.status,200);assert.deepEqual(await second.json(),{sessionId:'B',favorites:first.favorites});
  assert.equal((await post({favorite:false,sessionId:'B'})).status,200);assert.deepEqual((await (await get({sessionId:'A'})).json()).favorites,[]);
  const raw=await fetch(`${url}/v1/favorites`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({sessionId:'A',componentId:saved.componentId,favorite:true,profile:'other'})});assert.equal(raw.status,400);
  assert.equal(store.list('session_app_bindings').length,0);assert.equal(store.list('invocations').length,0);assert.equal(fixture.reads(),0);assert.equal(store.list('components').length,1);
 }finally{await host?.dispose();server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));await fixture.runtime.dispose();store.close();}
});
