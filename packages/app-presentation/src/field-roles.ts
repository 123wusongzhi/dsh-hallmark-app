import type {DataSourceField,FieldRole} from './types.ts';
import {OZON_FIELD_ROLES} from '../../app-hallmark/src/ozon-fields.ts';

export const FIELD_ROLES:readonly FieldRole[]=[
  ...OZON_FIELD_ROLES,
  {key:'product.id',label:'商品编号',description:'用于区分商品的唯一编号。',format:'text'},
  {key:'product.name',label:'商品名称',description:'商品的展示名称。',format:'text'},
  {key:'product.image',label:'商品图片',description:'商品主图；无图片时显示占位。',format:'image'},
  {key:'product.url',label:'商品网址',description:'由平台记录的真实商品 SKU 对应的商品页。',format:'text'},
  {key:'purchase.specification',label:'采购规格',description:'平台已有采购来源记录中的规格，与销售规格分别展示。',format:'text'},
  {key:'purchase.url',label:'采购网址',description:'平台已有采购来源链接；多条来源保留，不按标题猜配。',format:'text'},
  {key:'purchase.price',label:'采购价',description:'平台核定的采购成本，保留匹配与覆盖后的金额。缺失时不补零。',format:'currency'},
  {key:'logistics.weight',label:'计费重量',description:'物流试算使用的包装重量，单位为克。',format:'integer',unit:'g'},
  {key:'logistics.plan',label:'物流方案',description:'按接口返回的配送渠道和商品仓库关联；名称不作为计费或适用条件。',format:'text'},
  {key:'price.current',label:'当前售价',description:'数据源明确提供的当前价格，按对应币种展示。',format:'currency'},
  {key:'price.currency',label:'币种',description:'价格对应的币种，不根据数值猜测。',format:'text'},
  {key:'sku.id',label:'SKU 编码',description:'用于区分具体规格的编号。',format:'text'},
  {key:'sku.specification',label:'SKU 规格',description:'颜色、尺寸等商品规格。',format:'text'},
  {key:'sku.price',label:'SKU 价格',description:'该规格对应的价格。',format:'currency'},
  {key:'metric.sales',label:'销量',description:'需按数据源标注统计时间及退货口径。',format:'integer',unit:'件'},
  {key:'metric.views',label:'浏览量',description:'需按数据源标注统计时间及统计口径。',format:'integer',unit:'次'},
  {key:'metric.margin',label:'利润率',description:'需区分毛利率、净利率及统计口径。',format:'percent'},
  {key:'activity.id',label:'活动编号',description:'促销活动的唯一编号。',format:'text'},
  {key:'activity.name',label:'活动名称',description:'促销活动的展示名称。',format:'text'},
  {key:'activity.status',label:'活动状态',description:'平台提供的活动状态。',format:'text'},
  {key:'activity.startsAt',label:'开始时间',description:'活动开始时间。',format:'datetime'},
  {key:'activity.endsAt',label:'结束时间',description:'活动结束时间。',format:'datetime'},
];
export const FIELD_ROLE_MAP:Readonly<Record<string,FieldRole>>=Object.fromEntries(FIELD_ROLES.map(field=>[field.key,field]));

/** A familiar raw name is never evidence of a semantic match. */
export function dataSourceCompatibility(source:{fields:DataSourceField[];validation?:{status:string}},requiredRoles:readonly string[]):{compatible:boolean;missingRoles:string[]} {
  const provided=new Set(source.fields.filter(field=>field.confirmed).map(field=>field.role));
  const missingRoles=requiredRoles.filter(role=>!provided.has(role));
  return {compatible:missingRoles.length===0,missingRoles};
}
