import {request} from 'node:http';

/** Long local JSON calls use their explicit signal, without fetch's separate five-minute header timeout. */
export function loopbackHttpFetch(url:URL,input:{method:string;headers:Record<string,string>;body?:string;signal:AbortSignal}):Promise<Response> {
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('LOOPBACK_RUNTIME_REQUIRED');
  return new Promise((resolve,reject)=>{
    const call=request(url,{method:input.method,headers:input.headers,signal:input.signal},response=>{
      const status=response.statusCode??500;
      if(status>=300&&status<400){response.resume();reject(new Error('RUNTIME_REDIRECT_DISALLOWED'));return;}
      const chunks:Buffer[]=[];
      response.on('data',(chunk:Buffer)=>chunks.push(chunk));
      response.once('error',reject);
      response.once('end',()=>{
        const headers=new Headers();for(const [name,value]of Object.entries(response.headers))if(value!==undefined)for(const item of Array.isArray(value)?value:[value])headers.append(name,item);
        resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers}));
      });
    });
    call.once('error',reject);call.end(input.body);
  });
}
