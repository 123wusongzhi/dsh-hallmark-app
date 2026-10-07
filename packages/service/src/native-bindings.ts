import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {AppsRuntime} from '../../app-runtime/src/index.ts';

export interface NativeBindingRequest {sessionId:string;appId:string;connectionId?:string;bindRequestId:string;epoch:number;enabled:boolean;referenceId:string}
interface NativeBindingRecord extends NativeBindingRequest {status:'bound'|'needs_connection'|'failed'|'cancelled';requestHash:string;updatedAt:string}
const identity=(input:NativeBindingRequest)=>canonicalJson(['apps','presentation','native_references',input.sessionId,input.referenceId]);
/** One reference owns one intent. A focus change does not alter any session binding. */
export class NativeAppBindings {
  constructor(privateRuntime:AppsRuntime){this.runtime=privateRuntime;}
  private runtime:AppsRuntime;
  private available(appId:string):boolean {return this.runtime.listApps().some(app=>app.appId===appId&&['ready','degraded'].includes(app.providerState));}
  get(sessionId:string,bindRequestId:string,referenceId?:string) {
    if(!sessionId||!bindRequestId)throw new Error('EXPLICIT_NATIVE_REFERENCE_REQUIRED');
    const record=this.runtime.store.list<{namespace:string;value:NativeBindingRecord}>('provider_records').filter(row=>row.namespace==='native_references').map(row=>row.value).find(row=>row.sessionId===sessionId&&row.bindRequestId===bindRequestId&&(!referenceId||row.referenceId===referenceId));
    if(!record)return null;const {requestHash:_hash,updatedAt:_time,...response}=record;
    if(record.enabled&&!this.available(record.appId))return {...response,status:'failed' as const,error:{code:'APP_UNAVAILABLE',message:'应用服务当前不可用。'}};
    return {...response,...(record.status==='needs_connection'?{connections:this.runtime.listConnections(record.appId).filter(item=>item.enabled).map(item=>({connectionId:item.connectionId,displayName:item.displayName}))}:{})};
  }
  bind(input:NativeBindingRequest) {
    if(!input||['sessionId','appId','bindRequestId','referenceId'].some(key=>typeof (input as unknown as Record<string,unknown>)[key]!=='string'||!(input as unknown as Record<string,string>)[key])||!Number.isSafeInteger(input.epoch)||input.epoch<0||typeof input.enabled!=='boolean')throw new Error('NATIVE_BINDING_INPUT_INVALID');
    const key=identity(input),requestHash=canonicalJson(input),prior=this.runtime.store.get<{value:NativeBindingRecord}>('provider_records',key)?.value;
    if(prior&&prior.epoch>input.epoch)return {...prior,status:'cancelled' as const};
    if(prior&&prior.epoch===input.epoch){if(prior.requestHash!==requestHash)throw new Error('NATIVE_BINDING_CONFLICT');return {...prior};}
    const connections=this.runtime.listConnections(input.appId).filter(item=>item.enabled),connection=input.connectionId?connections.find(item=>item.connectionId===input.connectionId):connections.length===1?connections[0]:undefined;
    const available=this.available(input.appId),status:NativeBindingRecord['status']=!input.enabled?'cancelled':!available?'failed':!connection?connections.length?'needs_connection':'failed':'bound';
    const next:NativeBindingRecord={...input,...(connection?{connectionId:connection.connectionId}:prior?.connectionId?{connectionId:prior.connectionId}:{}),status,requestHash,updatedAt:new Date().toISOString()};
    this.runtime.store.transaction(()=>{
      this.runtime.store.put('provider_records',key,{appId:'apps',connectionId:'presentation',namespace:'native_references',recordId:canonicalJson([input.sessionId,input.referenceId]),value:next});
      if(status==='bound'){
        this.runtime.bind({sessionId:input.sessionId,appId:input.appId,connectionId:connection!.connectionId,enabled:true,boundAt:new Date().toISOString()});
        if(this.runtime.getConnection('apps','presentation'))this.runtime.bind({sessionId:input.sessionId,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
      }else if(!input.enabled&&next.connectionId){
        const others=this.runtime.store.list<{namespace:string;value:NativeBindingRecord}>('provider_records').some(row=>row.namespace==='native_references'&&row.value.referenceId!==input.referenceId&&row.value.sessionId===input.sessionId&&row.value.appId===input.appId&&row.value.connectionId===next.connectionId&&row.value.status==='bound'&&row.value.enabled);
        if(!others)this.runtime.bind({sessionId:input.sessionId,appId:input.appId,connectionId:next.connectionId,enabled:false,boundAt:new Date().toISOString()});
      }
    });
    const {requestHash:_hash,updatedAt:_time,...response}=next;
    return {...response,...(status==='needs_connection'?{connections:connections.map(item=>({connectionId:item.connectionId,displayName:item.displayName}))}:{}),...(status==='failed'?{error:{code:available?'CONNECTION_NOT_FOUND':'APP_UNAVAILABLE',message:available?'该应用没有可用的明确连接。':'应用服务当前不可用。'}}:{})};
  }
  serialize(input:{referenceId:string;sessionId?:string}):{text:string} {
    let ref:NativeBindingRequest&{kind:string;version:number};try{ref=JSON.parse(input.referenceId);}catch{throw new Error('NATIVE_REFERENCE_INVALID');}
    if(ref.kind!=='dsh-apps-native-reference'||ref.version!==1||!ref.sessionId||!ref.appId||!ref.bindRequestId||!Number.isSafeInteger(ref.epoch)||ref.epoch<0)throw new Error('NATIVE_REFERENCE_INVALID');
    if(input.sessionId&&ref.sessionId!==input.sessionId)throw new Error('NATIVE_REFERENCE_SESSION_MISMATCH');
    const record=this.runtime.store.get<{value:NativeBindingRecord}>('provider_records',identity({...ref,referenceId:input.referenceId}))?.value;
    if(!record||record.status!=='bound'||!record.enabled||record.referenceId!==input.referenceId||record.bindRequestId!==ref.bindRequestId||record.epoch<ref.epoch||record.sessionId!==ref.sessionId||record.appId!==ref.appId)throw new Error('NATIVE_REFERENCE_NOT_BOUND');
    const binding=this.runtime.sessionBindings(record.sessionId).find(row=>row.appId===record.appId&&row.connectionId===record.connectionId&&row.enabled),connection=this.runtime.getConnection(record.appId,record.connectionId!);
    if(!binding||!connection?.enabled||!this.available(record.appId))throw new Error('NATIVE_REFERENCE_NOT_BOUND');
    return {text:`[应用引用] ${canonicalJson({appId:record.appId,connectionId:record.connectionId,sessionId:record.sessionId,configRevision:connection.configRevision})}\n请使用当前会话已绑定的明确应用和连接执行能力；此引用不会自动提交或执行业务写入。`};
  }
}
