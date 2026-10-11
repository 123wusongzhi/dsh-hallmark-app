import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const privateKey=/(?:api.?key|client.?id|token|cookie|password|authorization|secret|report.?url)/i;

function publicMessage(value:string):string {
 return value.replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi,'[redacted]')
  .replace(/((?:api[-_ ]?key|client[-_ ]?id|access[-_ ]?token|refresh[-_ ]?token|token|password|authorization|secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,'$1[redacted]')
  .replace(/([?&](?:signature|credential|token|api[-_]?key|x-amz-signature|x-amz-credential)=)[^&\s]+/gi,'$1[redacted]');
}

/** Preserve bounded platform diagnostics, with defense in depth for legacy Control responses. */
export function platformFailureDetails(result:ToolResult):JsonValue|undefined {
 const raw=result.data;
 if(!object(raw)||typeof raw.httpStatus!=='number'||raw.httpStatus<400||!Object.hasOwn(raw,'response'))return undefined;
 let remaining=6000,truncated=false;
 const visit=(value:unknown,depth=0):JsonValue=>{
  if(remaining<=0||depth>6){truncated=true;return '[truncated]';}
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string'){
   const cleaned=publicMessage(value);
   const limit=Math.min(remaining,2000);let used=0,kept='';
   for(const char of cleaned){const bytes=Buffer.byteLength(JSON.stringify(char));if(used+bytes>limit){truncated=true;break;}kept+=char;used+=bytes;}
   remaining-=used;return kept;
  }
  if(Array.isArray(value)){const items:JsonValue[]=[];for(const item of value){if(items.length===20||remaining<=0){truncated=true;break;}remaining-=2;items.push(visit(item,depth+1));}return items;}
  if(object(value)){const entries:[string,JsonValue][]=[];for(const [key,item] of Object.entries(value)){if(entries.length===30||remaining<=0){truncated=true;break;}if(key.length>200){truncated=true;continue;}remaining-=Buffer.byteLength(JSON.stringify(key))+3;entries.push([key,privateKey.test(key)?'[redacted]':visit(item,depth+1)]);}return Object.fromEntries(entries);}
  return null;
 };
 const response=visit(raw.response);
 return {httpStatus:raw.httpStatus,response,...(truncated?{truncated:true}:{})};
}
