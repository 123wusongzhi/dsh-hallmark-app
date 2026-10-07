import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import {ComponentHost} from '../../component-runtime/src/host.ts';
import type {SourceComponentStore} from './index.ts';

/** Serves only immutable dist bytes, using the production v2 dispatcher. Legacy v1 preview is unchanged. */
export async function startAuthoringPreview(options:{sources:SourceComponentStore;buildId:string;mode:'fixture'|'live_readonly';data:JsonValue;context?:JsonValue;port?:number;readOnlyCapability?:(input:JsonValue)=>Promise<JsonValue>}) {
  if(!options.sources.verify(options.buildId).valid)throw new Error('PREVIEW_BUILD_INVALID');
  const identity={protocolVersion:'2.0' as const,sessionId:'authoring-preview',viewId:randomUUID(),buildId:options.buildId,frameInstanceId:randomUUID()};
  const events:{method:string;at:string;result?:JsonValue;error?:string}[]=[],features=['renderReadyV1','uiStateV1'];
  let ready=false;
  const host=new ComponentHost(identity,{
    getData:()=>options.data,getContext:()=>options.context??{preview:true,mode:options.mode,buildId:options.buildId},
    refresh:()=>options.data,resize:()=>null,
    attachSelection:()=>({status:'validated',preview:true}),
    ...(options.readOnlyCapability?{invokeCapability:(request)=>options.readOnlyCapability!(request.params)}:{}),
  },{extensionHandlers:{renderReadyV1:request=>{
    const params=request.params as {checks?:{rendered?:boolean;bridgeReady?:boolean;dataRead?:boolean;unhandledErrors?:string[]}};
    if(request.action!=='ready'||!params?.checks?.rendered||!params.checks.bridgeReady||!params.checks.dataRead||!Array.isArray(params.checks.unhandledErrors)||params.checks.unhandledErrors.length)throw Object.assign(new Error('Preview is not render-ready'),{code:'FRAME_NOT_READY'});
    ready=true;return {preview:true,renderReady:true};
  },uiStateV1:()=>({available:false,reason:'Preview does not persist live UI state'})}});
  const server=createServer(async(req,res)=>{
    try{
      const address=server.address(),port=typeof address==='object'&&address?address.port:0;
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')||req.headers.host!==`127.0.0.1:${port}`)throw new Error('PREVIEW_LOCAL_ONLY');
      const url=new URL(req.url??'/',`http://127.0.0.1:${port}`);
      if(req.method==='POST'&&url.pathname==='/bridge'){
        if(req.headers.origin!==`http://127.0.0.1:${port}`)throw new Error('PREVIEW_ORIGIN_INVALID');
        let bytes='';for await(const chunk of req){bytes+=chunk;if(Buffer.byteLength(bytes)>262144)throw new Error('BRIDGE_MESSAGE_TOO_LARGE');}
        const message=JSON.parse(bytes),response=await host.handle(message);events.push({method:message.method??message.type,at:new Date().toISOString(),...(response&&'error' in response&&response.error?{error:response.error.code}:{})});
        res.writeHead(response?200:400,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(response??{error:'INVALID_BRIDGE_MESSAGE'}));return;
      }
      if(req.method!=='GET')throw new Error('PREVIEW_READ_ONLY');
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(url.pathname==='/status'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({identity,events,ready,features,mode:options.mode}));return;}
      if(url.pathname==='/'){
        const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe title="组件预览" src="/dist/index.html"></iframe><script>
const frame=document.querySelector('iframe');window.__APPS_PREVIEW={identity:${JSON.stringify(identity)},bridgeReady:false,dataRead:false,events:[]};
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='dsh.apps.component.v2')return;
 try{const response=await fetch('/bridge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event.data)});const reply=await response.json();
 if(reply.type==='hello')window.__APPS_PREVIEW.bridgeReady=true;if(event.data.method==='getData'&&reply.result!==undefined)window.__APPS_PREVIEW.dataRead=true;
 window.__APPS_PREVIEW.events.push({request:event.data,response:reply});frame.contentWindow.postMessage(reply,location.origin);
 }catch(error){window.__APPS_PREVIEW.events.push({error:String(error)});}
});</script></body></html>`;
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
      }
      if(!url.pathname.startsWith('/dist/')){res.writeHead(404);res.end();return;}
      const asset=options.sources.readFile(options.buildId,decodeURIComponent(url.pathname.slice(6)));if(!asset){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'content-type':asset.mime,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(asset.bytes);
    }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}));}
  });
  await new Promise<void>((accept,reject)=>{server.once('error',reject);server.listen(options.port??0,'127.0.0.1',accept);});
  const port=(server.address() as {port:number}).port;
  return {url:`http://127.0.0.1:${port}`,identity,events,close:async()=>{host.dispose();server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));}};
}
