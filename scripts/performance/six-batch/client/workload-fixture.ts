import assert from 'node:assert/strict';
import {createMaterialView} from '@checkout/packages/app-presentation/src/materials/catalog.ts';
import {hallmarkProductSources,hallmarkCollectedSources} from '@checkout/packages/app-hallmark/src/field-mappings.ts';
import {FIELD_ROLE_MAP} from '@checkout/packages/app-presentation/src/field-roles.ts';
import {readProcurement,PROCUREMENT_DESCRIPTOR} from '@checkout/packages/app-hallmark/src/procurement.ts';
import {BusinessPricingRepository,dynamicReferenceDraft} from '@checkout/packages/business-pricing/src/index.ts';
import {compileSchema} from '@checkout/packages/app-contracts/src/index.ts';
import {REAL_SOURCE_SUMMARIES,REAL_STORES,REAL_SALES_PRODUCTS} from '../../../../test/real-data/browser-data.ts';

export const workloadNames=['platform','application-default','application-explicit','collection-loaded'];
const observedAt=REAL_SALES_PRODUCTS[0].lastSeenAt;
export function listedInFixture(i:number){
 const cases=[
  {listingRecord:'not_found',association:'unknown',saleStates:{}},
  {listingRecord:'found',association:'linked',saleStates:{archived:2}},
  {listingRecord:'found',association:'unknown',savedListingCount:1,saleStates:{}},
  {listingRecord:'found',association:'linked',saleStates:{failed:1,pending:1}},
  {listingRecord:'unavailable',listingRecordReason:'RECORD_SYNC_FAILED',association:'unknown',saleStates:{}},
  {association:'none',saleStates:{}}, // Legacy snapshots without listingRecord remain unavailable to filtering.
 ];
 // Listing states are deliberate availability faults attached to real source/store bases.
 const a={storeId:'fixture-store',storeName:REAL_STORES[0].shopName,status:'unknown',freshness:i%6===4?'stale':'fresh',observedAt,hasUnlinkedHistory:true,...cases[i%6]};
 const b={storeId:'fixture-store-b',storeName:REAL_STORES[1].shopName,status:'unknown',freshness:'fresh',observedAt:null,hasUnlinkedHistory:false,...cases[[1,0,4,5,3,0][i%6]]};
 return i%6===3?[a]:[a,b]; // Missing target-store evidence also means unavailable.
}

/** All application rows come from this checkout's actual provider and pricing engine, before timing starts. */
export async function createWorkbenchFixture({workload='platform',size,pageSize}){
 assert.ok(workloadNames.includes(workload),`Unknown workload: ${workload}`);
 const collection=workload==='collection-loaded',application=workload.startsWith('application');
 const sourceDraft=collection?hallmarkCollectedSources('fixture-connection')[0]:hallmarkProductSources('fixture-connection').find(source=>source.capabilityId==='hallmark.products.procurement');
 const source={...sourceDraft,kind:'data_source',revision:1,validation:{status:'unverified',checkedAt:'2026-10-10T08:00:00.000Z',sampleCount:0,issues:[]}};
 const materialId=collection?'product-list':'product-procurement';
 const design=createMaterialView(materialId);design.widgets[0].options.pageSize=pageSize;
 const derived=structuredClone(design),fieldMap=Object.fromEntries(source.fields.map(field=>[field.key??field.role,field.path]));
 const fieldMeta=Object.fromEntries(source.fields.map(field=>[field.key??field.role,{...FIELD_ROLE_MAP[field.role],...field}]));
 derived.widgets[0].fields=fieldMap;derived.widgets[0].options={...derived.widgets[0].options,rowsPath:source.rowsPath,fieldMeta,example:false};derived.bindings[0].fieldMap=fieldMap;
 // Authentic recorded facts; only repeated-load identities and isolated store aliases are derived.
 let products=Array.from({length:size},(_,i)=>{
  const row=structuredClone(REAL_SALES_PRODUCTS[i%REAL_SALES_PRODUCTS.length]);
  if(i>=REAL_SALES_PRODUCTS.length){row.productId+=`:repeat-${Math.floor(i/REAL_SALES_PRODUCTS.length)}`;row.offerId+=`:repeat-${Math.floor(i/REAL_SALES_PRODUCTS.length)}`;row.sku+=`:repeat-${Math.floor(i/REAL_SALES_PRODUCTS.length)}`;}
  return {...row,productUrl:`https://www.ozon.ru/product/${row.sku}`,salesSpecification:row.sources?.[0]?.salesSpec??null,purchaseSpecification:row.sources?.[0]?.sourceSpec??null,purchaseLinks:(row.sources??[]).filter(source=>source.sourceUrl).map(source=>({url:source.sourceUrl,label:source.sourceSpec??'来源'})),purchaseMinor:row.profit?.purchaseMinor??null,sellerMinor:row.pricing?.sellerMinor??null,packageGrams:row.profit?.packageGrams??null,referenceProfit:{...row.profit,margin:row.profit?.actualMargin??null,metricBasis:'实际快照中已记录的利润率映射'},logisticsMatch:{label:'快照记录'}};
 });
 const params=workload==='application-default'||collection?{}:{planMode:application?'application':'platform'};
 const queryInput=collection?{limit:Math.min(size,200)}:{loadAll:true,storeId:'fixture-store',...params};
 let payload:any={products,total:size,plan:{mode:'platform',label:'统一试算',fixedFeeYuan:3.2,logisticsYuanPerKg:12,commissionPercent:15}},provider,restoreClock=()=>{};
 if(collection){
  products=Array.from({length:size},(_,i)=>{const row=structuredClone(REAL_SOURCE_SUMMARIES[i%REAL_SOURCE_SUMMARIES.length]);if(i>=REAL_SOURCE_SUMMARIES.length)row.id+=`:repeat-${Math.floor(i/REAL_SOURCE_SUMMARIES.length)}`;return {...row,listedIn:listedInFixture(i)};});
  payload={items:products,total:size};
 }
 if(application){
  const OriginalDate=Date;let now=OriginalDate.parse('2026-10-10T08:00:00.000Z');
  // Freeze wall time only. performance.now()/CPU measurements retain their real clocks.
  globalThis.Date=class extends OriginalDate{constructor(...args:any[]){super(...(args.length?args:[now]));}static now(){return now;}} as DateConstructor;
  restoreClock=()=>{globalThis.Date=OriginalDate;};
  const records=new Map(),store={get:(collection,id)=>structuredClone(records.get(`${collection}:${id}`)),put:(collection,id,value)=>{records.set(`${collection}:${id}`,structuredClone(value));return value;},transaction:callback=>callback(),list:collection=>[...records.entries()].filter(([key])=>key.startsWith(`${collection}:`)).map(([,value])=>structuredClone(value))};
  const pricing=new BusinessPricingRepository(store),initialDraft=dynamicReferenceDraft();pricing.save('fixture-store',initialDraft,0);
  // Explicit boundary/failure conditions exercise 135 CNY, missing cost and missing weight.
  const rows=products.map((row,i)=>({...row,storeId:'fixture-store',status:'on_sale',pricing:{...row.pricing,sellerMinor:i%23===0?null:i%2?13499:13500,currency:row.currency},profit:{...row.profit,purchaseMinor:i%17===0?null:row.purchaseMinor,packageGrams:i%19===0?null:row.packageGrams},sources:row.sources}));
  let reads=0;
  const client={getStoreProducts:async()=>{reads++;return {status:'ok',raw:{stores:[{id:'fixture-store',hasCredential:true,lastSuccessAt:observedAt}],products:rows},provenance:{source:'hallmark_snapshot',endpoint:'/fixture/products',fetchedAt:new Date().toISOString()}};}};
  const read=async()=>{const response=await readProcurement(queryInput,store,client,undefined,pricing);assert.equal(response.status,'ok',JSON.stringify(response));assert.deepEqual(compileSchema(PROCUREMENT_DESCRIPTOR.outputSchema)(response.data),[]);return response.data;};
  payload=await read();products=payload.products;
  assert.equal(payload.plan.mode,'application');assert.equal(payload.plan.settingsRevision,1);
  assert.ok(products.some(row=>row.referenceProfit.planId==='dynamic-below-135'));
  assert.ok(products.some(row=>row.referenceProfit.planId==='dynamic-from-135'));
  provider={read,reads:()=>reads,transition:async(name)=>{
   if(name==='revision-overlap'){const next=structuredClone(initialDraft);next.plans.push({id:'overlap',name:'重叠高费用方案',enabled:true,fixedMinor:2500,logisticsMicrosPerGram:39300,commissionPpm:200000});pricing.save('fixture-store',next,1);}
   else if(name==='window-first'){const next=structuredClone(initialDraft);next.plans=[{id:'first',name:'当前方案',enabled:true,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000,validUntil:'2026-10-10T08:00:01.000Z'},{id:'next',name:'稍后方案',enabled:true,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000,validFrom:'2026-10-10T08:00:01.000Z',validUntil:'2026-10-10T08:00:02.000Z'}];pricing.save('fixture-store',next,2);}
   else if(name==='window-next')now+=1000;
   else if(name==='window-expired')now+=1000;
   else throw Error(`Unknown provider transition: ${name}`);
   return read();
  }};
 }
 const snapshot={instanceId:'O-fixture',view:{viewId:'O-view',design:derived},dataSources:{products:source},pages:{products:{hasMore:false,loadedCount:size,total:size}},data:{viewId:'O-view',bindings:[{bindingId:'products',appId:'hallmark',connectionId:'fixture-connection',datasetId:'O-data',payload,query:{appId:'hallmark',connectionId:'fixture-connection',capabilityId:source.capabilityId,input:queryInput},state:'ready',lastSuccessAt:'2026-10-10T08:00:00.000Z',sourceDataTime:observedAt,freshness:'fresh',provenance:[]}]}};
 const instance={instanceId:'O-fixture',title:collection?'采集商品':'采购表',materialId,materialVersion:1,design,dataSources:{products:{id:source.id,revision:1,params}},position:{order:0}};
 return {source,design,derived,fieldMap,fieldMeta,products,snapshot,instance,provider,restoreClock,metadata:{workload,planMode:collection?null:payload.plan.mode,parameterPlanMode:params.planMode??null,settingsRevision:payload.plan?.settingsRevision??null,rowSource:application?'real sales snapshot through readProcurement + explicit price/missing-data conditions':collection?'real41source snapshots plus explicit listing-availability conditions':'real432sales snapshots with aliases of recorded price/profit facts',collectionStatusRows:collection?size:0,collectionRecordContract:collection?'found/not_found/unavailable are explicit availability conditions; authentic source fields retained':null,repeatedRealDataStress:collection&&size>41||!collection&&size>432}};
}
