import {createHash} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CoreClient,CoreStore,RecordData,AdapterResponse} from '../../core/src/types.ts';
import type {OzonBusinessGateway} from '../../ozon-business/src/index.ts';
import type {CategoryDataInput,PlatformCallInput} from '../../hallmark-adapter/types.ts';
import {applicationProfit,businessWeight,type PricingReader} from './dynamic-profit.ts';

const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const object=(value:unknown):RecordData=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
const ok=(raw:unknown):AdapterResponse=>({status:'ok',raw:JSON.parse(JSON.stringify(raw)),provenance:{source:'hallmark_snapshot',fetchedAt:new Date().toISOString()}});
const payload=(response:AdapterResponse):RecordData=>object(response.raw?.response??response.raw);
const responseRows=(response:AdapterResponse):RecordData[]=>{const body=payload(response),value=body.items??body.result?.items??body.result;return Array.isArray(value)?value:[];};
const priceMinor=(value:unknown):number|null=>{if(value===null||value===undefined||value==='')return null;const numeric=Number(value),minor=Math.round(numeric*100);return Number.isFinite(numeric)&&numeric>0&&Number.isSafeInteger(minor)&&Math.abs(minor-numeric*100)<1e-6?minor:null;};
const exactObservation=(items:RecordData[],offerId:string,productId:string):RecordData|undefined=>{const matches=items.filter(item=>String(item.offer_id)===offerId);return matches.length===1&&String(matches[0].product_id??matches[0].id)===productId?matches[0]:undefined;};

export type BusinessProductSaleState='on_sale'|'out_of_stock'|'pending'|'archived'|'failed'|'not_sellable'|'unknown';
export interface BusinessCatalogStatusSync {
 storeId:string;state:'fresh'|'failed';observedAt:string|null;attemptedAt:string;expiresAt:string|null;total:number;missing:number;
 error?:{code:string;message:string};
}
type StatusSnapshot={metadata:BusinessCatalogStatusSync;items?:RecordData[];response?:AdapterResponse};
const statusSyncFlights=new WeakMap<CoreStore,Map<string,Promise<StatusSnapshot>>>();
const STATUS_MAX_AGE_MS=300000;
const approvedModeration=(product:RecordData)=>/^(approved|accepted|success)$/i.test(String(product.statuses?.moderate_status??product.moderation_status??''));
/** A field failure and an unfinished card take precedence over its empty stock. */
export function businessProductSaleState(product:RecordData):BusinessProductSaleState{
 const statuses=object(product.statuses),stocks=object(product.stocks),visibility=object(product.visibility_details);
 if(product.is_archived===true||product.is_autoarchived===true)return 'archived';
 const code=String(statuses.status??product.status??'').toLowerCase(),moderate=String(statuses.moderate_status??product.moderation_status??'').toLowerCase(),name=String(statuses.status_name??''),description=String(statuses.status_description??''),all=[code,moderate,name,description,statuses.status_failed??''].join(' ').toLowerCase();
 if(code==='archived')return 'archived';
 const errors=Array.isArray(product.errors)?product.errors:[];
 const fieldFailure=errors.some((error:RecordData)=>!/(warning|info)/i.test(String(error.level??error.severity??'')));
 if(fieldFailure||String(statuses.status_failed??'').trim()||/fail|invalid|error/.test(String(statuses.validation_status??'').toLowerCase())||/reject|declin|error|отклон/.test(all))return 'failed';
 const approved=approvedModeration(product),created=statuses.is_created===true;
 if(statuses.is_created===false||!approved&&/pending|moder|processing|imported|creating|на модерац|созда/.test(all))return 'pending';
 const hasStock=stocks.has_stock===true||Array.isArray(stocks.stocks)&&stocks.stocks.some((stock:RecordData)=>typeof stock.present==='number'&&stock.present>0);
 const noStock=stocks.has_stock===false||Array.isArray(stocks.stocks)&&stocks.stocks.length>0&&stocks.stocks.every((stock:RecordData)=>typeof stock.present==='number'&&stock.present<=0);
 if(created&&approved&&noStock&&!hasStock)return 'out_of_stock';
 const blocked=/не продается|not_sellable/.test(all),selling=/продается|в продаже|on[_ ]?sale|selling/.test(all);
 if(created&&approved&&hasStock&&!blocked&&(selling||visibility.has_price===true))return 'on_sale';
 if(blocked||created&&approved&&(noStock||/готов к продаже|нет на складе/.test(all)))return 'not_sellable';
 return 'unknown';
}
/** Keep the existing six-value status contract for older consumers. */
export function businessProductStatus(product:RecordData):string{
 const state=businessProductSaleState(product);return state==='out_of_stock'?'not_sellable':state==='failed'?'rejected':state;
}

const productIdentity=(product:RecordData):{offerId:string;productId:string}|undefined=>{
 const offerId=product.offer_id,productId=String(product.id??product.product_id??'');
 return typeof offerId==='string'&&offerId.length>0&&/^[1-9]\d*$/.test(productId)?{offerId,productId}:undefined;
};
/** Update only directly observed platform facts; procurement and commercial values belong to this app. */
export function recordBusinessProductObservations(store:CoreStore,storeId:string,items:RecordData[],observedAt=new Date().toISOString()):{updated:number;ignored:number}{
 const local=new Map(localBusinessProducts(store,storeId).map(row=>[String(row.offerId),row])),counts=new Map<string,number>();
 for(const product of items){const identity=productIdentity(product);if(identity)counts.set(identity.offerId,(counts.get(identity.offerId)??0)+1);}
 let updated=0,ignored=0;
 store.transaction(()=>{for(const product of items){
  const identity=productIdentity(product),prior=identity?local.get(identity.offerId):undefined;
  if(!identity||counts.get(identity.offerId)!==1||prior&&String(prior.productId)!==identity.productId){ignored++;continue;}
  const history=object(prior?.listingHistory),past=object(prior?.platformProduct),created=product.statuses?.is_created===true,approved=approvedModeration(product);
  const pastCreated=history.created===true||past.statuses?.is_created===true,pastApproved=history.approved===true||approvedModeration(past);
  const legacyOnSale=history.legacyOnSale===true||prior?.status==='on_sale';
  const listingHistory=created||approved||pastCreated||pastApproved||legacyOnSale?{created:pastCreated||created,approved:pastApproved||approved,...(legacyOnSale?{legacyOnSale:true}:{}),observedAt:created||approved?observedAt:history.observedAt??prior?.observedAt??prior?.pricing?.observedAt??observedAt}:undefined;
  const row={...prior,storeId,offerId:identity.offerId,productId:identity.productId,
   ...(product.sku!==undefined?{sku:/^[1-9]\d*$/.test(String(product.sku))?String(product.sku):null}:{}),
   ...(product.name!==undefined?{title:product.name}:{}),status:businessProductStatus(product),saleState:businessProductSaleState(product),observedAt,statusObservation:'observed',
   platformStatus:product.statuses??null,stock:product.stocks??null,platformProduct:product,...(listingHistory?{listingHistory}:{}),statusSyncError:null};
  store.put('business_catalog',hash([storeId,identity.offerId]),JSON.parse(JSON.stringify(row)));updated++;
 }});return {updated,ignored};
}

/** Compatibility reads describe receipt of a response, not completion of a business execution. */
export function compatibilityReadResponse(response:AdapterResponse):AdapterResponse {
 if(!['succeeded','rejected'].includes(response.raw?.outcome))return response;
 return {...response,raw:{...response.raw,outcome:'response_received'}};
}

/** A provider connection can only use stores assigned to that source connection. */
export function connectionBusinessGateway(gateway:OzonBusinessGateway,connectionId:string):OzonBusinessGateway {
 const owns=(id:string)=>{const entry=gateway.getStore(id);return !!entry&&(!entry.sourceConnectionId||entry.sourceConnectionId===connectionId);};
 const rejected=():AdapterResponse=>({status:'failed',error:{code:'STORE_CONNECTION_MISMATCH',message:'店铺不属于当前经营连接。',retryable:false}});
 return new Proxy(gateway,{get(target,key){if(key==='hasStore')return owns;if(key==='getStore')return (id:string)=>owns(id)?gateway.getStore(id):undefined;if(key==='listStores')return ()=>gateway.listStores().filter(entry=>owns(entry.id));if(key==='request')return (id:string,...args:unknown[])=>owns(id)?(gateway.request as any)(id,...args):Promise.resolve(rejected());if(key==='getProducts')return (id:string,...args:unknown[])=>owns(id)?(gateway.getProducts as any)(id,...args):Promise.resolve(rejected());const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}

/** Locally owned sale/source identities. Reading a catalogue never invents a procurement match. */
export function localBusinessProducts(store:CoreStore,storeId:string):RecordData[]{
 const rows=new Map(store.list<RecordData>('business_catalog').filter(row=>row.storeId===storeId).map(row=>[row.offerId,row]));
 for(const saved of store.list<RecordData>('business_procurement_bindings').filter(row=>row.storeId===storeId)){
  const prior=rows.get(saved.target.offerId),components=saved.binding?.components??[],groups=[...new Set(components.map((part:RecordData)=>String(part.itemId)))];
  const sources=groups.map(itemId=>{const parts=components.filter((part:RecordData)=>part.itemId===itemId),origin=prior?.sources?.find((entry:RecordData)=>entry.productId===itemId),evidence=saved.sourceItems?.find((item:RecordData)=>item.id===itemId),selected=(evidence?.skus??[]).filter((sku:RecordData)=>parts.some((part:RecordData)=>part.sourceSkuId===String(sku.sourceSkuId??sku.code??sku.id)));return {...origin,...(evidence?{sourceUrl:evidence.sourceUrl??null,source:evidence.source??null,sourceTitle:evidence.title??null,sourceSpec:selected.map((sku:RecordData)=>sku.spec??sku.name??String(sku.sourceSkuId??sku.code??sku.id)).join(' + ')}:{}),sourceSkuMatched:true,productId:itemId,skuCode:parts.length===1?parts[0].sourceSkuId:`composition:${hash(parts).slice(0,16)}`,components:parts.map((p:RecordData)=>({sourceSkuId:p.sourceSkuId,quantity:p.quantity})),...(parts.length>1||parts[0]?.quantity!==1?{salesSpec:parts.map((p:RecordData)=>`${p.sourceSkuId} × ${p.quantity}`).join(' + ')}:{})};});
  rows.set(saved.target.offerId,{...prior,storeId,offerId:saved.target.offerId,productId:saved.target.productId,sku:saved.target.sku??prior?.sku,sources,procurementBinding:saved.binding,profit:{...prior?.profit,purchaseMinor:saved.binding?.currency==='CNY'&&typeof saved.binding.amount==='number'?Math.round(saved.binding.amount*100):null}});
 }
 return [...rows.values()];
}

/** One-time explicit legacy catalogue import, followed by directly read Ozon facts. Collection methods stay on the source client. */
export function businessConnectedClient(source:CoreClient,gateway:OzonBusinessGateway,store:CoreStore,connectionId:string,collectionSourceMatches=true,pricing?:PricingReader):CoreClient & {storeDataRead:(storeId:string,input:PlatformCallInput)=>Promise<AdapterResponse>;ensureBusinessCatalog:(storeId:string)=>Promise<void>;syncBusinessProductStates:(storeId:string,options?:{refresh?:boolean;maxAgeMs?:number})=>Promise<BusinessCatalogStatusSync>}{
 const stores=()=>gateway.listStores().filter(item=>!item.sourceConnectionId||item.sourceConnectionId===connectionId);
 const owns=(id:string)=>stores().some(item=>item.id===id);
 const catalogImports=new Map<string,Promise<void>>();
 const ensureBusinessCatalog=async(storeId:string):Promise<void>=>{
  const entry=stores().find(item=>item.id===storeId);if(!entry||!entry.legacyStoreId||!collectionSourceMatches||store.get('business_migrations',`catalog:${entry.id}`))return;
  const existing=catalogImports.get(storeId);if(existing)return existing;
  const task=(async()=>{const legacy=await source.getStoreProducts();if(legacy.status!=='ok'||!Array.isArray(legacy.raw?.products))throw new Error('LEGACY_CATALOG_IMPORT_UNAVAILABLE');
   store.transaction(()=>{if(store.get('business_migrations',`catalog:${entry.id}`))return;for(const product of legacy.raw.products.filter((p:RecordData)=>String(p.storeId??p.store_id)===entry.legacyStoreId)){const offerId=String(product.offerId??product.offer_id??'');if(offerId)store.put('business_catalog',hash([entry.id,offerId]),JSON.parse(JSON.stringify({...product,storeId:entry.id,offerId,productId:product.productId??product.product_id,migratedFrom:{connectionId,legacyStoreId:entry.legacyStoreId}})));}store.put('business_migrations',`catalog:${entry.id}`,{at:new Date().toISOString(),connectionId});});
  })();catalogImports.set(storeId,task);try{await task;}finally{catalogImports.delete(storeId);}
 };
 let statusFlights=statusSyncFlights.get(store);if(!statusFlights){statusFlights=new Map();statusSyncFlights.set(store,statusFlights);}
 const failedStatus=(storeId:string,attemptedAt:string,error:{code:string;message:string}):BusinessCatalogStatusSync=>{
  const prior=store.get<BusinessCatalogStatusSync>('business_catalog_status_sync',storeId);
  const metadata:BusinessCatalogStatusSync={storeId,state:'failed',observedAt:prior?.observedAt??null,attemptedAt,expiresAt:attemptedAt,total:prior?.total??0,missing:prior?.missing??0,error};
  store.transaction(()=>{for(const row of localBusinessProducts(store,storeId))store.put('business_catalog',hash([storeId,row.offerId]),{...row,statusObservation:'stale',statusSyncError:error});store.put('business_catalog_status_sync',storeId,metadata);});return metadata;
 };
 const statusSnapshot=async(storeId:string,options:{refresh?:boolean;maxAgeMs?:number}={}):Promise<StatusSnapshot>=>{
  const maxAgeMs=options.maxAgeMs??STATUS_MAX_AGE_MS;
  if(!Number.isFinite(maxAgeMs)||maxAgeMs<0)throw Error('INVALID_STATUS_MAX_AGE');
  const flightKey=`${connectionId}:${storeId}`,active=statusFlights.get(flightKey);if(active)return active;
  const prior=store.get<BusinessCatalogStatusSync>('business_catalog_status_sync',storeId),now=Date.now();
  if(!options.refresh&&prior?.state==='fresh'&&prior.observedAt&&now-Date.parse(prior.observedAt)<maxAgeMs&&now<Date.parse(prior.expiresAt??''))return {metadata:prior};
  const job=(async():Promise<StatusSnapshot>=>{
   const attemptedAt=new Date().toISOString();
   try{
    if(!owns(storeId))return {metadata:{storeId,state:'failed',observedAt:null,attemptedAt,expiresAt:attemptedAt,total:0,missing:0,error:{code:'STORE_CONNECTION_MISMATCH',message:'店铺不属于当前经营连接。'}}};
    const response=await gateway.getProducts(storeId);
    if(response.status!=='ok')return {response,metadata:failedStatus(storeId,attemptedAt,{code:response.error?.code??'PRODUCT_STATUS_SYNC_FAILED',message:response.error?.message??'Ozon 商品状态刷新失败。'})};
    const items=payload(response).items;
    if(!Array.isArray(items))return {metadata:failedStatus(storeId,attemptedAt,{code:'PRODUCT_CATALOG_INVALID',message:'Ozon 商品目录不完整。'})};
    const local=new Map(localBusinessProducts(store,storeId).map(row=>[String(row.offerId),row])),seen=new Set<string>(),seenIds=new Set<string>();
    for(const product of items){const identity=productIdentity(product),old=identity?local.get(identity.offerId):undefined;
     if(!identity||seen.has(identity.offerId)||seenIds.has(identity.productId))return {metadata:failedStatus(storeId,attemptedAt,{code:'PRODUCT_CATALOG_INVALID',message:'商品快照缺少唯一的 Offer 与商品编号。'})};
     if(old&&String(old.productId)!==identity.productId)return {metadata:failedStatus(storeId,attemptedAt,{code:'PRODUCT_IDENTITY_MISMATCH',message:'平台商品身份与已有采购关联不同，未覆盖原关联。'})};
     seen.add(identity.offerId);seenIds.add(identity.productId);
    }
    const observedAt=new Date().toISOString();let missing=0;
    const metadata:BusinessCatalogStatusSync={storeId,state:'fresh',observedAt,attemptedAt,expiresAt:new Date(Date.parse(observedAt)+maxAgeMs).toISOString(),total:items.length,missing:0};
    store.transaction(()=>{
     recordBusinessProductObservations(store,storeId,items,observedAt);
     for(const row of local.values())if(!seen.has(String(row.offerId))){missing++;store.put('business_catalog',hash([storeId,row.offerId]),{...row,status:'unknown',saleState:'unknown',statusObservation:'missing',statusCheckedAt:observedAt,statusSyncError:null});}
     metadata.missing=missing;store.put('business_catalog_status_sync',storeId,metadata);
    });return {metadata,items,response};
   }catch(error){return {metadata:failedStatus(storeId,attemptedAt,{code:'PRODUCT_STATUS_SYNC_FAILED',message:error instanceof Error?error.message:'Ozon 商品状态刷新失败。'})};}
  })();statusFlights.set(flightKey,job);try{return await job;}finally{statusFlights.delete(flightKey);}
 };
 const syncBusinessProductStates=async(storeId:string,options?:{refresh?:boolean;maxAgeMs?:number})=>(await statusSnapshot(storeId,options)).metadata;
 const catalogue=async():Promise<AdapterResponse>=>{
  const configured=stores(),all:RecordData[]=[];let legacy:AdapterResponse|undefined;
  for(const entry of configured)await ensureBusinessCatalog(entry.id);
  for(const entry of configured){
   const snapshot=await statusSnapshot(entry.id,{refresh:true});if(snapshot.metadata.state!=='fresh')return snapshot.response?.status!=='ok'&&snapshot.response?snapshot.response:{status:'failed',error:{...snapshot.metadata.error!,retryable:true}};
   const items=snapshot.items!;
   const prices:RecordData[]=[],attributes:RecordData[]=[];
   for(let start=0;start<items.length;start+=100){
    const offerIds=items.slice(start,start+100).map((item:RecordData)=>String(item.offer_id));
    for(const [path,target] of [['/v5/product/info/prices',prices],['/v4/product/info/attributes',attributes]] as const){
     const observed=await gateway.request(entry.id,{path,body:{filter:{offer_id:offerIds,visibility:'ALL'},limit:100}});
     if(observed.status!=='ok')return observed;target.push(...responseRows(observed));
    }
   }
   const observedAt=new Date().toISOString();
   const local=new Map(localBusinessProducts(store,entry.id).map(product=>[String(product.offerId),product]));
   for(const product of items){const old=local.get(String(product.offer_id)),id=String(product.id??product.product_id),matched=old&&String(old.productId)===id?old:undefined;
    const offerId=String(product.offer_id),priceRow=exactObservation(prices,offerId,id),price=object(priceRow?.price),ordinaryMinor=priceMinor(price.price),sellerMinor=priceMinor(price.marketing_seller_price),currency=typeof price.currency_code==='string'?price.currency_code:null;
    const attribute=exactObservation(attributes,offerId,id),grams=attribute?.weight_unit==='g'&&Number.isSafeInteger(attribute.weight)&&attribute.weight>0?attribute.weight:null;
    const declaredWeight={grams,observedAt,reason:grams===null?'WEIGHT_NOT_VERIFIED':null};
    const mapped:RecordData={...matched,businessFactsVersion:2,storeId:entry.id,storeName:entry.name,offerId,productId:id,sku:product.sku?String(product.sku):null,title:product.name??matched?.title??null,imageUrl:(typeof product.primary_image==='string'?product.primary_image:product.primary_image?.[0])??product.images?.[0]??matched?.imageUrl??null,status:businessProductStatus(product),platformStatus:product.statuses,price:ordinaryMinor!==null?(ordinaryMinor/100).toFixed(2):null,currency,pricing:{sellerMinor,ordinaryMinor,currency,observedAt,reason:!priceRow?'PRICE_IDENTITY_NOT_VERIFIED':sellerMinor===null?'SELLER_PRICE_UNKNOWN':null},declaredWeight,profit:{purchaseMinor:matched?.profit?.purchaseMinor??null,packageGrams:businessWeight({...matched,declaredWeight}).grams,actualMinor:sellerMinor,costMinor:null,profitMinor:null,actualMargin:null},...(matched?.historicalProfit?{historicalProfit:matched.historicalProfit}:matched?.profit&&!matched.profit.pricingQuote&&(matched.profit.costMinor!=null||matched.profit.profitMinor!=null||matched.profit.actualMargin!=null)?{historicalProfit:{...matched.profit,basis:'迁入时的旧平台历史参考，未按当前渠道规则重新计算。'}}:{}),stock:product.stocks,platformProduct:product};const clean=JSON.parse(JSON.stringify(applicationProfit(mapped,entry.id,pricing)));all.push(clean);store.put('business_catalog',hash([entry.id,mapped.offerId]),clean);
   }
  }
  // Unconfigured legacy stores remain available for reading; only configured stores have independent writes.
  if(!configured.length&&!legacy){try{legacy=await source.getStoreProducts();}catch{}}
  const ids=new Set(configured.flatMap(item=>[item.id,item.legacyStoreId].filter(Boolean)));
  const remaining=legacy?.status==='ok'&&Array.isArray(legacy.raw?.products)?legacy.raw.products.filter((p:RecordData)=>!ids.has(String(p.storeId??p.store_id))):[];
  return ok({stores:[...(Array.isArray(legacy?.raw?.stores)?legacy!.raw.stores.filter((s:RecordData)=>!ids.has(String(s.id??s.storeId))):[]),...configured],products:[...remaining,...all]});
 };
 const directRead=async(storeId:string,input:PlatformCallInput):Promise<AdapterResponse>=>{
  if(!owns(storeId))return (source as any).storeDataRead?await (source as any).storeDataRead(storeId,input):{status:'failed',error:{code:'DIRECT_STORE_CONFIGURATION_REQUIRED',message:'店铺尚未配置独立连接。',retryable:false}};
  const response=compatibilityReadResponse(await gateway.request(storeId,{path:input.path,method:input.method,body:input.body as RecordData}));
  if(response.status==='ok'&&input.path==='/v3/product/info/list')recordBusinessProductObservations(store,storeId,responseRows(response));
  return response;
 };
 const category=async(input:CategoryDataInput):Promise<AdapterResponse>=>{
  if(!owns(input.storeId))return source.getCategoryData?source.getCategoryData(input):{status:'failed',error:{code:'CATEGORY_UNAVAILABLE',message:'类目读取未配置。',retryable:false}};
  const p=input as any,base={description_category_id:Number(p.descriptionCategoryId),type_id:Number(p.typeId),language:'DEFAULT'};
  if(p.mode==='search'||p.mode==='sync'){
   const response=await gateway.request(input.storeId,{path:'/v1/description-category/tree',body:{language:'DEFAULT'}});if(response.status!=='ok')return response;
   const found:RecordData[]=[];const visit=(items:RecordData[],parents:string[],parentCategoryId?:number)=>{for(const item of items){const categoryId=item.description_category_id??parentCategoryId,names=[...parents,item.category_name??item.type_name??''].filter(Boolean);if(item.type_id&&categoryId&&(!p.q||names.join(' ').toLowerCase().includes(String(p.q).toLowerCase())))found.push({...item,description_category_id:categoryId,descriptionCategoryId:categoryId,typeId:item.type_id,path:names});visit(item.children??[],names,categoryId);}};visit(payload(response).result??[],[]);
   return ok({storeId:input.storeId,items:p.mode==='search'?found.slice(0,p.limit??10):found,total:found.length,fetchedAt:new Date().toISOString()});
  }
  const path=p.mode==='show'||p.mode==='template'?'/v1/description-category/attribute':p.q?'/v1/description-category/attribute/values/search':'/v1/description-category/attribute/values';
  const response=await gateway.request(input.storeId,{path,body:{...base,...(p.attributeId?{attribute_id:Number(p.attributeId)}:{}),...(p.mode==='values'||p.mode==='validate_value'?{limit:p.limit??100,...(p.q?{value:p.q}:{}),last_value_id:p.lastValueId??0}:{})}});if(response.status!=='ok')return response;
  const data=payload(response);return ok({...data,storeId:input.storeId,...(p.mode==='validate_value'?{valueFound:Array.isArray(data.result)&&data.result.some((value:RecordData)=>Number(value.id)===Number(p.valueId)),note:'返回平台实际选项；未出现在本页不等于无效。'}:{}),fetchedAt:new Date().toISOString()});
 };
 const overrides:Record<string,unknown>={getStoreProducts:catalogue,syncStoreProducts:catalogue,ensureBusinessCatalog,syncBusinessProductStates,storeDataRead:directRead,getCategoryData:category,getStores:async()=>{let legacy:AdapterResponse|undefined;try{if(!stores().length)legacy=await source.getStores();}catch{}const direct=stores(),ids=new Set(direct.flatMap(item=>[item.id,item.legacyStoreId].filter(Boolean)));return ok([...(Array.isArray(legacy?.raw)?legacy!.raw.filter((item:RecordData)=>!ids.has(String(item.id??item.storeId))):[]),...direct]);}};
 return new Proxy(source,{get(target,key){if(typeof key==='string'&&Object.hasOwn(overrides,key))return overrides[key];const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as ReturnType<typeof businessConnectedClient>;
}
