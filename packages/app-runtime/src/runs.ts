import { randomUUID } from 'node:crypto';
import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { AppRef, CapabilityResult, InvocationRequest, JsonValue } from '../../app-contracts/src/index.ts';
import type { AppsRuntime } from './index.ts';
export interface RunRecord {runId:string;sessionId:string;traceId:string;state:'running'|'succeeded'|'failed'|'partial'|'cancelled';startedAt:string;updatedAt:string;error?:string;}
export interface RunStep {runId:string;stepKey:string;request:InvocationRequest;result?:CapabilityResult;state:'running'|'done';}
export class ScriptRun {
  readonly record:RunRecord;
  #signal:AbortSignal;
  #keys=new Set<string>();
  readonly runtime:AppsRuntime;
  constructor(runtime:AppsRuntime,sessionId:string,options:{runId?:string;signal?:AbortSignal;deadlineAt?:string}={}) {
    this.runtime=runtime;
    this.#signal=options.signal??new AbortController().signal;
    const runId=options.runId??randomUUID(),previous=runtime.store.get<RunRecord>('runs',runId);
    if(previous&&previous.sessionId!==sessionId)throw new Error('RUN_SESSION_MISMATCH');
    const now=new Date().toISOString();const {error:previousError,...base}=previous??{runId,sessionId,traceId:randomUUID(),startedAt:now};
    this.record={...base,state:'running',updatedAt:now};
    runtime.store.put('runs',runId,this.record);this.deadlineAt=options.deadlineAt??new Date(Date.now()+90000).toISOString();
  }
  readonly deadlineAt:string;
  async call(stepKey:string,ref:AppRef,capabilityId:string,input:JsonValue,options:{idempotencyKey?:string;expectedResourceRevision?:string}={}):Promise<CapabilityResult> {
    if(!stepKey||this.#keys.has(stepKey))throw new Error('DUPLICATE_STEP_KEY');this.#keys.add(stepKey);
    if(this.#signal.aborted)throw new Error('RUN_CANCELLED');
    const id=JSON.stringify([this.record.runId,stepKey]);
    const previous=this.runtime.store.get<RunStep>('run_steps',id);
    if(previous){
      if(canonicalJson({ref,capabilityId,input,options})!==canonicalJson({ref:{appId:previous.request.appId,connectionId:previous.request.connectionId},capabilityId:previous.request.capabilityId,input:previous.request.input,options:{...(previous.request.idempotencyKey?{idempotencyKey:previous.request.idempotencyKey}:{}),...(previous.request.expectedResourceRevision?{expectedResourceRevision:previous.request.expectedResourceRevision}:{})}}))throw new Error('RUN_STEP_CONFLICT');
      if(previous.result?.status==='ok'||previous.result?.status==='partial')return previous.result;
      const attempt=this.runtime.store.get<import('./store.ts').InvocationRecord>('invocations',previous.request.invocationId);
      const operationId=previous.result?.operation?.operationId??attempt?.operationId;
      if(operationId){
        const result=await this.runtime.inspect(operationId,this.#signal);
        this.runtime.store.put('run_steps',id,{...previous,result,state:'done'} satisfies RunStep);
        return result;
      }
      if(previous.request.idempotencyKey)return previous.result??{invocationId:previous.request.invocationId,traceId:previous.request.traceId,status:'failed',error:{code:'STEP_OUTCOME_UNRESOLVED',message:'Inspect the original invocation; do not replay this mutation.',retryPolicy:'inspect_only'}};
    }
    const descriptor=this.runtime.describe(capabilityId,previous?.request.capabilityVersion);if(!descriptor)throw new Error('CAPABILITY_NOT_FOUND');
    const request:InvocationRequest={protocolVersion:'1.0',...ref,invocationId:randomUUID(),traceId:this.record.traceId,capabilityId,capabilityVersion:descriptor.version,input,source:{kind:'script',sessionId:this.record.sessionId,runId:this.record.runId,stepKey},deadlineAt:this.deadlineAt,...options};
    this.runtime.store.put('run_steps',id,{runId:this.record.runId,stepKey,request,state:'running'} satisfies RunStep);
    const result=await this.runtime.invoke(request,this.#signal);
    this.runtime.store.put('run_steps',id,{runId:this.record.runId,stepKey,request,result,state:'done'} satisfies RunStep);
    return result;
  }
  async execute<T>(script:(run:ScriptRun)=>Promise<T>):Promise<{run:RunRecord;value?:T;steps:RunStep[]}> {
    let value:T|undefined,error:string|undefined;
    try{value=await script(this);}catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    const steps=this.runtime.store.list<RunStep>('run_steps').filter(step=>step.runId===this.record.runId);
    const successes=steps.filter(step=>step.result?.status==='ok'||step.result?.status==='partial').length;
    const incomplete=steps.some(step=>step.result?.status!=='ok');
    const state=error||incomplete?(successes?'partial':this.#signal.aborted?'cancelled':'failed'):'succeeded';
    const record:RunRecord={...this.record,state,updatedAt:new Date().toISOString(),...(error?{error}:{})};this.runtime.store.put('runs',record.runId,record);
    return {run:record,...(value===undefined?{}:{value}),steps};
  }
}
