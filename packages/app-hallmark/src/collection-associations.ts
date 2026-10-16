import {createHash} from 'node:crypto';
import type {CoreStore,RecordData} from '../../core/src/types.ts';
import {localBusinessProducts} from './operations-client.ts';
import {collectionListingStates,observedSale} from './listing-prepare.ts';

export interface CollectionAssociationsInput {id:string;storeId:string;cursor?:string;limit?:number;refresh?:boolean}
const fail=(code:string,message:string):never=>{throw Object.assign(new Error(message),{code});};

/** Exact source IDs only. Titles and model names are never identity evidence. */
export function readCollectionAssociations(store:CoreStore,input:CollectionAssociationsInput){
 const {id,storeId}=input;
 const state=collectionListingStates(store,[storeId],[id])[id][0];
 const sync=store.get<RecordData>('business_catalog_status_sync',storeId),now=Date.now();
 const linked=[...new Map(localBusinessProducts(store,storeId).filter(p=>typeof p.offerId==='string'&&p.offerId&&p.sources?.some((s:RecordData)=>s.productId===id)).map(p=>[p.offerId,p])).values()].sort((a,b)=>a.offerId.localeCompare(b.offerId));
 const offers=linked.map(p=>({offerId:p.offerId,productId:p.productId==null?null:String(p.productId),title:String(p.title??'').slice(0,160),...observedSale(p,sync,now),sources:p.sources.filter((s:RecordData)=>s.productId===id).map((s:RecordData)=>({itemId:id,skuMatched:s.sourceSkuMatched===true,components:s.components?.map((c:RecordData)=>({sourceSkuId:c.sourceSkuId,quantity:c.quantity??null}))??[{sourceSkuId:s.skuCode??null,quantity:null}]}))}));
 const currentSale=(state.saleStates?.on_sale??0)>0?'on_sale':state.association==='unknown'||state.freshness!=='fresh'||(state.saleStates?.unknown??0)>0?'unknown':'not_on_sale';
 const conclusion=linked.length?'linked_offers':state.savedListingCount?'saved_listing_only':state.listingRecord==='unavailable'?'unavailable':state.hasUnlinkedHistory||state.association==='unknown'?'unresolved_history':'no_linked_record';
 const messages={linked_offers:'已找到按采集商品 ID 关联的销售商品；当前是否在售以 currentSale 和逐条 saleState 为准。',saved_listing_only:'仅找到已保存的上品记录，不能当作成功上架或当前在售。',unavailable:'关联状态暂不可完整核实；保留已知证据，不得判断从未上架。',unresolved_history:'未找到本商品的精确销售关联，但存在未关联或未完整核实的历史；不能判断从未上架。',no_linked_record:'当前记录中未找到本商品的销售关联；不证明平台历史从未上架。'};
 const summary={id,storeId,matchBasis:'source_item_id',conclusion,message:messages[conclusion],currentSale,listingRecord:state.listingRecord,listingRecordReason:state.listingRecordReason,association:state.association,savedListingCount:state.savedListingCount??0,hasUnlinkedHistory:state.hasUnlinkedHistory,offerCount:state.offerCount,associatedSkuCount:state.associatedSkuCount,listedSkuCount:state.listedSkuCount,saleStates:state.saleStates,observedAt:state.observedAt,freshness:state.freshness,historyExhaustive:false};
 const revision=createHash('sha256').update(JSON.stringify({summary,offers})).digest('hex');
 let offset=0;
 if(input.cursor){let value:any;try{value=JSON.parse(Buffer.from(input.cursor,'base64url').toString());}catch{return fail('COLLECTION_CURSOR_INVALID','关联分页引用无效。');}
  if(!value||typeof value!=='object'||Array.isArray(value)||value.id!==id||value.storeId!==storeId||!Number.isSafeInteger(value.offset)||value.offset<0||value.offset>offers.length)return fail('COLLECTION_CURSOR_INVALID','关联分页与当前商品或店铺不一致。');
  if(value.revision!==revision)return fail('COLLECTION_REVISION_CHANGED','关联或状态已更新，请不带 cursor 重新读取。');offset=value.offset;
 }
 const page:typeof offers=[];
 const result=()=>{const end=offset+page.length,nextCursor=end<offers.length?Buffer.from(JSON.stringify({id,storeId,revision,offset:end})).toString('base64url'):null;return {...summary,revision,offers:page,returned:page.length,total:offers.length,nextCursor,...(nextCursor?{continuation:{capabilityId:'hallmark.collection.associations',input:{id,storeId,cursor:nextCursor,limit:input.limit??20}}}:{}),guidance:'依据精确关联回答，不再轮流用型号或标题搜索 products.list、collection.search；未知保持未知。需要更新状态时仅对本查询 refresh:true 一次。'};};
 for(const offer of offers.slice(offset,offset+Math.max(1,Math.min(input.limit??20,50)))){page.push(offer);if(Buffer.byteLength(JSON.stringify(result()))>14*1024){page.pop();if(!page.length)return fail('COLLECTION_ASSOCIATION_TOO_LARGE','单条销售关联过大，无法完整返回；不能将缺失数据当作无关联。');break;}}
 return result();
}
