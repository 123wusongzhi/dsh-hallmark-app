export type Row=Record<string,unknown>;
export interface Field {key:string;label:string;source:string;format:string;unit?:string;currencyPath?:string;description?:string}
const object=(value:unknown):Row=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
export function valueAt(value:unknown,path:string):unknown {return path.split('.').reduce<unknown>((row,key)=>Object.hasOwn(object(row),key)?object(row)[key]:undefined,value);}
/** Reads the host's bound result. No HTTP, credentials, joins or duplicate business logic. */
export function composedData(data:unknown,bindingId='main'){
  const bindings=object(data).bindings,raw=Array.isArray(bindings)?bindings.find(item=>object(item).bindingId===bindingId):undefined,binding=object(raw),payload=object(binding.payload);
  const fields=(Array.isArray(payload.fieldMeta)?payload.fieldMeta:[]).filter((field):field is Field=>typeof object(field).key==='string'&&typeof object(field).label==='string');
  const cache=object(payload.cache),fetchedAt=typeof cache.fetchedAt==='string'?cache.fetchedAt:undefined;
  return {bindingId,state:String(binding.state??'empty'),error:typeof object(binding.error).message==='string'?String(object(binding.error).message):undefined,fields,rows:Array.isArray(payload.items)?payload.items.map(object):[],cursor:typeof payload.cursor==='string'?payload.cursor:null,warnings:(Array.isArray(payload.warnings)?payload.warnings:[]).filter((value):value is string=>typeof value==='string'),total:typeof payload.total==='number'?payload.total:null,fetchedAt,stale:cache.stale===true||binding.freshness==='stale',atFirstPage:typeof object(object(binding.query).input).cursor!=='string'};
}
export function formatValue(row:Row,field:Field):string {
  const value=valueAt(row,field.key);if(value===null||value===undefined||value==='')return '暂缺';
  if(field.format==='currency'&&typeof value==='number'){
    const currency=field.currencyPath?valueAt(row,field.currencyPath):undefined;
    if(typeof currency==='string'&&/^[A-Z]{3}$/.test(currency))return new Intl.NumberFormat('zh-CN',{style:'currency',currency}).format(value);
    return `${value.toFixed(2)}（币种待确认）`;
  }
  if(typeof value==='number')return `${new Intl.NumberFormat('zh-CN').format(value)}${field.unit?` ${field.unit}`:''}`;
  return typeof value==='string'||typeof value==='boolean'?String(value):'暂缺';
}
