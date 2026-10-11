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
 return {store,runtime,provider,call,describe,events,sourceReads,unexpected,categoryCalls,legacyCalls,transport,gateway,setResponse:(fn:typeof respond)=>{respond=fn;},setAttributes:(value:any[])=>{attributes=value;},providerCalls:()=>providerCalls,async close(){await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}};
}

const input={storeId:'shop',mode:'values',descriptionCategoryId:'123',typeId:'456',attributeId:'85',limit:1};
const ok=(response:any)=>({status:'ok',raw:{response}});
const raw=(result:any)=>{assert.equal(result.status,'ok',JSON.stringify(result));return result.data.raw;};
test('required dictionary metadata gives executable read and continuation retrieves required page-two value',async()=>{
 const f=await fixture();try{
  const prepared=await f.call('hallmark.listing.prepare',{storeId:'shop',selections:[{id:'cup-a'}],categories:{'cup-a':{descriptionCategoryId:'123',typeId:'456'}}});
  assert.equal(prepared.status,'ok',JSON.stringify(prepared));
  const available=prepared.data.categories['cup-a'].attributes[0].available;assert.ok(available);
  const schema=await f.describe(available.capability);assert.equal(schema.status,'ok');const valuesSchema=schema.descriptor.inputSchema.oneOf.find((branch:any)=>branch.properties.mode.const==='values');assert.equal(valuesSchema.properties.lastValueId.type,'string');reports.push({case:'model-visible-complete-schema',schema});
  assert.equal(compileCapability(HALLMARK_DESCRIPTORS.find(d=>d.capabilityId===available.capability)!).input(available.input).length,0);
  const first=await f.call(available.capability,available.input),firstRaw=raw(first),next=firstRaw.continuation;assert.ok(next);assert.equal(firstRaw.completeness,'partial');
  assert.equal(compileCapability(HALLMARK_DESCRIPTORS.find(d=>d.capabilityId===next.capability)!).input(next.input).length,0);
  const second=await f.call(next.capability,next.input),secondRaw=raw(second);assert.deepEqual(secondRaw.result,[{id:22,value:'Required second-page value'}]);assert.equal(secondRaw.continuation,null);assert.equal(secondRaw.completeness,'complete');
  const firstOracle={has_next:true,result:[{id:11,value:'First-page value'}],completeness:'partial',continuation:{capability:'hallmark.categories.read',input:{storeId:'shop',mode:'values',descriptionCategoryId:'123',typeId:'456',attributeId:'85',limit:100,lastValueId:'11'}},storeId:'shop'};
  const secondOracle={has_next:false,result:[{id:22,value:'Required second-page value'}],completeness:'complete',continuation:null,storeId:'shop'};
  const {fetchedAt:firstFetched,...firstContent}=firstRaw,{fetchedAt:secondFetched,...secondContent}=secondRaw;
  assert.ok(Number.isFinite(Date.parse(firstFetched)));assert.ok(Number.isFinite(Date.parse(secondFetched)));
  assert.deepEqual(firstContent,firstOracle);assert.deepEqual(secondContent,secondOracle);
  reports.push({case:'complete-output-oracle',firstHash:hash(firstContent),expectedFirstHash:hash(firstOracle),secondHash:hash(secondContent),expectedSecondHash:hash(secondOracle)});
  assert.notEqual(first.data.datasetKey,second.data.datasetKey);assert.equal(f.categoryCalls.length,3);assert.deepEqual(f.categoryCalls.map(c=>c.body.language),['DEFAULT','DEFAULT','DEFAULT']);
  assert.deepEqual(f.categoryCalls[2],{storeId:'shop',path:'/v1/description-category/attribute/values',body:{description_category_id:123,type_id:456,language:'DEFAULT',attribute_id:85,limit:100,last_value_id:11}});
  assert.deepEqual(f.unexpected,[]);assert.equal(f.store.list('operations').length,0);reports.push({case:'candidate-complete-chain',events:f.events,categoryCalls:f.categoryCalls});
 }finally{await f.close();}
});
test('dictionary metadata aliases and positive bounds do not turn free text into dictionaries',async()=>{
 const f=await fixture();try{
  f.setAttributes([{dictionary_id:9},{dictionaryId:'10'},{dictionary_id:0},{dictionaryId:-1},{dictionary_id:'9007199254740992'},{dictionary_id:'01'},{options:[]},{}].map((x,i)=>({id:85+i,is_required:true,...x})));
  const result=await f.call('hallmark.listing.prepare',{storeId:'shop',selections:[{id:'cup-a'}],categories:{'cup-a':{descriptionCategoryId:'123',typeId:'456'}}});assert.equal(result.status,'ok');
  const attributes=result.data.categories['cup-a'].attributes;assert.deepEqual(attributes.map((a:any)=>Boolean(a.available)),[true,true,false,false,false,false,true,false]);
  for(const attribute of attributes.filter((a:any)=>a.available))assert.equal(raw(await f.call(attribute.available.capability,attribute.available.input)).has_next,true);
 }finally{await f.close();}
});
test('cursor rejects lossy noncanonical and mode-extraneous inputs before any upstream read',async()=>{
 const f=await fixture();try{
  for(const lastValueId of [0,11,'0','-1','01','1.0','1e3','9007199254740992',' 11','11 ',null,{},''])assert.notEqual((await f.call('hallmark.categories.read',{...input,lastValueId})).status,'ok');
  for(const changed of [{q:'blue',lastValueId:'11'},{mode:'template',lastValueId:'11'},{mode:'show',lastValueId:'11'},{language:'EN'}])assert.notEqual((await f.call('hallmark.categories.read',{...input,...changed} as any)).status,'ok');
  assert.equal(f.categoryCalls.length,0);reports.push({case:'invalid-inputs-no-upstream',events:f.events});
 }finally{await f.close();}
});
test('strict modern category modes accept executable values cursors only and reject search cursors before dispatch',async()=>{
 const f=await fixture();try{
  const modes:Record<string,JsonValue>[]=[
   {storeId:'shop',mode:'search',q:'cup'},
   {storeId:'shop',mode:'show',descriptionCategoryId:'123',typeId:'456'},
   {storeId:'shop',mode:'template',descriptionCategoryId:'123',typeId:'456'},
   {storeId:'shop',mode:'validate_value',descriptionCategoryId:'123',typeId:'456',attributeId:'85',valueId:'11',dictionaryId:'9'},
   {storeId:'shop',mode:'sync'},
   {...input,q:'blue'},
  ];
  for(const capabilityId of ['hallmark.categories.read','hallmark.api.category.read']){
   const described=await f.describe(capabilityId),validate=compileSchema(described.descriptor.inputSchema);
   assert.deepEqual(validate({...input,lastValueId:'11'}),[]);
   for(const mode of modes){
    assert.deepEqual(validate(mode),[],`valid ${mode.mode} input remains accepted`);
    const selected={...mode,lastValueId:'11'};
    assert.ok(validate(selected).length,`${mode.mode} must not accept a listing cursor`);
    const rejected=await f.call(capabilityId,selected);
    assert.equal(rejected.error.code,'INPUT_SCHEMA_INVALID');
   }
  }
  assert.equal(f.providerCalls(),0);assert.equal(f.categoryCalls.length,0);assert.equal(f.legacyCalls.length,0);
 }finally{await f.close();}
});
test('scoped cursors are emitted with exact category type attribute store limit and defaults',async()=>{
 const f=await fixture();try{
  f.gateway.listStores=()=>[{id:'shop',name:'Synthetic shop',enabled:true},{id:'shop-b',name:'Synthetic other',enabled:true}];
  for(const scope of [input,{...input,storeId:'shop-b'},{...input,descriptionCategoryId:'999'},{...input,typeId:'777'},{...input,attributeId:'86'},{...input,limit:10}]){
   const next=raw(await f.call('hallmark.categories.read',scope)).continuation;assert.deepEqual(next.input,{...scope,lastValueId:'11'});
   await f.call(next.capability,next.input);assert.equal(f.categoryCalls.at(-1).storeId,scope.storeId);const body=f.categoryCalls.at(-1).body;assert.equal(body.description_category_id,Number(scope.descriptionCategoryId));assert.equal(body.type_id,Number(scope.typeId));assert.equal(body.attribute_id,Number(scope.attributeId));assert.equal(body.limit,scope.limit);assert.equal(body.last_value_id,11);assert.equal(body.language,'DEFAULT');
  }
 }finally{await f.close();}
});
test('no continuation for complete page and no looping on empty malformed or stalled evidence',async()=>{
 const f=await fixture();try{
  const cases=[{has_next:true,result:[]},{has_next:true,result:[{value:'missing id'}]},{has_next:true,result:[{id:0}]},{has_next:true,result:[{id:'01'}]},{has_next:true,result:[{id:9007199254740992}]},{has_next:true,result:[{id:'9007199254740992'}]},{has_next:true,result:[{id:11}]},{has_next:true,result:[{id:10}]},{result:[{id:22}]},{has_next:'true',result:[{id:22}]}];
  for(const response of cases){f.setResponse(()=>ok(response));const result=raw(await f.call('hallmark.categories.read',{...input,lastValueId:'11'}));assert.equal(result.completeness,'partial');assert.equal(result.continuation,null);assert.ok(result.paginationError);assert.deepEqual(result.result,response.result);}
  f.setResponse(()=>ok({has_next:false,result:[]}));const final=raw(await f.call('hallmark.categories.read',input));assert.equal(final.completeness,'complete');assert.equal(final.continuation,null);assert.equal(final.paginationError,undefined);
  reports.push({case:'pagination-controls',events:f.events});
 }finally{await f.close();}
});
test('maximum safe cursor remains lossless in real direct body and last-id continuation',async()=>{
 const f=await fixture();try{
  f.setResponse(()=>ok({has_next:true,result:[{id:'9007199254740991',value:'Boundary'}]}));const next=raw(await f.call('hallmark.categories.read',input)).continuation;assert.equal(next.input.lastValueId,'9007199254740991');
  const result=raw(await f.call(next.capability,next.input));assert.equal(f.categoryCalls.at(-1).body.last_value_id,9007199254740991);assert.equal(result.continuation,null);assert.equal(result.paginationError.code,'CATEGORY_PAGINATION_INVALID');
 }finally{await f.close();}
});
test('upstream failure remains failure without fabricated page or fallback',async()=>{
 const f=await fixture();try{
  f.setResponse(()=>({status:'unavailable',error:{code:'SYNTHETIC_UPSTREAM_DOWN',message:'Synthetic unavailable',retryable:true}}));
  const result=await f.call('hallmark.categories.read',{...input,lastValueId:'11'});assert.notEqual(result.status,'ok');assert.equal(result.error.code,'SYNTHETIC_UPSTREAM_DOWN');assert.equal(result.data,undefined);assert.equal(f.legacyCalls.length,0);
 }finally{await f.close();}
});
test('search remains separate and does not advertise a listing cursor',async()=>{
 const f=await fixture();try{
  f.setResponse(()=>ok({result:[{id:99,value:'Search candidate'}]}));const result=raw(await f.call('hallmark.categories.read',{...input,q:'blue'}));assert.equal(result.continuation,undefined);assert.equal(f.categoryCalls.at(-1).path,'/v1/description-category/attribute/values/search');
 }finally{await f.close();}
});
test('legacy first-page semantics stay raw; direct continuation is explicitly unsupported before legacy call',async()=>{
 const f=await fixture();try{
  f.gateway.listStores=()=>[];const old={...input,storeId:'legacy'};const first=raw(await f.call('hallmark.categories.read',old));assert.equal(first.stale,true);assert.equal(first.complete,false);assert.equal(first.continuation,undefined);assert.equal(f.legacyCalls.length,1);
  const failed=await f.call('hallmark.categories.read',{...old,lastValueId:'11'});assert.equal(failed.error.code,'CATALOG_PAGINATION_UNSUPPORTED');assert.equal(f.legacyCalls.length,1);assert.equal(f.categoryCalls.length,0);
 }finally{await f.close();}
});
test('public API alias and legacy tool name both execute validated direct continuation',async()=>{
 const f=await fixture();try{
  const response=await f.call('hallmark.api.category.read',{...input,lastValueId:'11'});assert.equal(raw(response).result[0].id,22);
  const legacy:any=await f.transport.legacyInvoke({name:'hallmark_get_category_data',arguments:{...input,lastValueId:'11'},sessionId:'collection-owner',invocationId:'legacy-dictionary',traceId:'legacy-dictionary',deadlineAt:new Date(Date.now()+60000).toISOString()});assert.equal(legacy.status,'ok',JSON.stringify(legacy));assert.equal(legacy.data.raw.result[0].id,22);
 }finally{await f.close();}
});

test('actual legacy HallmarkClient rejects direct cursor before even health HTTP and keeps no-cursor URL unchanged',async()=>{
 const requests:any[]=[];const client=new HallmarkClient({fetchImpl:async(url,init)=>{const target=new URL(String(url));requests.push({path:target.pathname,query:Object.fromEntries(target.searchParams)});return new Response(JSON.stringify(target.pathname==='/api/health'?{service:'hallmark-control'}:{values:[{id:1,value:'Legacy'}],complete:false,stale:true}));}});
 const result=await client.getCategoryData({...input,mode:'values',lastValueId:'11'});assert.equal(result.error?.code,'CATALOG_PAGINATION_UNSUPPORTED');assert.equal(requests.length,0);
 const first=await client.getCategoryData({...input,mode:'values'});assert.equal(first.status,'ok');assert.deepEqual(requests.at(-1),{path:'/api/catalog/categories/123/types/456/attributes/85/values',query:{storeId:'shop',limit:'1'}});assert.equal(first.raw?.stale,true);
});

test('committed generated SDK, tool schema and docs accept the exact emitted continuation',async()=>{
 const f=await fixture();try{
  const next=raw(await f.call('hallmark.categories.read',input)).continuation;
  const metadata=JSON.parse(readFileSync(new URL('../../packages/app-sdk/generated/tools.json',import.meta.url),'utf8'));
  const docs=readFileSync(new URL('../../docs/apps-capabilities.md',import.meta.url),'utf8');
  for(const capabilityId of ['hallmark.categories.read','hallmark.api.category.read']){
   const generated=generatedCatalog.find(d=>d.capabilityId===capabilityId)!,descriptor=HALLMARK_DESCRIPTORS.find(d=>d.capabilityId===capabilityId)!,tool=metadata.find((d:any)=>d.name===capabilityId);
   assert.deepEqual(generated.inputSchema,descriptor.inputSchema);assert.deepEqual(tool.parameters,descriptor.inputSchema);assert.equal(compileSchema(generated.inputSchema as any)(next.input).length,0);assert.equal(compileSchema(tool.parameters)(next.input).length,0);assert.ok(docs.includes(canonicalJson(descriptor.inputSchema)));
  }
  const client=new AppsClient(f.transport,{kind:'script',sessionId:'collection-owner',runId:'generated-dictionary',stepKey:'read'}),ref={appId:'hallmark',connectionId:'fixture'};
  const typedNext:Input38={...input,mode:'values',lastValueId:next.input.lastValueId};assert.deepEqual(typedNext,next.input);
  assert.equal(raw(await call38(client,ref,typedNext)).result[0].id,22);assert.equal(raw(await call24(client,ref,typedNext)).result[0].id,22);
  reports.push({case:'committed-generated-artifacts',continuation:next,generatedSchema:generatedCatalog.find(d=>d.capabilityId===next.capability)!.inputSchema,upstream:f.categoryCalls});
 }finally{await f.close();}
});

test('integrated category reuse preserves string identities and executable described dictionary continuation',async()=>{
 const f=await fixture();try{
  const categories=Object.fromEntries(['cup-a','cup-b','cup-c'].map(id=>[id,{descriptionCategoryId:'123',typeId:'456'}]));
  const prepared=await f.call('hallmark.listing.prepare',{storeId:'shop',selections:['cup-a','cup-b','cup-c'].map(id=>({id})),categories,refresh:true});
  assert.equal(prepared.status,'ok',JSON.stringify(prepared));
  assert.equal(f.categoryCalls.filter(c=>c.path==='/v1/description-category/attribute').length,1,'shared refreshed category is fetched once for the preparation');
  for(const id of ['cup-a','cup-b','cup-c']){
   const selected=prepared.data.categories[id];assert.equal(selected.selection.descriptionCategoryId,'123');assert.equal(selected.selection.typeId,'456');
   const available=selected.attributes[0].available,description=await f.describe(available.capability);
   assert.deepEqual(compileSchema(description.descriptor.inputSchema)(available.input),[]);
   const first=raw(await f.call(available.capability,available.input));assert.ok(first.continuation);
   assert.deepEqual(compileSchema(description.descriptor.inputSchema)(first.continuation.input),[]);
   assert.equal(first.continuation.input.descriptionCategoryId,'123');assert.equal(first.continuation.input.lastValueId,'11');
   const second=raw(await f.call(first.continuation.capability,first.continuation.input));assert.deepEqual(second.result,[{id:22,value:'Required second-page value'}]);assert.equal(second.completeness,'complete');
  }
  assert.deepEqual(f.unexpected,[]);assert.equal(f.store.list('operations').length,0);
 }finally{await f.close();}
});
