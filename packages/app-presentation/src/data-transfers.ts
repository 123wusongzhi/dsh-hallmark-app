import {createHash,randomUUID} from 'node:crypto';
import type {JsonValue} from '../../app-contracts/src/index.ts';

export const DATA_TRANSFER_MAX_BYTES=32*1024*1024;
const CHUNK_BYTES=64*1024,TTL_MS=120000,MAX_RETAINED_BYTES=64*1024*1024;
type Transfer={owner:string;guard:string;bytes:Buffer;revision:string;expiresAt:number};
function failure(code:string,message:string):never {throw Object.assign(new Error(message),{code});}

/** Frozen content is owned by one granted iframe. Metadata may change without retransmitting rows. */
export class DataTransfers {
  private entries=new Map<string,Transfer>();
  private retainedBytes=0;
  clearOwner(owner:string):void {for(const [id,entry] of this.entries)if(entry.owner===owner){this.entries.delete(id);this.retainedBytes-=entry.bytes.length;}}
  private prune():void {
    for(const [id,entry] of this.entries)if(entry.expiresAt<=Date.now()){this.entries.delete(id);this.retainedBytes-=entry.bytes.length;}
  }
  prepare(owner:string,data:JsonValue,knownRevision?:string,guard=''):JsonValue {
    this.prune();
    const value=data as {viewId?:JsonValue;bindings?:Record<string,JsonValue>[]};
    if(!value||!Array.isArray(value.bindings))failure('INVALID_DATA_TRANSFER','Data transfer requires binding data.');
    const metadata={viewId:value.viewId??null,bindings:value.bindings.map(binding=>{
      const {payload,resources,...rest}=binding;
      const cache=payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'cache')?{payloadCache:payload.cache}:{};
      return {...rest,...cache};
    })};
    const body={bindings:value.bindings.map(binding=>{
      const payload=binding.payload;
      if(payload&&typeof payload==='object'&&!Array.isArray(payload)){const {cache,...content}=payload;return {bindingId:binding.bindingId,payload:content,resources:binding.resources??[]};}
      return {bindingId:binding.bindingId,payload:payload??null,resources:binding.resources??[]};
    })};
    const bytes=Buffer.from(JSON.stringify(body),'utf8');
    if(bytes.length>DATA_TRANSFER_MAX_BYTES)failure('DATA_TRANSFER_TOO_LARGE','Snapshot exceeds the 32 MiB data capacity. Select fewer fields.');
    if(Buffer.byteLength(JSON.stringify(metadata),'utf8')>128000)failure('DATA_TRANSFER_METADATA_TOO_LARGE','Binding metadata exceeds the control message capacity.');
    const revision=createHash('sha256').update(bytes).digest('hex');
    const header={kind:'dsh.data-transfer.v1',revision,metadata};
    if(knownRevision===revision)return {...header,unchanged:true} as JsonValue;
    if(bytes.length+Buffer.byteLength(JSON.stringify(header),'utf8')<220000)return {...header,body} as JsonValue;
    while(this.entries.size>=64||this.retainedBytes+bytes.length>MAX_RETAINED_BYTES){
      const first=this.entries.entries().next().value;if(!first)break;this.entries.delete(first[0]);this.retainedBytes-=first[1].bytes.length;
    }
    const id=randomUUID();this.entries.set(id,{owner,guard,bytes,revision,expiresAt:Date.now()+TTL_MS});this.retainedBytes+=bytes.length;
    return {...header,transfer:{id,bytes:bytes.length,chunks:Math.ceil(bytes.length/CHUNK_BYTES)}} as JsonValue;
  }
  read(owner:string,id:string,index:number,guard=''):JsonValue {
    this.prune();const entry=this.entries.get(id);
    if(!entry||entry.owner!==owner||entry.guard!==guard)failure('DATA_TRANSFER_EXPIRED','Data transfer is unavailable for this iframe. Read the snapshot again.');
    if(!Number.isSafeInteger(index)||index<0||index>=Math.ceil(entry.bytes.length/CHUNK_BYTES))failure('INVALID_DATA_CHUNK','Chunk index is outside this snapshot.');
    return {id,index,revision:entry.revision,chunk:entry.bytes.subarray(index*CHUNK_BYTES,(index+1)*CHUNK_BYTES).toString('base64')};
  }
}
