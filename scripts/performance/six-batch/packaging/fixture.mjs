export const fixedAt='2026-10-10T00:00:00.000Z';
export const configuration={connections:[
 {appId:'notes',connectionId:'n',displayName:'Synthetic Notes',enabled:true,configRevision:1,config:{backend:'local:fixture'}},
 {appId:'hallmark',connectionId:'h',displayName:'Synthetic Hallmark',enabled:true,configRevision:1,config:{baseUrl:'http://127.0.0.1:1'}},
]};
export const draft=()=>({currency:'CNY',logisticsSelection:'automatic',defaultPlanId:null,plans:[
 {id:'low',name:'低价方案',enabled:true,maxPriceExclusiveMinor:13500,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000},
 {id:'high',name:'高价方案',enabled:true,minPriceMinor:13500,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000},
],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:null,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null});
export const quote=(storeId,patch={})=>({storeId,action:'price',purchaseMinor:2000,weightGrams:100,priceMinor:13500,pricingMode:'manual',...patch});
export const invocation=(id,capabilityId,input={},extra={})=>({protocolVersion:'1.0',invocationId:String(id),traceId:`trace-${id}`,appId:capabilityId.startsWith('notes.')?'notes':'hallmark',connectionId:capabilityId.startsWith('notes.')?'n':'h',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${id}`},deadlineAt:new Date(Date.now()+120000).toISOString(),...extra});
