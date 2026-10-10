import type { CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';
import type { InvocationRecord, RuntimeStore } from './store.ts';
type JsonRecord=Record<string,JsonValue>;
const object=(value:JsonValue|undefined):JsonRecord|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value:undefined;
const pick=(value:JsonRecord|undefined,keys:readonly string[]):JsonRecord=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value![key]]));
const size=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');

/** Only the Agent's view changes; the provider result and its UI representation stay intact. */
function businessRow(row:JsonRecord):JsonRecord {
  const result=pick(row,['rowId','revision','action','target','status','issues','corrections','dependsOn','executionId','retryAt','completedAt']);
  const values=pick(object(row.payload),['price','old_price','currency_code','stock','warehouse_id','archived','action_id','weight','weight_unit','depth','width','height','dimension_unit']);
  if(Object.keys(values).length)result.values=values;
  const binding=object(row.binding);if(binding)result.binding=pick(binding,['amount','currency','missing']);
  const quote=object(row.pricingQuote)??object(object(row.context)?.pricingQuote);
  if(quote)result.pricingQuote=pick(quote,['status','configRevision','currency','planId','planName','selectionMode','targetMarginPpm','minimumMarginPpm','suggestedPriceMinor','minimumAllowedPriceMinor','evaluatedPriceMinor','breakdown','issues','warnings']);
  const receipt=object(row.receipt);
  if(receipt){
    result.receipt=pick(receipt,['executionId','requestId','taskId','importTaskId','transport','completion','observed']);
    const product=object(receipt.product);if(product)(result.receipt as JsonRecord).product=pick(product,['id','sku','statuses','is_archived']);
  }
  return result;
}

function businessProjection(store:RuntimeStore,result:CapabilityResult,budget:number):{content:string;fullResultRef?:string}|undefined {
  const plan=object('data'in result?result.data:undefined);
  if(!plan||typeof plan.planId!=='string'||typeof plan.revision!=='number'||!Array.isArray(plan.rows)
    ||!plan.rows.every(row=>{const value=object(row);return value&&typeof value.rowId==='string'&&typeof value.action==='string'&&typeof value.status==='string';}))return;
  let request:InvocationRecord['request']|undefined;
  try{request=store.get<InvocationRecord>('invocations',result.invocationId)?.request;}catch{/* The compact in-memory result is still useful if the store is unavailable. */}
  // Explicit evidence reads use the ordinary full result / bounded spill path below.
  // Trust the persisted invocation, not a flag echoed inside the provider's result.
  if(request?.appId==='hallmark'&&['hallmark.plan.get','hallmark.listing.draft.get'].includes(request.capabilityId)
    &&object(request.input)?.includeEvidence===true)return;
  const rows=plan.rows.map(row=>businessRow(row as JsonRecord));
  const suppliedPage=object(plan.page),offset=typeof suppliedPage?.offset==='number'?suppliedPage.offset:0;
  const total=typeof suppliedPage?.total==='number'?suppliedPage.total:rows.length;
  const connectionId=typeof plan.connectionId==='string'?plan.connectionId:request?.connectionId;
  const read=(input:JsonRecord):JsonRecord=>({tool:'apps_invoke',arguments:{appId:'hallmark',...(connectionId?{connectionId}:{}),capabilityId:'hallmark.plan.get',capabilityVersion:'1.0.0',input:{planId:plan.planId,...input}},...(!connectionId?{connection:'Use the same connectionId as this call.'}:{})});
  const metadata=pick(plan,['planId','revision','storeId','status','createdAt','updatedAt']);
  const counts:JsonRecord={};for(const row of rows){const status=String(row.status);counts[status]=Number(counts[status]??0)+1;}
  const envelope=pick(result as unknown as JsonRecord,['status','invocationId','traceId','operation','errors','unresolvedOperationIds']);
  const fullResultRef=request?.source?.kind==='recovery'?`result:${result.invocationId}`:undefined;
  if(fullResultRef){
    try{store.put('datasets',fullResultRef,{datasetId:fullResultRef,kind:'invocation-result',revision:'1',result,createdAt:new Date().toISOString()});}
    catch{return {content:JSON.stringify({status:'failed',invocationId:result.invocationId,error:{code:'RESULT_SPILL_FAILED',message:'Inspection evidence could not be retained. Read the original plan; do not resubmit the business action.',retryPolicy:'never'}})};}
    envelope.fullResultRef=fullResultRef;envelope.read=resultRead(fullResultRef,'','0',100);
  }
  const make=(count:number):JsonRecord=>{
    const next=count<rows.length?String(offset+count):suppliedPage?.nextCursor??null;
    return {...envelope,data:{...metadata,rows:rows.slice(0,count),page:{offset,total,returned:count,nextCursor:next},
      modelView:'business-operation-summary',rowStatusCounts:counts,countsScope:'input page',
      omitted:['payload content','review objects','source context'],
      ...(next!==null?{continuation:read({cursor:next,limit:20})}:{})}};
  };
  let count=rows.length,projected=make(count);
  while(count>0&&size(projected)>budget)projected=make(--count);
  if(count>0||rows.length===0){
    const content=JSON.stringify(projected);if(Buffer.byteLength(content)<=budget)return {content,...(fullResultRef?{fullResultRef}:{})};
  }
  // An individual issue can exceed the budget too. Be explicit; identical get retries cannot fix it.
  const first=rows[0],issues=Array.isArray(first?.issues)?first.issues:[];
  const failure={code:'ROW_MODEL_BUDGET_EXCEEDED',rowId:first?.rowId??null,rowBytes:first?size(first):0,
    issues:issues.map(issue=>({...pick(object(issue),['code','field']),bytes:size(issue)})),
    message:'The full issue text could not be delivered. Repeating the same get will not fix this limit. Do not resubmit the business action.'};
  const detail={...envelope,data:{...metadata,rows:[],page:{offset,total,returned:0,nextCursor:null},
    modelView:'business-operation-summary',completeness:'incomplete',modelProjectionError:failure}};
  if(size(detail)<=budget)return {content:JSON.stringify(detail),...(fullResultRef?{fullResultRef}:{})};
  const minimal={status:result.status,planId:plan.planId,revision:plan.revision,completeness:'incomplete',
    ...(fullResultRef?{fullResultRef}:{}),error:{code:failure.code,rowId:failure.rowId,rowBytes:failure.rowBytes,issueCount:issues.length,message:failure.message}};
  if(size(minimal)<=budget)return {content:JSON.stringify(minimal),...(fullResultRef?{fullResultRef}:{})};
  throw new Error('MODEL_BUDGET_EXCEEDED');
}
/** A shape-preserving sample, not a replacement for the stored result. */
function sample(value:JsonValue,depth=0):JsonValue {
  if(typeof value==='string')return value.length>240?value.slice(0,240)+'…':value;
  if(value===null||typeof value!=='object')return value;
  if(depth>=6)return Array.isArray(value)?[]:{};
  if(Array.isArray(value))return value.slice(0,1).map(item=>sample(item,depth+1));
  return Object.fromEntries(Object.entries(value).slice(0,60).map(([key,item])=>[key,sample(item,depth+1)]));
}
export function projectModelResult(store:RuntimeStore,result:CapabilityResult,budget=16384):{content:string;fullResultRef?:string} {
  if(!Number.isSafeInteger(budget)||budget<512||budget>16384)throw new Error('INVALID_MODEL_BUDGET');
  const business=businessProjection(store,result,budget);if(business)return business;
  const full=JSON.stringify(result);if(Buffer.byteLength(full,'utf8')<=budget)return {content:full};
  const id=`result:${result.invocationId}`;
  try{store.put('datasets',id,{datasetId:id,kind:'invocation-result',revision:'1',result,createdAt:new Date().toISOString()});}
  catch {return {content:JSON.stringify({status:'failed',error:{code:'RESULT_SPILL_FAILED',message:'Use a smaller page or projection.',retryPolicy:'never'}})};}
  const read=resultRead(id,'','0',100);
  const summary={status:result.status,invocationId:result.invocationId,traceId:result.traceId,operation:result.operation??null,fullResultRef:id,bytes:Buffer.byteLength(full,'utf8'),completeness:'partial',read,message:'The sample is incomplete, including nested arrays. Use apps_inspect with resultRef and a JSON Pointer path (empty path reads the root) to retrieve exact values. Do not repeat the business query.'};
  const data='data' in result?result.data:null;
  const authoringSummary=data&&typeof data==='object'&&!Array.isArray(data)&&'summary' in data&&'attempt' in data&&'displays' in data?data.summary:undefined;
  let content=JSON.stringify({...summary,...(authoringSummary?{authoringSummary}:{}),sample:sample(data),sampleTruncated:true});
  if(Buffer.byteLength(content,'utf8')>budget)content=JSON.stringify({...summary,...(authoringSummary?{authoringSummary}:{})});
  if(Buffer.byteLength(content,'utf8')>budget)content=JSON.stringify(summary);
  if(Buffer.byteLength(content,'utf8')>budget)content=JSON.stringify({status:result.status,fullResultRef:id,completeness:'partial',read});
  if(Buffer.byteLength(content,'utf8')>budget)throw new Error('MODEL_BUDGET_EXCEEDED');
  return {content,fullResultRef:id};
}
const resultRead=(resultRef:string,path:string,cursor:string,limit:number)=>({tool:'apps_inspect',arguments:{resultRef,path,cursor,limit}});
const pointerChild=(path:string,key:string|number)=>`${path}/${String(key).replace(/~/g,'~0').replace(/\//g,'~1')}`;
const valueKind=(value:JsonValue)=>value===null?'null':Array.isArray(value)?'array':typeof value;

function pointerValue(root:JsonValue,path:string):JsonValue {
  if(path==='')return root;
  if(!path.startsWith('/')||/~(?:[^01]|$)/.test(path))throw new Error('INVALID_RESULT_PATH');
  let value=root;
  for(const part of path.slice(1).split('/')){
    const key=part.replace(/~1/g,'/').replace(/~0/g,'~');
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,key)
      ||Array.isArray(value)&&!/^(0|[1-9]\d*)$/.test(key))throw new Error('RESULT_PATH_NOT_FOUND');
    value=Array.isArray(value)?value[Number(key)]:(value as JsonRecord)[key];
  }
  return value;
}

/** Paths address the complete original CapabilityResult, never its model sample. */
function boundedResultPage(id:string,result:CapabilityResult,offset:number,limit:number,options:{path:string;budget?:number}):JsonRecord {
  const {path,budget=14000}=options;
  if(typeof path!=='string')throw new Error('INVALID_RESULT_PATH');
  if(!Number.isSafeInteger(budget)||budget<512||budget>16384)throw new Error('INVALID_MODEL_BUDGET');
  const value=pointerValue(result as unknown as JsonValue,path),kind=valueKind(value);
  const base={resultRef:id,path,kind,bytes:size(value)};
  const page=(payload:JsonRecord,total:number,consumed:number):JsonRecord=>{
    const next=offset+consumed<total?String(offset+consumed):null;
    return {...base,...payload,offset,total,nextCursor:next,completeness:offset===0&&consumed===total?'complete':'partial',
      ...(next!==null?{continuation:resultRead(id,path,next,limit)}:{})};
  };
  const checked=(output:JsonRecord):JsonRecord=>{
    if(size(output)>budget)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');
    return output;
  };
  const reference=(node:JsonValue,childPath:string):JsonRecord=>({path:childPath,kind:valueKind(node),bytes:size(node),read:resultRead(id,childPath,'0',limit)});
  if(Array.isArray(value)){
    if(offset>value.length)throw new Error('INVALID_PAGE');
    const items:JsonValue[]=[];
    for(let index=offset;index<Math.min(value.length,offset+limit);index++){
      const candidate=page({items:[...items,value[index]],returned:items.length+1},value.length,items.length+1);
      if(size(candidate)>budget)break;
      items.push(value[index]);
    }
    if(items.length||offset===value.length)return checked(page({items,returned:items.length},value.length,items.length));
    // Advance past a deferred whole element; its exact child path is independently readable.
    // This cannot send the model into a same-cursor retry loop or silently shorten the element.
    return checked({...page({items:[],returned:0,deferred:[{index:offset,...reference(value[offset],pointerChild(path,offset))}],scanned:1},value.length,1),completeness:'partial'});
  }
  if(typeof value==='string'){
    const characters=Array.from(value);
    if(offset>characters.length)throw new Error('INVALID_PAGE');
    const make=(length:number)=>page({text:characters.slice(offset,offset+length).join(''),returned:length,cursorUnit:'unicode-code-points'},characters.length,length);
    let low=0,high=Math.min(characters.length-offset,budget);
    while(low<high){const middle=Math.ceil((low+high)/2);if(size(make(middle))<=budget)low=middle;else high=middle-1;}
    if(!low&&offset<characters.length)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');
    return checked(make(low));
  }
  if(value!==null&&typeof value==='object'){
    const whole={...base,value,returned:1,total:1,nextCursor:null,completeness:'complete'};
    if(offset===0&&size(whole)<=budget)return whole;
    const entries=Object.entries(value);
    if(offset>entries.length)throw new Error('INVALID_PAGE');
    const directory:JsonValue[]=[];
    for(let index=offset;index<Math.min(entries.length,offset+limit);index++){
      const [key,node]=entries[index],entry={key,...reference(node,pointerChild(path,key))};
      const candidate=page({kind:'directory',entries:[...directory,entry],returned:directory.length+1},entries.length,directory.length+1);
      if(size(candidate)>budget)break;
      directory.push(entry);
    }
    if(!directory.length&&offset<entries.length)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');
    return checked({...page({kind:'directory',entries:directory,returned:directory.length},entries.length,directory.length),completeness:'partial'});
  }
  if(offset!==0)throw new Error('INVALID_PAGE');
  return checked({...base,value,returned:1,total:1,nextCursor:null,completeness:'complete'});
}

export function readResultPage(store:RuntimeStore,id:string,cursor='0',limit=100,options?:{path:string;budget?:number}) {
  const stored=store.get<{result:CapabilityResult}>('datasets',id);if(!stored)throw new Error('RESULT_NOT_FOUND');
  const offset=Number(cursor);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('INVALID_PAGE');
  if(options)return boundedResultPage(id,stored.result,offset,limit,options);
  const data='data' in stored.result?stored.result.data:null;
  if(Array.isArray(data)){const items=data.slice(offset,offset+limit);return {datasetId:id,revision:'1',items,total:data.length,returned:items.length,nextCursor:offset+items.length<data.length?String(offset+items.length):null,completeness:offset===0&&items.length===data.length?'complete':'partial'};}
  return {datasetId:id,revision:'1',result:stored.result as unknown as JsonValue,returned:1,total:1,nextCursor:null,completeness:'complete'};
}
