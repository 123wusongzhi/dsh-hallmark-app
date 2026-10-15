import type {AppsRuntime} from '../../app-runtime/src/index.ts';
import type {CoreClient,CoreStore,RecordData} from '../../core/src/types.ts';
import type {CollectionService} from '../../collection/src/index.ts';
import type {OzonBusinessGateway} from '../../ozon-business/src/index.ts';
import {businessConnectedClient,localBusinessProducts,type BusinessCatalogStatusSync} from '../../app-hallmark/src/operations-client.ts';
import {observedSale} from '../../app-hallmark/src/listing-prepare.ts';

export type AssociationState='linked'|'none'|'unknown';
export interface AssociationSource {itemId:string;title:string;available:boolean;skuVerified:boolean;parts:{sourceSkuId:string;quantity:number|null}[]}
export interface AssociationSale {offerId:string;productId:string;title:string;saleState:string;observedAt:string|null;freshness:string;sources:AssociationSource[];association:AssociationState}
export interface AssociationRow {id:string;title:string;association:AssociationState;sales:AssociationSale[]}
export interface AssociationOverview {direction:'sales'|'collection';storeId:string;rows:AssociationRow[];total:number;page:number;pageSize:number;counts:Record<AssociationState,number>;checkedAt:string;warnings:string[]}
type Card={id:string;title:string};
const error=(message:string,statusCode=400):never=>{throw Object.assign(new Error(message),{code:'ASSOCIATION_UNAVAILABLE',statusCode});};

/** Only persisted source IDs establish edges. Names, images and offer prefixes never infer a match. */
export function associationRows(products:RecordData[],cards:Card[],sync:BusinessCatalogStatusSync|undefined,sourceMatches:boolean,collectionComplete:boolean,now=Date.now()):{sales:AssociationRow[];collection:AssociationRow[]} {
  const titles=new Map(cards.map(card=>[card.id,card.title]));
  const sales:AssociationSale[]=products.map(product=>{
    const raw=Array.isArray(product.sources)?product.sources:[];
    const sourceRows:AssociationSource[]=sourceMatches?raw.filter(source=>typeof source?.productId==='string'&&source.productId).map(source=>({itemId:source.productId,title:titles.get(source.productId)??source.sourceTitle??source.productId,available:titles.has(source.productId),skuVerified:source.sourceSkuMatched===true,parts:(Array.isArray(source.components)?source.components:source.skuCode?[{sourceSkuId:source.skuCode,quantity:source.quantity}]:[]).filter((part:RecordData)=>typeof part.sourceSkuId==='string').map((part:RecordData)=>({sourceSkuId:part.sourceSkuId,quantity:Number.isSafeInteger(part.quantity)&&part.quantity>0?part.quantity:null}))})):[];
    const grouped=new Map<string,AssociationSource>();
    for(const source of sourceRows){const prior=grouped.get(source.itemId);if(prior){prior.parts.push(...source.parts);prior.skuVerified=prior.skuVerified&&source.skuVerified;}else grouped.set(source.itemId,{...source,parts:[...source.parts]});}
    const sources=[...grouped.values()];
    const association:AssociationState=sources.length?'linked':sourceMatches&&Array.isArray(product.sources)&&!raw.length?'none':'unknown';
    return {offerId:String(product.offerId),productId:String(product.productId??''),title:String(product.title??product.platformProduct?.name??product.offerId),...observedSale(product,sync,now),sources,association};
  });
  const complete=collectionComplete&&sourceMatches&&sync?.state==='fresh'&&sync.missing===0&&Date.parse(sync.expiresAt??'')>now&&Date.parse(sync.observedAt??'')<=now&&now-Date.parse(sync.observedAt??'')<=300000;
  const allSourcesKnown=sales.every(sale=>sale.association!=='unknown'&&sale.sources.every(source=>source.skuVerified&&source.available));
  const reverse=new Map<string,AssociationSale[]>();
  for(const sale of sales)for(const id of new Set(sale.sources.map(source=>source.itemId))){const list=reverse.get(id)??[];list.push(sale);reverse.set(id,list);}
  return {sales:sales.map(sale=>({id:sale.offerId,title:sale.title,association:sale.association,sales:[sale]})),collection:cards.map(card=>{const linked=reverse.get(card.id)??[];return {...card,association:linked.length?'linked':complete&&allSourcesKnown?'none':'unknown',sales:linked};})};
}

export class AssociationOverviewService {
  readonly options:{runtime:AppsRuntime;gateway:OzonBusinessGateway;storeFor:(id:string)=>CoreStore;clientFor:(id:string)=>CoreClient;collectionFor:(id:string)=>Pick<CollectionService,'search'>;sourceMatches:(id:string)=>boolean};
  constructor(options:AssociationOverviewService['options']){this.options=options;}
  async read(query:Record<string,string>,signal?:AbortSignal):Promise<AssociationOverview>{
    const allowed=['connectionId','storeId','direction','association','saleState','query','focus','page','refresh'];
    if(Object.keys(query).some(key=>!allowed.includes(key)))error('未知的关联查询参数。');
    const {connectionId,storeId}=query,direction=query.direction??'sales',association=query.association??'all',saleState=query.saleState??'all',term=(query.query??'').trim().toLocaleLowerCase(),page=Number(query.page??1),pageSize=30;
    if(!connectionId||!storeId||!['sales','collection'].includes(direction)||!['all','linked','none','unknown'].includes(association)||!['all','on_sale','out_of_stock','pending','archived','failed','not_sellable','unknown'].includes(saleState)||!Number.isSafeInteger(page)||page<1||term.length>200||(query.focus?.length??0)>200||query.refresh!==undefined&&!['true','false'].includes(query.refresh))error('关联查询参数无效。');
    if(!this.options.runtime.getConnection('hallmark',connectionId)?.enabled)error('经营连接不可用。',409);
    const selected=this.options.gateway.getStore(storeId);if(!selected||selected.sourceConnectionId!==connectionId)error('店铺不属于当前连接。',404);
    const store=this.options.storeFor(connectionId),matches=this.options.sourceMatches(connectionId),client=businessConnectedClient(this.options.clientFor(connectionId),this.options.gateway,store,connectionId,matches),warnings:string[]=[];
    signal?.throwIfAborted();
    let catalogueComplete=true;
    try{await client.ensureBusinessCatalog(storeId);}catch{catalogueComplete=false;warnings.push('历史来源关联读取失败，未记录的关系不能判定为未关联。');}
    const sync=await client.syncBusinessProductStates(storeId,{refresh:query.refresh==='true'});
    if(sync.state!=='fresh')warnings.push(sync.error?.message??'店铺状态更新失败，在售状态暂未确认。');
    if(!matches)warnings.push('当前采集来源与关联记录的来源不一致，未将同号商品自动关联。');
    const cards:Card[]=[],seen=new Set<string>(),cursors=new Set<string>();let cursor:string|undefined,complete=true;
    try{
      do{
        signal?.throwIfAborted();
        const result=await this.options.collectionFor(connectionId).search({limit:100,...(cursor?{cursor}:{refresh:query.refresh==='true'})});
        if(!Array.isArray(result.items))throw Error('INVALID_COLLECTION_INDEX');
        for(const item of result.items)if(!seen.has(String(item.id))){seen.add(String(item.id));cards.push({id:String(item.id),title:String(item.title??item.id)});}
        cursor=result.nextCursor??undefined;
        if(cursor){if(cursors.has(cursor)||cursors.size>=10000)throw Error('INVALID_COLLECTION_CURSOR');cursors.add(cursor);}
      }while(cursor);
    }catch{signal?.throwIfAborted();complete=false;warnings.push('采集箱读取未完成；仅展示已读取记录，不能据此判断没有关联。');}
    signal?.throwIfAborted();
    const rows=associationRows(localBusinessProducts(store,storeId),cards,sync,matches,complete&&catalogueComplete)[direction as 'sales'|'collection'];
    const searched=rows.filter(row=>(!query.focus||row.id===query.focus)&&(!term||[row.id,row.title,...row.sales.flatMap(sale=>[sale.offerId,sale.productId,sale.title,...sale.sources.flatMap(source=>[source.itemId,source.title,...source.parts.map(part=>part.sourceSkuId)])])].some(value=>value.toLocaleLowerCase().includes(term))));
    const counts={linked:0,none:0,unknown:0};for(const row of searched)counts[row.association]++;
    const filtered=searched.filter(row=>(association==='all'||row.association===association)&&(saleState==='all'||row.sales.some(sale=>sale.saleState===saleState))).sort((a,b)=>a.id.localeCompare(b.id));
    const current=Math.min(page,Math.max(1,Math.ceil(filtered.length/pageSize)));
    return {direction:direction as 'sales'|'collection',storeId,rows:filtered.slice((current-1)*pageSize,current*pageSize),total:filtered.length,page:current,pageSize,counts,checkedAt:new Date().toISOString(),warnings};
  }
}
