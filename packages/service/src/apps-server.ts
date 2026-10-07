import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { body, send, sameToken, loopback } from './http.ts';
import { TOOL_DEFINITIONS, validate } from '../../contracts/src/index.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { BridgeIdentity, CapabilityResult, InvocationRequest, InvocationSource, JsonValue, SessionAppBinding } from '../../app-contracts/src/index.ts';
import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { AppsRuntime, AppConnection, InvocationRecord, RuntimeOperation } from '../../app-runtime/src/index.ts';
import { projectModelResult, readResultPage } from '../../app-runtime/src/projection.ts';
import type { AppsPresentationService, AppsView } from '../../app-presentation/src/index.ts';
import type { Operation } from '../../core/src/types.ts';
import { createLegacyPresentationAdapter, normalizeLegacyPresentationInput, projectLegacyPresentationResult, projectLegacySpec } from './apps-legacy-presentation.ts';

function strict(value:Record<string,unknown>,keys:readonly string[],required:readonly string[]=[]):void {
  const invalid=Object.keys(value).filter(key=>!keys.includes(key));const missing=required.filter(key=>!Object.hasOwn(value,key));
  if(invalid.length||missing.length)throw Object.assign(new Error(`INVALID_INPUT: unknown=${invalid.join(',')} missing=${missing.join(',')}`),{statusCode:400});
}
function source(sessionId:string):InvocationSource {return {kind:'agent',sessionId,nativeCallId:randomUUID()};}
function legacySource(sessionId:string):InvocationSource {return {kind:'agent',sessionId,nativeCallId:`legacy:${randomUUID()}`};}
function legacyResult(result:CapabilityResult):ToolResult {
  if(result.status==='needs_clarification')return {status:'needs_clarification',clarification:{missing:result.missing,candidates:result.candidates,question:result.question}};
  return {status:result.status==='cancelled'?'failed':result.status,...('data' in result?{data:result.data}:{}),...(result.operation?{operation:{operationId:result.operation.operationId,state:result.operation.state==='dispatching'?'running':result.operation.state==='queued'?'pending':result.operation.state==='cancelled'?'failed':result.operation.state}}:{}),...('error' in result?{error:{code:result.error.code,message:result.error.message,retryable:result.error.retryPolicy==='read_retry'}}:{}),...(result.provenance?.[0]?{provenance:{source:result.provenance[0].sourceKind==='derived'?'hallmark_compute':'app_snapshot',fetchedAt:result.provenance[0].fetchedAt,...(result.provenance[0].sourceDataTime?{dataTime:result.provenance[0].sourceDataTime}:{}),endpoint:result.provenance[0].sourceRef}}:{})};
}
export function createAppsServer(options:{runtime:AppsRuntime;presentation:AppsPresentationService;token:string;port?:number;allowedOrigins?:string[];health?:()=>Promise<unknown>}) {
  const {runtime,presentation}=options;if(options.token.length<32)throw new Error('SERVICE_KEY_TOO_SHORT');
  const legacyPresentation=createLegacyPresentationAdapter(presentation,runtime);
  const legacyConnection=():string|undefined=>runtime.store.get<{appId:string;connectionId:string;status?:string}>('legacy_aliases','connection:default')?.connectionId;
  const bindings=(sessionId:string,active:boolean)=>{
    const connectionId=legacyConnection();if(!connectionId||!runtime.getConnection('hallmark',connectionId))throw Object.assign(new Error('LEGACY_CONNECTION_NEEDS_MIGRATION'),{statusCode:409});
    runtime.bind({sessionId,appId:'hallmark',connectionId,enabled:active,boundAt:new Date().toISOString()});
    if(runtime.getConnection('apps','presentation'))runtime.bind({sessionId,appId:'apps',connectionId:'presentation',enabled:active,boundAt:new Date().toISOString()});
    return {sessionId,appId:'hallmark',active,connectionId};
  };
  const legacyInvoke=async(input:Record<string,unknown>,signal:AbortSignal):Promise<ToolResult>=>{
    strict(input,['name','arguments','sessionId','invocationId','traceId','deadlineAt','userRequest'],['name','arguments','sessionId','invocationId','traceId','deadlineAt']);
    const name=String(input.name),sessionId=String(input.sessionId),definition=TOOL_DEFINITIONS.find(tool=>tool.name===name);
    if(!definition)return {status:'failed',error:{code:'TOOL_NOT_FOUND',message:'Unknown legacy tool.',retryable:false}};
    const args=input.arguments as Record<string,unknown>,errors=validate(definition.parameters,args);
    if(input.userRequest&&args.userRequest&&input.userRequest!==args.userRequest)return {status:'failed',error:{code:'USER_REQUEST_MISMATCH',message:'Write/save instruction differs from the invocation context.',retryable:false}};
    const missing=(definition.parameters.required??[]).filter(key=>!Object.hasOwn(args,key));
    if(missing.length){if(definition.kind==='save'&&missing.includes('userRequest'))return {status:'failed',error:{code:'SAVE_NOT_REQUESTED',message:'保存须记录本轮明确保存原话。',retryable:false}};return {status:'needs_clarification',clarification:{missing,question:'Please supply required inputs.'}};}
    if(errors.length)return {status:'failed',error:{code:'INVALID_PARAMS',message:errors.join('; '),retryable:false}};
    if(definition.kind==='save'&&(typeof args.userRequest!=='string'||!args.userRequest.trim()))return {status:'failed',error:{code:'SAVE_NOT_REQUESTED',message:'仅本轮明确保存要求允许持久保存。',retryable:false}};
    if(name==='hallmark_save_component'&&args.mode==='update'&&(!args.componentId||args.expectedRevision===undefined))return {status:'needs_clarification',clarification:{missing:[...(!args.componentId?['componentId']:[]),...(args.expectedRevision===undefined?['expectedRevision']:[])],question:'请明确要更新的组件及预期修订。'}};
    if(definition.kind==='write'&&!args.clientOperationKey)return {status:'needs_clarification',clarification:{missing:['clientOperationKey'],question:'请明确原写入幂等键；不会生成替代键发起业务写入。'}};
    const descriptor=runtime.describe(name);if(!descriptor)return {status:'unavailable',error:{code:'CAPABILITY_NOT_FOUND',message:'Legacy alias is not registered.',retryable:false}};
    const appId=descriptor.capabilityId.split('.')[0],route=runtime.resolveConnection(appId,sessionId,appId==='apps'?'presentation':legacyConnection());
    if('status' in route)return legacyResult({...route,invocationId:String(input.invocationId),traceId:String(input.traceId)});
    if(definition.kind==='write'){
      const existing=runtime.store.list<RuntimeOperation>('operations').find(operation=>operation.appId===appId&&operation.connectionId===route.connectionId&&operation.capabilityId===descriptor.capabilityId&&operation.idempotencyKey===args.clientOperationKey);
      if(existing&&(!('sessionId' in existing.request.source)||existing.request.source.sessionId!==sessionId))return {status:'failed',error:{code:'OPERATION_NOT_FOUND',message:'幂等键属于其他会话。',retryable:false}};
    }
    let normalized:Record<string,unknown>={...args};
    if(appId==='apps'){
      try{normalized=normalizeLegacyPresentationInput(name,args,sessionId,runtime);}
      catch(error){return {status:'failed',error:{code:(error as {code?:string}).code??'CORE_ERROR',message:error instanceof Error?error.message:String(error),retryable:false}};}
    }
    else if(definition.kind==='write'&&typeof input.userRequest==='string'&&!args.userRequest)normalized.userRequest=input.userRequest;
    const request:InvocationRequest={protocolVersion:'1.0',...route,invocationId:String(input.invocationId),traceId:String(input.traceId),capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:JSON.parse(canonicalJson(normalized)) as JsonValue,source:legacySource(sessionId),deadlineAt:String(input.deadlineAt),...(descriptor.effect==='mutation'?{idempotencyKey:String(args.clientOperationKey??`legacy:${input.invocationId}`)}:{})};
    const result=await runtime.invoke(request,signal);
    if(appId==='apps')return projectLegacyPresentationResult(name,result,runtime);
    let projected=legacyResult(result);
    const originalRequest=result.operation?runtime.store.get<RuntimeOperation>('operations',result.operation.operationId)?.request:undefined;
    const metadataId=originalRequest?.capabilityId===descriptor.capabilityId&&'sessionId' in originalRequest.source&&originalRequest.source.sessionId===sessionId?originalRequest.invocationId:String(input.invocationId);
    const metadata=runtime.store.get<{appId:string;connectionId:string;namespace:string;recordId:string;value:{sessionId:string;invocationId:string;capabilityId:string;provenance?:ToolResult['provenance'];metricBasis?:string;error?:ToolResult['error']}}>('provider_records',canonicalJson(['hallmark',route.connectionId,'legacy_result_metadata',metadataId]));
    if(metadata?.appId==='hallmark'&&metadata.connectionId===route.connectionId&&metadata.namespace==='legacy_result_metadata'&&metadata.recordId===metadataId&&metadata.value.sessionId===sessionId&&metadata.value.invocationId===metadataId&&metadata.value.capabilityId===descriptor.capabilityId){
      const {provenance:_genericProvenance,...withoutProvenance}=projected;
      projected={...withoutProvenance,...(metadata.value.provenance?{provenance:metadata.value.provenance}:{}),...(metadata.value.metricBasis?{metricBasis:metadata.value.metricBasis}:{}),...(metadata.value.error?{error:metadata.value.error}:{})};
    }
    if(name==='hallmark_app_info'&&result.status==='ok'&&result.data&&typeof result.data==='object'&&!Array.isArray(result.data)){
      const sessionComponents=runtime.store.list<AppsView>('views').filter(view=>view.ownerSessionId===sessionId).map(view=>{
        const spec=projectLegacySpec(view);
        return {viewId:spec.id,title:spec.title,kind:spec.kind??'view-spec',...(spec.kind==='source'&&spec.source?{source:{directory:spec.source.directory,buildId:spec.source.buildId}}:{})};
      });
      return {...projected,data:{...result.data,sessionComponents}};
    }
    // Restore an old receipt only from the same connection/session/operation's domain evidence.
    // Reading this evidence never invokes the Provider or creates another operation.
    if(result.status==='unknown'&&result.operation&&(definition.kind==='write'||name==='hallmark_get_operation')){
      const id=result.operation.operationId;
      const record=runtime.store.get<{appId:string;connectionId:string;namespace:string;recordId:string;value:Operation}>('provider_records',canonicalJson(['hallmark',route.connectionId,'operations',id]));
      if(record?.appId==='hallmark'&&record.connectionId===route.connectionId&&record.namespace==='operations'&&record.recordId===id&&record.value.operationId===id&&record.value.sessionId===sessionId&&record.value.state==='unknown')return {...projected,data:record.value};
    }
    return projected;
  };
  const server=createServer(async(req,res)=>{
    const controller=new AbortController();req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort();});
    try {
      if(!loopback(req.socket.remoteAddress))return send(res,403,{error:'LOCAL_ONLY'});
      const address=server.address(),port=address&&typeof address==='object'?address.port:options.port;
      if(!new Set([`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`]).has((req.headers.host??'').toLowerCase()))return send(res,403,{error:'INVALID_HOST'});
      if(req.headers.origin&&!(options.allowedOrigins??[]).includes(req.headers.origin))return send(res,403,{error:'INVALID_ORIGIN'});
      if(!sameToken(options.token,(req.headers.authorization??'').replace(/^Bearer /,'')))return send(res,401,{error:'UNAUTHORIZED'});
      if(req.url?.match(/%2f|\.\./i))return send(res,400,{error:'INVALID_PATH'});
      const url=new URL(req.url??'/',`http://127.0.0.1:${port}`),path=url.pathname;
      if(path.startsWith('/ui/')||/^\/sessions\/[^/]+\/views/.test(path)){
        const input=req.method==='POST'?await body(req):{};
        const result=await legacyPresentation.handle(path,req.method??'GET',input,url.searchParams.get('sessionId')??undefined);if(result!==undefined)return send(res,200,result);
      }
      const legacyTool=path.match(/^\/tools\/(hallmark_[a-z_]+)$/);
      if(req.method==='POST'&&legacyTool){const input=await body(req);strict(input,['arguments','sessionId','userRequest'],['arguments','sessionId']);return send(res,200,await legacyInvoke({name:legacyTool[1],...input,invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+90000).toISOString()},controller.signal));}
      if(req.method==='GET'&&path==='/v1/runtime')return send(res,200,runtime.identity());
      if(req.method==='GET'&&path==='/v1/apps')return send(res,200,{apps:runtime.listApps()});
      if(req.method==='GET'&&path==='/v1/diagnostics'){
        const sessionId=url.searchParams.get('sessionId');if(!sessionId||[...url.searchParams.keys()].some(key=>key!=='sessionId'))throw new Error('EXPLICIT_SESSION_REQUIRED');
        const invocations=runtime.store.list<InvocationRecord>('invocations').filter(row=>'sessionId' in row.request.source&&row.request.source.sessionId===sessionId).slice(-25).reverse().map(row=>({invocationId:row.invocationId,traceId:row.request.traceId,operationId:row.operationId??null,runId:row.parentRunId??null,appId:row.request.appId,connectionId:row.request.connectionId,capabilityId:row.request.capabilityId,capabilityVersion:row.request.capabilityVersion,status:row.result?.status??row.state,durationMs:row.durationMs??null}));return send(res,200,{invocations});
      }
      if(req.method==='GET'&&path==='/v1/capabilities')return send(res,200,runtime.discover({appId:url.searchParams.get('appId')??undefined,query:url.searchParams.get('query')??undefined,cursor:url.searchParams.get('cursor')??undefined,limit:url.searchParams.has('limit')?Number(url.searchParams.get('limit')):undefined}));
      if(req.method==='GET'&&path==='/v1/component-contexts'){
        const sessionId=url.searchParams.get('sessionId');if(!sessionId||[...url.searchParams.keys()].some(key=>key!=='sessionId'))throw new Error('EXPLICIT_SESSION_REQUIRED');
        return send(res,200,presentation.contexts.active(sessionId));
      }
      const contextSnapshot=path.match(/^\/v1\/component-contexts\/([-a-zA-Z0-9_.:]+)$/);
      if(req.method==='GET'&&contextSnapshot){
        const sessionId=url.searchParams.get('sessionId');if(!sessionId||[...url.searchParams.keys()].some(key=>key!=='sessionId'))throw new Error('EXPLICIT_SESSION_REQUIRED');
        const record=presentation.contexts.history(sessionId,contextSnapshot[1]);return send(res,record?200:404,record??{error:'CONTEXT_NOT_FOUND'});
      }
      const agentRequest=path.match(/^\/v1\/agent-requests\/([-a-zA-Z0-9_.:]+)(\/(dispatch|receipt))?$/);
      if(agentRequest){
        const requestId=agentRequest[1];
        if(req.method==='GET'&&!agentRequest[2]){
          const sessionId=url.searchParams.get('sessionId');if(!sessionId||[...url.searchParams.keys()].some(key=>key!=='sessionId'))throw new Error('EXPLICIT_SESSION_REQUIRED');
          const intent=presentation.contexts.intent(sessionId,requestId);return send(res,intent?200:404,intent??{error:'AGENT_REQUEST_NOT_FOUND'});
        }
        if(req.method==='POST'&&agentRequest[3]==='dispatch'){
          const input=await body(req);strict(input,['sessionId','requestHash'],['sessionId','requestHash']);
          return send(res,200,presentation.contexts.dispatch(String(input.sessionId),requestId,String(input.requestHash)));
        }
        if(req.method==='POST'&&agentRequest[3]==='receipt'){
          const input=await body(req);strict(input,['sessionId','requestHash','state','receipt','error'],['sessionId','requestHash','state']);
          return send(res,200,presentation.contexts.receipt(String(input.sessionId),requestId,String(input.requestHash),input.state as never,input.receipt as JsonValue|undefined,input.error as JsonValue|undefined));
        }
      }
      const description=path.match(/^\/v1\/capabilities\/([^/]+)$/);if(req.method==='GET'&&description){const descriptor=runtime.describe(decodeURIComponent(description[1]),url.searchParams.get('version')??undefined);return send(res,descriptor?200:404,descriptor??{error:'CAPABILITY_NOT_FOUND'});}
      if(req.method==='POST'&&path==='/v1/invocations'){const input=await body(req),result=await runtime.invoke(input as unknown as InvocationRequest,controller.signal);return send(res,input.protocolVersion!=='1.0'?409:result.status==='pending'?202:200,result);}
      if(req.method==='POST'&&path==='/v1/component-bridge'){
        const input=await body(req);strict(input,['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','method','params'],['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','method','params']);
        const view=presentation.ownedView(String(input.sessionId),String(input.viewId));
        if(!view.source||view.source.buildId!==input.buildId)throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
        const identity:BridgeIdentity={protocolVersion:input.protocolVersion as '2.0',sessionId:String(input.sessionId),viewId:String(input.viewId),buildId:String(input.buildId),frameInstanceId:String(input.frameInstanceId)};
        const host=presentation.createHost(identity,{signal:controller.signal,attachSelection:async(_identity,selection)=>({status:'validated',selection:JSON.parse(canonicalJson(selection)) as JsonValue})});
        try{const response=await host.handle(input);return send(res,response?200:400,response??{error:{code:'INVALID_BRIDGE_MESSAGE',retryPolicy:'never'}});}finally{host.dispose();}
      }
      const invocation=path.match(/^\/v1\/invocations\/([^/]+)$/);if(req.method==='GET'&&invocation){const record=runtime.store.get<InvocationRecord>('invocations',decodeURIComponent(invocation[1]));return send(res,record?200:404,record??{error:'INVOCATION_NOT_FOUND'});}
      const operation=path.match(/^\/v1\/operations\/([^/]+)(\/inspect)?$/);if(operation){const id=decodeURIComponent(operation[1]);if(req.method==='POST'&&operation[2]){const input=await body(req);strict(input,[]);return send(res,200,await runtime.inspect(id,controller.signal));}if(req.method==='GET'&&!operation[2]){const record=runtime.store.get<RuntimeOperation>('operations',id);return send(res,record?200:404,record?{...record,events:runtime.store.list<{operationId:string}>('operation_events').filter(row=>row.operationId===id)}:{error:'OPERATION_NOT_FOUND'});}}
      if(path==='/v1/session-bindings'){if(req.method==='GET')return send(res,200,{bindings:runtime.sessionBindings(url.searchParams.get('sessionId')??'')});if(req.method==='POST'){const input=await body(req);strict(input,['sessionId','appId','connectionId','enabled','boundAt'],['sessionId','appId','connectionId','enabled','boundAt']);return send(res,200,runtime.bind(input as unknown as SessionAppBinding));}}
      if(path==='/v1/connections'){if(req.method==='GET')return send(res,200,{connections:runtime.listConnections(url.searchParams.get('appId')??undefined)});if(req.method==='POST'){const input=await body(req);strict(input,['appId','connectionId','displayName','config','configRevision','enabled'],['appId','connectionId','displayName','config','configRevision','enabled']);return send(res,200,runtime.addConnection(input as unknown as AppConnection));}}
      if(req.method==='POST'&&path==='/v1/views/open'){const input=await body(req);strict(input,['sessionId','title','directory','design','bindings','viewId','componentId','revision'],['sessionId']);const sessionId=String(input.sessionId);const view=input.componentId?presentation.openComponent(sessionId,String(input.componentId),{revision:input.revision as number|undefined,directory:input.directory as string|undefined}):input.directory?presentation.openSource(sessionId,String(input.directory),input as never):presentation.createView(sessionId,input as never);return send(res,200,view);}
      const viewRoute=path.match(/^\/v1\/views\/([^/]+)(\/data|\/refresh)?$/);if(viewRoute){const viewId=decodeURIComponent(viewRoute[1]);if(req.method==='GET'){const sessionId=url.searchParams.get('sessionId')??'';return send(res,200,viewRoute[2]?presentation.getData(sessionId,viewId):presentation.ownedView(sessionId,viewId));}if(req.method==='POST'&&viewRoute[2]==='/refresh'){const input=await body(req);strict(input,['sessionId','bindingIds'],['sessionId']);return send(res,200,await presentation.refreshView(String(input.sessionId),viewId,source(String(input.sessionId)),input.bindingIds as string[]|undefined,controller.signal));}}
      if(path==='/v1/components'){if(req.method==='GET')return send(res,200,{components:runtime.store.list('components')});if(req.method==='POST'){const input=await body(req);strict(input,['sessionId','viewId','userRequest','mode','componentId','expectedRevision'],['sessionId','viewId','userRequest','mode']);return send(res,200,presentation.saveComponent(String(input.sessionId),String(input.viewId),String(input.userRequest),input as never));}}
      const resultRoute=path.match(/^\/v1\/results\/(.+)$/);if(req.method==='GET'&&resultRoute)return send(res,200,readResultPage(runtime.store,decodeURIComponent(resultRoute[1]),url.searchParams.get('cursor')??'0',Number(url.searchParams.get('limit')??100)));
      if(req.method==='POST'&&path==='/v1/model-result'){const input=await body(req);strict(input,['invocationId'],['invocationId']);const record=runtime.store.get<InvocationRecord>('invocations',String(input.invocationId));if(!record?.result)return send(res,404,{error:'INVOCATION_NOT_FOUND'});return send(res,200,projectModelResult(runtime.store,record.result));}
      if(req.method==='POST'&&path==='/v1/legacy-invocations')return send(res,200,await legacyInvoke(await body(req),controller.signal));
      if(req.method==='GET'&&path==='/health')return send(res,200,{status:'ok',service:'dsh-apps-runtime',version:runtime.runtimeVersion,...runtime.identity(),hallmark:options.health?await options.health():{status:'unavailable'}});
      if(req.method==='GET'&&path==='/tools')return send(res,200,{tools:TOOL_DEFINITIONS});
      const session=path.match(/^\/sessions\/([^/]+)\/app$/);if(session){const sessionId=decodeURIComponent(session[1]);if(req.method==='GET')return send(res,200,{sessionId,appId:'hallmark',active:runtime.sessionBindings(sessionId).some(row=>row.appId==='hallmark'&&row.enabled)});if(req.method==='POST'){const input=await body(req);strict(input,['active'],['active']);if(typeof input.active!=='boolean')throw new Error('INVALID_INPUT');return send(res,200,bindings(sessionId,input.active));}}
      const sourceRoute=path.match(/^\/source-builds\/([a-f0-9]{64})\/(manifest|thumbnail|files\/(.+))$/);if(req.method==='GET'&&sourceRoute&&presentation.sources){const sources=presentation.sources,id=sourceRoute[1];if(sourceRoute[2]==='manifest')return send(res,200,sources.manifest(id));const asset=sourceRoute[2]==='thumbnail'?{bytes:sources.thumbnail(id),contentType:'image/png'}:sources.readFile(id,decodeURIComponent(sourceRoute[3]));if(!asset?.bytes)return send(res,404,{error:'SOURCE_FILE_NOT_FOUND'});res.writeHead(200,{'Content-Type':('contentType' in asset?asset.contentType:asset.mime),'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.end(asset.bytes);return;}
      return send(res,404,{error:'ROUTE_NOT_FOUND'});
    }catch(error){if(!res.headersSent)send(res,(error as {statusCode?:number}).statusCode??400,{status:'failed',error:{code:(error as {code?:string}).code??'INVALID_REQUEST',message:error instanceof Error?error.message:String(error),retryPolicy:'never'}});else res.end();}
  });
  server.requestTimeout=90000;server.headersTimeout=10000;return server;
}
