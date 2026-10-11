import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]);
const {AppsRuntime}=await import(pathToFileURL(root+'/packages/app-runtime/src/index.ts').href);
const {HallmarkProvider}=await import(pathToFileURL(root+'/packages/app-hallmark/src/index.ts').href);
import {performance} from 'node:perf_hooks';

import assert from 'node:assert/strict';
const {RuntimeStore}=await import(pathToFileURL(root+'/packages/app-runtime/src/store.ts').href);
const {HallmarkStorePort}=await import(pathToFileURL(root+'/packages/app-hallmark/src/store.ts').href);
const {CollectionService}=await import(pathToFileURL(root+'/packages/collection/src/index.ts').href);
const {BusinessPackagingRepository}=await import(pathToFileURL(root+'/packages/business-packaging/src/index.ts').href);
const {BusinessPricingRepository,dynamicReferenceDraft}=await import(pathToFileURL(root+'/packages/business-pricing/src/index.ts').href);
const {prepareListing,collectionListingStates}=await import(pathToFileURL(root+'/packages/app-hallmark/src/listing-prepare.ts').href);
const {HallmarkBusinessAdapter}=await import(pathToFileURL(root+'/packages/app-hallmark/src/operations-adapter.ts').href);
type CoreClient=any;
const {projectModelResult}=await import(pathToFileURL(root+'/packages/app-runtime/src/projection.ts').href);

function fixture(count=6,productCount=1){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'source');let detailReads=0,categoryReads=0;
 const details=new Map(Array.from({length:productCount},(_,i)=>{const id=`p${i+1}`;return [id,{id,source:'taobao_tmall',title:`组合杯 ${id}`,currency:'CNY',attributes:{材料:'陶瓷',包装单位:'件'},package:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}},skus:Array.from({length:count},(_,j)=>({sourceSkuId:`sku-${j}`,spec:`颜色：${j}`,goodsPrice:3.43,price:4,currency:'CNY'}))}];}));
 const client:CoreClient={getStores:async()=>({status:'ok',raw:[{id:'bill'},{id:'other'}]}),getStoreProducts:async()=>({status:'ok',raw:{stores:[{id:'bill'}],products:[]}}),syncStoreProducts:async()=>({status:'ok'}),getTargetMargin:async()=>({status:'ok'}),searchCollectedItems:async()=>({status:'ok',raw:[]}),getCollectedItem:async()=>{throw Error('raw not expected');},getCollectedItemDetail:async id=>{detailReads++;return {status:'ok',raw:details.get(id)};},platformCall:async()=>{throw Error('write not expected');},platformRead:async()=>{throw Error('platform read not expected');},getCategoryData:async input=>{categoryReads++;return input.mode==='search'?{status:'ok',raw:{items:[{description_category_id:1,type_id:2,name:'杯子',children:[{huge:'discard'}]}],total:1}}:{status:'ok',raw:{result:Array.from({length:100},(_,i)=>({id:i+1,name:`属性 ${i+1}`,is_required:i<2,type:'string',max_value_count:1,...(i===0?{dictionary_id:12,values:Array.from({length:1000},(_,j)=>({id:j,value:'large choice'.repeat(100)}))}:{})}))}};}};
 const collection=new CollectionService({client,store}),packaging=new BusinessPackagingRepository(store),pricing=new BusinessPricingRepository(store);pricing.save('bill',dynamicReferenceDraft(),0);
 return {database,store,client,collection,packaging,pricing,details,counts:()=>({detailReads,categoryReads}),options:{client,store,collection,packaging,pricing}};
}
// Synthetic CoreClient boundary; no Ozon network, writes, credentials or artificial sleeps.
// Template shape matches /v1/description-category/attribute: result = attribute[].
const template=JSON.stringify({result:Array.from({length:80},(_,i)=>({id:i+1,name:`Attribute ${i+1}`,description:'Platform attribute definition',type:'String',is_required:i<4,is_collection:false,dictionary_id:i===0?12:0,attribute_complex_id:0,max_value_count:1,group_id:0,group_name:'Product'}))});
async function scenario(kind:string,refresh=true,count=20,warm=false){
 const f=fixture(1,count);const runtime=new AppsRuntime(f.database);let sequence=0,requestBytes=0,modelBytes=0;
 runtime.register(new HallmarkProvider({store:()=>f.store,client:f.client,broker:{getStoreTask:async()=>{throw Error('NO TASK');},getListingTask:async()=>{throw Error('NO TASK');},requestId:()=>''}}));
 runtime.addConnection({appId:'hallmark',connectionId:'source',displayName:'fixture',config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'source',enabled:true,boundAt:new Date().toISOString()});
 const prepare=async(input:any,_options:any)=>{const n=++sequence;requestBytes+=Buffer.byteLength(JSON.stringify(input));const result=await runtime.invoke({protocolVersion:'1.0',invocationId:`cache-${n}`,traceId:`cache-${n}`,appId:'hallmark',connectionId:'source',capabilityId:'hallmark.listing.prepare',capabilityVersion:'1.0.0',input:JSON.parse(JSON.stringify(input)),source:{kind:'agent',sessionId:'s',nativeCallId:`cache-${n}`},deadlineAt:new Date(Date.now()+60000).toISOString()});const content=projectModelResult(f.database,result).content;modelBytes+=Buffer.byteLength(content);const model=JSON.parse(content);assert.equal(model.status,'ok',JSON.stringify(model));return model.data;};
 let calls=0,failures=0;const seen:any[]=[];
 f.client.getCategoryData=async input=>{calls++;seen.push(input);if(kind==='transient'&&calls===1||kind==='429'){failures++;return {status:'failed',error:{code:'OZON_RATE_LIMIT',message:'Rate limited',retryable:true}};}if(kind==='abort'&&calls===1)throw new DOMException('Aborted','AbortError');const raw=JSON.parse(template);if(kind==='changing')raw.result[0].name=`Revision ${calls}`;return {status:'ok',raw};};
 const selections=Array.from({length:count},(_,i)=>({id:`p${i+1}`})),categories=Object.fromEntries(selections.map((p,i)=>[p.id,{descriptionCategoryId:kind==='distinct'?String(i+1):kind==='mixed'?String(i%4+1):'1',typeId:'2'}]));
 try{if(warm){await prepare({storeId:'bill',selections,categories,refresh:false},f.options);calls=0;failures=0;requestBytes=0;modelBytes=0;}const cpu=process.cpuUsage(),start=performance.now();let page=await prepare({storeId:'bill',selections,categories,refresh},f.options),pages=1;const snapshot=f.store.get<any>('business_listing_preparations',page.preparationRevision);while(page.continuation){page=await prepare(page.continuation.input,f.options);pages++;}return {calls,failures,pages,requestBytes,modelBytes,elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),parts:{storeId:snapshot.storeId,parts:snapshot.parts,rules:snapshot.rules,sourceRevisions:snapshot.sourceRevisions,totals:snapshot.totals},seen};}finally{await runtime.dispose();f.database.close();}
}
function stable(value:any):any {if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['fetchedAt','updatedAt','observedAt'].includes(key)).map(([k,v])=>[k,stable(v)]));return value;}

const rows:any[]=[];
for(const control of [{kind:'same',refresh:true,count:20},{kind:'distinct',refresh:true,count:20},{kind:'mixed',refresh:true,count:20},{kind:'transient',refresh:true,count:20},{kind:'429',refresh:true,count:20},{kind:'same',refresh:false,count:20},{kind:'same',refresh:false,count:20,warm:true},{kind:'same',refresh:true,count:1}]){
 const result=await scenario(control.kind,control.refresh,control.count,control.warm);
 const {parts,seen,...stats}=result;rows.push({control,...stats,oracle:stable(parts)});
}
console.log(JSON.stringify({boundary:'AppsRuntime → HallmarkProvider → prepareListing → projectModelResult, every continuation; synthetic client, no network/sleeps',rows}));
