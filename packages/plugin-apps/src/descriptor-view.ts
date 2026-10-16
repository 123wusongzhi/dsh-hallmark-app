import {createHash} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonValue} from '../../app-contracts/src/index.ts';
const budget=16384;
const size=(value:unknown)=>Buffer.byteLength(canonicalJson(value));
/** The identity covers the exact canonical representation, including session guidance.
 * Unrelated catalog changes do not invalidate a continuation; any represented change does.
 * Chunks are canonical JSON text, never partial schemas to be used for validation.
 */
export function descriptorView(descriptor:CapabilityDescriptor,guidance:JsonValue|undefined,input:Record<string,JsonValue>):unknown {
 const full={status:'ok',descriptor,...(guidance===undefined?{}:{authoringGuidance:guidance})},serialized=canonicalJson(full),identity=(section:string)=>createHash('sha256').update(canonicalJson({section,serialized})).digest('hex');
 const section=input.section,representationId=identity(typeof input.section==='string'?input.section:'full'),base={capabilityId:descriptor.capabilityId,version:descriptor.version};
 const read=(section:string)=>({...base,section,representationId:identity(section)});
 const failed=(code:string,message:string)=>({status:'failed',error:{code,message},restart:{tool:'apps_describe',arguments:base}});
 if(input.representationId!==undefined&&input.representationId!==representationId)return failed('DESCRIPTOR_CHANGED','说明或当前会话指引已变化；重新读取，不得拼接不同表示。');
 if(section!==undefined){
  if(section!=='full'&&section!=='outputSchema'&&section!=='inputSchema')return failed('INVALID_INPUT','section 必须为 full、inputSchema 或 outputSchema。');
  if(input.representationId===undefined)return failed('INVALID_INPUT','续读必须携带 representationId。');
  const source=section==='full'?serialized:canonicalJson(section==='inputSchema'?descriptor.inputSchema:descriptor.outputSchema),offset=input.cursor===undefined?0:Number(input.cursor);
  if(!Number.isSafeInteger(offset)||offset<0||offset>=source.length)return failed('INVALID_CURSOR','cursor 必须是本次表示的有效字符位置。');
  if(offset>0&&/[\uDC00-\uDFFF]/.test(source[offset])&&/[\uD800-\uDBFF]/.test(source[offset-1]))return failed('INVALID_CURSOR','cursor 不得拆分 Unicode 字符。');
  let end=Math.min(source.length,offset+10000);
  for(;;){
   if(end<source.length&&/[\uD800-\uDBFF]/.test(source[end-1]))end--;
   const next=end<source.length?{tool:'apps_describe',arguments:{...read(section),cursor:String(end)}}:null;
   const page={status:'ok',capabilityId:descriptor.capabilityId,version:descriptor.version,representationId,section,encoding:'canonical-json-text',cursorUnit:'utf16-code-units',cursor:String(offset),text:source.slice(offset,end),complete:end===source.length,next,instructions:'按 next 顺序读取并拼接 text 后 JSON.parse；未读完不可当作完整 Schema。'};
   if(size(page)<=budget)return page;
   end=offset+Math.floor((end-offset)/2);
   if(end<=offset)return failed('DESCRIPTOR_IDENTITY_TOO_LARGE','能力身份超过读取预算。');
  }
 }
 if(input.cursor!==undefined)return failed('INVALID_INPUT','cursor 需要 section。');
 if(Buffer.byteLength(serialized)<=budget)return full;
 const {outputSchema,...callDescriptor}=descriptor;
 const lean={status:'ok',descriptor:callDescriptor,inputSchemaComplete:true,outputSchemaDeferred:{tool:'apps_describe',arguments:read('outputSchema')},...(guidance===undefined?{}:{authoringGuidance:guidance})};
 if(size(lean)<=budget)return lean;
 // Do not claim a partial input schema is complete. Preserve every constraint via full reading.
 return {status:'ok',capabilityId:descriptor.capabilityId,version:descriptor.version,inputSchemaComplete:false,inputSchemaDeferred:{tool:'apps_describe',arguments:read('inputSchema')},descriptorDeferred:{tool:'apps_describe',arguments:read('full')},instructions:'完整输入约束或指引超出单次预算。调用前必须读取 descriptorDeferred 及全部 next，拼接 text 后 JSON.parse。'};
}
