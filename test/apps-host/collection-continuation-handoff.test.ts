import {HallmarkClient} from '../../packages/hallmark-adapter/index.ts';
import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {AppsClient} from '../../packages/app-sdk/src/index.ts';
import {catalog as generatedCatalog,call24,call38,type Input38} from '../../packages/app-sdk/src/generated.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort,HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import type {NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';
import type {JsonValue,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import {compileSchema,compileCapability,canonicalJson} from '../../packages/app-contracts/src/index.ts';

const reports:unknown[]=[],bytes=(value:unknown)=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value)),hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
after(()=>{if(process.env.APPS_COLLECTION_BATCH_REPORT)writeFileSync(process.env.APPS_COLLECTION_BATCH_REPORT,JSON.stringify(reports,null,2)+'\n');});
const details=['cup-a','cup-b','cup-c'].map((id,i)=>({id,source:'taobao_tmall',title:['不锈钢保温杯','陶瓷马克杯','玻璃水杯'][i],currency:'CNY',attributes:{材质:['不锈钢','陶瓷','玻璃'][i],用途:'日常饮水'},package:{weightKg:.33,dimensionsCm:[25,10,10]},description:'杯口圆润，适合日常饮水。请按所选颜色区分规格，包装内包含杯体和配套杯盖。清洁后晾干收纳，避免与尖锐物品碰撞。',skus:['red','blue','white'].map((color,n)=>({sourceSkuId:`${id}-${color}`,spec:`颜色:${['红','蓝','白'][n]}`,properties:{颜色:['红','蓝','白'][n]},goodsPrice:12+n,currency:'CNY'}))}));
async function fixture(sourceDetails=details){
 let respond:((storeId:string,input:any)=>any)|undefined,attributes:any[]=[{id:85,dictionary_id:9,is_required:true,name:'Synthetic material'}];
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'fixture'),tools=new Map<string,NativeGatewayTool>(),agent={id:'collection-owner'},events:any[]=[],sourceReads:string[]=[],unexpected:string[]=[];let providerCalls=0,sequence=0;
 const forbidden=(name:string)=>async()=>{unexpected.push(name);throw Error(`Unexpected ${name}`);};
 const client:CoreClient={getStores:async()=>({status:'ok',raw:[{id:'legacy',name:'Legacy'}]}),getStoreProducts:forbidden('products'),syncStoreProducts:forbidden('sync'),getTargetMargin:forbidden('margin'),searchCollectedItems:forbidden('search'),getCollectedItem:forbidden('raw'),getCollectedItemDetail:async id=>{sourceReads.push(id);const detail=sourceDetails.find(item=>item.id===id);assert.ok(detail);return {status:'ok',raw:structuredClone(detail)};},platformCall:forbidden('write'),platformRead:forbidden('platform-read')};
 const broker:CoreBroker={getStoreTask:forbidden('store-task'),getListingTask:forbidden('listing-task'),requestId:()=>{throw Error('Unexpected requestId');}};
 const categoryCalls:any[]=[],legacyCalls:any[]=[];client.getCategoryData=async input=>{legacyCalls.push(input);return {status:'ok',raw:{storeId:input.storeId,values:[{id:11,value:'Legacy value'}],complete:false,stale:true}};};
 const gateway:any={listStores:()=>[{id:'shop',name:'Synthetic shop',enabled:true}],hasStore:(id:string)=>id==='shop',getStore:()=>({id:'shop'}),getProducts:async()=>({status:'ok',raw:{response:{items:[]}}}),request:async(storeId:string,input:any)=>{
  assert.ok(['/v1/description-category/attribute','/v1/description-category/attribute/values','/v1/description-category/attribute/values/search'].includes(input.path),input.path);
  categoryCalls.push({storeId,...input});if(respond)return respond(storeId,input);
  return {status:'ok',raw:{response:input.path.endsWith('/values')?{has_next:input.body.last_value_id===0,result:input.body.last_value_id===0?[{id:11,value:'First-page value'}]:[{id:22,value:'Required second-page value'}]}:{result:attributes}}};
 }};
 const provider=new HallmarkProvider({store:port,client,broker,businessGateway:()=>gateway}),original=provider.execute.bind(provider);provider.execute=async context=>{providerCalls++;return original(context);};runtime.register(provider);
 runtime.addConnection({appId:'hallmark',connectionId:'fixture',displayName:'Fixture',config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'fixture',enabled:true,boundAt:new Date().toISOString()});
 const token=randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address==='object');
 const base=`http://127.0.0.1:${address.port}`,transport=new HttpAppsHostTransport(base,token,async(input,init)=>{assert.equal(new URL(String(input)).origin,base);return fetch(input,init);}),host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
 await host.start();host.attachApp('hallmark');
 const call=async(capabilityId:string,input:JsonValue)=>{const index=++sequence,args={appId:'hallmark',connectionId:'fixture',capabilityId,capabilityVersion:'1.0.0',input,invocationId:`collection-call-${index}`,traceId:`collection-trace-${index}`},tool=tools.get('apps_invoke')!,raw=await tool.execute(args,{agent,signal:new AbortController().signal,callId:`native-${index}`}),rendered=tool.output.render(args,raw).map(item=>item.text).join(''),model=JSON.parse(rendered);assert.ok(bytes(rendered)<=16384);events.push({args,model,rendered,modelBytes:bytes(rendered)});return model;};
 const describe=async(capabilityId:string)=>{const args={capabilityId},tool=tools.get('apps_describe')!,value=await tool.execute(args,{agent,signal:new AbortController().signal,callId:'describe'});return JSON.parse(tool.output.render(args,value).map(item=>item.text).join(''));};
 return {store,runtime,provider,call,describe,events,sourceReads,unexpected,categoryCalls,legacyCalls,transport,gateway,setResponse:(fn:typeof respond)=>{respond=fn;},setAttributes:(value:any[])=>{attributes=value;},providerCalls:()=>providerCalls,async close(){await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}};
}

const broken=process.env.EXPECT_BROKEN==='1';
for(const budget of [2500,3000,4096])test(`batch capability handoff preserves exact selected product and SKU scope at ${budget} bytes`,async()=>{
 const f=await fixture();try{
  const selections=details.map(d=>({id:d.id,skuIds:[d.skus[1].sourceSkuId]}));
  let page=await f.call('hallmark.collection.read',{selections,maxBytes:budget}),seen:any[]=[],pages=0,failures=0;
  for(;;){
   assert.equal(page.status,'ok',JSON.stringify(page));seen.push(...page.data.items);pages++;
   assert.ok(pages<10);const next=page.data.continuation;if(!next)break;
   const descriptor=HALLMARK_DESCRIPTORS.find(d=>d.capabilityId===next.capability);
   if(!broken){assert.ok(descriptor,next.capability);assert.deepEqual(compileCapability(descriptor).input(next.input),[]);}
   page=await f.call(next.capability,next.input);
   if(broken){assert.equal(page.status,'failed');assert.equal(page.error.code,'CAPABILITY_NOT_FOUND');failures++;page=await f.call('hallmark.collection.read',next.input);}
  }
  assert.ok(pages>1);assert.deepEqual(seen.map(x=>x.id),details.map(x=>x.id));
  assert.deepEqual(seen.flatMap(x=>x.skus.rows.map((r:any[])=>r[0])),details.map(d=>d.skus[1].sourceSkuId));
  assert.equal(new Set(seen.map(x=>x.id)).size,3);assert.deepEqual(f.unexpected,[]);assert.equal(f.store.list('operations').length,0);
  reports.push({case:`batch-${budget}`,arm:broken?'baseline-recovery':'candidate',pages,failures,calls:f.events.length,modelBytes:f.events.reduce((n,e)=>n+e.modelBytes,0),seen,events:f.events});
 }finally{await f.close();}
});
test('single complete page stays unchanged and invalid selections are never approximated',async()=>{
 const f=await fixture();try{
  const good=await f.call('hallmark.collection.read',{id:'cup-a'});assert.equal(good.status,'ok');assert.equal(good.data.continuation,null);assert.equal(good.data.items[0].skus.rows.length,3);
  const bad=await f.call('hallmark.collection.read',{selections:[{id:'cup-a',skuIds:['unknown-red']}],maxBytes:2048});assert.equal(bad.status,'failed');assert.equal(bad.error.code,'COLLECTION_SKU_NOT_FOUND');
  const invalid=await f.call('hallmark.collection.read',{cursor:'batch:nonexistent',maxBytes:2048});assert.equal(invalid.status,'failed');assert.equal(invalid.error.code,'COLLECTION_CURSOR_INVALID');
  reports.push({case:'negative-controls',events:f.events});
 }finally{await f.close();}
});

test('opaque identifiers and pinned revisions survive every emitted continuation',async()=>{
 const opaque=details.map((d,i)=>({...d,id:['gift:红/01','零-00042','punct.~/_'][i],skus:d.skus.map((sku,j)=>({...sku,sourceSkuId:`exact/${i}:蓝-${j}`}))}));
 const f=await fixture(opaque);try{
  const revisions=new Map<string,string>();for(const d of opaque){const r=await f.call('hallmark.collection.read',{id:d.id});assert.equal(r.status,'ok');revisions.set(d.id,r.data.items[0].revision);}
  const selected=opaque.map(d=>({id:d.id,skuIds:[d.skus[2].sourceSkuId],revision:revisions.get(d.id)!}));
  let page=await f.call('hallmark.collection.read',{selections:selected,maxBytes:3000});const seen:any[]=[];
  for(let n=0;;n++){assert.ok(n<10);assert.equal(page.status,'ok');seen.push(...page.data.items);const c=page.data.continuation;if(!c)break;page=await f.call(broken?'hallmark.collection.read':c.capability,c.input);}
  assert.deepEqual(seen.map(x=>({id:x.id,revision:x.revision,skuIds:x.skus.rows.map((r:any[])=>r[0])})),selected.map(x=>({id:x.id,revision:x.revision,skuIds:x.skuIds})));
  const stale=await f.call('hallmark.collection.read',{id:opaque[0].id,revision:'known-stale-version'});assert.equal(stale.error.code,'COLLECTION_REVISION_CHANGED');reports.push({case:'opaque-revision-controls',events:f.events});
 }finally{await f.close();}
});
