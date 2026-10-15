import type { BusinessIssue, BusinessRowInput } from './operations/types.ts';

/** Image-only Ozon rich content v0.3; source: https://cdn2.ozone.ru/s3/artifact/schema.json */
export function buildListingRichContent(urls: readonly string[]): string {
  return JSON.stringify({version:0.3,content:urls.map(src=>({widgetName:'raShowcase',type:'billboard',blocks:[{img:{src,srcMobile:src}}]}))});
}

/** Normalize before persistence, review and import so all three use identical media. */
export function assembleListingAssets(row: BusinessRowInput, payload: Record<string,unknown>): {issues:BusinessIssue[];corrections:string[]} {
  if(row.listingAssets===undefined)return {issues:[],corrections:[]};
  const issues:BusinessIssue[]=[];
  if(row.action!=='listing')return {issues:[{code:'LISTING_ASSETS_ACTION_INVALID',field:'listingAssets',message:'图片组装输入仅用于上品行。'}],corrections:[]};
  const assets=row.listingAssets;
  for(const [key,count] of [['images',7],['richContentImages',8]] as const){
    const urls=assets?.[key];
    if(!Array.isArray(urls)||urls.length!==count){issues.push({code:'LISTING_ASSETS_COUNT_INVALID',field:`listingAssets.${key}`,message:`${key} 需要按顺序交付 ${count} 张图片。`});continue;}
    if(urls.some(url=>{try{const parsed=new URL(url);return typeof url!=='string'||url.trim()!==url||parsed.protocol!=='https:'||!!parsed.username||!!parsed.password;}catch{return true;}}))issues.push({code:'LISTING_ASSET_URL_INVALID',field:`listingAssets.${key}`,message:'使用素材发布成功后返回的 HTTPS 图片地址。'});
    if(new Set(urls).size!==urls.length)issues.push({code:'LISTING_ASSETS_DUPLICATED',field:`listingAssets.${key}`,message:'同一组内不能重复图片凑数；跨销售行允许复用。'});
  }
  if(payload.attributes!==undefined&&!Array.isArray(payload.attributes))issues.push({code:'LISTING_ATTRIBUTES_INVALID',field:'attributes',message:'商品属性必须为数组。'});
  if(issues.length)return {issues,corrections:[]};
  const attributes=(payload.attributes??[]) as Array<Record<string,unknown>>;
  payload.images=[...assets.images];
  payload.primary_image=assets.images[0];
  payload.attributes=[...attributes.filter(attribute=>Number(attribute.id)!==11254),{id:11254,complex_id:0,values:[{value:buildListingRichContent(assets.richContentImages)}]}];
  return {issues:[],corrections:['已按 listingAssets 顺序组装 7 张商品图与 8 张富文本详情图；首项为首图，属性 11254 由程序统一生成。']};
}
