import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import {ComponentHost} from '../../component-runtime/src/host.ts';
import type {SourceComponentStore} from './index.ts';
import {validateDataSelection} from '../../app-presentation/src/selection.ts';
import type {AppsViewData} from '../../app-presentation/src/types.ts';
import type {SelectionEnvelope} from '../../app-contracts/src/index.ts';
import {DataTransfers} from '../../app-presentation/src/data-transfers.ts';

const record=(value:unknown):Record<string,JsonValue>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,JsonValue>:{};
function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
function validatePage(value:JsonValue):{bindingId:string;cursor?:string|null} {
  const params=record(value);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(params).some(key=>!['bindingId','cursor','documentNonce'].includes(key))||typeof params.bindingId!=='string'||!params.bindingId||params.cursor!==undefined&&params.cursor!==null&&typeof params.cursor!=='string')fail('INVALID_INPUT','Binding pages require a binding ID and an optional string cursor.');
  return {bindingId:params.bindingId as string,...(params.cursor!==undefined?{cursor:params.cursor as string|null}:{})};
}
function validateRefresh(value:JsonValue|undefined):JsonValue {
  if(value===undefined||value===null)return null;
  const params=record(value);
  if(typeof value!=='object'||Array.isArray(value)||Object.keys(params).some(key=>!['bindingIds','forceRefresh'].includes(key))||params.forceRefresh!==undefined&&typeof params.forceRefresh!=='boolean'||params.bindingIds!==undefined&&(!Array.isArray(params.bindingIds)||params.bindingIds.some(id=>typeof id!=='string'||!id)))fail('INVALID_INPUT','Refresh accepts binding IDs and a boolean forceRefresh.');
  return value;
}

/** Serves only immutable dist bytes, using the production v2 dispatcher. Legacy v1 preview is unchanged. */
export async function startAuthoringPreview(options:{sources:SourceComponentStore;buildId:string;mode:'fixture'|'live_readonly';data:JsonValue;context?:JsonValue;port?:number;readOnlyCapability?:(input:JsonValue)=>Promise<JsonValue>;refreshData?:(input:JsonValue)=>Promise<JsonValue>;validateSelection?:(input:JsonValue)=>Promise<JsonValue>;readBindingPage?:(input:JsonValue)=>Promise<JsonValue>;closeData?:()=>Promise<unknown>;resetData?:()=>Promise<JsonValue>}) {
  if(!options.sources.verify(options.buildId).valid)throw new Error('PREVIEW_BUILD_INVALID');
  const identity={protocolVersion:'2.0' as const,sessionId:'authoring-preview',viewId:randomUUID(),buildId:options.buildId,frameInstanceId:randomUUID()};
  const hasBindings=Array.isArray(record(options.data).bindings),transfers=new DataTransfers();
  const events:{method:string;at:string;durationMs:number;result?:JsonValue;error?:string}[]=[],pendingCalls=new Set<string>(),features=['renderReadyV1','uiStateV1',...(options.readBindingPage?['bindingPagesV1']:[]),...(hasBindings?['dataTransferV1']:[])];
  let ready=false,documentNonce:string|undefined;
  let data=options.data;
  const transferOwner=()=>JSON.stringify([identity.protocolVersion,identity.sessionId,identity.viewId,identity.buildId,identity.frameInstanceId,documentNonce]);
  const currentDocument=(nonce:string|undefined)=>{if(!nonce||nonce!==documentNonce)fail('BRIDGE_IDENTITY_STALE','Preview request belongs to a different document.');};
  const refresh=async(input:JsonValue)=>{const nonce=documentNonce;if(!options.refreshData)fail('PREVIEW_CAPABILITY_UNAVAILABLE','Fixture refresh is not configured; refresh has not been verified.');const next=await options.refreshData(validateRefresh(input));currentDocument(nonce);data=next;return data;};
  const readPage=async(input:JsonValue,transfer=false)=>{const nonce=documentNonce;if(!options.readBindingPage)fail('PREVIEW_CAPABILITY_UNAVAILABLE','Binding page reads are not configured.');const params=validatePage(input),next=await options.readBindingPage({...params,...(transfer?{dataTransfer:true}:{})});currentDocument(nonce);data=next;return data;};
  const host=new ComponentHost(identity,{
    getData:()=>data,getContext:()=>options.context??{preview:true,mode:options.mode,buildId:options.buildId},
    refresh:request=>refresh(request.params),resize:()=>null,
    attachSelection:async request=>{if(options.validateSelection)return options.validateSelection(request.params);validateDataSelection(data as unknown as AppsViewData,request.params as unknown as SelectionEnvelope);return {status:'validated',preview:true};},
    ...(options.readOnlyCapability?{invokeCapability:(request)=>options.readOnlyCapability!(request.params)}:{}),
  },{extensionHandlers:{...(hasBindings?{dataTransferV1:async(request:import('../../component-runtime/src/host.ts').ComponentExtensionRequest)=>{
    const params=record(request.params),nonce=documentNonce;currentDocument(typeof params.documentNonce==='string'?params.documentNonce:undefined);
    const allowed=request.action==='read'?['id','index','documentNonce']:params.method==='getData'?['method','knownRevision','documentNonce']:params.method==='refresh'?['method','options','knownRevision','documentNonce']:params.method==='readBindingPage'?['method','bindingId','cursor','knownRevision','documentNonce']:[];
    if(Object.keys(params).some(key=>!allowed.includes(key))||params.knownRevision!==undefined&&(typeof params.knownRevision!=='string'||!/^[a-f0-9]{64}$/.test(params.knownRevision)))fail('INVALID_INPUT','Invalid data transfer parameters.');
    const owner=transferOwner();
    if(request.action==='read'){if(typeof params.id!=='string'||typeof params.index!=='number')fail('INVALID_INPUT','Chunk reads require an ID and index.');return transfers.read(owner,params.id,params.index);}
    if(request.action!=='prepare')fail('INVALID_INPUT','Unknown data transfer action.');
    const value=params.method==='getData'?data:params.method==='refresh'?await refresh(validateRefresh(params.options)):params.method==='readBindingPage'?await readPage({bindingId:params.bindingId??null,...(params.cursor!==undefined?{cursor:params.cursor}:{})},true):fail('INVALID_INPUT','Only snapshot reads and refreshes use data transfers.');
    currentDocument(nonce);return transfers.prepare(owner,value,params.knownRevision as string|undefined);
  }}:{}),...(options.readBindingPage?{bindingPagesV1:async(request:import('../../component-runtime/src/host.ts').ComponentExtensionRequest)=>{if(request.action!=='read')fail('INVALID_INPUT','Unknown page action');return readPage(request.params);}}:{}),renderReadyV1:request=>{
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
        const message=JSON.parse(bytes);
        if(message?.type==='hello'){
          if(message.channel!=='dsh.apps.component.v2'||message.protocolVersion!=='2.0'||typeof message.requestId!=='string'||typeof message.documentNonce!=='string'||!message.documentNonce||message.documentNonce.length>160||Object.keys(message).some(key=>!['channel','type','protocolVersion','requestId','documentNonce','clientFeatures','sessionId','viewId','buildId','frameInstanceId'].includes(key))||message.clientFeatures!==undefined&&(!Array.isArray(message.clientFeatures)||message.clientFeatures.some((feature:unknown)=>typeof feature!=='string'))||['sessionId','viewId','buildId','frameInstanceId'].some(key=>message[key]!==undefined&&message[key]!==identity[key as keyof typeof identity]))fail('INVALID_BRIDGE_MESSAGE','Invalid preview hello envelope.');
          if(message.documentNonce!==documentNonce){const oldOwner=transferOwner(),hadDocument=!!documentNonce;documentNonce=message.documentNonce;ready=false;transfers.clearOwner(oldOwner);data=options.data;if(hadDocument&&options.resetData){const next=await options.resetData();currentDocument(message.documentNonce);data=next;}}
        }
        const started=performance.now(),callId=randomUUID();pendingCalls.add(callId);let response;try{response=await host.handle(message);}finally{pendingCalls.delete(callId);}const result=response&&'result' in response?response.result as {status?:string;error?:{code?:string}}:undefined;const callError=!response?'INVALID_BRIDGE_MESSAGE':response&&'error' in response?response.error?.code:result?.status&& !['ok','partial','validated'].includes(result.status)?result.error?.code??'CAPABILITY_FAILED':undefined;
        const method=message.feature==='dataTransferV1'?message.action==='prepare'?record(message.params).method??'dataTransferPrepare':'dataTransferChunk':message.feature==='bindingPagesV1'?'readBindingPage':message.method??message.type;
        events.push({method:String(method),at:new Date().toISOString(),durationMs:Math.round(performance.now()-started),...(callError?{error:callError}:{})});
        res.writeHead(response?200:400,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(response??{error:'INVALID_BRIDGE_MESSAGE'}));return;
      }
      if(req.method!=='GET')throw new Error('PREVIEW_READ_ONLY');
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(url.pathname==='/status'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({identity,events,ready,features,mode:options.mode}));return;}
      if(url.pathname==='/'){
        const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe title="组件预览" src="/dist/index.html"></iframe><script>
const frame=document.querySelector('iframe');window.__APPS_PREVIEW={identity:${JSON.stringify(identity)},bridgeReady:false,dataRead:false,inflight:0,events:[]};
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='dsh.apps.component.v2')return;
 window.__APPS_PREVIEW.inflight++;
 try{const response=await fetch('/bridge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event.data)});const reply=await response.json();
 if(reply.type==='hello')window.__APPS_PREVIEW.bridgeReady=true;const readMethod=event.data.feature==='dataTransferV1'&&event.data.action==='prepare'?event.data.params?.method:event.data.method;
 if(readMethod==='getData'&&reply.result!==undefined&&!reply.error)window.__APPS_PREVIEW.dataRead=true;
 window.__APPS_PREVIEW.events.push({request:event.data,response:reply});frame.contentWindow.postMessage(reply,location.origin);
 }catch(error){window.__APPS_PREVIEW.events.push({error:String(error)});}finally{window.__APPS_PREVIEW.inflight--;}
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
  return {url:`http://127.0.0.1:${port}`,identity,events,get pendingCalls(){return pendingCalls.size;},close:async()=>{transfers.clearOwner(transferOwner());await options.closeData?.();host.dispose();server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));}};
}
