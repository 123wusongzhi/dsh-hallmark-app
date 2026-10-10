import {createHash} from 'node:crypto';
import {canonicalJson, validateResult} from '../../app-contracts/src/index.ts';
import type {CapabilityResult} from '../../app-contracts/src/index.ts';
import type {AppsRuntime, InvocationRecord, RuntimeOperation} from '../../app-runtime/src/index.ts';

const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
export interface VerifiedInvocationInspection {result:CapabilityResult;recoveryEvidence?:{source:'operation-ledger';operationId:string;observedInvocationId:string;observedTraceId:string;originalStatus:string}}
/** Reads existing invocation/operation ledgers only: no invoke, Provider inspection, new identity or request/config disclosure. */
export function inspectInvocation(runtime:AppsRuntime,invocationId:string,sessionId:string):VerifiedInvocationInspection {
  const record=runtime.store.get<InvocationRecord>('invocations',invocationId);
  // Do not disclose whether an invocation exists to another session.
  if(!record||!('sessionId' in record.request.source)||record.request.source.sessionId!==sessionId)
    throw Object.assign(new Error('Original invocation is not available in this session.'),{code:'INVOCATION_NOT_FOUND',statusCode:404});
  const request=record.request,identity={invocationId,traceId:request.traceId};
  const unavailable=(code:string,message:string):VerifiedInvocationInspection=>({result:{...identity,status:'unavailable',error:{code,message,retryPolicy:'inspect_only',details:{invocationId,doNotResubmitMutation:true,next:{tool:'apps_inspect',arguments:{invocationId}}}}}});
  if(record.invocationId!==invocationId||request.invocationId!==invocationId||record.requestHash!==digest(request))
    return unavailable('INVOCATION_INTEGRITY_ERROR','The original invocation identity could not be verified.');
  if('status' in runtime.resolveConnection(request.appId,sessionId,request.connectionId))
    return unavailable('CONNECTION_NOT_BOUND','Enable the original application connection in the original session before inspecting.');
  if(record.configRevision===undefined||runtime.getConnection(request.appId,request.connectionId)?.configRevision!==record.configRevision)
    return unavailable('CONNECTION_REVISION_CHANGED','The original backend configuration is no longer active.');
  const descriptor=runtime.describe(request.capabilityId,request.capabilityVersion);
  if(!descriptor)return unavailable('CAPABILITY_VERSION_CHANGED','The original capability version is no longer registered.');
  const operation=record.operationId?runtime.store.get<RuntimeOperation>('operations',record.operationId):undefined;
  if(record.operationId){
    const mapping=runtime.store.get<{invocationId:string;operationId:string}>('invocation_operations',invocationId);
    if(!operation||mapping?.invocationId!==invocationId||mapping.operationId!==record.operationId
      ||operation.operationId!==record.operationId||operation.appId!==request.appId||operation.connectionId!==request.connectionId
      ||operation.capabilityId!==request.capabilityId||operation.capabilityVersion!==request.capabilityVersion
      ||operation.request.appId!==operation.appId||operation.request.connectionId!==operation.connectionId
      ||operation.request.capabilityId!==operation.capabilityId||operation.request.capabilityVersion!==operation.capabilityVersion
      ||operation.requestHash!==digest({capabilityVersion:operation.request.capabilityVersion,input:operation.request.input,expectedResourceRevision:operation.request.expectedResourceRevision??null})
      ||operation.configRevision!==record.configRevision||!('sessionId' in operation.request.source)||operation.request.source.sessionId!==sessionId
      ||operation.requestHash!==digest({capabilityVersion:request.capabilityVersion,input:request.input,expectedResourceRevision:request.expectedResourceRevision??null}))
      return unavailable('INVOCATION_INTEGRITY_ERROR','The original operation identity could not be verified.');
  }
  if(record.result){
    const result=record.result;
    if(validateResult(result,descriptor.outputSchema).length||result.invocationId!==invocationId||result.traceId!==request.traceId
      ||result.operation?.operationId!==record.operationId
      ||operation&&['ok','partial','failed','cancelled'].includes(result.status)&&result.operation?.state!==operation.state)
      return unavailable('INVOCATION_INTEGRITY_ERROR','The stored result does not identify the original invocation.');
  }
  // A later read-only inspection may settle the operation without changing the original invocation snapshot.
  // Adopt it only when the complete persisted observation is tied to this exact operation and intent.
  if(operation&&['succeeded','failed','partial','cancelled'].includes(operation.state)&&(!record.result||['pending','unknown','unavailable'].includes(record.result.status))){
    const latest=operation.result,observed=latest?runtime.store.get<InvocationRecord>('invocations',latest.invocationId):undefined;
    const mapping=latest?runtime.store.get<{invocationId:string;operationId:string}>('invocation_operations',latest.invocationId):undefined;
    const source=observed?.request.source;
    const expectedStatus=({succeeded:'ok',failed:'failed',partial:'partial',cancelled:'cancelled'} as Record<string,string>)[operation.state];
    if(!latest||validateResult(latest,descriptor.outputSchema).length||latest.status!==expectedStatus||latest.operation?.operationId!==operation.operationId||latest.operation.state!==operation.state
      ||!observed||observed.state!=='settled'||!observed.result||canonicalJson(observed.result)!==canonicalJson(latest)
      ||observed.invocationId!==latest.invocationId||observed.request.invocationId!==latest.invocationId||observed.requestHash!==digest(observed.request)
      ||observed.request.traceId!==latest.traceId||latest.traceId!==operation.request.traceId
      ||observed.operationId!==operation.operationId||mapping?.invocationId!==latest.invocationId||mapping.operationId!==operation.operationId
      ||observed.configRevision!==record.configRevision||observed.request.appId!==request.appId||observed.request.connectionId!==request.connectionId
      ||observed.request.capabilityId!==request.capabilityId||observed.request.capabilityVersion!==request.capabilityVersion
      ||digest({capabilityVersion:observed.request.capabilityVersion,input:observed.request.input,expectedResourceRevision:observed.request.expectedResourceRevision??null})!==operation.requestHash
      ||!source||!(source.kind==='recovery'?source.operationId===operation.operationId:'sessionId' in source&&source.sessionId===sessionId))
      return unavailable('OPERATION_EVIDENCE_UNAVAILABLE','The current operation outcome could not be tied to a complete original observation. Inspect the same invocation later.');
    return {result:{...structuredClone(latest),...identity},recoveryEvidence:{source:'operation-ledger',operationId:operation.operationId,observedInvocationId:latest.invocationId,observedTraceId:latest.traceId,originalStatus:record.result?.status??record.state}};
  }
  if(record.result)return {result:structuredClone(record.result)};
  if(operation)return {result:{...identity,status:'unknown',operation:{operationId:operation.operationId,state:operation.state},error:{code:'OUTCOME_UNKNOWN',message:'The original invocation has not settled. Inspect this same invocation ID later; do not resubmit.',retryPolicy:'inspect_only',details:{invocationId,next:{tool:'apps_inspect',arguments:{invocationId}}}}}};
  return unavailable('INVOCATION_NOT_SETTLED','The original invocation has not settled. Inspect the same invocation ID later; do not resubmit.');
}
