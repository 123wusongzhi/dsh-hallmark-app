import {createHash} from 'node:crypto';
import type {CoreClient,CoreStore,RecordData} from '../../core/src/types.ts';
import type {CollectionService,CollectionProduct,CollectionPackage,CollectionListingState,CollectionSaleState} from '../../collection/src/index.ts';
import type {BusinessPackagingRepository,PackagingMember} from '../../business-packaging/src/index.ts';
import type {BusinessPricingRepository} from '../../business-pricing/src/index.ts';
import {localBusinessProducts,businessProductSaleState} from './operations-client.ts';
import {readExistingCategoryHint} from './packaging-evidence.ts';
import type {BusinessPlan} from './operations/types.ts';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
const clean=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const fail=(code:string,message:string):never=>{throw Object.assign(new Error(`${code}: ${message}`),{code});};
export function packageValues(value:CollectionPackage|null|undefined){return {weightKg:value?.weightGrams==null?null:value.weightGrams/1000,dimensionsCm:value?.dimensionsMm?{length:value.dimensionsMm.length/10,width:value.dimensionsMm.width/10,height:value.dimensionsMm.height/10}:null};}
export function packagingMembers(products:CollectionProduct[],members:Array<{itemId:string;sourceSkuId:string;quantity:number}>):PackagingMember[]{return members.map(part=>{const product=products.find(p=>p.id===part.itemId),matches=product?.skus.filter(s=>s.id===part.sourceSkuId)??[];if(!product||matches.length!==1)throw Error('SOURCE_SKU_NOT_FOUND');return {...part,skuPackage:packageValues(matches[0].package),commonPackage:packageValues(product.package),sourceRevision:product.revision,title:matches[0].spec};});}

const STATUS_MAX_AGE_MS=5*60*1000;
const saleStates:CollectionSaleState[]=['on_sale','out_of_stock','pending','archived','failed','not_sellable','unknown'];
function observedSale(product:RecordData,sync:RecordData|undefined,now:number):{saleState:CollectionSaleState;observedAt:string|null;freshness:'fresh'|'stale'|'unknown'}{
 const timestamp=Date.parse(product.observedAt??''),observedAt=Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
 const freshness=product.statusObservation==='missing'||observedAt===null?'unknown':product.statusObservation==='stale'||now-timestamp>STATUS_MAX_AGE_MS||timestamp>now||sync?.state==='failed'&&Date.parse(sync.attemptedAt??'')>=timestamp?'stale':'fresh';
 const raw=product.platformProduct??{...product,statuses:product.platformStatus,stocks:product.stock};
 const saleState=freshness==='fresh'?(saleStates.includes(product.saleState)?product.saleState:businessProductSaleState(raw)):'unknown';
 return {saleState,observedAt,freshness};
}
function successfulListing(product:RecordData):boolean{
 const native=product.platformProduct?.statuses??product.platformStatus??{},history=product.listingHistory??{};
 // A failed import can still have a product ID. Neither a binding nor not_sellable proves creation.
 return history.created===true||history.legacyOnSale===true||native.is_created===true||native.is_created!==false&&(history.approved===true||/^(approved|accepted)$/i.test(String(native.moderate_status??'')))||product.status==='on_sale';
}
const sourceSkuIds=(product:RecordData,itemId:string):string[]=>product.sources.filter((source:RecordData)=>source.productId===itemId&&source.sourceSkuMatched===true).flatMap((source:RecordData)=>source.components?.map((part:RecordData)=>part.sourceSkuId)??[source.skuCode]).filter((id:unknown):id is string=>typeof id==='string'&&!!id);

/** Historical successful source coverage and currently observed sale offers are different facts. */
export function collectionListingStates(store:CoreStore,storeIds:string[],itemIds:string[],summaries:Array<{id:string;skuCount:number;skuIds?:string[]}>=[]):Record<string,CollectionListingState[]>{
 const result:Record<string,CollectionListingState[]>={},catalogues=new Map(storeIds.map(id=>[id,localBusinessProducts(store,id)])),now=Date.now();
 const plans=store.list<BusinessPlan>('business_plans');
 for(const itemId of itemIds){result[itemId]=[];for(const storeId of storeIds){
  const catalogue=catalogues.get(storeId)!,sync=store.get<RecordData>('business_catalog_status_sync',storeId);
  const linked=[...new Map(catalogue.filter(product=>typeof product.offerId==='string'&&product.offerId&&product.sources?.some((source:RecordData)=>source.productId===itemId)).map(product=>[product.offerId,product])).values()];
  const associatedSkuIds=[...new Set(linked.flatMap(product=>sourceSkuIds(product,itemId)))].sort(),listedSkuIds=[...new Set(linked.filter(successfulListing).flatMap(product=>sourceSkuIds(product,itemId)))].sort();
  const summary=summaries.find(row=>row.id===itemId),complete=!!summary&&summary.skuCount>0&&(summary.skuIds?summary.skuIds.length===summary.skuCount&&summary.skuIds.every(id=>listedSkuIds.includes(id)):listedSkuIds.length===summary.skuCount);
  const observations=linked.map(product=>observedSale(product,sync,now)),counts=Object.fromEntries(saleStates.map(state=>[state,observations.filter(row=>row.saleState===state).length])) as Record<CollectionSaleState,number>;
  const completeCatalogue=sync?.state==='fresh'&&Number.isFinite(Date.parse(sync.observedAt??''))&&now-Date.parse(sync.observedAt)<=STATUS_MAX_AGE_MS&&Date.parse(sync.expiresAt??'')>now&&sync.missing===0;
  const allSourcesKnown=catalogue.every(product=>product.sources?.length&&product.sources.every((source:RecordData)=>source.sourceSkuMatched===true));
  const association=linked.length?'linked':completeCatalogue&&allSourcesKnown?'none':'unknown';
  const savedListingCount=plans.filter(plan=>plan.storeId===storeId).reduce((count,plan)=>count+plan.rows.filter(row=>row.action==='listing'&&row.procurement?.some(part=>part.itemId===itemId)).length,0);
  // A complete record lookup need not resolve unrelated old source identities or missing offers.
  const lookupReady=sync?.state==='fresh'&&Number.isFinite(Date.parse(sync.observedAt??''))&&now-Date.parse(sync.observedAt)>=0&&now-Date.parse(sync.observedAt)<=STATUS_MAX_AGE_MS&&Date.parse(sync.expiresAt??'')>now;
  const listingRecord=linked.length||savedListingCount?'found':lookupReady?'not_found':'unavailable';
  const listingRecordReason=linked.length?'EXACT_SALE_LINK':savedListingCount?'SAVED_LISTING':lookupReady?'NO_LOCAL_LISTING_RECORD':sync?.state==='failed'?'RECORD_SYNC_FAILED':sync?'RECORD_SYNC_EXPIRED':'RECORD_SYNC_REQUIRED';
  const freshness=observations.some(row=>row.freshness==='stale')?'stale':observations.some(row=>row.freshness==='unknown')?'unknown':observations.length?'fresh':completeCatalogue?'fresh':sync?.state==='failed'?'stale':'unknown';
  const times=observations.map(row=>row.observedAt).filter((at):at is string=>at!==null).sort();
  result[itemId].push({storeId,...(catalogue.find(product=>product.storeName)?.storeName?{storeName:catalogue.find(product=>product.storeName)!.storeName}:{}),status:complete?'listed':listedSkuIds.length?'partial':association==='none'?'not_listed':'unknown',listingRecord,listingRecordReason,...(savedListingCount?{savedListingCount}:{}),hasUnlinkedHistory:!allSourcesKnown,listedSkuIds,listedSkuCount:listedSkuIds.length,association,associatedSkuIds,associatedSkuCount:associatedSkuIds.length,offerCount:linked.length,saleStates:counts,countUnit:'offers',observedAt:linked.length?(times[0]??null):(sync?.observedAt??null),freshness});
 }}return result;
}
export interface ListingPrepareInput {
 storeId:string;selections?:Array<{id:string;skuIds?:string[];cursor?:string;revision?:string}>;
 compositions?:Array<{id:string;members:Array<{itemId:string;sourceSkuId:string;quantity:number}>}>;
 knownRevisions?:Record<string,string>;categoryQuery?:string;categories?:Record<string,{descriptionCategoryId:string;typeId:string}>;
 maxBytes?:number;salesLimit?:number;cursor?:string;refresh?:boolean;includeOptionalAttributes?:boolean;
}
interface PrepareOptions {collection:CollectionService;packaging:BusinessPackagingRepository;pricing?:Pick<BusinessPricingRepository,'read'|'quote'>;client:CoreClient;store:CoreStore;listingStates?:(ids:string[])=>Record<string,CollectionListingState[]>;prepareProducts?:(products:CollectionProduct[])=>Promise<CollectionProduct[]>}
type Part={kind:'material'|'sale'|'reused'|'existingLinks'|'listingRecord';data:any}|{kind:'category';id:string;data:any};
interface Preparation {storeId:string;revision:string;createdAt:string;parts:Part[];totals:{materials:number;sales:number;categories:number};rules:any;sourceRevisions:Record<string,string>}
const NEXT='按已返回资料制作标题、属性和图片；草稿只填写原生 Ozon 字段及 procurement 引用，包装和自动售价由程序填入。缺失值为 null 时补充具体事实。';

function scope(input:ListingPrepareInput){
 const selections=input.selections;if(!Array.isArray(selections)||!selections.length||selections.length>30)fail('PREPARE_SELECTION_REQUIRED','选择 1 至 30 个商品。');
 const ids=new Set<string>();for(const selection of selections!){if(!selection.id||ids.has(selection.id))fail('PREPARE_DUPLICATE_SELECTION','商品范围必须是互不重复的稳定 ID。');ids.add(selection.id);if(selection.skuIds&&(!selection.skuIds.length||new Set(selection.skuIds).size!==selection.skuIds.length))fail('PREPARE_SKU_SCOPE_INVALID','指定 SKU 时需提供非空且不重复的范围。');}
 if(input.compositions){if(!input.compositions.length||input.compositions.length>200)fail('PREPARE_COMPOSITION_INVALID','销售组成需为 1 至 200 行。');const names=new Set<string>();for(const row of input.compositions){if(!row.id||names.has(row.id)||!row.members?.length||row.members.length>100)fail('PREPARE_COMPOSITION_INVALID','每个销售组成须有独立 ID 和 1 至 100 个成员。');names.add(row.id);for(const member of row.members)if(!Number.isSafeInteger(member.quantity)||member.quantity<1)fail('PREPARE_QUANTITY_INVALID','组成数量必须是正整数。');}}
 return selections!;
}
function compactRules(config:ReturnType<BusinessPricingRepository['read']>){if(!config)return null;return {revision:config.revision,currency:config.currency,logisticsSelection:config.logisticsSelection??'fixed',listingTargetMarginPpm:config.listingTargetMarginPpm,minimumMarginPpm:config.minimumMarginPpm,minPriceMinor:config.minPriceMinor,maxPriceMinor:config.maxPriceMinor,maxAutoPriceMinor:config.maxAutoPriceMinor,logisticsPlans:config.plans.length,available:{capability:'hallmark.pricing.read',input:{storeId:config.storeId}}};}
function compactQuote(quote:ReturnType<BusinessPricingRepository['quote']>|null){if(!quote)return null;return {status:quote.status,configRevision:quote.configRevision,planId:quote.planId,planName:quote.planName,currency:quote.currency,suggestedPriceMinor:quote.suggestedPriceMinor,minimumAllowedPriceMinor:quote.minimumAllowedPriceMinor,targetMarginPpm:quote.targetMarginPpm,breakdown:quote.breakdown,issues:quote.issues,warnings:quote.warnings};}

async function categoryParts(product:CollectionProduct,input:ListingPrepareInput,options:PrepareOptions):Promise<Part[]>{
 const hint=readExistingCategoryHint(options.store,product.id),specified=input.categories?.[product.id]??(hint?{descriptionCategoryId:String(hint.descriptionCategoryId),typeId:String(hint.typeId)}:undefined),query=input.categoryQuery??product.category.path.at(-1)??product.originalTitle??product.title;
 const request=specified?{mode:'template' as const,storeId:input.storeId,...specified}:{mode:'search' as const,storeId:input.storeId,q:query.slice(0,190),limit:8};
 if(!options.client.getCategoryData)return [{kind:'category',id:product.id,data:{status:'unavailable'}}];
 const key=hash(request);let cached=options.store.get<RecordData>('business_category_preparation',key);
 if(input.refresh||!cached||Date.now()-Date.parse(cached.at)>24*60*60*1000){const response=await options.client.getCategoryData(request);cached={at:new Date().toISOString(),status:response.status,data:response.raw??null,error:response.error??null};if(response.status==='ok')options.store.put('business_category_preparation',key,cached);}
 if(cached.status!=='ok')return [{kind:'category',id:product.id,data:{status:'unavailable',error:cached.error}}];
 const raw=cached.data?.response??cached.data??{},revision=hash(raw);
 if(!specified){const values=raw.items??raw.result?.items??raw.result??[],items=Array.isArray(values)?values.slice(0,8).map((value:any)=>({descriptionCategoryId:value.descriptionCategoryId??value.description_category_id,typeId:value.typeId??value.type_id,name:value.type_name??value.category_name??value.name,path:value.path})):[];return [{kind:'category',id:product.id,data:{status:'candidates',revision,items,total:raw.total??items.length,query:request}}];}
 const values=raw.result??raw.attributes??raw.items??[],attributes=Array.isArray(values)?values:[],required=(value:any)=>value.is_required===true||value.required===true;
 const base={status:'selected',revision,selection:specified,...(hint&&!input.categories?.[product.id]?{basis:'exact-platform-binding'}:{}),totalAttributes:attributes.length,requiredAttributes:attributes.filter(required).length,optionalAttributes:attributes.filter(value=>!required(value)).length,scope:input.includeOptionalAttributes?'all':'required',available:{capability:'hallmark.categories.read',input:request}};
 const parts:Part[]=[{kind:'category',id:product.id,data:{...base,attributes:[]}}];
 for(const attribute of [...attributes.filter(required),...(input.includeOptionalAttributes?attributes.filter(value=>!required(value)):[])]){
  // Platform constraints stay intact. Full choice dictionaries are fetched only for a chosen field.
  const omitted=['values','dictionary_values','options'].filter(field=>Array.isArray(attribute[field]));
  const value:Record<string,unknown>=Object.fromEntries(Object.entries(attribute).filter(([field])=>!omitted.includes(field)));
  if(omitted.length)value.available={capability:'hallmark.categories.read',input:{storeId:input.storeId,mode:'values',...specified,attributeId:String(attribute.id??attribute.attribute_id),limit:100}};
  parts.push({kind:'category',id:product.id,data:{...base,attributes:[value]}});
 }
 return parts;
}
function page(preparation:Preparation,offset:number,input:ListingPrepareInput){
 const requested=input.maxBytes??14000,salesLimit=input.salesLimit??40;if(!Number.isInteger(requested)||requested<2048||requested>65536||!Number.isInteger(salesLimit)||salesLimit<1||salesLimit>100)fail('PREPARE_PAGE_INVALID','响应预算为 2048 至 65536 字节，每页销售行为 1 至 100。');
 // Leave room for the Runtime result envelope inside the real Host's 16 KiB limit.
 // A caller asking for a larger page must still receive intact continuation data.
 const budget=Math.min(requested,14000);
 const make=(end:number)=>{
  const parts=preparation.parts.slice(offset,end),materials=parts.filter(part=>part.kind==='material').map(part=>part.data),sales=parts.filter(part=>part.kind==='sale').map(part=>part.data),reused=parts.filter(part=>part.kind==='reused').map(part=>part.data),existingLinks=parts.filter(part=>part.kind==='existingLinks').map(part=>part.data),categories:Record<string,any>={};
  for(const part of parts)if(part.kind==='category'){const prior=categories[part.id];categories[part.id]={...part.data,...(part.data.attributes?{attributes:[...(prior?.attributes??[]),...part.data.attributes]}:{})};}
  for(const category of Object.values(categories))if(category.attributes)category.returnedAttributes=category.attributes.length;
  const cursor=end<preparation.parts.length?Buffer.from(JSON.stringify({revision:preparation.revision,offset:end})).toString('base64url'):null;
  return {storeId:preparation.storeId,preparationRevision:preparation.revision,preparedAt:preparation.createdAt,listingRecords:parts.filter(part=>part.kind==='listingRecord').map(part=>part.data),materials:materials.length?{items:materials,returned:materials.length}:null,reused,sales,...(existingLinks.length?{existingLinks}:{}),rules:offset===0?preparation.rules:null,categories,totals:preparation.totals,completeness:cursor?'partial':'complete',continuation:cursor?{capability:'hallmark.listing.prepare',input:{storeId:preparation.storeId,cursor,maxBytes:budget,salesLimit}}:null,next:offset===0?NEXT:'当前页延续同一份准备结果；existingLinks 按 saleId 和 offset 延续对应销售组成的完整关联，无需重复读取已返回资料。'};
 };
 let end=offset,sales=0;while(end<preparation.parts.length){if(preparation.parts[end].kind==='sale'&&sales>=salesLimit)break;const candidate=make(end+1);if(bytes(candidate)>budget)break;if(preparation.parts[end].kind==='sale')sales++;end++;}
 if(end===offset&&offset<preparation.parts.length)fail('PREPARE_BUDGET_TOO_SMALL','一个完整资料单元超过当前预算，请提高 maxBytes 后读取；未返回截断内容。');
 return make(end);
}
export async function prepareListing(input:ListingPrepareInput,options:PrepareOptions){
 const {collection,packaging,client,store,pricing}=options;
 const stores=await client.getStores();if(stores.status!=='ok'||!Array.isArray(stores.raw)||!stores.raw.some(value=>String(value.id??value.storeId)===input.storeId))fail('STORE_NOT_FOUND','目标店铺不在当前经营连接中。');
 if(input.cursor){
  if(input.selections||input.compositions||input.categories||input.knownRevisions||input.refresh||input.categoryQuery||input.includeOptionalAttributes)fail('PREPARE_CURSOR_SCOPE','续页只传原店铺、cursor 与分页大小；更改商品范围时重新准备。');
  let value:any;try{value=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{return fail('PREPARE_CURSOR_INVALID','准备资料续页无效。');}
  const saved=store.get<Preparation>('business_listing_preparations',String(value.revision));
  if(!saved||saved.storeId!==input.storeId||!Number.isInteger(value.offset)||value.offset<0||value.offset>=saved.parts.length)fail('PREPARE_CURSOR_INVALID','准备资料续页与当前店铺不匹配或已不存在。');
  return page(saved!,value.offset,input);
 }
 const selections=scope(input);await (client as CoreClient&{ensureBusinessCatalog?:(id:string)=>Promise<void>}).ensureBusinessCatalog?.(input.storeId);
 const originals=await Promise.all(selections.map(selection=>collection.getProduct(selection.id,{refresh:input.refresh}))),products=options.prepareProducts?await options.prepareProducts(originals):originals;
 const allowed=new Map(selections.map(selection=>[selection.id,new Set(selection.skuIds??products.find(product=>product.id===selection.id)!.skus.map(sku=>sku.id).filter((id):id is string=>!!id))]));
 for(const selection of selections){const product=products.find(product=>product.id===selection.id)!;if(selection.revision&&selection.revision!==product.revision)fail('COLLECTION_REVISION_CHANGED','所选采集资料已更新，请采用当前版本。');for(const id of selection.skuIds??[])if(!product.skus.some(sku=>sku.id===id))fail('SOURCE_SKU_NOT_FOUND','选中的 SKU 不属于对应商品。');if(!allowed.get(selection.id)!.size)fail('SOURCE_SKU_NOT_FOUND','所选商品没有可稳定关联的 SKU。');}
 const compositions=input.compositions??selections.flatMap(selection=>[...allowed.get(selection.id)!].map(id=>({id:`${selection.id}:${id}`,members:[{itemId:selection.id,sourceSkuId:id,quantity:1}]})));
 for(const composition of compositions)for(const member of composition.members)if(!allowed.get(member.itemId)?.has(member.sourceSkuId))fail('COMPOSITION_OUTSIDE_SELECTION','销售组成超出本次选中的商品或 SKU。');
 const config=pricing?.read(input.storeId),existing=localBusinessProducts(store,input.storeId),parts:Part[]=[],reused=originals.filter(product=>input.knownRevisions?.[product.id]===product.revision),toRead=selections.filter(selection=>!reused.some(product=>product.id===selection.id));
 const recordStates=options.listingStates?options.listingStates(products.map(p=>p.id)):collectionListingStates(store,[input.storeId],products.map(p=>p.id));
 for(const product of products){const state=recordStates[product.id]?.find(state=>state.storeId===input.storeId);parts.push({kind:'listingRecord',data:{itemId:product.id,listingRecord:state?.listingRecord??'unavailable',reason:state?.listingRecordReason??'RECORD_SOURCE_UNAVAILABLE',savedListingCount:state?.savedListingCount??0,...(state?.savedListingCount?{available:{capability:'hallmark.plan.list',input:{storeId:input.storeId}}}:{})}});}
 for(const product of reused)parts.push({kind:'reused',data:{id:product.id,revision:product.revision,skuIds:[...allowed.get(product.id)!],available:{capability:'hallmark.collection.read',input:{id:product.id,skuIds:[...allowed.get(product.id)!],revision:product.revision}}}});
 if(toRead.length){let materials=await collection.read({selections:toRead,maxBytes:11000});for(;;){for(const item of materials.items)parts.push({kind:'material',data:item});if(!materials.continuation)break;materials=await collection.read(materials.continuation.input);}}
 for(const product of products)parts.push(...await categoryParts(product,input,options));
 for(const composition of compositions){
  const resolved=packaging.resolve({members:packagingMembers(products,composition.members),...(composition.members.length>1||composition.members[0].quantity!==1?{combinationId:composition.id}:{})});let purchase=0,known=true;
  for(const member of composition.members){const cost=products.find(product=>product.id===member.itemId)!.skus.find(sku=>sku.id===member.sourceSkuId)!.purchaseCost,amount=cost?Number(cost.amount):NaN;if(!cost||cost.currency!=='CNY'||!Number.isFinite(amount)||amount<0)known=false;else purchase+=amount*member.quantity;}
  const purchaseMinor=known&&Number.isSafeInteger(Math.round(purchase*100))?Math.round(purchase*100):null,quote=config&&pricing?pricing.quote({storeId:input.storeId,action:'listing',purchaseMinor,weightGrams:resolved.weightGrams,priceMinor:null,pricingMode:'automatic'}):null;
  const links=existing.filter(product=>product.sources?.some((source:RecordData)=>composition.members.some(member=>source.productId===member.itemId&&(source.components?.some((part:RecordData)=>part.sourceSkuId===member.sourceSkuId)||source.skuCode===member.sourceSkuId)))).map(product=>({offerId:product.offerId,productId:product.productId,status:product.status??'unknown',association:'linked',...observedSale(product,store.get<RecordData>('business_catalog_status_sync',input.storeId),Date.now()),scope:'contains_source_sku'}));
  parts.push({kind:'sale',data:{id:composition.id,procurement:composition.members,purchaseMinor,packaging:{weightGrams:resolved.weightGrams,dimensionsMm:resolved.dimensionsMm,origin:resolved.origin,missing:resolved.missing,version:resolved.version},quote:compactQuote(quote),existingLinks:links.slice(0,10),...(links.length>10?{existingLinkCount:links.length,existingLinksComplete:false,existingLinksContinuation:'同一准备结果的 existingLinks 批次按 saleId/offset 续读'}:{})}});
  for(let offset=10;offset<links.length;offset+=10)parts.push({kind:'existingLinks',data:{saleId:composition.id,offset,total:links.length,links:links.slice(offset,offset+10)}});
 }
 const snapshot={storeId:input.storeId,createdAt:new Date().toISOString(),parts:clean(parts),rules:compactRules(config),sourceRevisions:Object.fromEntries(originals.map(product=>[product.id,product.revision])),totals:{materials:originals.length,sales:compositions.length,categories:products.length}},preparation:Preparation={...snapshot,revision:hash(snapshot)};
 store.put('business_listing_preparations',preparation.revision,preparation);return page(preparation,0,input);
}
