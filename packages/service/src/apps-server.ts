import {validateDataSelection} from '../../app-presentation/src/selection.ts';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { body as readBody, send, sameToken, loopback } from './http.ts';
import { TOOL_DEFINITIONS, validate } from '../../contracts/src/index.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { BridgeIdentity, CapabilityResult, InvocationRequest, InvocationSource, JsonValue, SessionAppBinding } from '../../app-contracts/src/index.ts';
import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { AppsRuntime, AppConnection, InvocationRecord, RuntimeOperation } from '../../app-runtime/src/index.ts';
import { projectModelResult, readResultPage } from '../../app-runtime/src/projection.ts';
import type { AppsComponent, AppsPresentationService, AppsView } from '../../app-presentation/src/index.ts';
import type { Operation } from '../../core/src/types.ts';
import { createLegacyPresentationAdapter, normalizeLegacyPresentationInput, projectLegacyPresentationResult, projectLegacySpec } from './apps-legacy-presentation.ts';
import {NativeAppBindings} from './native-bindings.ts';
import type {CandidateFrameIdentity} from '../../app-presentation/src/authoring-types.ts';
import type {AppsSnapshotScheduler} from './apps-scheduler.ts';
import {workbenchRoutes} from './workbench-routes.ts';

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
export function createAppsServer(options:{runtime:AppsRuntime;presentation:AppsPresentationService;token:string;port?:number;allowedOrigins?:string[];health?:()=>Promise<unknown>;scheduler?:AppsSnapshotScheduler}) {
  const {runtime,presentation}=options;if(options.token.length<32)throw new Error('SERVICE_KEY_TOO_SHORT');
  const workbench=workbenchRoutes(runtime,presentation);
  const body=async(req:Parameters<typeof readBody>[0])=>{const input=await readBody(req);runtime.assertAdmission();return input;};
  const nativeBindings=new NativeAppBindings(runtime);
  const frameKey=(value:{sessionId:string;viewId:string;frameInstanceId:string})=>canonicalJson(['apps','presentation','frame_grants',value.sessionId,value.viewId,value.frameInstanceId]);
  type Grant={identity:BridgeIdentity;documentNonce:string;features:string[];candidate?:CandidateFrameIdentity;retired?:boolean};
  const assertDisplayBindings=(sessionId:string,view:AppsView)=>{
    for(const route of [{appId:'apps',connectionId:'presentation'},...view.bindings])if('status' in runtime.resolveConnection(route.appId,sessionId,route.connectionId))throw Object.assign(new Error('Display connection is not enabled in this session.'),{code:'CONNECTION_NOT_BOUND'});
  };
  const validateClientFeatures=(params:Record<string,unknown>)=>{if(params.clientFeatures!==undefined&&(!Array.isArray(params.clientFeatures)||params.clientFeatures.some(feature=>typeof feature!=='string')))throw Object.assign(new Error('INVALID_CLIENT_FEATURES'),{code:'INVALID_CLIENT_FEATURES'});};
  const usesDisplay=(sessionId:string,viewId:string)=>runtime.store.list<{namespace:string;value:{ownerSessionId?:string;viewId?:string}}>('provider_records').some(row=>row.namespace==='component_displays'&&row.value.ownerSessionId===sessionId&&row.value.viewId===viewId);
  const frameGrant=(identity:BridgeIdentity)=>{
    const grant=runtime.store.get<{value:Grant}>('provider_records',frameKey(identity))?.value;
    if(!grant||grant.retired||canonicalJson(grant.identity)!==canonicalJson(identity))throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
    if(grant.candidate?.displayId){if(!presentation.authoring?.acceptsDisplayFrame(grant.candidate))throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});assertDisplayBindings(identity.sessionId,presentation.authoring.display(identity.sessionId,{...grant.candidate,displayId:grant.candidate.displayId,displayGeneration:grant.candidate.displayGeneration!}).view);}return grant;
  };
  const grantFrame=(sessionId:string,params:Record<string,unknown>,candidate?:CandidateFrameIdentity)=>{
    const identity:BridgeIdentity={protocolVersion:'2.0',sessionId,viewId:String(params.viewId),buildId:String(params.buildId),frameInstanceId:String(params.frameInstanceId)},view=presentation.ownedView(sessionId,identity.viewId);
    if(!identity.frameInstanceId||!params.documentNonce||view.source?.buildId!==identity.buildId&&!presentation.authoring?.acceptsFrame(candidate!))throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
    validateClientFeatures(params);
    const prior=runtime.store.get<{value:Grant}>('provider_records',frameKey(identity))?.value;
    if(prior&&(prior.retired||canonicalJson(prior.identity)!==canonicalJson(identity)||prior.documentNonce!==params.documentNonce))throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
    const features=(params.clientFeatures as string[]??[]).filter(feature=>['renderReadyV1','uiStateV1','bindingPagesV1'].includes(feature)),grant:Grant={identity,documentNonce:String(params.documentNonce),features,...(candidate?{candidate}:{})};
    runtime.store.put('provider_records',frameKey(identity),{appId:'apps',connectionId:'presentation',namespace:'frame_grants',recordId:frameKey(identity),value:grant});return {features};
  };
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
      const sessionComponents=runtime.store.viewsForSession<AppsView>(sessionId).filter(view=>view.panelState!=='closed').map(view=>{
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
      // Freeze ordinary entry points while retaining inspection of an existing operation.
      const operationInspection=path.match(/^\/v1\/operations\/[^/]+(\/inspect)?$/);
      if(!(operationInspection&&(req.method==='GET'&&!operationInspection[1]||req.method==='POST'&&operationInspection[1]==='/inspect')))runtime.assertAdmission();
      if(path.startsWith('/ui/')||/^\/sessions\/[^/]+\/views/.test(path)){
        const input=req.method==='POST'?await body(req):{};
        const result=await legacyPresentation.handle(path,req.method??'GET',input,url.searchParams.get('sessionId')??undefined);if(result!==undefined)return send(res,200,result);
      }
      const legacyTool=path.match(/^\/tools\/(hallmark_[a-z_]+)$/);
      if(req.method==='POST'&&legacyTool){const input=await body(req);strict(input,['arguments','sessionId','userRequest'],['arguments','sessionId']);return send(res,200,await legacyInvoke({name:legacyTool[1],...input,invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+90000).toISOString()},controller.signal));}
      if(req.method==='GET'&&path==='/v1/runtime')return send(res,200,runtime.identity());
      if(req.method==='GET'&&path==='/v1/apps')return send(res,200,{apps:runtime.listApps()});
      if(req.method==='GET'&&path==='/v1/workbench')return send(res,200,await workbench.read(url.searchParams.get('resource')??'workbench',url.searchParams.get('appId')));
      if(req.method==='POST'&&path==='/v1/workbench')return send(res,200,await workbench.write(await body(req),controller.signal));
      if(req.method==='GET'&&path==='/v1/authoring/features')return send(res,200,{features:presentation.authoring?['renderReadyV1','uiStateV1','bindingPagesV1']:[]});
      if(req.method==='GET'&&path==='/v1/views'){const sessionId=url.searchParams.get('sessionId');if(!sessionId)throw new Error('EXPLICIT_SESSION_REQUIRED');return send(res,200,{views:runtime.store.viewsForSession<AppsView>(sessionId)});}
      if(req.method==='GET'&&path==='/v1/component-history')return send(res,200,{revisions:runtime.store.componentSummaries(url.searchParams.get('componentId')??'')});
      if(req.method==='GET'&&path==='/v1/saved')return send(res,200,{components:runtime.store.componentSummaries(),assets:runtime.store.list<{kind:string}>('saved_assets').filter(asset=>['entry','template'].includes(asset.kind))});
      if(req.method==='GET'&&path==='/v1/component-thumbnail'){
        const componentId=url.searchParams.get('componentId')??'',revisionText=url.searchParams.get('revision')??'';
        if([...url.searchParams.keys()].some(key=>!['componentId','revision'].includes(key))||!/^[-a-zA-Z0-9_.:]{1,180}$/.test(componentId)||! /^[1-9][0-9]{0,9}$/.test(revisionText))throw Object.assign(new Error('INVALID_COMPONENT_THUMBNAIL'),{statusCode:400});
        const latest=runtime.store.get<AppsComponent>('components',componentId),revision=Number(revisionText),component=latest&&(runtime.store.get<AppsComponent>('component_versions',`${componentId}:${revision}`)??(latest.revision===revision?latest:undefined)),source=component?.view.source;
        // Only saved versions may disclose their exact preview. No source checkout, browser, or business query is started.
        const bytes=source?.preview&&source.thumbnail&&/^[a-f0-9]{64}$/.test(source.buildId)?presentation.sources?.thumbnail(source.buildId):undefined;
        if(!bytes)return send(res,404,{error:'COMPONENT_PREVIEW_NOT_FOUND'});
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return;
      }
      if(req.method==='POST'&&path==='/v1/presentation-actions'){
        const input=await body(req);strict(input,['sessionId','capabilityId','input','requestId'],['sessionId','capabilityId','input','requestId']);
        const sessionId=String(input.sessionId),capabilityId=String(input.capabilityId),descriptor=runtime.describe(capabilityId);
        if(!sessionId||!String(input.requestId)||!/^apps\.(presentation|authoring)\./.test(capabilityId)||!descriptor)throw new Error('PRESENTATION_ACTION_UNAVAILABLE');
        runtime.bind({sessionId,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
        return send(res,200,await runtime.invoke({protocolVersion:'1.0',invocationId:String(input.requestId),traceId:String(input.requestId),appId:'apps',connectionId:'presentation',capabilityId,capabilityVersion:descriptor.version,input:input.input as JsonValue,source:{kind:'agent',sessionId,nativeCallId:String(input.requestId)},deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString(),...(descriptor.effect==='mutation'?{idempotencyKey:String(input.requestId)}:{})},controller.signal));
      }
      const authoringAction=path.match(/^\/v1\/authoring\/([a-zA-Z]+)$/);
      if(req.method==='POST'&&authoringAction){
        const input=await body(req);strict(input,['sessionId','params'],['sessionId','params']);const sessionId=String(input.sessionId),params=input.params as Record<string,unknown>,authoring=presentation.authoring;if(!authoring)throw new Error('AUTHORING_UNAVAILABLE');
        switch(authoringAction[1]){
          case 'preview':{
            const view=presentation.ownedView(sessionId,String(params.viewId));
            const scope=canonicalJson(['preview',sessionId,view.viewId,params.scopeId??'legacy']);
            if(params.action==='close'){presentation.clearBindingPages(scope);return send(res,200,{closed:true});}
            if(params.action==='page')return send(res,200,await presentation.readBindingPage(view,scope,params as never,{kind:'agent',sessionId,nativeCallId:randomUUID()},()=>presentation.ownedView(sessionId,view.viewId),controller.signal));
            if(params.action==='data')return send(res,200,presentation.scopedData(view,scope));
            if(params.action==='refresh'){if(params.forceRefresh!==undefined&&typeof params.forceRefresh!=='boolean')throw new Error('INVALID_FORCE_REFRESH');presentation.clearBindingPages(scope);return send(res,200,await presentation.refreshView(sessionId,view.viewId,{kind:'agent',sessionId,nativeCallId:randomUUID()},params.bindingIds as string[]|undefined,controller.signal,{forceRefresh:params.forceRefresh!==false}));}
            if(params.action==='selection'){validateDataSelection(presentation.scopedData(view,scope),params.selection as never);return send(res,200,{status:'validated',preview:true});}
            if(params.action!=='invoke')throw new Error('PREVIEW_ACTION_UNAVAILABLE');
            const call=params.input as Pick<InvocationRequest,'appId'|'connectionId'|'capabilityId'|'capabilityVersion'|'input'>,descriptor=runtime.describe(call.capabilityId,call.capabilityVersion);
            if(!descriptor||!['query','compute'].includes(descriptor.effect)||/^apps\.(presentation|authoring)\./.test(call.capabilityId))throw new Error('PREVIEW_CAPABILITY_NOT_READ_ONLY');
            if(!view.bindings.some(binding=>binding.appId===call.appId&&binding.connectionId===call.connectionId))throw new Error('CONNECTION_NOT_BOUND');
            return send(res,200,await runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:call.appId,connectionId:call.connectionId,capabilityId:call.capabilityId,capabilityVersion:call.capabilityVersion,input:call.input,source:{kind:'agent',sessionId,nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString()},controller.signal));
          }
          case 'openDisplay':{
            strict(params,['viewId','publicationId','attemptId','attemptEpoch','buildId','expectedViewRevision','displayId'],['viewId','publicationId','attemptId','attemptEpoch','buildId','expectedViewRevision','displayId']);
            return send(res,200,runtime.store.transaction(()=>{presentation.ownedView(sessionId,String(params.viewId));const state=authoring.inspect(sessionId,{publicationId:String(params.publicationId)});const publication=state.publication;if(!publication||publication.viewId!==params.viewId)throw Object.assign(new Error('PUBLICATION_TARGET_MISMATCH'),{code:'PUBLICATION_TARGET_MISMATCH'});const existingSnapshot=publication.state==='mounted'?runtime.store.get<{value:AppsView}>('provider_records','view-revision:'+canonicalJson([sessionId,publication.viewId,publication.committedViewRevision]))?.value:state.view;if(!existingSnapshot)throw Object.assign(new Error('PUBLICATION_UNAVAILABLE'),{code:'PUBLICATION_UNAVAILABLE'});assertDisplayBindings(sessionId,existingSnapshot);const opened=authoring.openDisplay(sessionId,params as never);return {...opened,data:presentation.getData(sessionId,opened.display.viewId,{publicationId:opened.display.publicationId,buildId:opened.display.buildId,displayId:opened.display.displayId,displayGeneration:opened.display.generation})};}));
          }
          case 'authorizeDisplayFrame':{
            strict(params,['publicationId','attemptId','attemptEpoch','viewId','buildId','displayId','displayGeneration','frameInstanceId','documentNonce','clientFeatures'],['publicationId','attemptId','attemptEpoch','viewId','buildId','displayId','displayGeneration','frameInstanceId','documentNonce']);validateClientFeatures(params);
            return send(res,200,runtime.store.transaction(()=>{const display=authoring.display(sessionId,params as never);assertDisplayBindings(sessionId,display.view);const authorized=authoring.authorizeDisplayFrame(sessionId,params as never),candidate={...params,protocolVersion:'2.0',sessionId} as unknown as CandidateFrameIdentity;return {display:authorized,...grantFrame(sessionId,params,candidate)};}));
          }
          case 'reportDisplayError':strict(params,['viewId','publicationId','buildId','displayId','displayGeneration','error'],['viewId','publicationId','buildId','displayId','displayGeneration','error']);return send(res,200,authoring.reportDisplayError(sessionId,params as never));
          case 'startMount':strict(params,['viewId','publicationId','attemptId','attemptEpoch','buildId','expectedViewRevision'],['viewId','publicationId','attemptId','attemptEpoch','buildId','expectedViewRevision']);return send(res,200,authoring.startMount(sessionId,params as never));
          case 'markBuilding':strict(params,['attemptId','epoch'],['attemptId','epoch']);return send(res,200,authoring.markBuilding(sessionId,params as never));
          case 'authorizeFrame':{
            strict(params,['publicationId','attemptId','attemptEpoch','viewId','buildId','frameInstanceId','documentNonce','clientFeatures'],['publicationId','attemptId','attemptEpoch','viewId','buildId','frameInstanceId','documentNonce']);
            validateClientFeatures(params);return send(res,200,runtime.store.transaction(()=>{presentation.ownedView(sessionId,String(params.viewId));const original=authoring.inspect(sessionId,{publicationId:String(params.publicationId)}).publication;if(original?.viewId!==params.viewId)throw Object.assign(new Error('VIEW_NOT_OWNED'),{code:'VIEW_NOT_OWNED'});const publication=authoring.authorizeFrame(sessionId,params as never),candidate={...params,protocolVersion:'2.0',sessionId} as unknown as CandidateFrameIdentity;return {...publication,...grantFrame(sessionId,params,candidate)};}));
          }
          case 'negotiateFrame':strict(params,['viewId','buildId','frameInstanceId','documentNonce','clientFeatures'],['viewId','buildId','frameInstanceId','documentNonce','clientFeatures']);return send(res,200,grantFrame(sessionId,params));
          case 'retireFrame':{
            strict(params,['viewId','buildId','frameInstanceId','documentNonce'],['viewId','buildId','frameInstanceId','documentNonce']);presentation.ownedView(sessionId,String(params.viewId));
            const identity:BridgeIdentity={protocolVersion:'2.0',sessionId,viewId:String(params.viewId),buildId:String(params.buildId),frameInstanceId:String(params.frameInstanceId)},grant=frameGrant(identity);if(grant.documentNonce!==params.documentNonce)throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});runtime.store.transaction(()=>{
              presentation.clearBindingPages(canonicalJson(identity));
              runtime.store.put('provider_records',frameKey(identity),{appId:'apps',connectionId:'presentation',namespace:'frame_grants',recordId:frameKey(identity),value:{...grant,retired:true}});
              // A closed document must not pin its display: the same display may grant exactly one new iframe document afterwards.
              if(grant.candidate?.displayId)authoring.releaseDisplayFrame(sessionId,{displayId:grant.candidate.displayId,frameInstanceId:identity.frameInstanceId,documentNonce:grant.documentNonce});
            });
            return send(res,200,{retired:true});
          }
          case 'inspect':return send(res,200,authoring.inspect(sessionId,params as never));
          case 'failMount':strict(params,['publicationId','reason'],['publicationId','reason']);return send(res,200,authoring.failMount(sessionId,String(params.publicationId),String(params.reason)));
          case 'exportUiState':if(usesDisplay(sessionId,String(params.viewId)))throw Object.assign(new Error('Display UI state requires the current authorized iframe extension.'),{code:'BRIDGE_IDENTITY_STALE'});return send(res,200,authoring.exportUiState(sessionId,params as never));
          case 'restoreUiState':if(usesDisplay(sessionId,String(params.viewId)))throw Object.assign(new Error('Display UI state requires the current authorized iframe extension.'),{code:'BRIDGE_IDENTITY_STALE'});return send(res,200,authoring.restoreUiState(sessionId,params as never));
          case 'closeDraft':strict(params,['viewId','action'],['viewId','action']);return send(res,200,authoring.closeView(sessionId,String(params.viewId),params.action as 'keep'|'discard'));
          case 'restoreView':strict(params,['viewId'],['viewId']);return send(res,200,authoring.restoreView(sessionId,String(params.viewId)));
          default:throw new Error('AUTHORING_ACTION_UNKNOWN');
        }
      }
      if(path==='/v1/schedules'){
        if(!options.scheduler)throw new Error('SCHEDULER_UNAVAILABLE');
        if(req.method==='GET')return send(res,200,options.scheduler.status());
        if(req.method==='POST')return send(res,200,options.scheduler.create(await body(req) as never));
        if(req.method==='PATCH'){const input=await body(req),{scheduleId,...patch}=input;return send(res,200,options.scheduler.update(String(scheduleId),patch as never));}
      }
      if(req.method==='POST'&&path==='/v1/native-bindings'){
        const input=await body(req);strict(input,['sessionId','appId','connectionId','bindRequestId','epoch','enabled','referenceId'],['sessionId','appId','bindRequestId','epoch','enabled','referenceId']);
        return send(res,200,nativeBindings.bind(input as never));
      }
      if(req.method==='GET'&&path==='/v1/native-bindings')return send(res,200,nativeBindings.get(url.searchParams.get('sessionId')??'',url.searchParams.get('bindRequestId')??'',url.searchParams.get('referenceId')??undefined));
      if(req.method==='POST'&&path==='/v1/native-references/serialize'){
        const input=await body(req);strict(input,['referenceId','sessionId'],['referenceId','sessionId']);return send(res,200,nativeBindings.serialize(input as never));
      }
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
      if(req.method==='POST'&&path==='/v1/component-extension'){
        const input=await body(req);strict(input,['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','type','feature','action','params'],['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','type','feature','action','params']);
        const identity:BridgeIdentity={protocolVersion:input.protocolVersion as '2.0',sessionId:String(input.sessionId),viewId:String(input.viewId),buildId:String(input.buildId),frameInstanceId:String(input.frameInstanceId)},grant=frameGrant(identity);
        if(input.type!=='extension'||!grant.features.includes(String(input.feature)))throw new Error('UNSUPPORTED_HOST_CAPABILITY');
        const params=input.params as Record<string,unknown>;if((grant.candidate?.displayId||params.documentNonce!==undefined)&&params.documentNonce!==grant.documentNonce)throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
        const host=presentation.createHost(identity,{signal:controller.signal,candidate:grant.candidate,clientFeatures:grant.features});try{return send(res,200,await host.handle(input));}finally{host.dispose();}
      }
      if(req.method==='POST'&&path==='/v1/component-bridge'){
        const input=await body(req);strict(input,['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','method','params'],['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','method','params']);
        const view=presentation.ownedView(String(input.sessionId),String(input.viewId));
        const identity:BridgeIdentity={protocolVersion:input.protocolVersion as '2.0',sessionId:String(input.sessionId),viewId:String(input.viewId),buildId:String(input.buildId),frameInstanceId:String(input.frameInstanceId)};
        const storedGrant=runtime.store.get<{value:Grant}>('provider_records',frameKey(identity))?.value;
        const grant=storedGrant?.candidate?.displayId?frameGrant(identity):storedGrant;
        if(grant?.retired)throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
        if((!view.source||view.source.buildId!==input.buildId)&&(!grant?.candidate||!presentation.authoring?.acceptsFrame(grant.candidate)))throw Object.assign(new Error('BRIDGE_IDENTITY_STALE'),{code:'BRIDGE_IDENTITY_STALE'});
        const host=presentation.createHost(identity,{signal:controller.signal,candidate:grant?.candidate,clientFeatures:grant?.features,attachSelection:async(_identity,selection)=>({status:'validated',selection:JSON.parse(canonicalJson(selection)) as JsonValue})});
        try{const response=await host.handle(input);return send(res,response?200:400,response??{error:{code:'INVALID_BRIDGE_MESSAGE',retryPolicy:'never'}});}finally{host.dispose();}
      }
      const invocation=path.match(/^\/v1\/invocations\/([^/]+)$/);if(req.method==='GET'&&invocation){const record=runtime.store.get<InvocationRecord>('invocations',decodeURIComponent(invocation[1]));return send(res,record?200:404,record??{error:'INVOCATION_NOT_FOUND'});}
      const operation=path.match(/^\/v1\/operations\/([^/]+)(\/inspect)?$/);if(operation){const id=decodeURIComponent(operation[1]);if(req.method==='POST'&&operation[2]){const input=await readBody(req);strict(input,[]);return send(res,200,await runtime.inspect(id,controller.signal));}if(req.method==='GET'&&!operation[2]){const record=runtime.store.get<RuntimeOperation>('operations',id);return send(res,record?200:404,record?{...record,events:runtime.store.list<{operationId:string}>('operation_events').filter(row=>row.operationId===id)}:{error:'OPERATION_NOT_FOUND'});}}
      if(path==='/v1/session-bindings'){if(req.method==='GET')return send(res,200,{bindings:runtime.sessionBindings(url.searchParams.get('sessionId')??'')});if(req.method==='POST'){const input=await body(req);strict(input,['sessionId','appId','connectionId','enabled','boundAt'],['sessionId','appId','connectionId','enabled','boundAt']);return send(res,200,runtime.bind(input as unknown as SessionAppBinding));}}
      if(path==='/v1/connections'){if(req.method==='GET')return send(res,200,{connections:runtime.listConnections(url.searchParams.get('appId')??undefined)});if(req.method==='POST'){const input=await body(req);strict(input,['appId','connectionId','displayName','config','configRevision','enabled'],['appId','connectionId','displayName','config','configRevision','enabled']);return send(res,200,runtime.addConnection(input as unknown as AppConnection));}if(req.method==='PATCH'){const input=await body(req);strict(input,['appId','connectionId','displayName','config','expectedConfigRevision','enabled','drainTimeoutMs'],['appId','connectionId','expectedConfigRevision']);return send(res,200,await runtime.updateConnection(input as never,controller.signal));}}
      if(req.method==='POST'&&path==='/v1/views/open'){const input=await body(req);strict(input,['sessionId','title','directory','design','bindings','viewId','componentId','revision','context','newCopy'],['sessionId']);const sessionId=String(input.sessionId);const view=input.componentId?presentation.openComponent(sessionId,String(input.componentId),{revision:input.revision as number|undefined,directory:input.directory as string|undefined,context:input.context as AppsView['context'],newCopy:input.newCopy as boolean|undefined}):input.directory?presentation.openSource(sessionId,String(input.directory),input as never):presentation.createView(sessionId,input as never);return send(res,200,view);}
      const viewRoute=path.match(/^\/v1\/views\/([^/]+)(\/data|\/refresh)?$/);if(viewRoute){const viewId=decodeURIComponent(viewRoute[1]);if(req.method==='GET'){
        const sessionId=url.searchParams.get('sessionId')??'',current=presentation.ownedView(sessionId,viewId);
        if(viewRoute[2]){
          const displayId=url.searchParams.get('displayId');if(displayId){const displayGeneration=Number(url.searchParams.get('displayGeneration')),publicationId=url.searchParams.get('publicationId')??'',buildId=url.searchParams.get('buildId')??'',display=presentation.authoring?.display(sessionId,{viewId,displayId,displayGeneration,publicationId,buildId});if(!display)throw new Error('AUTHORING_UNAVAILABLE');assertDisplayBindings(sessionId,display.view);return send(res,200,presentation.getData(sessionId,viewId,{displayId,displayGeneration,publicationId,buildId}));}
          return send(res,200,presentation.getData(sessionId,viewId));
        }
        const buildId=url.searchParams.get('buildId'),revision=url.searchParams.has('viewRevision')?Number(url.searchParams.get('viewRevision')):undefined,publicationId=url.searchParams.get('publicationId');
        if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('VIEW_REVISION_INVALID');
        if(publicationId){
          const publication=runtime.store.get<import('../../app-presentation/src/authoring-types.ts').ViewPublication>('view_publications',publicationId);
          if(!publication||publication.ownerSessionId!==sessionId||publication.viewId!==viewId||buildId&&publication.candidateBuildId!==buildId)throw Object.assign(new Error('Publication target does not belong to this message and session.'),{code:'PUBLICATION_TARGET_MISMATCH'});
          if((publication.state==='prepared'||publication.state==='mounting')&&current.pendingPublicationId===publication.publicationId&&current.viewRevision===publication.expectedViewRevision&&(!revision||revision===publication.expectedViewRevision))return send(res,200,{...current,...(publication.state==='mounting'?{source:publication.source}:{}),publication});
          if(['failed_mount','interrupted'].includes(publication.state)&&current.viewRevision===publication.expectedViewRevision&&(!current.pendingPublicationId||current.pendingPublicationId===publication.publicationId)&&(!revision||revision===publication.expectedViewRevision))return send(res,200,{...current,publication});
          if(publication.state==='mounted'&&publication.committedViewRevision&&(!revision||revision===publication.committedViewRevision)){
            const record=runtime.store.get<{namespace:string;value:AppsView}>('provider_records','view-revision:'+canonicalJson([sessionId,viewId,publication.committedViewRevision]));
            const snapshot=record?.namespace==='view_revisions'&&record.value.ownerSessionId===sessionId&&record.value.viewId===viewId&&record.value.viewRevision===publication.committedViewRevision&&record.value.source?.buildId===publication.candidateBuildId?record.value:undefined;
            if(snapshot)return send(res,200,{...snapshot,publication});
          }
          throw Object.assign(new Error('The fixed publication is no longer mountable; inspect its terminal result.'),{code:'PUBLICATION_UNAVAILABLE'});
        }
        if(buildId||revision!==undefined){
          const record=revision===undefined?undefined:runtime.store.get<{namespace:string;value:AppsView}>('provider_records','view-revision:'+canonicalJson([sessionId,viewId,revision]));
          const records=revision===undefined?runtime.store.list<{namespace:string;value:AppsView}>('provider_records'):record?[record]:[];
          const historical=records.filter(row=>row.namespace==='view_revisions').map(row=>row.value).find(view=>view.ownerSessionId===sessionId&&view.viewId===viewId&&(revision===undefined||view.viewRevision===revision)&&(!buildId||view.source?.buildId===buildId));
          if(historical)return send(res,200,historical);
          if((!buildId||current.source?.buildId===buildId)&&(revision===undefined||current.viewRevision===revision))return send(res,200,current);
          throw Object.assign(new Error('The message names an unavailable historical view; current source is not substituted.'),{code:'VIEW_REVISION_NOT_FOUND'});
        }
        return send(res,200,current);
      }if(req.method==='POST'&&viewRoute[2]==='/refresh'){const input=await body(req);strict(input,['sessionId','bindingIds','forceRefresh'],['sessionId']);if(input.forceRefresh!==undefined&&typeof input.forceRefresh!=='boolean')throw new Error('INVALID_FORCE_REFRESH');return send(res,200,await presentation.refreshView(String(input.sessionId),viewId,source(String(input.sessionId)),input.bindingIds as string[]|undefined,controller.signal,{forceRefresh:input.forceRefresh!==false}));}}
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
