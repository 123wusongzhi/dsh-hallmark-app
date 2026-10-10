import type {JsonValue} from '../../app-contracts/src/index.ts';

type Body={bindings:{bindingId:string;payload:JsonValue;resources:JsonValue}[]};
type Cached={revision:string;body:Body};
const object=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
function invalid():never {throw new Error('INVALID_DATA_TRANSFER');}

/** Each response owns one immutable body; an overlapping read cannot replace its base revision. */
export function createDataTransferReader(extension:(action:string,params:JsonValue)=>Promise<JsonValue>):(params:Record<string,JsonValue>)=>Promise<JsonValue> {
  let latest:Cached|undefined;
  return async params=>{
    const base=latest;
    const packet=object(await extension('prepare',{...params,...(base?{knownRevision:base.revision}:{})}));
    if(packet.kind!=='dsh.data-transfer.v1'||typeof packet.revision!=='string'||!/^[a-f0-9]{64}$/.test(packet.revision)||!Array.isArray(packet.metadata?.bindings))invalid();
    let body:Body;
    if(packet.unchanged===true){if(!base||base.revision!==packet.revision)invalid();body=base.body;}
    else if(packet.body){body=structuredClone(packet.body);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)))),value=>value.toString(16).padStart(2,'0')).join('');if(hash!==packet.revision)invalid();}
    else {
      const transfer=object(packet.transfer);
      if(typeof transfer.id!=='string'||transfer.id.length>160||!Number.isSafeInteger(transfer.bytes)||transfer.bytes<1||transfer.bytes>32*1024*1024||!Number.isSafeInteger(transfer.chunks)||transfer.chunks<1||transfer.chunks>512)invalid();
      const bytes=new Uint8Array(transfer.bytes);let offset=0;
      for(let start=0;start<transfer.chunks;start+=4){
        const chunks=await Promise.all(Array.from({length:Math.min(4,transfer.chunks-start)},async(_,index)=>{
          const actualIndex=start+index,value=object(await extension('read',{id:transfer.id,index:actualIndex}));
          if(value.id!==transfer.id||value.index!==actualIndex||value.revision!==packet.revision||typeof value.chunk!=='string'||value.chunk.length>90000)invalid();
          return Uint8Array.from(atob(value.chunk),character=>character.charCodeAt(0));
        }));
        for(const chunk of chunks){if(offset+chunk.length>bytes.length)invalid();bytes.set(chunk,offset);offset+=chunk.length;}
      }
      if(offset!==bytes.length)invalid();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
      if(hash!==packet.revision)invalid();body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    }
    if(!Array.isArray(body?.bindings))invalid();
    const content=new Map(body.bindings.map(binding=>[binding.bindingId,binding]));
    if(content.size!==body.bindings.length||packet.metadata.bindings.length!==content.size||new Set(packet.metadata.bindings.map((binding:Record<string,JsonValue>)=>binding.bindingId)).size!==content.size)invalid();
    const bindings=packet.metadata.bindings.map((binding:Record<string,JsonValue>)=>{
      const row=content.get(String(binding.bindingId));if(!row)invalid();
      const {payloadCache,...metadata}=binding;
      const payload=Object.hasOwn(binding,'payloadCache')?{...object(row.payload),cache:payloadCache}:row.payload;
      return {...metadata,payload,resources:row.resources};
    });
    latest={revision:packet.revision,body};return structuredClone({...packet.metadata,bindings}) as JsonValue;
  };
}
