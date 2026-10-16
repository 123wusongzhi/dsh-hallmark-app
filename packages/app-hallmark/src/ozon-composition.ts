import type {DataSourceDraft,DataSourceParameter,FieldFormat} from '../../app-presentation/src/types.ts';
import {OZON_FIELD_META} from './ozon-fields.ts';

/** Browser-safe business catalog; no platform clients, secrets or Node imports. */
export type OzonCompositionGrain='product'|'posting';
export interface OzonCompositionRecipe {version:1;grain:OzonCompositionGrain;fields:string[]}
export const OZON_COMPOSITION_SOURCES=[
 {key:'products',label:'商品',description:'商品资料与状态'},
 {key:'prices',label:'价格',description:'当前卖家价与普通售价'},
 {key:'warehouses',label:'仓库',description:'指定仓库和配送渠道'},
 {key:'stocks',label:'库存',description:'指定仓库或全仓库存合计'},
 {key:'analytics',label:'流量',description:'所选完整日期内的商品表现'},
 {key:'orders',label:'订单',description:'所选期间的包裹与商品'},
 {key:'weights',label:'实重',description:'已核实单 SKU 单件包裹实重'},
 {key:'finance',label:'费用',description:'包裹对应的有符号记账金额'},
 {key:'promotions',label:'活动',description:'指定活动的商品参与信息'},
 {key:'returns',label:'售后',description:'平台可返回的售后记录'},
] as const;
export type OzonCompositionSource=typeof OZON_COMPOSITION_SOURCES[number]['key'];
export interface OzonCompositionField {key:string;source:OzonCompositionSource;sourceLabel:string;field:string;role:string;label:string;description:string;format:FieldFormat;grains:OzonCompositionGrain[];unit?:string;example:string;requires?:('dateRange'|'warehouse'|'action')[]}
export const OZON_COMPOSITION_SOURCE_FIELDS:Record<OzonCompositionSource,string[]>={
 products:['productId','offerId','sku','title','image','status','statusCode','statusRaw','errorReason'],
 prices:['productId','offerId','price','ordinaryPrice','oldPrice','currency'],
 warehouses:['warehouseId','warehouseName','fulfillment','status','statusCode','statusRaw','deliveryMethods'],
 stocks:['productId','sku','offerId','warehouseId','warehouseName','stockPresent','stockReserved','stockAvailable'],
 analytics:['sku','title','date','impressions','views','cartEvents','orderedUnits','visitors'],
 orders:['orderId','orderNumber','postingNumber','sku','offerId','title','quantity','orderPrice','currency','status','statusCode','statusRaw','createdAt','shipmentAt','trackingNumber'],
 weights:['postingNumber','sku','offerId','quantity','actualWeight','declaredWeight','weightDifference','weightScope','shipmentAt'],
 finance:['accrualId','unitNumber','postingNumber','date','accrualType','amount','commission','logisticsFee','feeDetails','currency'],
 promotions:['actionId','actionName','productId','participation','actionPrice','maxActionPrice','currency','startsAt','endsAt'],
 returns:['returnId','postingNumber','orderId','orderNumber','sku','offerId','title','quantity','returnReason','status','statusCode','statusRaw','createdAt','orderPrice','currency'],
};
const examples:Record<string,string>={title:'便携收纳盒',price:'¥ 49.90',ordinaryPrice:'¥ 59.90',stockAvailable:'128 件',orderedUnits:'24 件',views:'360 次',actualWeight:'310 克',amount:'−18.50 CNY',status:'在售',offerId:'BOX-001',sku:'123456789',warehouseName:'自发货仓'};
export const OZON_COMPOSITION_FIELDS:OzonCompositionField[]=OZON_COMPOSITION_SOURCES.flatMap(source=>OZON_COMPOSITION_SOURCE_FIELDS[source.key].map(field=>{
 const meta=OZON_FIELD_META[field],requires:NonNullable<OzonCompositionField['requires']>=[];
 if(['analytics','orders','weights','finance'].includes(source.key))requires.push('dateRange');
 if(source.key==='warehouses')requires.push('warehouse');
 if(source.key==='promotions')requires.push('action');
 const scope=source.key==='stocks'?'指定仓库；未选择时按全仓合计。':source.key==='analytics'?(field==='date'?'组合采用期间商品汇总，此单日日期为空；请查看统一开始和结束日期。':'由平台按所选期间汇总，访问会话不是去重人数。'):source.key==='weights'?'商品行取期间内最新核实单件记录，包裹行只匹配该包裹。':source.key==='orders'?'商品行数量汇总、单价取最近订单，其余多值并列；包裹行只展示该包裹。':source.key==='finance'?'仅包裹行可用；同币种金额相加，不向商品分摊。':source.key==='returns'?'按平台当前可返回的全部售后记录匹配；数量汇总、单价取最近记录。':'';
 return {key:`${source.key}.${field}`,source:source.key,sourceLabel:source.label,field,role:`ozon.${field}`,label:meta.label,description:`${meta.description}${scope}`,format:meta.format,grains:source.key==='finance'?['posting']:['product','posting'],...(meta.unit?{unit:meta.unit}:{}),example:examples[field]??(meta.format==='integer'?'12':meta.format==='currency'?'¥ 49.90':meta.format==='datetime'?'2026-10-01 10:30':'平台返回值'),...(requires.length?{requires}:{})};
}));
export const DEFAULT_PRODUCT_FIELDS=['products.image','products.title','prices.price','stocks.stockAvailable','analytics.orderedUnits'];
export const COMPOSITION_FIELD_MAP=new Map(OZON_COMPOSITION_FIELDS.map(field=>[field.key,field]));
export function validateOzonCompositionRecipe(value:unknown):OzonCompositionRecipe {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('需要有效的组合定义。');
 const recipe=value as OzonCompositionRecipe;
 if(Object.keys(recipe).some(key=>!['version','grain','fields'].includes(key))||recipe.version!==1||!['product','posting'].includes(recipe.grain)||!Array.isArray(recipe.fields)||!recipe.fields.length||recipe.fields.length>30||new Set(recipe.fields).size!==recipe.fields.length)throw new Error('组合定义需要版本 1、商品或包裹粒度，以及 1 至 30 个不同字段。');
 for(const key of recipe.fields){const field=COMPOSITION_FIELD_MAP.get(key);if(!field||!field.grains.includes(recipe.grain))throw new Error(`字段 ${String(key)} 不能用于当前行粒度；包裹费用不能直接分摊到商品。`);}
 return {version:1,grain:recipe.grain,fields:[...recipe.fields]};
}
export function createOzonCompositionDraft(connectionId:string,raw:OzonCompositionRecipe,id?:string):DataSourceDraft {
 const recipe=validateOzonCompositionRecipe(raw),fields=recipe.fields.map(key=>COMPOSITION_FIELD_MAP.get(key)!),requirements=new Set(fields.flatMap(field=>field.requires??[]));
 if(recipe.grain==='posting')requirements.add('dateRange');
 const parameters:DataSourceParameter[]=[{name:'storeId',label:'店铺',type:'string',required:true,editable:false},{name:'loadAll',label:'完整快照',type:'boolean',default:true,editable:false}];
 if(requirements.has('dateRange'))parameters.push({name:'dateFrom',label:'开始日期',type:'string',required:true},{name:'dateTo',label:'结束日期',type:'string',required:true});
 if(requirements.has('warehouse')||fields.some(field=>field.source==='stocks'))parameters.push({name:'warehouseId',label:'仓库（留空合计全部仓库）',type:'string',...(requirements.has('warehouse')?{required:true}:{})});
 if(requirements.has('action'))parameters.push({name:'actionId',label:'活动编号',type:'string',required:true},{name:'participation',label:'参加状态',type:'string',default:'joined',choices:[{label:'已参加',value:'joined'},{label:'可参加',value:'eligible'}]});
 // Stable 64-bit recipe fingerprint is a catalog identity, never an authorization token.
 let hash=14695981039346656037n;for(const character of JSON.stringify(recipe)){hash^=BigInt(character.charCodeAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}
 return {id:id??`hallmark:${connectionId}:ozon:composition:${recipe.grain}:${hash.toString(16).padStart(16,'0')}`,title:recipe.grain==='product'?'商品经营组合':'包裹经营组合',description:'跨接口组合业务信息，店铺由工作台统一选择。',appId:'hallmark',connectionId,capabilityId:'hallmark.ozon.compose',capabilityMajor:1,storeScoped:true,input:{recipe:recipe as unknown as import('../../app-contracts/src/index.ts').JsonValue,loadAll:true},parameters,rowsPath:'items',fields:fields.map(field=>({key:field.key,path:field.key,role:field.role,label:field.label,description:field.description,confirmed:true,origin:{source:field.source,label:field.sourceLabel},...(field.unit?{unit:field.unit}:{}),...(field.format==='currency'?{currencyPath:`${field.source}.currency`}:{})})),operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
}
