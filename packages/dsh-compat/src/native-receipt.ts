import {createHash} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';

export interface DurableNativeReceipt {
  accepted:true;durable:true;requestId:string;sessionId:string;
  eventType:'agent/inbox/spliced'|'user/message';eventSeq:number;contentHash:string;
}
/** Exact public SessionEvent envelope and UserMessage paths verified in installed 0.2.0-rc.2. */
export function nativeInputReceipt(events:readonly unknown[],sessionId:string,requestId:string,content:string|readonly {type:'text';text:string}[]):DurableNativeReceipt|undefined {
  const expectedHash=createHash('sha256').update(canonicalJson(typeof content==='string'?[{type:'text',text:content}]:content)).digest('hex');
  for(const raw of [...events].reverse()) {
    if(!raw||typeof raw!=='object')continue;
    const event=raw as {type?:unknown;seq?:unknown;data?:unknown};
    if(!Number.isSafeInteger(event.seq)||Number(event.seq)<0||!event.data||typeof event.data!=='object')continue;
    const data=event.data as {inserted?:unknown;target?:unknown};
    const messages=event.type==='user/message'?[event.data]:event.type==='agent/inbox/spliced'&&['next-turn','next-step'].includes(String(data.target))&&Array.isArray(data.inserted)?data.inserted:[];
    for(const rawMessage of messages) {
      if(!rawMessage||typeof rawMessage!=='object')continue;
      const message=rawMessage as {source?:{kind?:unknown;rpcId?:unknown};content?:unknown};
      if(message.source?.kind!=='user'||message.source.rpcId!==requestId)continue;
      const contentHash=createHash('sha256').update(canonicalJson(message.content)).digest('hex');
      if(contentHash!==expectedHash)throw new Error('NATIVE_REQUEST_CONTENT_CONFLICT');
      return {accepted:true,durable:true,sessionId,requestId,eventType:event.type as DurableNativeReceipt['eventType'],eventSeq:Number(event.seq),contentHash};
    }
  }
}
