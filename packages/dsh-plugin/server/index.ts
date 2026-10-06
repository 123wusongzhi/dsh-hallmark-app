import { TOOL_DEFINITIONS, APP_INSTRUCTIONS, failed, validate, type ToolDescriptor, type ToolResult } from '../../contracts/src/index.ts';
import { AppServiceClient, ServiceFailure } from './service-client.ts';
import { assertJsonCompatible } from '../../contracts/src/json.ts';
import { OUTPUT_SCHEMA, createRenderer, isToolResult, presentationMeta } from './render.ts';
import { launchService } from './launch.ts';
import { ClosureOutbox } from './close-outbox.ts';
import { HOST_PLUGIN_VERSION } from './version.ts';
import { DESIGN_CAPABILITIES, DESIGN_INSTRUCTIONS, designToolDescription } from './design-guidance.ts';
import { Config, snapshotPluginConfig } from './config.ts';
import { SourceAssetRoutes } from './source-assets.ts';
export { Config } from './config.ts';
import type { PluginConfig, PluginContext, AgentRef, SessionApp, Execution, PreDecision } from './types.ts';
export type { PluginConfig, PluginContext } from './types.ts';
export const name='dsh-plugin-hallmark';
export const inject=['tools','commands','systemPrompt','connection','agents','sessions','sessionQuery'];
export const UI_PATH='/api/hallmark-app';
const SESSION=/^[-a-zA-Z0-9_]{1,160}$/;
const ID=/^[-a-zA-Z0-9_.:]{1,180}$/;
const inactive=(sessionId:string):SessionApp=>({sessionId,appId:'hallmark',active:false});
function state(value:unknown,sessionId:string):SessionApp {
  const item=value as SessionApp;
  if(!item||item.sessionId!==sessionId||item.appId!=='hallmark'||typeof item.active!=='boolean'||(item.activatedAt!==undefined&&typeof item.activatedAt!=='string'))throw new ServiceFailure('INVALID_SESSION_STATE');
  return {sessionId,appId:'hallmark',active:item.active,...(item.activatedAt?{activatedAt:item.activatedAt}:{})};
}
function response(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function serviceError(error:unknown,write=false):ToolResult {
  if(error instanceof ServiceFailure&&error.code==='CLOSE_OUTBOX_UNAVAILABLE')return {status:'unavailable',error:{code:'CLOSE_OUTBOX_UNAVAILABLE',message:'关闭意图日志不可用，当前聊天调用已拒绝；请检查本机应用数据目录权限/日志后重试。',retryable:false}};
  if(write&&error instanceof ServiceFailure&&error.dispatched)return {status:'unknown',error:{code:'OUTCOME_UNKNOWN',message:'接入服务调用结果不确定；保留clientOperationKey，先查当前会话操作记录，不得自动再次写入。',retryable:false}};
  return {status:'unavailable',error:{code:'APP_SERVICE_UNAVAILABLE',message:'本机应用服务或会话状态不可用；请检查服务已启动及本机service-key配置。',retryable:true}};
}
async function readBody(request:Request):Promise<Record<string,unknown>> {
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))throw new Error('JSON_REQUIRED');
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader)try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('OBJECT_REQUIRED');return parsed;
}
/** Thin transport adapter; all domain/state persistence belongs to the service. */
export class HallmarkPlugin {
  readonly ctx:PluginContext; readonly config:PluginConfig; readonly client:AppServiceClient;
  readonly cache=new Map<string,SessionApp>();
  private readonly epochs=new Map<string,number>();
  private readonly closures:ClosureOutbox;
  private readonly queues=new Map<string,Promise<unknown>>();
  private readonly disposers:(()=>unknown)[]=[];
  private readonly lifetime=new AbortController();
  private closed=false;
  private readonly sourceAssets:SourceAssetRoutes;
  constructor(ctx:PluginContext,config:PluginConfig={}){this.ctx=ctx;this.config=config;this.client=new AppServiceClient(config);this.closures=new ClosureOutbox(this.client.directory);this.sourceAssets=new SourceAssetRoutes(ctx,this.client,this.lifetime.signal);this.own(()=>this.sourceAssets.dispose());}
  private own(dispose:()=>unknown):void{this.disposers.push(dispose);}
  private trusted(agent:AgentRef|undefined):string|undefined {
    return agent&&SESSION.test(agent.id)&&this.ctx.agents.get(agent.id)===agent?agent.id:undefined;
  }
  private async knownSession(id:string,signal:AbortSignal):Promise<boolean> {
    if(!SESSION.test(id))return false;
    if(this.ctx.agents.get(id)||this.ctx.sessions?.get(id))return true;
    if(this.ctx.sessionQuery)try{return (await this.ctx.sessionQuery.readTitleSnapshot(id,signal)).session.id===id;}catch{return false;}
    return false;
  }
  private serial<T>(id:string,operation:()=>Promise<T>):Promise<T> {
    const previous=this.queues.get(id)??Promise.resolve();
    const current=previous.catch(()=>{}).then(operation);this.queues.set(id,current);
    void current.finally(()=>{if(this.queues.get(id)===current)this.queues.delete(id);}).catch(()=>{});
    return current;
  }
  async restore(id:string,signal?:AbortSignal):Promise<SessionApp> {
    const epoch=this.epochs.get(id)??0;
    return this.serial(id,async()=>{
      try {
        this.closures.assertHealthy();
        if(this.closures.has(id)){
          const closed=state(await this.client.request(`/sessions/${encodeURIComponent(id)}/app`,{active:false},this.combined(signal),3000),id);
          if(closed.active)throw new ServiceFailure('SESSION_STATE_MISMATCH');
          if((this.epochs.get(id)??0)===epoch)this.closures.ack(id);
        }
        const value=state(await this.client.request(`/sessions/${encodeURIComponent(id)}/app`,undefined,this.combined(signal),3000),id);
        if(!this.closed&&(this.epochs.get(id)??0)===epoch)this.cache.set(id,value);
        return (this.epochs.get(id)??0)===epoch?value:inactive(id);
      }catch(error){if((this.epochs.get(id)??0)===epoch)this.cache.set(id,inactive(id));throw error;}
    });
  }
  private combined(signal?:AbortSignal):AbortSignal{return AbortSignal.any([this.lifetime.signal,...(signal?[signal]:[])]);}
  async setActive(id:string,active:boolean,signal?:AbortSignal):Promise<SessionApp> {
    if(!SESSION.test(id))throw new Error('INVALID_SESSION');
    const epoch=(this.epochs.get(id)??0)+1;this.epochs.set(id,epoch);
    // Closing/failed activation blocks new calls immediately, even before HTTP settles.
    this.cache.set(id,inactive(id));
    if(!active)this.closures.request(id);else this.closures.assertHealthy();
    return this.serial(id,async()=>{
      try {
        const next=state(await this.client.request(`/sessions/${encodeURIComponent(id)}/app`,{active},this.combined(signal),3000),id);
        if(next.active!==active)throw new ServiceFailure('SESSION_STATE_MISMATCH');
        if(!this.closed&&this.epochs.get(id)===epoch){this.closures.ack(id);this.cache.set(id,next);}return next;
      }catch(error){this.cache.set(id,inactive(id));throw error;}
    });
  }
  async invoke(descriptor:ToolDescriptor,args:unknown,sessionId:string,signal?:AbortSignal):Promise<ToolResult> {
    try {
      const current=await this.restore(sessionId,signal);
      if(!current.active)return failed('APP_NOT_ACTIVE','请先在当前会话选择 Hallmark 应用或输入 /hallmark。');
      const errors=validate(descriptor.parameters,args);if(errors.length)return failed('INVALID_INPUT',errors.join('; '));
      if(!this.cache.get(sessionId)?.active)return failed('APP_NOT_ACTIVE','应用已关闭。');
      const result=await this.client.request(`/tools/${descriptor.name}`,{arguments:args,sessionId},this.combined(signal));
      if(!isToolResult(result))throw new ServiceFailure('INVALID_TOOL_RESULT',true);
      await this.sourceAssets.prepare(result);
      // Runtime evidence, not installed-package inference; all original app-info fields remain intact.
      if(descriptor.name==='hallmark_app_info'&&result.data&&typeof result.data==='object'&&!Array.isArray(result.data))return {...result,data:{...result.data,hostPluginVersion:HOST_PLUGIN_VERSION,designCapabilities:DESIGN_CAPABILITIES}};
      return result;
    }catch(error){signal?.throwIfAborted();return serviceError(error,descriptor.kind==='write');}
  }
  private async gate(exec:Execution,next:()=>Promise<PreDecision>):Promise<PreDecision> {
    if(!exec.name.startsWith('hallmark_'))return next();
    const id=this.trusted(exec.agent);
    if(!id)return {kind:'deny',reason:'APP_NOT_ACTIVE:缺少可信会话身份',info:{name:'HallmarkAppGuard',code:'APP_NOT_ACTIVE'}};
    try{const current=await this.restore(id,exec.signal);if(current.active&&this.cache.get(id)?.active)return next();}catch{exec.signal.throwIfAborted();}
    return {kind:'deny',reason:'APP_NOT_ACTIVE:请在当前会话选择 Hallmark 应用或输入 /hallmark；服务故障时拒绝调用。',info:{name:'HallmarkAppGuard',code:'APP_NOT_ACTIVE'}};
  }
  async ui(request:Request):Promise<Response> {
    try {
      const url=new URL(request.url);let input:Record<string,unknown>;
      if(request.method==='GET')input=Object.fromEntries(url.searchParams);
      else if(request.method==='POST')input=await readBody(request);
      else return response(failed('METHOD_NOT_ALLOWED','GET/POST only'),405);
      const id=input.sessionId;
      if(request.method==='GET'){
        if(Object.keys(input).some(k=>!['sessionId','resource','viewId'].includes(k)))return response(failed('INVALID_INPUT','Unknown key'),400);
        if(input.resource==='state'){
          if(typeof id!=='string'||!await this.knownSession(id,request.signal))return response(failed('INVALID_SESSION','没有此本机会话；请先打开现有聊天。'),400);
          return response(await this.restore(id,request.signal));
        }
        if(['sessionViews','sessionView','sessionViewData'].includes(String(input.resource))) {
          if(typeof id!=='string'||!await this.knownSession(id,request.signal))return response(failed('INVALID_SESSION','没有此本机会话；不能猜测组件所属。'),400);
          const base=`/sessions/${encodeURIComponent(id)}/views`;
          if(input.resource==='sessionViews') {
            if(input.viewId!==undefined)return response(failed('INVALID_INPUT','Session list does not accept viewId'),400);
            return response(await this.client.request(base,undefined,this.combined(request.signal)));
          }
          if(typeof input.viewId!=='string'||!ID.test(input.viewId))return response(failed('INVALID_INPUT','Explicit viewId required'),400);
          const value=await this.client.request(`${base}/${encodeURIComponent(input.viewId)}${input.resource==='sessionViewData'?'/data':''}`,undefined,this.combined(request.signal));await this.sourceAssets.prepare(value);return response(value);
        }
        // Workbench is local display/configuration authority, independent of chat activation.
        if(input.resource==='health') {
          const health=await this.client.request('/health',undefined,this.combined(request.signal)) as {status?:unknown;hallmark?:{status?:unknown}};
          // Project statuses only; never expose upstream raw health, credentials, or internal config.
          return response({serviceStatus:health.status==='ok'?'ok':'unavailable',hallmarkStatus:health.hallmark?.status==='ok'?'ok':'unavailable'});
        }
        if(input.resource==='overview') {
          if(Object.keys(input).some(key=>key!=='resource'))return response(failed('INVALID_INPUT','Overview reads do not accept parameters'),400);
          return response(await this.client.request('/ui/overview',undefined,this.combined(request.signal)));
        }
        if(['saved','templates','datasets'].includes(String(input.resource))){const value=await this.client.request(`/ui/${input.resource}`,undefined,this.combined(request.signal));await this.sourceAssets.prepare(value);return response(value);}
        if((input.resource==='view'||input.resource==='viewData')&&typeof input.viewId==='string'&&ID.test(input.viewId)){const value=await this.client.request(`/ui/views/${encodeURIComponent(input.viewId)}${input.resource==='viewData'?'/data':''}`,undefined,this.combined(request.signal));await this.sourceAssets.prepare(value);return response(value);}
        return response(failed('INVALID_INPUT','Invalid resource/viewId'),400);
      }
      if(input.action==='activate'||input.action==='close'){
        if(Object.keys(input).some(k=>!['sessionId','action'].includes(k)))return response(failed('INVALID_INPUT','Unknown key'),400);
        if(typeof id!=='string'||!await this.knownSession(id,request.signal))return response(failed('INVALID_SESSION','没有此本机会话；请先打开现有聊天。'),400);
        return response(await this.setActive(id,input.action==='activate',request.signal));
      }
      if(input.action==='manageSessionView') {
        if(Object.keys(input).some(key=>!['action','sessionId','viewId','operation',...(input.operation==='rename'?['title']:[])].includes(key))||typeof input.operation!=='string'||!['rename','remove'].includes(input.operation)||typeof input.viewId!=='string'||!ID.test(input.viewId)||input.operation==='rename'&&(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>200))return response(failed('INVALID_INPUT','无效的会话组件管理请求。'),400);
        if(typeof id!=='string'||!await this.knownSession(id,request.signal))return response(failed('INVALID_SESSION','没有此本机会话；不能管理其他会话组件。'),400);
        return response(await this.client.request(`/sessions/${encodeURIComponent(id)}/views/${encodeURIComponent(input.viewId)}`,{action:input.operation,...(input.operation==='rename'?{title:input.title}:{})},this.combined(request.signal)));
      }
      const actions:Record<string,{path:string;keys:string[];marker?:string}>={
        preview:{path:'/ui/render',keys:['spec','templateId','title','bindings']},
        update:{path:'/ui/update',keys:['viewId','patch']},
        saveComponent:{path:'/ui/save',keys:['viewId','title','mode','componentId','expectedRevision'],marker:'save-component'},
        openComponent:{path:'/ui/open-component',keys:['componentId','revision','directory','sessionId']},
        openTemplate:{path:'/ui/open-template',keys:['templateId','title','bindings','directory','sessionId']},
        saveTemplate:{path:'/ui/save-template',keys:['viewId','name','description'],marker:'save-template'},
        manage:{path:'/ui/manage',keys:['kind','id','operation','name','order','pinned']},
        openEntry:{path:'/ui/open-entry',keys:['entryId']},
        refresh:{path:'/ui/refresh',keys:['datasetKey']},
      };
      const action=typeof input.action==='string'&&Object.hasOwn(actions,input.action)?actions[input.action]:undefined;
      if(!action||Object.keys(input).some(k=>!['action',...action.keys].includes(k)))return response(failed('INVALID_INPUT','Invalid workbench action/field'),400);
      if(['openComponent','openTemplate'].includes(String(input.action))&&input.sessionId!==undefined&&(typeof input.sessionId!=='string'||!await this.knownSession(input.sessionId,request.signal)))return response(failed('INVALID_SESSION','打开源码草稿需要已有聊天。'),400);
      const {action:_browserAction,...body}=input;
      if(action.marker)body.action=action.marker;
      if(input.action==='manage'){body.action=body.operation;delete body.operation;}
      const value=await this.client.request(action.path,body,this.combined(request.signal));await this.sourceAssets.prepare(value);return response(value);
    }catch(error){request.signal.throwIfAborted();
      if(error instanceof ServiceFailure&&error.httpStatus&&isToolResult(error.publicResult))return response(error.publicResult,error.httpStatus);
      return response(serviceError(error),error instanceof ServiceFailure?503:400);
    }
  }
  async start():Promise<void> {
    // Reject malformed optional fields before any registration can poison unrelated chat headers.
    assertJsonCompatible(TOOL_DEFINITIONS);assertJsonCompatible(OUTPUT_SCHEMA);
    if(this.config.autoStart){
      try{await this.client.request('/health',undefined,this.lifetime.signal,1500);}catch{await launchService(this.config,this.client.directory);}
    }
    // The local contracts are the single source; a reachable service must match exactly.
    try {
      const catalog=await this.client.request('/tools',undefined,this.lifetime.signal,3000) as {tools?:ToolDescriptor[]};
      if(!Array.isArray(catalog.tools)||JSON.stringify(catalog.tools)!==JSON.stringify(TOOL_DEFINITIONS))throw new Error('TOOL_CATALOG_MISMATCH');
    }catch(error){if(!(error instanceof ServiceFailure))throw error;}
    const render=createRenderer(this.client.directory,this.config.contentBudgetBytes);
    for(const descriptor of TOOL_DEFINITIONS)this.own(this.ctx.tools.register({
      name:descriptor.name,description:designToolDescription(descriptor),parameters:descriptor.parameters as Record<string,unknown>,
      output:{schema:OUTPUT_SCHEMA,render,presentationMeta:(_args,value)=>presentationMeta(value)},
      timeoutMs:90_000,isConcurrencySafe:()=>descriptor.kind==='read'||descriptor.kind==='compute',
      execute:async(args,exec)=>{const id=this.trusted(exec.agent);return id?this.invoke(descriptor,args,id,exec.signal):failed('APP_NOT_ACTIVE','缺少可信会话身份。');},
    }));
    this.own(this.ctx.on('tools/pre-execute',(exec,next)=>this.gate(exec,next)));
    this.own(this.ctx.systemPrompt.context({name:'hallmark-app',order:500,text:context=>{
      const agent=context.agent??context.scope as AgentRef|undefined;
      const id=this.trusted(agent);return id&&(!context.scope||context.scope===agent)&&this.cache.get(id)?.active?`${APP_INSTRUCTIONS}\n${DESIGN_INSTRUCTIONS}`:'';
    }}));
    this.own(this.ctx.commands.register({name:'hallmark',description:'在当前聊天激活/关闭 Hallmark 应用',input:{hint:'on | off | status'},handler:async invocation=>{
      const id=this.trusted(invocation.agent);if(!id)return {kind:'error',text:'缺少可信会话身份。'};
      const command=invocation.rawInput.trim().toLowerCase();
      if(!['','on','open','off','close','status'].includes(command))return {kind:'error',text:'用法：/hallmark [on|off|status]'};
      try{const current=command==='status'?await this.restore(id,invocation.signal):await this.setActive(id,!['off','close'].includes(command),invocation.signal);return {kind:'success',text:current.active?'Hallmark 已在当前聊天激活。':'Hallmark 已在当前聊天关闭。'};}catch(error){return {kind:'error',text:serviceError(error).error?.message??'应用状态不可用，当前聊天调用已拒绝。'};}
    }}));
    this.own(this.ctx.connection.fetch.register({path:UI_PATH,methods:['GET','POST'],requestBody:'buffered',fetch:request=>this.ui(request)}));
    this.own(this.ctx.on('agent/created',async payload=>{try{await this.restore(payload.agent.id,payload.signal);}catch{/* Never fail creation of an unrelated agent because this app is offline. */}return undefined;}));
    await Promise.all(this.ctx.agents.list().map(async agent=>{try{await this.restore(agent.id);}catch{}}));
  }
  async dispose():Promise<void>{if(this.closed)return;this.closed=true;this.lifetime.abort();this.cache.clear();await Promise.allSettled(this.disposers.reverse().map(dispose=>Promise.resolve().then(dispose)));}
}
export async function apply(ctx:PluginContext,config:PluginConfig={}):Promise<void>{
  const plugin=new HallmarkPlugin(ctx,snapshotPluginConfig(config));
  ctx.effect?.(()=>()=>{void plugin.dispose();});
  try{await plugin.start();}catch(error){await plugin.dispose();throw error;}
}
// Cordis unwraps a default export before resolving Config; keep both entry styles equivalent.
export default {name,inject,apply,Config};
