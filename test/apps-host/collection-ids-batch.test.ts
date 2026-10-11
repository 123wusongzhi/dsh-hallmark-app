import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import type {NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

const reports:unknown[]=[],bytes=(value:unknown)=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value));
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
 return {store,runtime,provider,call,describe,events,sourceReads,unexpected,categoryCalls,legacyCalls,transport,gateway,setResponse:(fn:typeof respond)=>{respond=fn;},setAttributes:(value:any[])=>{attributes=value;},providerCalls:()=>providerCalls,async close(){reports.push({case:"fixture-public-transcript",events,sourceReads,unexpected});await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}};
}

test('ids batch persists omitted selection fields and completes in order',async()=>{
 const f=await fixture();try{
 const input={ids:details.map(d=>d.id),maxBytes:2500};
 let page=await f.call('hallmark.collection.read',input);const seen:string[]=[];
 for(let n=0;;n++){assert.ok(n<10);assert.equal(page.status,'ok',JSON.stringify(page));seen.push(...page.data.items.map((x:any)=>x.id));const c=page.data.continuation;if(!c)break;
 // Both arms explicitly correct the separate, known old capability name; no credit for that fix.
 assert.equal(c.capability,'hallmark.collection.read');page=await f.call(c.capability,c.input);}
 assert.deepEqual(seen,input.ids);assert.ok(f.events.length>1);assert.deepEqual(f.unexpected,[]);assert.equal(f.store.list('operations').length,0);
 reports.push({case:'ids-batch',events:f.events});
 }finally{await f.close();}
});

async function drain(f:Awaited<ReturnType<typeof fixture>>,input:JsonValue){
 let page=await f.call('hallmark.collection.read',input);const items:any[]=[],pages:any[]=[];
 for(let n=0;;n++){assert.ok(n<20);assert.equal(page.status,'ok',JSON.stringify(page));pages.push(page.data);items.push(...page.data.items);const c=page.data.continuation;if(!c)break;assert.equal(c.capability,'hallmark.collection.read');page=await f.call(c.capability,c.input);}
 return {items,pages};
}

test('ids duplicates and equivalent selections keep stable remainder and exact order',async()=>{
 const f=await fixture();try{
 const ids=['cup-c','cup-a','cup-c','cup-b'];
 const a=await drain(f,{ids,maxBytes:2500}),b=await drain(f,{selections:ids.map(id=>({id})),maxBytes:2500});
 assert.ok(a.pages.length>1);assert.deepEqual(a,b);assert.deepEqual(a.items.map(x=>x.id),ids);
 const first=await f.call('hallmark.collection.read',{ids,maxBytes:2500});assert.deepEqual(first.data,a.pages[0]);
 const saved=f.store.list<any>('provider_records').filter(x=>x.namespace==='collection_read_batches');assert.ok(saved.length);for(const row of saved)for(const selection of row.value.selections)assert.deepEqual(Object.keys(selection),['id']);
 assert.deepEqual(f.unexpected,[]);reports.push({case:'duplicate-stability',events:f.events,saved});
 }finally{await f.close();}
});

test('explicit SKU cursor and revision survive alias normalization and saved selections',async()=>{
 const f=await fixture();try{
 const seed=await f.call('hallmark.collection.read',{id:'cup-a',limit:1});assert.equal(seed.status,'ok');const item=seed.data.items[0],cursor=item.skus.nextCursor,revision=item.revision;assert.ok(cursor);
 const ids=['cup-a','cup-a','cup-a'],selection={id:'cup-a',cursor,revision};
 const a=await drain(f,{id:'cup-a',ids,cursor,revision,maxBytes:2500}),b=await drain(f,{selections:ids.map(()=>selection),maxBytes:2500});
 assert.ok(a.pages.length>1);assert.deepEqual(a,b);for(const p of a.items){assert.equal(p.revision,revision);assert.deepEqual(p.skus.rows.map((r:any[])=>r[0]),['cup-a-blue','cup-a-white']);}
 const skuIds=['cup-a-blue'];const c=await drain(f,{ids,skuIds,revision,maxBytes:2500});for(const p of c.items)assert.deepEqual(p.skus.rows.map((r:any[])=>r[0]),skuIds);
 const saved=f.store.list<any>('provider_records').filter(x=>x.namespace==='collection_read_batches');assert.ok(saved.some(x=>x.value.selections.some((s:any)=>s.cursor===cursor&&s.revision===revision)));assert.ok(saved.some(x=>x.value.selections.some((s:any)=>s.skuIds?.[0]==='cup-a-blue')));
 reports.push({case:'cursor-revision-sku',events:f.events,saved});
 }finally{await f.close();}
});

test('no batch, empty input, nulls and malformed fields retain schema and domain failures',async()=>{
 const f=await fixture();try{
 for(const input of [{id:'cup-a'},{ids:['cup-a']},{selections:[{id:'cup-a'}]}] as JsonValue[]){const r=await f.call('hallmark.collection.read',input);assert.equal(r.status,'ok');assert.equal(r.data.continuation,null);assert.equal(r.data.items[0].skus.rows.length,3);}
 assert.equal(f.store.list<any>('provider_records').filter(x=>x.namespace==='collection_read_batches').length,0);
 // The current baseline rejects an omitted selection at the public schema gate.
 for(const input of [{},{ids:[]},{selections:[]},{ids:[null]},{ids:['cup-a'],skuIds:null},{ids:['cup-a'],cursor:null},{ids:['cup-a'],revision:null},{selections:[{id:'cup-a',cursor:null}]},{selections:[{id:'cup-a',revision:null}]},{selections:[{id:'cup-a',skuIds:null}]},{ids:['cup-a'],extra:true}] as JsonValue[]){const calls=f.providerCalls(),r=await f.call('hallmark.collection.read',input);assert.equal(r.status,'failed');assert.equal(r.error.code,'INPUT_SCHEMA_INVALID',JSON.stringify(r));assert.equal(f.providerCalls(),calls,'invalid selections do not dispatch the provider');}
 for(const [input,code] of [[{cursor:'batch:missing'},'COLLECTION_CURSOR_INVALID'],[{ids:['cup-a','cup-a'],revision:'stale',maxBytes:2500},'COLLECTION_REVISION_CHANGED'],[{id:'cup-a',cursor:'malformed'},'COLLECTION_CURSOR_INVALID'],[{ids:['cup-a'],skuIds:['missing']},'COLLECTION_SKU_NOT_FOUND']] as Array<[JsonValue,string]>){const r=await f.call('hallmark.collection.read',input);assert.equal(r.error.code,code);}
 assert.deepEqual(f.unexpected,[]);assert.equal(f.store.list('operations').length,0);reports.push({case:'negative-controls',events:f.events});
 }finally{await f.close();}
});

test('saved ids batch keeps pinned revision rejection after source refresh',async()=>{
 const local=structuredClone(details),f=await fixture(local);try{
 const first=await f.call('hallmark.collection.read',{id:'cup-a'}),revision=first.data.items[0].revision;
 const batch=await f.call('hallmark.collection.read',{ids:Array(6).fill('cup-a'),revision,maxBytes:2500});assert.equal(batch.status,'ok');assert.ok(batch.data.continuation);
 local[0].title+=' revised';const refreshed=await f.call('hallmark.collection.read',{id:'cup-a',refresh:true});assert.equal(refreshed.status,'ok');assert.notEqual(refreshed.data.items[0].revision,revision);
 const stale=await f.call('hallmark.collection.read',batch.data.continuation.input);assert.equal(stale.error.code,'COLLECTION_REVISION_CHANGED');
 }finally{await f.close();}
});
