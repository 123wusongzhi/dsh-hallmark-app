import type {BusinessPricingRepository} from '../../business-pricing/src/index.ts';
import type {RecordData} from '../../core/src/types.ts';

export type PricingReader=Pick<BusinessPricingRepository,'read'|'quote'>;
export const DYNAMIC_PROFIT_BASIS='应用经营规则参考利润＝（实际卖家售价－采购成本－匹配方案固定费－运费－佣金）÷实际卖家售价；按售价与重量匹配，重叠取总费用较高方案，非财务结算净利润。';
const positive=(value:unknown):number|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:null;

/** Only an identified single-item observation can take precedence over a platform declaration. */
export function businessWeight(row:RecordData):{grams:number|null;source:string|null;revision?:string}{
 const actual=row.weight;
 if(actual?.source==='ozon_order_actual'&&positive(actual.grams)&&typeof actual.revision==='string'&&actual.revision)return {grams:actual.grams,source:'ozon_order_actual',revision:actual.revision};
 const declared=row.declaredWeight;
 if(declared&&!declared.reason&&positive(declared.grams))return {grams:declared.grams,source:'ozon_declared'};
 return {grams:null,source:null};
}

/** Read views and operating drafts use the same pricing engine; failed policy checks still expose calculable profit. */
export function applicationProfit(row:RecordData,storeId:string,pricing?:PricingReader):RecordData{
 const previous=row.profit??{},currency=row.pricing?.currency??row.currency;
 const price=row.pricing&&Object.hasOwn(row.pricing,'sellerMinor')?row.pricing.sellerMinor:previous.actualMinor;
 const purchase=Number.isSafeInteger(previous.purchaseMinor)&&previous.purchaseMinor>=0?previous.purchaseMinor:null;
 const explicitWeight=businessWeight(row),weight=Object.hasOwn(row,'declaredWeight')||Object.hasOwn(row,'weight')?explicitWeight.grams:positive(previous.packageGrams);
 const quote=currency==='CNY'&&positive(price)!==null?pricing?.quote({storeId,action:'price',purchaseMinor:purchase,weightGrams:weight,priceMinor:positive(price),pricingMode:'manual'}):undefined;
 const breakdown=quote?.breakdown;
 const calculated=currency==='CNY'&&positive(price)!==null&&quote?.evaluatedPriceMinor===price&&breakdown?.totalCostMinor!=null&&breakdown?.profitMinor!=null;
 const reason=currency!=='CNY'?'仅在明确人民币币种时计算参考利润。':!positive(price)?'实际卖家价尚未核实。':purchase===null?'缺少精确来源的人民币采购价。':weight===null?'缺少有效的计费重量。':!pricing||!quote?.configRevision?'此店铺尚未保存应用经营规则。':!calculated?quote?.issues.map(issue=>issue.message).join('；')||'物流费用方案尚未就绪。':null;
 return {...row,profit:{...previous,purchaseMinor:purchase,packageGrams:weight,actualMinor:currency==='CNY'?positive(price):null,costMinor:calculated?breakdown!.totalCostMinor:null,profitMinor:calculated?breakdown!.profitMinor:null,actualMargin:calculated?breakdown!.profitMinor!/quote!.evaluatedPriceMinor!:null,reason,metricBasis:DYNAMIC_PROFIT_BASIS,configRevision:quote?.configRevision??null,weightSource:explicitWeight.source,pricingQuote:quote??null}};
}
