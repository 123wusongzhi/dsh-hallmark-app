export interface Product {
 id:string; name:string; sku:string; spec:string; source?:string; image?:string;
 price?:number; margin?:number; unitProfit?:number; profit?:number; views?:number; orders?:number; sales?:number; conversion?:number;
 campaign?:string; stock?:number; activityPrice?:number; activityMargin?:number;
 beforePrice?:number; beforeSales?:number; beforeProfit?:number; beforeViews?:number;
}
export interface Dataset {items:Product[]; total:number; currency:string; period:string; comparisonPeriod?:string; note?:string}
export const templates = [
 ['products','商品经营总表','价格、流量与利润，在同一张表里看清'],
 ['collection','采集箱','查看采集商品的信息、SKU 规格与价格'],
 ['profit','利润贡献排行','同时关注每件收益和整体贡献'],
 ['traffic','流量与成交','从关注到成交，找到值得进一步查看的商品'],
 ['pricing','价格调整复盘','对照调价前后的销量与利润变化'],
 ['campaigns','促销报名评估','查看活动要求、商品价格与活动利润预估'],
 ['review','促销效果复盘','销量变化之外，看看利润是否一起增长'],
] as const;
export type TemplateId=typeof templates[number][0];
export const fields:Record<string,{label:string;type?:'money'|'percent'}>={price:{label:'售价',type:'money'},margin:{label:'利润率',type:'percent'},unitProfit:{label:'单件利润',type:'money'},profit:{label:'期间利润',type:'money'},views:{label:'浏览量'},orders:{label:'订单数'},sales:{label:'销量'},conversion:{label:'订单 / 浏览',type:'percent'},source:{label:'来源'},sku:{label:'SKU'},spec:{label:'规格'},campaign:{label:'促销活动'},stock:{label:'库存'},activityPrice:{label:'活动价',type:'money'},activityMargin:{label:'活动预估利润率',type:'percent'},beforePrice:{label:'调整前售价',type:'money'},beforeSales:{label:'对比期销量'},beforeProfit:{label:'对比期利润',type:'money'},beforeViews:{label:'对比期浏览量'}};
export const columns:Record<TemplateId,string[]>={products:['price','margin','views','sales','campaign'],collection:['source','sku','spec','price'],profit:['unitProfit','margin','sales','profit'],traffic:['views','orders','sales','conversion'],pricing:['beforePrice','price','beforeSales','sales','profit'],campaigns:['price','activityPrice','activityMargin','stock','campaign'],review:['beforeViews','views','beforeSales','sales','beforeProfit','profit']};
export function format(key:string,value:unknown,currency='CNY') {if(value===undefined||value===null||value==='')return '—';if(typeof value!=='number')return String(value);return fields[key]?.type==='money'?new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:2}).format(value):fields[key]?.type==='percent'?`${value.toFixed(1)}%`:value.toLocaleString('zh-CN');}
