import {createHash} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonValue} from '../../app-contracts/src/index.ts';

type RecordValue=Record<string,JsonValue>;
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
const child=(path:string,key:string|number)=>`${path}/${String(key).replace(/~/g,'~0').replace(/\//g,'~1')}`;
const kind=(value:JsonValue)=>value===null?'null':Array.isArray(value)?'array':typeof value;
function at(root:JsonValue,path:string):JsonValue {
  if(path==='')return root;
  if(!path.startsWith('/')||/~(?:[^01]|$)/.test(path))throw new Error('INVALID_DESCRIPTOR_PATH');
  let value=root;
  for(const part of path.slice(1).split('/')){
    const key=part.replace(/~1/g,'/').replace(/~0/g,'~');
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,key)||Array.isArray(value)&&!/^(0|[1-9]\d*)$/.test(key))throw new Error('DESCRIPTOR_PATH_NOT_FOUND');
    value=(value as RecordValue)[key];
  }
  return value;
}
/** A model-facing view only. Runtime validation always uses the unchanged complete descriptor. */
export function describeForModel(descriptor:CapabilityDescriptor,_catalogDigest:string,options:{view?:string;path?:string;cursor?:string;limit?:number;descriptorDigest?:string},authoringGuidance?:JsonValue):RecordValue {
  const root:RecordValue={descriptor:descriptor as unknown as JsonValue,...(authoringGuidance?{authoringGuidance}:{})};
  const descriptorDigest=createHash('sha256').update(canonicalJson(root)).digest('hex');
  if(options.descriptorDigest!==undefined&&options.descriptorDigest!==descriptorDigest)throw new Error('DESCRIPTOR_CHANGED');
  const identity={capabilityId:descriptor.capabilityId,version:descriptor.version,descriptorDigest};
  const read=(path:string,cursor='0',limit=options.limit??20):RecordValue=>({tool:'apps_describe',arguments:{...identity,view:'full',path,cursor,limit}});
  const budget=14000;
  if(options.view!=='full'&&options.path===undefined&&options.cursor===undefined){
    const {outputSchema,...inputDescriptor}=descriptor;
    const output:RecordValue={status:'ok',...identity,view:'input',descriptor:inputDescriptor as unknown as JsonValue,
      schemaCompleteness:{input:'complete',output:'deferred'},outputSchemaRead:read('/descriptor/outputSchema'),fullDescriptorRead:read('/descriptor'),...(authoringGuidance?{authoringGuidance}:{})};
    // Small complete schemas cost less than the continuation envelope; keep them inline.
    const complete:RecordValue={status:'ok',...root};
    if(bytes(complete)<=budget&&bytes(complete)<=bytes(output))return complete;
    if(bytes(output)<=budget)return output;
  }
  const path=options.path??'',offset=Number(options.cursor??'0'),limit=options.limit??20;
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('INVALID_DESCRIPTOR_PAGE');
  let value=at(root,path);const base:RecordValue={status:'ok',...identity,view:'full',path,kind:kind(value),bytes:bytes(value)};
  const whole={...base,value,completeness:'complete'};
  if(offset===0&&bytes(whole)<=budget)return whole;
  const page=(payload:RecordValue,total:number,consumed:number):RecordValue=>{
    const next=offset+consumed<total?String(offset+consumed):null;
    return {...base,...payload,offset,total,nextCursor:next,completeness:'partial',...(next!==null?{continuation:read(path,next,limit)}:{})};
  };
  const checked=(result:RecordValue)=>{if(bytes(result)>budget)throw new Error('DESCRIPTOR_PATH_BUDGET_EXCEEDED');return result;};
  if(value!==null&&typeof value==='object'){
    const entries=Object.entries(value);
    const unreadable=entries.some(([key,node])=>{
      const nextPath=child(path,key),entry={key,kind:kind(node),bytes:bytes(node),read:read(nextPath,'0',limit)};
      const max=Number.MAX_SAFE_INTEGER;
      const worstPage={...base,kind:'directory',containerKind:kind(value),entries:[entry],returned:1,offset:max,total:max,nextCursor:String(max),completeness:'partial',continuation:read(path,String(max),limit)};
      return nextPath.length>4000||bytes(worstPage)>budget;
    });
    // A legal JSON key can exceed the tool's pointer or byte budget. Stay on the
    // current short path and stream exact JSON rather than issuing an unusable read.
    if(unreadable){base.originalKind=kind(value);base.kind='serialized-json';base.encoding='json';value=JSON.stringify(value);}
  }
  if(typeof value==='string'){
    const chars=Array.from(value);if(offset>chars.length)throw new Error('INVALID_DESCRIPTOR_PAGE');
    const make=(n:number)=>page({text:chars.slice(offset,offset+n).join(''),returned:n,cursorUnit:'unicode-code-points'},chars.length,n);
    let low=0,high=Math.min(chars.length-offset,budget);
    while(low<high){const mid=Math.ceil((low+high)/2);if(bytes(make(mid))<=budget)low=mid;else high=mid-1;}
    if(!low&&offset<chars.length)throw new Error('DESCRIPTOR_PATH_BUDGET_EXCEEDED');
    return checked(make(low));
  }
  if(value!==null&&typeof value==='object'){
    const entries=Object.entries(value);if(offset>entries.length)throw new Error('INVALID_DESCRIPTOR_PAGE');
    const directory:JsonValue[]=[];
    for(let i=offset;i<Math.min(entries.length,offset+limit);i++){
      const [key,node]=entries[i],entry={key,kind:kind(node),bytes:bytes(node),read:read(child(path,key),'0',limit)};
      if(bytes(page({kind:'directory',containerKind:kind(value),entries:[...directory,entry],returned:directory.length+1},entries.length,directory.length+1))>budget)break;
      directory.push(entry);
    }
    if(!directory.length&&offset<entries.length)throw new Error('DESCRIPTOR_PATH_BUDGET_EXCEEDED');
    return checked(page({kind:'directory',containerKind:kind(value),entries:directory,returned:directory.length},entries.length,directory.length));
  }
  if(offset!==0)throw new Error('INVALID_DESCRIPTOR_PAGE');
  return checked(whole);
}
