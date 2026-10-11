import {HallmarkClient} from '../../packages/hallmark-adapter/index.ts';
import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort,HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import type {NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';
import type {JsonValue,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import {compileCapability,canonicalJson} from '../../packages/app-contracts/src/index.ts';

const reports:unknown[]=[],bytes=(value:unknown)=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value)),hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
after(()=>{if(process.env.APPS_COLLECTION_BATCH_REPORT)writeFileSync(process.env.APPS_COLLECTION_BATCH_REPORT,JSON.stringify(reports,null,2)+'\n');});
const details=['cup-a','cup-b','cup-c'].map((id,i)=>({id,source:'taobao_tmall',title:['不锈钢保温杯','陶瓷马克杯','玻璃水杯'][i],currency:'CNY',attributes:{材质:['不锈钢','陶瓷','玻璃'][i],用途:'日常饮水'},package:{weightKg:.33,dimensionsCm:[25,10,10]},description:'杯口圆润，适合日常饮水。请按所选颜色区分规格，包装内包含杯体和配套杯盖。清洁后晾干收纳，避免与尖锐物品碰撞。',skus:['red','blue','white'].map((color,n)=>({sourceSkuId:`${id}-${color}`,spec:`颜色:${['红','蓝','白'][n]}`,properties:{颜色:['红','蓝','白'][n]},goodsPrice:12+n,currency:'CNY'}))}));
async function fixture(){
 let respond:((storeId:string,input:any)=>any)|undefined,attributes:any[]=[{id:85,dictionary_id:9,is_required:true,name:'Synthetic material'}];
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'fixture'),tools=new Map<string,NativeGatewayTool>(),agent={id:'collection-owner'},events:any[]=[],sourceReads:string[]=[],unexpected:string[]=[];let providerCalls=0,sequence=0;
 const forbidden=(name:string)=>async()=>{unexpected.push(name);throw Error(`Unexpected ${name}`);};
 const client:CoreClient={getStores:async()=>({status:'ok',raw:[{id:'legacy',name:'Legacy'}]}),getStoreProducts:forbidden('products'),syncStoreProducts:forbidden('sync'),getTargetMargin:forbidden('margin'),searchCollectedItems:forbidden('search'),getCollectedItem:forbidden('raw'),getCollectedItemDetail:async id=>{sourceReads.push(id);const detail=details.find(item=>item.id===id);assert.ok(detail);return {status:'ok',raw:structuredClone(detail)};},platformCall:forbidden('write'),platformRead:forbidden('platform-read')};
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
 return {host,tools,agent,store,runtime,provider,call,describe,events,sourceReads,unexpected,categoryCalls,legacyCalls,transport,gateway,setResponse:(fn:typeof respond)=>{respond=fn;},setAttributes:(value:any[])=>{attributes=value;},providerCalls:()=>providerCalls,async close(){await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}};
}

test('independent oversized page retains full values and exact next request through native inspect',async()=>{
const f=await fixture();try{
const giant='超长字典值🟦'.repeat(12000), input={storeId:'shop',mode:'values',descriptionCategoryId:'123',typeId:'456',attributeId:'85',limit:100};
f.setResponse((s,r)=>({status:'ok',raw:{response:{has_next:r.body.last_value_id===0,result:r.body.last_value_id===0?[{id:11,value:giant}]:[{id:22,value:'Required second-page value'}]}}}));
const first=await f.call('hallmark.categories.read',input);assert.ok(first.fullResultRef);assert.equal(first.completeness,'partial');
const inspected:any[]=[];
async function inspect(path:string,cursor='0') {const tool=f.tools.get('apps_inspect')!,args={resultRef:first.fullResultRef,path,cursor,limit:100};const result=await tool.execute(args,{agent:f.agent,signal:new AbortController().signal,callId:'inspect-'+path+'-'+cursor});const rendered=tool.output.render(args,result).map(x=>x.text).join('');assert.ok(Buffer.byteLength(rendered)<=16384);const model=JSON.parse(rendered);inspected.push({args,model,modelBytes:Buffer.byteLength(rendered)});return model;}
const c=await inspect('/data/raw/continuation');let next=c.value??c.data?.value;assert.ok(next,JSON.stringify(c));const second=await f.call(next.capability,next.input);assert.equal(second.data.raw.result[0].id,22);
let cursor='0',value='',pages=0;do {const r=await inspect('/data/raw/result/0/value',cursor),p=r.text!==undefined?r:r.data;assert.ok(p,JSON.stringify(r));value+=p.text;cursor=p.nextCursor;pages++;assert.ok(pages<100);}while(cursor!==null);assert.equal(value,giant);assert.equal(f.categoryCalls.length,2);reports.push({case:'oversized-complete-output-oracle',expectedHash:hash(giant),actualHash:hash(value),events:f.events,inspected,categoryCalls:f.categoryCalls});console.log(JSON.stringify({oversizedBytes:Buffer.byteLength(giant),readPages:pages,nativeBudget:16384,upstreamReads:f.categoryCalls.length}));
}finally{await f.close();}});
