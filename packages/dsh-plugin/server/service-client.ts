import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { PluginConfig } from './types.ts';
export class ServiceFailure extends Error {
  readonly code:string; readonly dispatched:boolean; readonly httpStatus?:number; readonly publicResult?:unknown;
  constructor(code:string,dispatched=false,httpStatus?:number,publicResult?:unknown){super(code);this.name='ServiceFailure';this.code=code;this.dispatched=dispatched;this.httpStatus=httpStatus;this.publicResult=publicResult;}
}
export function dataDirectory(config:PluginConfig):string {
  const path=config.dataDirectory??process.env.HALLMARK_APP_DATA_DIR??(process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'dsh-hallmark-app'):undefined);
  if(!path||!isAbsolute(path))throw new ServiceFailure('DATA_DIRECTORY_REQUIRED');
  return resolve(path);
}
export function validateServiceUrl(value:string):string {
  // URL normalizes short/integer IPv4 aliases; require literal spelling first.
  if(!/^http:\/\/(127\.0\.0\.1|\[::1\])(?::\d{1,5})?\/?$/i.test(value))throw new ServiceFailure('LOOPBACK_SERVICE_REQUIRED');
  const url=new URL(value);
  if(url.port&&Number(url.port)<1)throw new ServiceFailure('LOOPBACK_SERVICE_REQUIRED');
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new ServiceFailure('LOOPBACK_SERVICE_REQUIRED');
  return url.origin;
}
export class AppServiceClient {
  readonly base:string; readonly directory:string; readonly timeoutMs:number;
  constructor(config:PluginConfig={}) {
    this.base=validateServiceUrl(config.serviceUrl??'http://127.0.0.1:4180');this.directory=dataDirectory(config);
    this.timeoutMs=config.requestTimeoutMs??75_000;
    if(!Number.isInteger(this.timeoutMs)||this.timeoutMs<100||this.timeoutMs>90_000)throw new ServiceFailure('INVALID_TIMEOUT');
  }
  private token():string {
    let token:string;try{token=readFileSync(join(this.directory,'service-key'),'utf8').trim();}catch{throw new ServiceFailure('SERVICE_KEY_UNAVAILABLE');}
    if(!/^[a-f0-9]{64}$/.test(token))throw new ServiceFailure('SERVICE_KEY_INVALID');return token;
  }
  /** Preserve real build bytes (including fonts/images); the credential stays in the Host. */
  async asset(path:string,signal?:AbortSignal):Promise<Response> {
    if(!path.startsWith('/source-builds/'))throw new ServiceFailure('INVALID_SERVICE_PATH');
    const token=this.token();signal?.throwIfAborted();
    try {
      const response=await fetch(this.base+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([AbortSignal.timeout(this.timeoutMs),...(signal?[signal]:[])]),redirect:'error'});
      if(!response.ok){await response.body?.cancel();throw new ServiceFailure(`SERVICE_HTTP_${response.status}`,true,response.status);}
      return response;
    }catch(error){if(error instanceof ServiceFailure)throw error;signal?.throwIfAborted();throw new ServiceFailure('APP_SERVICE_UNAVAILABLE',true);}
  }
  async request(path:string,body?:unknown,signal?:AbortSignal,timeoutMs=this.timeoutMs):Promise<unknown> {
    if(!path.startsWith('/')||path.startsWith('//'))throw new ServiceFailure('INVALID_SERVICE_PATH');
    const token=this.token();signal?.throwIfAborted();let dispatched=false;
    try {
      const combined=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);
      dispatched=true;
      const response=await fetch(this.base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:combined,redirect:'error'});
      const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let bytes=0;
      if(reader)try {while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>16*1024*1024){await reader.cancel();throw new ServiceFailure('SERVICE_RESPONSE_TOO_LARGE',dispatched);}chunks.push(next.value);}}finally{reader.releaseLock();}
      let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ServiceFailure('INVALID_SERVICE_RESPONSE',dispatched);}
      if(!response.ok)throw new ServiceFailure(response.status===401?'SERVICE_UNAUTHORIZED':`SERVICE_HTTP_${response.status}`,dispatched,response.status,value);
      return value;
    }catch(error){if(error instanceof ServiceFailure)throw error;signal?.throwIfAborted();throw new ServiceFailure('APP_SERVICE_UNAVAILABLE',dispatched);}
  }
}
