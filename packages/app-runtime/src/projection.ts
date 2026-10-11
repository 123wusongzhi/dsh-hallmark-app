import type { CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';
import type { InvocationRecord, RuntimeStore } from './store.ts';
type JsonRecord=Record<string,JsonValue>;
const object=(value:JsonValue|undefined):JsonRecord|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value:undefined;
const pick=(value:JsonRecord|undefined,keys:readonly string[]):JsonRecord=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value![key]]));
// Plain well-formed strings need only the surrounding JSON quotes. Keep native
// serialization for escapes and lone surrogates so bytes always match JSON.stringify.
// Node >=22.18 provides isWellFormed; the project intentionally types against ES2023.
const size=(value:unknown)=>typeof value==='string'&&!/["\\\u0000-\u001f]/.test(value)&&(value as string&{isWellFormed():boolean}).isWellFormed()
  ?Buffer.byteLength(value,'utf8')+2:Buffer.byteLength(JSON.stringify(value),'utf8');

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
  const read=(input:JsonRecord,readConnectionId=connectionId):JsonRecord=>({tool:'apps_invoke',arguments:{appId:'hallmark',...(readConnectionId?{connectionId:readConnectionId}:{}),capabilityId:'hallmark.plan.get',capabilityVersion:'1.0.0',input:{planId:plan.planId,...input}},...(!readConnectionId?{connection:'Use the same connectionId as this call.'}:{})});
  const metadata=pick(plan,['planId','revision','storeId','status','createdAt','updatedAt']);
  const counts:JsonRecord={};for(const row of rows){const status=String(row.status);counts[status]=Number(counts[status]??0)+1;}
  const envelope=pick(result as unknown as JsonRecord,['status','invocationId','traceId','operation','errors','unresolvedOperationIds']);
  let fullResultRef=request?.source?.kind==='recovery'?`result:${result.invocationId}`:undefined;
  if(fullResultRef){
    try{store.put('datasets',fullResultRef,{datasetId:fullResultRef,kind:'invocation-result',revision:'1',result,createdAt:new Date().toISOString()});}
    catch{return {content:JSON.stringify({status:'failed',invocationId:result.invocationId,error:{code:'RESULT_SPILL_FAILED',message:'Inspection evidence could not be retained. Read the original plan; do not resubmit the business action.',retryPolicy:'never'}})};}
    envelope.fullResultRef=fullResultRef;envelope.read=resultRead(fullResultRef,'','0',100);
  }
  // Page offsets are relative to the original selection, not the whole plan.
  const rowIds=request?.appId==='hallmark'&&['hallmark.plan.get','hallmark.listing.draft.get'].includes(request.capabilityId)?object(request.input)?.rowIds:undefined;
  const make=(count:number):JsonRecord=>{
    const next=count<rows.length?String(offset+count):suppliedPage?.nextCursor??null;
    return {...envelope,data:{...metadata,rows:rows.slice(0,count),page:{offset,total,returned:count,nextCursor:next},
      modelView:'business-operation-summary',rowStatusCounts:counts,countsScope:'input page',
      omitted:['payload content','review objects','source context'],
      ...(next!==null?{continuation:read({...(Array.isArray(rowIds)?{rowIds}:{}),cursor:next,limit:20})}:{})}};
  };
  let count=rows.length,projected=make(count);
  while(count>0&&size(projected)>budget)projected=make(--count);
  if(count>0||rows.length===0){
    const content=JSON.stringify(projected);if(Buffer.byteLength(content)<=budget)return {content,...(fullResultRef?{fullResultRef}:{})};
  }
  // An individual issue can exceed the budget too. Be explicit; identical get retries cannot fix it.
  if(!fullResultRef){
    fullResultRef=`result:${result.invocationId}`;
    try{store.put('datasets',fullResultRef,{datasetId:fullResultRef,kind:'invocation-result',revision:'1',result,createdAt:new Date().toISOString()});}
    catch{
      const failed={status:'failed',error:{code:'RESULT_SPILL_FAILED',message:'Read original plan evidence; do not resubmit the business action.',retryPolicy:'never'},read:read({rowIds:[String(rows[0]?.rowId)],includeEvidence:true})};
      if(size(failed)<=budget)return {content:JSON.stringify(failed)};
      return {content:JSON.stringify({status:failed.status,error:{...failed.error,message:'Read the original plan with includeEvidence:true; do not resubmit.'}})};
    }
    envelope.fullResultRef=fullResultRef;envelope.read=resultRead(fullResultRef,'/data/rows','0',100);
  }
  if(typeof suppliedPage?.nextCursor==='string'){
    // The retained result contains only this provider page. Keep the exact next
    // read separately so an oversized selection never drops its remaining rows.
    // Its original invocation identity enforces the same connection authorization.
    const recoveryRef=`${fullResultRef}:page`,recovery={
      current:resultRead(fullResultRef,'/data/rows','0',100),
      next:read({...(Array.isArray(rowIds)?{rowIds}:{}),cursor:suppliedPage.nextCursor,limit:20},request?.connectionId??connectionId),
    };
    try{store.put('datasets',recoveryRef,{datasetId:recoveryRef,kind:'business-page-recovery',revision:'1',result:{status:'ok',invocationId:result.invocationId,traceId:result.traceId,data:JSON.stringify(recovery)},createdAt:new Date().toISOString()});}
    catch{return {content:JSON.stringify({status:'failed',error:{code:'RESULT_SPILL_FAILED',message:'The next page read could not be retained. Read the original plan; do not resubmit the business action.',retryPolicy:'never'}})};}
    envelope.read=resultRead(recoveryRef,'/data','0',100);
    envelope.readInstructions='Read every text page and JSON.parse; read current rows completely before invoking next. Do not resubmit the business action.';
  }
  const first=rows[0],issues=Array.isArray(first?.issues)?first.issues:[];
  const failure={code:'ROW_MODEL_BUDGET_EXCEEDED',rowId:first?.rowId??null,rowBytes:first?size(first):0,
    issues:issues.map(issue=>({...pick(object(issue),['code','field']),bytes:size(issue)})),
    message:'The full issue text could not be delivered. Repeating the same get will not fix this limit. Do not resubmit the business action.'};
  const detail={...envelope,data:{...metadata,rows:[],page:{offset,total,returned:0,nextCursor:null},
    modelView:'business-operation-summary',completeness:'incomplete',modelProjectionError:failure}};
  if(size(detail)<=budget)return {content:JSON.stringify(detail),...(fullResultRef?{fullResultRef}:{})};
  const minimal={status:result.status,planId:plan.planId,revision:plan.revision,completeness:'incomplete',
    ...(fullResultRef?{fullResultRef,read:envelope.readInstructions?envelope.read:resultRead(fullResultRef,'/data/rows','0',100),...(envelope.readInstructions?{readInstructions:envelope.readInstructions}:{})}:{}),error:{code:failure.code,rowId:failure.rowId,rowBytes:failure.rowBytes,issueCount:issues.length,message:'Read the retained original rows; do not resubmit the business action.'}};
  if(size(minimal)<=budget)return {content:JSON.stringify(minimal),...(fullResultRef?{fullResultRef}:{})};
  const {rowBytes,issueCount,...compactError}=minimal.error;
  const compact={...minimal,error:compactError};
  if(size(compact)<=budget)return {content:JSON.stringify(compact),...(fullResultRef?{fullResultRef}:{})};
  if(envelope.readInstructions){
    const bounded={status:result.status,completeness:'incomplete',read:envelope.read,readInstructions:envelope.readInstructions,error:{code:failure.code}};
    if(size(bounded)<=budget)return {content:JSON.stringify(bounded),fullResultRef};
  }
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
  let value=pointerValue(result as unknown as JsonValue,path);
  const kind=valueKind(value),base:JsonRecord={resultRef:id,path,kind,bytes:size(value)};
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
  if(value!==null&&typeof value==='object'){
    const whole={...base,value,returned:1,total:1,nextCursor:null,completeness:'complete'};
    // Like descriptor reads, exact JSON streaming keeps legal keys addressable
    // when their escaped/accumulated pointer or reference envelope cannot fit.
    // Preserve the existing complete-object and ordinary directory/array shapes.
    const arrayValue=Array.isArray(value)?value:undefined,array=arrayValue!==undefined,total=arrayValue?.length??0,last=Math.max(0,total-1);
    const longestChild=pointerChild(path,array?last:'');
    const arrayReference={path:longestChild,kind:'boolean',bytes:base.bytes,read:resultRead(id,longestChild,'0',limit)};
    const arrayEnvelope={...base,items:[],returned:0,deferred:[{index:last,...arrayReference}],scanned:1,offset:last,total,nextCursor:String(last),completeness:'partial',continuation:resultRead(id,path,String(last),limit)};
    // Ordinary arrays retain page-local traversal rather than scanning every row.
    if(array?(total>0&&(longestChild.length>4000||size(arrayEnvelope)>budget)):size(whole)>budget){
      // Only inspect actual entries when the cheap array upper bound cannot prove
      // references fit. Real positions keep readable small-budget pages unchanged;
      // the decision still covers this entire value, never just the current page.
      const entryPage=(payload:JsonRecord,index:number,count:number,partial=true):JsonRecord=>{
        const next=index+1<count?String(index+1):null;
        return {...base,...payload,offset:index,total:count,nextCursor:next,completeness:!partial&&index===0&&count===1?'complete':'partial',...(next!==null?{continuation:resultRead(id,path,next,limit)}:{})};
      };
      const unreadable=arrayValue?arrayValue.some((node,index)=>{
        if(size(entryPage({items:[node],returned:1},index,total,false))<=budget)return false;
        const childPath=pointerChild(path,index);
        return childPath.length>4000||size(entryPage({items:[],returned:0,deferred:[{index,...reference(node,childPath)}],scanned:1},index,total))>budget;
      }):Object.entries(value).some(([key,node],index,entries)=>{
        const childPath=pointerChild(path,key),ref=reference(node,childPath);
        const payload={kind:'directory',entries:[{key,...ref}],returned:1};
        return childPath.length>4000||size(entryPage(payload,index,entries.length))>budget;
      });
      if(unreadable){base.originalKind=kind;base.kind='serialized-json';base.encoding='json';base.readInstruction='Concatenate text pages in order, then JSON.parse once.';value=JSON.stringify(value);}
    }
  }
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
    // Count code points without allocating an array for the entire stored string.
    // Only this page's possible boundaries are retained; cursors keep their existing units.
    let total=value.length,start=Math.min(offset,value.length);
    const ends:number[]=[];
    // Without a surrogate pair, code-point offsets equal UTF-16 offsets, even
    // when lone surrogates are present. The native scan avoids a JS full-text loop.
    if(!/[\ud800-\udbff][\udc00-\udfff]/.test(value)){
      for(let index=start;index<Math.min(value.length,start+budget);index++)ends.push(index+1);
    }else{
      total=0;start=value.length;
      for(let index=0;index<value.length;total++){
        if(total===offset)start=index;
        const first=value.charCodeAt(index++);
        if(first>=0xd800&&first<=0xdbff&&index<value.length){
          const second=value.charCodeAt(index);if(second>=0xdc00&&second<=0xdfff)index++;
        }
        if(total>=offset&&ends.length<budget)ends.push(index);
      }
    }
    if(offset>total)throw new Error('INVALID_PAGE');
    const make=(length:number)=>page({text:value.slice(start,length?ends[length-1]:start),returned:length,cursorUnit:'unicode-code-points'},total,length);
    let low=0,high=ends.length;
    while(low<high){const middle=Math.ceil((low+high)/2);if(size(make(middle))<=budget)low=middle;else high=middle-1;}
    if(!low&&offset<total)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');
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

/** Explicit exact own-key projection; the original result is never replaced or mutated. */
function projectedResultPage(id:string,result:CapabilityResult,offset:number,limit:number,options:{path:string;fields:string[];budget?:number}):JsonRecord {
  const {path,fields,budget=14000}=options;
  const reject=(code:string,message=code):never=>{throw Object.assign(new Error(message),{code});};
  if(!Array.isArray(fields)||fields.length<1||fields.length>16||new Set(fields).size!==fields.length||fields.some(field=>typeof field!=='string'||!field.length||Array.from(field).length>256))reject('INVALID_RESULT_FIELDS');
  if(typeof path!=='string')reject('INVALID_RESULT_PATH');
  if(!Number.isSafeInteger(budget)||budget<512||budget>16384)reject('INVALID_MODEL_BUDGET');
  const value=pointerValue(result as unknown as JsonValue,path);
  if(!Array.isArray(value)||value.some(row=>row===null||typeof row!=='object'||Array.isArray(row)))reject('RESULT_PROJECTION_REQUIRES_OBJECT_ARRAY');
  const rows=value as JsonRecord[];
  if(offset>rows.length)reject('INVALID_PAGE');
  const make=(items:JsonValue[]):JsonRecord=>{
    const next=offset+items.length<rows.length?String(offset+items.length):null;
    return {resultRef:id,path,kind:'array-projection',fields,completeness:'partial',rowsCompleteness:offset===0&&items.length===rows.length?'complete':'partial',offset,returned:items.length,total:rows.length,items,nextCursor:next,
      ...(next!==null?{continuation:{tool:'apps_inspect',arguments:{resultRef:id,path,fields,cursor:next,limit}}}:{})};
  };
  if(size(make([]))>budget)reject('RESULT_PROJECTION_BUDGET_EXCEEDED','Selection and continuation exceed the read budget. Omit fields and read the original result at the same resultRef and path.');
  const items:JsonValue[]=[];
  for(let index=offset;index<Math.min(rows.length,offset+limit);index++){
    const row=rows[index],present=fields.filter(field=>Object.hasOwn(row,field));
    const item={index,values:Object.fromEntries(present.map(field=>[field,row[field]])),missing:fields.filter(field=>!Object.hasOwn(row,field))};
    if(size(make([...items,item]))>budget)break;
    items.push(item);
  }
  if(!items.length&&offset<rows.length||size(make(items))>budget)reject('RESULT_PROJECTION_BUDGET_EXCEEDED','Selected row or envelope exceeds the read budget. Omit fields and read the original result at the same resultRef and path.');
  return make(items);
}

/** Exact literal locations in one original string; never a business-context summary. */
function locateResultLiteral(id:string,result:CapabilityResult,offset:number,limit:number,options:{path:string;budget?:number;literal:string}):JsonRecord {
  const {path,literal,budget=14000}=options;
  if(typeof path!=='string')throw new Error('INVALID_RESULT_PATH');
  if(typeof literal!=='string'||!literal.length||literal.length>512||Array.from(literal).length>256)throw new Error('INVALID_RESULT_LITERAL');
  if(!Number.isSafeInteger(budget)||budget<512||budget>16384)throw new Error('INVALID_MODEL_BUDGET');
  const value=pointerValue(result as unknown as JsonValue,path);
  if(typeof value!=='string')throw new Error('RESULT_LITERAL_REQUIRES_STRING');
  const advance=(at:number)=>{const first=value.charCodeAt(at++);if(first>=0xd800&&first<=0xdbff&&at<value.length){const second=value.charCodeAt(at);if(second>=0xdc00&&second<=0xdfff)at++;}return at;};
  // Fresh Store reads still materialize the full value. Converting an existing code-point
  // cursor scans its prefix; only new candidate starts are capped at 65,536 per call.
  let position=0,index=0;
  while(position<offset&&index<value.length){index=advance(index);position++;}
  if(position<offset)throw new Error('INVALID_PAGE');
  const literalLength=Array.from(literal).length,matches:JsonValue[]=[];
  const make=():JsonRecord=>({resultRef:id,path,kind:'literal-locations',cursorUnit:'unicode-code-points',literalLength,
    matches,returned:matches.length,scanned:{from:offset,toExclusive:position},total:index===value.length?position:null,done:index===value.length,
    nextCursor:index<value.length?String(position):null,
    ...(index<value.length?{continuation:{tool:'apps_inspect',arguments:{resultRef:id,path,literal,cursor:String(position),limit}}}:{}),
    message:'Locations only, not complete business context. Follow continuation; omit literal and read original context at each readCursor on the same resultRef and path.'});
  // Reserve enough for numeric cursor growth and a terminal total, including absent matches.
  const max=Number.MAX_SAFE_INTEGER,preflight={...make(),matches:[{offset:max,length:literalLength,readCursor:String(max)}],returned:1,scanned:{from:max,toExclusive:max},total:max,done:false,nextCursor:String(max),continuation:{tool:'apps_inspect',arguments:{resultRef:id,path,literal,cursor:String(max),limit}}};
  if(size(preflight)>budget)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');
  while(index<value.length&&position-offset<65536&&matches.length<limit){
    const previousIndex=index,previousPosition=position,end=index+literal.length;
    const splitsPair=end<value.length&&end>0&&value.charCodeAt(end-1)>=0xd800&&value.charCodeAt(end-1)<=0xdbff&&value.charCodeAt(end)>=0xdc00&&value.charCodeAt(end)<=0xdfff;
    const matched=value.startsWith(literal,index)&&!splitsPair;
    index=advance(index);position++;
    if(matched){
      matches.push({offset:previousPosition,length:literalLength,readCursor:String(Math.max(0,previousPosition-256))});
      // Test the consumed envelope and reserve numeric growth if later candidates miss.
      const outputBytes=size(make());
      if(outputBytes>budget){matches.pop();index=previousIndex;position=previousPosition;if(!matches.length)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');break;}
      if(outputBytes+64>budget)break;
    }
  }
  const output=make();if(size(output)>budget)throw new Error('RESULT_PATH_BUDGET_EXCEEDED');return output;
}

export function readResultPage(store:RuntimeStore,id:string,cursor='0',limit=100,options?:{path:string;budget?:number;fields?:string[];literal?:string}) {
  if(options?.fields!==undefined&&options.literal!==undefined)throw new Error('RESULT_SELECTION_CONFLICT');
  const stored=store.get<{result:CapabilityResult}>('datasets',id);if(!stored)throw new Error('RESULT_NOT_FOUND');
  return readStoredResultPage(id,stored.result,cursor,limit,options);
}

/** Reuse only the snapshot already loaded and authorized in this synchronous request. */
export function readStoredResultPage(id:string,result:CapabilityResult,cursor='0',limit=100,options?:{path:string;budget?:number;fields?:string[];literal?:string}) {
  if(options?.fields!==undefined&&options.literal!==undefined)throw new Error('RESULT_SELECTION_CONFLICT');
  const offset=Number(cursor);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('INVALID_PAGE');
  if(options?.literal!==undefined)return locateResultLiteral(id,result,offset,limit,{...options,literal:options.literal});
  if(options?.fields!==undefined)return projectedResultPage(id,result,offset,limit,{...options,fields:options.fields});
  if(options)return boundedResultPage(id,result,offset,limit,options);
  const data='data' in result?result.data:null;
  if(Array.isArray(data)){const items=data.slice(offset,offset+limit);return {datasetId:id,revision:'1',items,total:data.length,returned:items.length,nextCursor:offset+items.length<data.length?String(offset+items.length):null,completeness:offset===0&&items.length===data.length?'complete':'partial'};}
  return {datasetId:id,revision:'1',result:result as unknown as JsonValue,returned:1,total:1,nextCursor:null,completeness:'complete'};
}
