import {existsSync,readFileSync} from 'node:fs';
// The artifact runner copies this private snapshot beside the fixture before enforcing
// module isolation. Standalone timing runs read the same explicitly captured corpus.
const localCorpus=new URL('./real-data.json',import.meta.url);
const sourceCorpus=existsSync(localCorpus)?localCorpus:process.env.DSH_REAL_CORPUS??new URL('../../../../artifacts/real-source-tests-20261013/corpus.json',import.meta.url);
const corpus=JSON.parse(readFileSync(sourceCorpus,'utf8'));
export const recordedSalesProduct=structuredClone(corpus.ancillary.storeProducts.data.products.find(row=>row.currency==='CNY'&&row.profit?.purchaseMinor>0&&row.declaredWeight?.grams>0&&row.pricing?.sellerMinor>0));
export const recordedPackagingDetail=structuredClone(corpus.records.find(row=>row.detail.sourceDetails?.packaging?.pkgWeight>0&&row.detail.sourceDetails?.packaging?.pkgMeasure?.inputArray?.length===3&&row.detail.skus?.[0]?.sourceSkuId).detail);
export const recordedPackaging={weightKg:recordedPackagingDetail.sourceDetails.packaging.pkgWeight,dimensionsCm:Object.fromEntries(['length','width','height'].map((name,index)=>[name,Number(recordedPackagingDetail.sourceDetails.packaging.pkgMeasure.inputArray[index])]))};
export const recordedPackagingTarget={kind:'sku',itemId:recordedPackagingDetail.id,sourceSkuId:recordedPackagingDetail.skus[0].sourceSkuId};
export const recordedSettings=structuredClone(corpus.ancillary.pricingSettings.data);
export const fixedAt='2026-10-10T00:00:00.000Z';
export const configuration={connections:[
 {appId:'notes',connectionId:'n',displayName:'Real source note projection',enabled:true,configRevision:1,config:{backend:'local:fixture'}},
 {appId:'hallmark',connectionId:'h',displayName:'Recorded Hallmark business data',enabled:true,configRevision:1,config:{baseUrl:'http://127.0.0.1:1'}},
]};
export const draft=()=>({currency:'CNY',logisticsSelection:'automatic',defaultPlanId:null,plans:[
 {id:'low',name:'低价方案',enabled:true,maxPriceExclusiveMinor:13500,fixedMinor:recordedSettings.fixedMinor,logisticsMicrosPerGram:recordedSettings.logisticsMicrosPerGram,commissionPpm:recordedSettings.commissionPpm},
 // Higher fixed fee and the 135 CNY boundary are explicit pricing-policy test conditions.
 {id:'high',name:'高价方案',enabled:true,minPriceMinor:13500,fixedMinor:1800,logisticsMicrosPerGram:recordedSettings.logisticsMicrosPerGram,commissionPpm:recordedSettings.commissionPpm},
],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:null,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null});
export const quote=(storeId,patch={})=>({storeId,action:'price',purchaseMinor:recordedSalesProduct.profit.purchaseMinor,weightGrams:recordedSalesProduct.declaredWeight.grams,priceMinor:recordedSalesProduct.pricing.sellerMinor,pricingMode:'manual',...patch});
export const invocation=(id,capabilityId,input={},extra={})=>({protocolVersion:'1.0',invocationId:String(id),traceId:`trace-${id}`,appId:capabilityId.startsWith('notes.')?'notes':'hallmark',connectionId:capabilityId.startsWith('notes.')?'n':'h',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${id}`},deadlineAt:new Date(Date.now()+120000).toISOString(),...extra});
