import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import type {DataSourceDraft} from '../../packages/app-presentation/src/types.ts';

test('Host UI workbench endpoints preview, persist, reload without session and keep saved library compatible',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),token='test-workbench-token'.repeat(3);let reads=0;
 runtime.register({manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[{capabilityId:'sample.products.list',version:'1.0.0',title:'Products',description:'Products',effect:'query',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]}],execute:async context=>{reads++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:[{id:'p1',title:'杯子',price:1299,currency:'CNY'}],total:1}};},dispose:async()=>{}});
 runtime.addConnection({appId:'sample',connectionId:'shop',displayName:'Shop',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:'s',appId:'sample',connectionId:'shop',enabled:true,boundAt:new Date().toISOString()});
 const presentation=new AppsPresentationService({store,runtime}),server=createAppsServer({runtime,presentation,token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
 const host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>id==='s'?{id}:undefined},sessions:{get:id=>id==='s'?{id}:undefined}},new HttpAppsHostTransport(url,token));await host.start();
 const ui=async(input:unknown)=>host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}));
 try{
  const definition:DataSourceDraft={id:'products',title:'商品',appId:'sample',connectionId:'shop',capabilityId:'sample.products.list',capabilityMajor:1,input:{},parameters:[],fields:[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'title',confirmed:true},{role:'price.current',path:'price',currencyPath:'currency',numericScale:.01,confirmed:true},{role:'price.currency',path:'currency',confirmed:true}],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
  const registered=await presentation.registerDataSource({definition},{kind:'agent',sessionId:'s',nativeCallId:'register'});assert.equal(registered.validation.status,'verified');
  const get=await host.ui(new Request('http://localhost/api/dsh-apps?resource=dataSources&appId=sample'));assert.equal(get.status,200);assert.equal((await get.json()).dataSources[0].title,'商品');
  const instance={instanceId:'one',title:'常用商品',materialId:'product-list',materialVersion:1,design:createMaterialView('product-list'),dataSources:{products:{id:'products',revision:1,params:{}}},position:{order:0,span:2}};
  runtime.bind({sessionId:'s',appId:'sample',connectionId:'shop',enabled:false,boundAt:new Date().toISOString()});
  const preview=await ui({action:'workbench',operation:'preview',appId:'sample',sessionId:'s',params:{instance}});assert.equal(preview.status,200);assert.equal((await preview.json()).data.bindings[0].payload.items[0].title,'杯子');
  assert.equal(presentation.getWorkbench('sample').instances.length,0,'preview must not persist a workbench instance');
  const save=await ui({action:'workbench',operation:'save',appId:'sample',params:{expectedRevision:0,instances:[instance]}});assert.equal(save.status,200);assert.equal((await save.json()).revision,1);
  runtime.bind({sessionId:'s',appId:'sample',connectionId:'shop',enabled:false,boundAt:new Date().toISOString()});
  const read=await ui({action:'workbench',operation:'read',appId:'sample',params:{instanceId:'one'}});assert.equal(read.status,200);assert.equal((await read.json()).data.bindings[0].state,'ready');
  const saved=await host.ui(new Request('http://localhost/api/dsh-apps?resource=saved'));assert.equal(saved.status,200);assert.deepEqual((await saved.json()).assets,[]);
  const stale=await ui({action:'workbench',operation:'save',appId:'sample',params:{expectedRevision:0,instances:[]}});assert.notEqual(stale.status,200);assert.equal(presentation.getWorkbench('sample').instances.length,1);
  assert.ok(reads>=3);
 }finally{host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
