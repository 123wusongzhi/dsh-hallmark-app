export interface Product {
  key:string;title:string;image?:string;source:string;sourceUrl?:string;
  collectedAt?:string;timeLabel:string;timestamp?:number;price?:number;maxPrice?:number;currency?:string;skuCount?:number;
}
const text=(...values:unknown[])=>values.find(value=>typeof value==='string'&&value.trim()) as string|undefined;
const number=(...values:unknown[])=>values.find(value=>typeof value==='number'&&Number.isFinite(value)) as number|undefined;
export function toProduct(key:string,row:Record<string,unknown>):Product {
  const date=text(row.collectedAt,row.collected_at,row.importedAt,row.createdAt);
  const source=typeof row.source==='object'&&row.source?row.source as Record<string,unknown>:{};
  const collectedAt=date??text(source.collected_at,source.importedAt);
  const parsed=collectedAt?Date.parse(collectedAt):NaN;
  const images=Array.isArray(row.images)?row.images:[];
  const image=text(row.mainImage,row.imageUrl,row.image,typeof images[0]==='string'?images[0]:undefined);
  const timeLabel=text(row.collectedAt,row.collected_at)?'采集时间':text(row.importedAt)?'导入时间':text(row.createdAt)?'创建时间':text(source.collected_at)?'采集时间':'导入时间';
  return {key,title:text(row.title,row.name,source.description)??'未提供商品名称',image,source:text(row.sourceLabel,typeof row.source==='string'?row.source:undefined,source.name)??'来源未提供',sourceUrl:text(row.sourceUrl),collectedAt,timeLabel,timestamp:Number.isFinite(parsed)?parsed:undefined,price:number(row.minPrice,row.price),maxPrice:number(row.maxPrice),currency:text(row.currency),skuCount:number(row.skuCount)};
}
export function displayDate(value?:string){
  if(!value)return '时间未提供';const date=new Date(value);if(Number.isNaN(date.getTime()))return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
export function displayPrice(product:Product){
  if(product.price===undefined)return '未提供报价';
  const format=(value:number)=>{try{return product.currency?new Intl.NumberFormat('zh-CN',{style:'currency',currency:product.currency,maximumFractionDigits:2}).format(value):new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(value);}catch{return `${value} ${product.currency??''}`.trim();}};
  const min=format(product.price);return product.maxPrice!==undefined&&product.maxPrice>product.price?`${min} – ${format(product.maxPrice)}`:min;
}
