import type {FailureInfo,JsonSchema} from '../../app-contracts/src/index.ts';

const text:JsonSchema={type:'string',minLength:1};
const selectedTargets:JsonSchema={anyOf:[{required:['offerIds']},{required:['productIds']}]};
const modes:Record<string,{required:string[];optional?:string[]}>={
 search:{required:['q'],optional:['aspects','requireAspects','limit']},
 show:{required:['descriptionCategoryId','typeId']},
 template:{required:['descriptionCategoryId','typeId']},
 values:{required:['descriptionCategoryId','typeId','attributeId'],optional:['q','limit']},
 validate_value:{required:['descriptionCategoryId','typeId','attributeId','valueId','dictionaryId']},
 sync:{required:[]},
};

/** Refine the modern capability contract without removing legacy aliases or valid payload fields. */
export function refineInput(suffix:string,schema:JsonSchema):JsonSchema {
 if(suffix==='get_category_data'){
  const properties=schema.properties as Record<string,JsonSchema>;
  return {type:'object',oneOf:Object.entries(modes).map(([mode,fields])=>({
   type:'object',properties:{...Object.fromEntries(['storeId','store',...fields.required,...fields.optional??[]].map(key=>[key,properties[key]])),mode:{const:mode},...(fields.optional?.includes('limit')?{limit:{type:'integer',minimum:1,maximum:mode==='search'?20:100}}:{})},
   required:['mode',...fields.required],anyOf:[{required:['storeId']},{required:['store']}],additionalProperties:false,
  }))};
 }
 if(suffix==='update_price'||suffix==='update_stock')return {...schema,...selectedTargets};
 if(suffix==='list_product'){
  const properties=schema.properties as Record<string,JsonSchema>,items=properties.importItems;
  // An omitted source reference remains supported when offer_id itself is in skuScope.
  return {...schema,properties:{...properties,importItems:{...items,items:{type:'object',properties:{offer_id:text,_sourceSkuId:{anyOf:[text,{type:'null'}]}},required:['offer_id'],additionalProperties:true}}}};
 }
 return schema;
}

const numericId:JsonSchema={anyOf:[{type:'string',pattern:'^[1-9][0-9]*$'},{type:'integer',minimum:1}]};
export const productInfoBody:JsonSchema={
 type:'object',properties:{offer_id:{type:'array',items:text},product_id:{type:'array',items:numericId},sku:{type:'array',items:numericId}},
 anyOf:['offer_id','product_id','sku'].map(key=>({required:[key],properties:{[key]:{type:'array',minItems:1}}})),
 additionalProperties:true,
 description:'至少提供非空 offer_id、product_id 或 sku 数组；不发送空的商品查询。',
};

export function legacyListingIssue(input:Record<string,any>):FailureInfo|undefined {
 for(const [index,item] of (input.importItems??[]).entries()){
  const sku=item._sourceSkuId??(input.skuScope?.includes(item.offer_id)?item.offer_id:undefined);
  if(!sku)return {code:'SOURCE_SKU_REFERENCE_REQUIRED',message:`importItems[${index}]._sourceSkuId 缺失；请关联 skuScope 中的采购规格。只有 offer_id 本身在 skuScope 中时才可省略。`,retryPolicy:'never',details:{field:`importItems[${index}]._sourceSkuId`}};
  if(!input.skuScope?.includes(sku))return {code:'SOURCE_SKU_OUTSIDE_SCOPE',message:`importItems[${index}]._sourceSkuId 不在已选择的 skuScope 中。`,retryPolicy:'never',details:{field:`importItems[${index}]._sourceSkuId`}};
 }
 return undefined;
}
