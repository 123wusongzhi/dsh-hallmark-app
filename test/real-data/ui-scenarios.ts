import {realAncillary,realCollection,realDetail,realScenarioProduct,realStoreProducts,realStores,realSourceSummaries,realTasks,realPricingSettings} from './corpus.ts';

const recordedSales=realStoreProducts().products;
const sourceSummaries=realSourceSummaries();

/** UI aliases preserve the recorded commodity; overrides are explicit local fault/state cases. */
export function uiProduct(overrides:Record<string,any>={},selector=0):any {
  const detail=realDetail(selector),summary=sourceSummaries[selector],sku=detail.skus?.[0]??{};
  const sales=recordedSales.find(product=>product.sources?.some((source:any)=>source.productId===detail.id&&(!sku.sourceSkuId||source.skuCode===sku.sourceSkuId)));
  const image=detail.mainImage??sku.image;
  const price=sku.goodsPrice??sku.price??summary.goodsMinPrice;
  const packaging=realCollection(selector).package;
  return JSON.parse(JSON.stringify({id:detail.id,productId:detail.id,storeId:sales?.storeId,offerId:sales?.offerId,title:detail.title,name:detail.title,image,imageUrl:image,mainImage:image,
    productUrl:summary.sourceUrl,sourceUrl:summary.sourceUrl,sku:sku.sourceSkuId,spec:sku.spec,
    salesSpecification:sku.spec,purchaseSpecification:sku.spec,purchaseLinks:[{url:summary.sourceUrl,label:sku.spec}],
    currency:detail.currency,minor:price==null?null:Math.round(price*100),price:price==null?null:Math.round(price*100),purchaseMinor:price==null?null:Math.round(price*100),
    sellerMinor:sales?.pricing?.sellerMinor??null,packageGrams:sales?.declaredWeight?.grams??null,
    sourcePackage:{weightKg:packaging.weightGrams==null?null:packaging.weightGrams/1000,dimensionsCm:packaging.dimensionsMm==null?null:Object.fromEntries(Object.entries(packaging.dimensionsMm).map(([key,value])=>[key,Number(value)/10]))},
    sourceFixture:{kind:'recorded-source-ui-derivative',itemId:detail.id,source:detail.source,overriddenFields:Object.keys(overrides)},...overrides}));
}

export function uiProducts(count=41):any[]{return Array.from({length:count},(_,index)=>uiProduct({},index%41));}

export function uiText(value:string):RegExp{return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));}

export function uiStore(overrides:Record<string,any>={},index=0):any {
  const stores=realStores(),store=stores[index%stores.length];return {...store,name:store.shopName,...overrides};
}

export function uiListingPayload(overrides:Record<string,any>={},selector=0):any {
  const detail=realDetail(selector),sku=detail.skus?.[0]??{};
  const price=sku.goodsPrice??sku.price;
  return {name:detail.title,description:detail.description??detail.title,images:[detail.mainImage,...(detail.images??[])].filter(Boolean),
    attributes:Object.entries(detail.attributes??{}).map(([name,value],index)=>({id:index+1,name,values:[{value:String(value)}]})),
    price:price==null?null:String(price),currency_code:detail.currency,...overrides};
}

/** Three recorded source families, projected to three SKUs for local cursor/budget fault cases. */
export function uiCollectionDetails(ids=['cup-a','cup-b','cup-c']):any[]{
  return ids.map((id,index)=>{const selector=[6,20,40][index],detail=realDetail(selector);
    return {id,title:detail.title,source:detail.source,currency:detail.currency,attributes:Object.fromEntries(Object.entries(detail.attributes??{}).slice(0,2)),
      package:detail.package,description:(detail.description??detail.title).slice(0,180),skus:detail.skus.slice(0,3).map((sku:any,ordinal:number)=>({sourceSkuId:`${id}-${['red','blue','white'][ordinal]}`,spec:sku.spec,properties:sku.properties,goodsPrice:sku.goodsPrice??sku.price,currency:sku.currency??detail.currency}))};
  });
}

export function uiOzonProduct(overrides:Record<string,any>={},index=0):any {
  const product=realScenarioProduct({},index);
  return {...product,id:product.productId,product_id:product.productId,offer_id:product.offerId,name:product.title,
    price:{price:String(product.pricing?.sellerMinor==null?product.price:product.pricing.sellerMinor/100),currency_code:product.currency},...overrides};
}

export function uiTask(overrides:Record<string,any>={},index=0):any{return {...realTasks()[index],...overrides};}
export function uiDictionaryValue(index=0):string{return realAncillary('ozonDictionary').values[index].value;}
export function uiActivity(overrides:Record<string,any>={},index=0):any {
  const row=realAncillary('ozonActions').response.result[index];
  return {...row,name:row.title,from:row.date_start,to:row.date_end,...overrides};
}
export function uiWarehouse(overrides:Record<string,any>={},index=0):any {
  const row=realAncillary('ozonWarehouses').response.warehouses[index];
  return {warehouseId:String(row.warehouse_id),warehouseName:row.name,...overrides};
}

/** Bundled child render tests receive the recordings by value, independent of their temporary file path. */
export function uiFixturePrelude():string {
  return `const recordedUiProducts=${JSON.stringify(uiProducts())};
    const recordedUiStores=${JSON.stringify(realStores().map(store=>({...store,name:store.shopName})))};
    const recordedPricingSettings=${JSON.stringify(realPricingSettings())};
    const recordedWarehouses=${JSON.stringify(realAncillary('ozonWarehouses').response.warehouses.map((row:any)=>({warehouseId:String(row.warehouse_id),warehouseName:row.name})))};
    const uiWarehouse=(overrides={},index=0)=>({...recordedWarehouses[index%recordedWarehouses.length],...overrides});
    const uiProduct=(overrides={},index=0)=>({...recordedUiProducts[index%41],...overrides});
    const uiProducts=count=>Array.from({length:count},(_,index)=>uiProduct({},index));
    const uiStore=(overrides={},index=0)=>({...recordedUiStores[index%recordedUiStores.length],...overrides});
    const uiText=${uiText.toString()};`;
}
