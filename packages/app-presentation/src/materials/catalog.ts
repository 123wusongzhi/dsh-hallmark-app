import type {BindingData,ViewSpec,WidgetType} from '../../../presentation/src/types.ts';

export interface MaterialDefinition {
  id:string;
  version:number;
  title:string;
  description:string;
  category:'module'|'preset';
  requiredRoles:string[];
  optionalRoles:string[];
  bindingRoles?:Record<string,string[]>;
  widgetTypes:WidgetType[];
  defaultOptions:{columns:{field:string;label?:string}[];density:'comfortable'|'compact';pageSize:number};
  operations:('search'|'sort'|'pagination'|'select')[];
  example:string;
  boundaries:string[];
}
const productDefaults={columns:[{field:'product.image'},{field:'product.name'},{field:'price.current'}],density:'comfortable' as const,pageSize:10};
const procurementDefaults={columns:[{field:'product.name',label:'商品'},{field:'sku.specification',label:'销售规格'},{field:'purchase.specification',label:'采购规格'},{field:'logistics.plan',label:'物流方案'},{field:'product.url',label:'商品网址'},{field:'purchase.url',label:'采购网址'},{field:'purchase.price',label:'采购价'},{field:'price.current',label:'当前售价'},{field:'metric.margin',label:'参考利润率'}],density:'comfortable' as const,pageSize:10};
const skuDefaults={columns:[{field:'sku.id'},{field:'sku.specification'},{field:'price.current'}],density:'comfortable' as const,pageSize:10};
const activityDefaults={columns:[{field:'activity.name'},{field:'activity.status'},{field:'activity.startsAt'},{field:'activity.endsAt'}],density:'comfortable' as const,pageSize:10};
export const MATERIAL_CATALOG:MaterialDefinition[]=[
  {id:'product-procurement',version:1,title:'商品-采购对照表',description:'在售商品与采购规格、链接并排核对，按物流方案查看参考利润。',category:'module',requiredRoles:['product.id','product.name','price.current'],optionalRoles:['product.image','price.currency','sku.id','sku.specification','product.url','purchase.specification','purchase.url','purchase.price','logistics.plan','logistics.weight','metric.margin'],widgetTypes:['product_list'],defaultOptions:procurementDefaults,operations:['search','sort','pagination'],example:'搜索商品、SKU、货号或规格；从真实物流渠道中匹配，再按确认的费用试算。',boundaries:['只展示在售商品，采购关系沿用平台记录。','物流渠道按接口身份与商品仓库关联；名称不作为计费或重量限制规则。','利润按当前选定费用方案试算，不代表实际结算净利润。','缺采购成本、方案费率、有效重量或明确币种时提示待补充，不使用零代替。']},
  {id:'product-operations',version:1,title:'商品经营表',description:'把商品、价格、库存与销量放在同一张表里。',category:'preset',requiredRoles:[],optionalRoles:[],widgetTypes:['table'],defaultOptions:{columns:[{field:'products.image',label:'图片'},{field:'products.title',label:'商品'},{field:'prices.price',label:'当前售价'},{field:'stocks.stockAvailable',label:'可售库存'},{field:'analytics.orderedUnits',label:'订购件数'}],density:'comfortable',pageSize:10},operations:['search','sort','pagination'],example:'商品、价格、库存、流量按同一商品关联。',boundaries:['同一店铺、已确认的商品身份；未知值保持缺失。','仓库和日期作用于对应来源，销量不代表已结算销售。']},
  {id:'data-table',version:1,title:'数据表',description:'选择商品、库存、流量、订单、财务或售后数据，按中文字段配置表格。',category:'module',requiredRoles:[],optionalRoles:[],widgetTypes:['table'],defaultOptions:{columns:[],density:'comfortable',pageSize:10},operations:['search','sort','pagination'],example:'选择业务数据源和店铺，再选择需要显示的中文字段。',boundaries:['缺失值显示为未知，空数据和读取失败分别显示。','筛选、搜索与排序的范围由数据源声明。']},
  {id:'product-list',version:1,title:'商品列表',description:'展示商品图片、名称和价格，按需添加业务字段。',category:'module',requiredRoles:['product.id','product.name','price.current'],optionalRoles:['product.image','price.currency','metric.sales','metric.views','metric.margin'],widgetTypes:['product_list'],defaultOptions:productDefaults,operations:['search','sort','pagination','select'],example:'绑定商品数据，选择显示列；选中商品可联动 SKU 明细。',boundaries:['搜索和排序范围由数据源决定。','不编辑价格，不推算缺失指标。']},
  {id:'sku-detail',version:1,title:'SKU 明细',description:'查看商品的 SKU 编码、规格与价格。',category:'module',requiredRoles:['sku.id','sku.specification','price.current'],optionalRoles:['product.id','product.name','product.image','price.currency'],widgetTypes:['sku_detail'],defaultOptions:skuDefaults,operations:[],example:'绑定指定商品的 SKU 数据，或与商品列表选中事件联动。',boundaries:['只展示规格和价格。','没有已选商品时不展示上一次商品的明细。']},
  {id:'product-browser',version:1,title:'商品浏览',description:'商品列表与 SKU 明细的可拆改组合，选择商品即可查看规格。',category:'preset',requiredRoles:['product.id','product.name','price.current'],optionalRoles:['product.image','price.currency','metric.sales','metric.views','metric.margin'],widgetTypes:['product_list','sku_detail'],defaultOptions:productDefaults,operations:['search','sort','pagination','select'],example:'商品列表绑定店铺商品，SKU 明细绑定可按商品编号查询的数据源。',boundaries:['两个模块可单独保留、替换或调整位置。','SKU 数据源需另外提供 SKU 编码、规格和价格。']},
  {id:'collection-box',version:1,title:'采集箱',description:'浏览采集商品的信息、SKU 规格和价格。',category:'preset',requiredRoles:['product.id','product.name','price.current'],optionalRoles:['product.image','price.currency'],widgetTypes:['product_list','sku_detail'],defaultOptions:productDefaults,operations:['search','sort','pagination','select'],example:'采集商品列表联动采集商品详情，展示原始规格与价格。',boundaries:['仅展示采集商品信息、SKU 规格和价格。','不包含选品评分、利润评估或定价试算。']},
  {id:'activity-list',version:1,title:'促销活动',description:'查看平台已有活动的名称、状态及起止时间。',category:'module',requiredRoles:['activity.id','activity.name'],optionalRoles:['activity.status','activity.startsAt','activity.endsAt'],widgetTypes:['table'],defaultOptions:activityDefaults,operations:['search','sort','pagination'],example:'选择已登记的促销活动数据源，可多次添加并查看不同店铺。',boundaries:['展示已有活动信息，不创建、报名或修改活动。','搜索与排序只针对当前已加载数据。']},
];
for(const material of MATERIAL_CATALOG)material.bindingRoles=material.id==='data-table'||material.id==='product-operations'?{main:[]}:material.id==='activity-list'?{activities:[...material.requiredRoles]}:material.id==='sku-detail'?{sku:[...material.requiredRoles]}:material.category==='preset'?{products:[...material.requiredRoles],sku:['sku.id','sku.specification','price.current']}:{products:[...material.requiredRoles]};
export function getMaterial(id:string):MaterialDefinition|undefined{return MATERIAL_CATALOG.find(material=>material.id===id);}
/** A preset expands into ordinary editable widgets; it is not another rendering engine. */
export function createMaterialView(materialId:string,options:{id?:string;bindingIds?:{products?:string;sku?:string;activities?:string}}={}):ViewSpec{
  const material=getMaterial(materialId);if(!material)throw new Error('未知素材');
  if(materialId==='product-procurement'){
    const bindingId=options.bindingIds?.products??'products';
    return {id:options.id??'material:product-procurement',title:material.title,layout:{type:'column',children:['products']},widgets:[{id:'products',type:'product_list',title:material.title,bindingId,options:{...structuredClone(procurementDefaults),materialId:'product-procurement'}}],bindings:[{id:bindingId,datasetKey:'material:procurement',fieldMap:{}}]};
  }
  if(materialId==='product-operations')return {id:options.id??'material:product-operations',title:material.title,layout:{type:'column',children:['main']},widgets:[{id:'main',type:'table',title:material.title,bindingId:'main',fields:{},columns:material.defaultOptions.columns.map(column=>({field:column.field,label:column.label!})),options:{materialId:'data-table',pageSize:10,density:'comfortable',fieldMeta:{'products.image':{format:'image',label:'图片'},'products.title':{format:'text',label:'商品'},'prices.price':{format:'currency',currency:'CNY',label:'当前售价'},'stocks.stockAvailable':{format:'integer',unit:'件',label:'可售库存'},'analytics.orderedUnits':{format:'integer',unit:'件',label:'订购件数'}}}}],bindings:[{id:'main',datasetKey:'material:product-operations',fieldMap:{}}]};
  if(materialId==='data-table')return {id:options.id??'material:data-table',title:material.title,layout:{type:'column',children:['main']},widgets:[{id:'main',type:'table',title:'业务数据',bindingId:'main',fields:{},columns:[],options:{materialId:'data-table',pageSize:10,density:'comfortable'}}],bindings:[{id:'main',datasetKey:'material:data-table',fieldMap:{}}]};
  if(materialId==='activity-list'){
    const bindingId=options.bindingIds?.activities??'activities';
    return {id:options.id??'material:activity-list',title:material.title,layout:{type:'column',children:['activities']},widgets:[{id:'activities',type:'table',title:'促销活动',bindingId,fields:{'activity.id':'activity.id','activity.name':'activity.name','activity.status':'activity.status','activity.startsAt':'activity.startsAt','activity.endsAt':'activity.endsAt'},columns:[{field:'activity.name',label:'活动名称'},{field:'activity.status',label:'活动状态'},{field:'activity.startsAt',label:'开始时间',format:'date'},{field:'activity.endsAt',label:'结束时间',format:'date'}],options:{pageSize:10,density:'comfortable'}}],bindings:[{id:bindingId,datasetKey:'material:activities',fieldMap:{}}]};
  }
  const products=options.bindingIds?.products??'products',sku=options.bindingIds?.sku??'sku';
  const preset=material.category==='preset',onlySku=materialId==='sku-detail';
  return {
    id:options.id??`material:${materialId}`,title:material.title,
    layout:{type:preset?'grid':'column',...(preset?{columns:2}:{}),gap:20,children:onlySku?['sku']:preset?['products','sku']:['products']},
    widgets:[...(!onlySku?[{id:'products',type:'product_list' as const,title:materialId==='collection-box'?'采集商品':'商品列表',bindingId:products,options:structuredClone(productDefaults)}]:[]),...(onlySku||preset?[{id:'sku',type:'sku_detail' as const,title:'SKU 明细',bindingId:sku,options:{...structuredClone(skuDefaults),requiresSelection:preset}}]:[])],
    bindings:[...(!onlySku?[{id:products,datasetKey:'material:products',fieldMap:{}}]:[]),...(onlySku||preset?[{id:sku,datasetKey:'material:sku',fieldMap:{}}]:[])],
    ...(preset?{links:[{from:{widgetId:'products',event:'select' as const,field:'product.id' as const},to:{bindingId:sku,param:'productId'}}]}:{}),
  };
}
/** Explicit fixtures only for unbound previews, never passed off as a queried snapshot. */
export function materialExampleData(view:ViewSpec):BindingData[]{
  const rows=[
    {product:{id:'example-1',name:'示例 · 便携保温杯'},price:{current:129,currency:'CNY'},sku:{id:'DEMO-BLUE',specification:'颜色：雾蓝 / 容量：500ml'}},
    {product:{id:'example-2',name:'示例 · 桌面收纳盒'},price:{current:59,currency:'CNY'},sku:{id:'DEMO-WHITE',specification:'颜色：白色 / 规格：标准款'}},
    {product:{id:'example-3',name:'示例 · 轻便旅行袋'},price:{current:189,currency:'CNY'},sku:{id:'DEMO-LARGE',specification:'颜色：深蓝 / 尺寸：大号'}},
  ];
  const operatingRows=rows.map((row,index)=>({products:{title:row.product.name,offerId:`DEMO-${index+1}`,image:null,status:'在售'},prices:{price:row.price.current,oldPrice:row.price.current+20,currency:'CNY'},stocks:{stockAvailable:[320,186,92][index],stockReserved:[12,6,3][index]},analytics:{orderedUnits:[16,8,5][index],cartEvents:[7,4,2][index],views:[82,64,38][index]}}));
  if(view.widgets.some(widget=>widget.options?.materialId==='product-procurement'))return view.bindings.map(binding=>({bindingId:binding.id,datasetKey:'material:example',payload:rows.map((row,index)=>({...row,product:{...row.product,url:null},purchase:{specification:['颜色：蓝色 / 容量：500ml','颜色：白色 / 规格：标准款','颜色：蓝色 / 尺寸：大号'][index],url:[],price:null},metric:{margin:null},currency:'CNY',referenceProfit:{margin:null,reason:'接入真实采购成本和费用方案后计算'}})),state:'ready',provenance:{source:'示例数据，仅用于预览布局',example:true}}));
  return view.bindings.map(binding=>({bindingId:binding.id,datasetKey:'material:example',payload:view.widgets.some(widget=>widget.bindingId===binding.id&&widget.type==='table')?view.widgets.some(widget=>widget.bindingId===binding.id&&widget.options?.materialId==='data-table')?operatingRows:[{activity:{id:'demo-activity-1',name:'示例 · 秋季促销',status:'进行中',startsAt:'2026-10-01T00:00:00+08:00',endsAt:'2026-10-15T23:59:00+08:00'}},{activity:{id:'demo-activity-2',name:'示例 · 周末精选',status:'未开始',startsAt:'2026-10-10T00:00:00+08:00',endsAt:'2026-10-12T23:59:00+08:00'}}]:rows,state:'ready',provenance:{source:'示例数据，仅用于预览布局',example:true}}));
}
