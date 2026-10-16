import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import type {IndependentReviewRequest,IndependentReviewResult} from '../../app-contracts/src/business-review.ts';

export interface ReviewOwner {invocationId:string;sessionId?:string}
export interface ReviewTicket {requestId:string;claimToken:string;owner:ReviewOwner;input:IndependentReviewRequest}
export type ReviewCompletion={result:IndependentReviewResult}|{error:string};
type Entry={ticket:ReviewTicket;claimed:boolean;resolve:(result:IndependentReviewResult)=>void;reject:(error:Error)=>void;cleanup:()=>void};
const sameOwner=(a:ReviewOwner,b:ReviewOwner)=>a.invocationId===b.invocationId&&a.sessionId===b.sessionId;
const problem=(code:string)=>Object.assign(new Error(code),{code,statusCode:409});
export function componentReviewInvocationId(value:{sessionId:string;viewId:string;buildId:string;frameInstanceId:string;requestId:string}):string {
  return `component:${JSON.stringify([value.sessionId,value.viewId,value.buildId,value.frameInstanceId,value.requestId])}`;
}

/** Host-only rendezvous: no review receipt is exposed as an Agent capability. */
export class ReviewBridge {
  private entries=new Map<string,Entry>();
  private changed=new Set<()=>void>();
  private owners=new AsyncLocalStorage<ReviewOwner>();
  withOwner<T>(owner:ReviewOwner,action:()=>T):T {return this.owners.run(owner,action);}
  request(input:IndependentReviewRequest,owner:ReviewOwner,signal?:AbortSignal):Promise<IndependentReviewResult> {
    owner=this.owners.getStore()??owner;
    if(!owner.sessionId||!owner.invocationId)return Promise.reject(problem('REVIEW_HOST_SESSION_REQUIRED'));
    if(signal?.aborted)return Promise.reject(problem('REVIEW_CANCELLED'));
    const requestId=randomUUID(),ticket:ReviewTicket={requestId,claimToken:randomUUID(),owner:{...owner},input:structuredClone(input)};
    return new Promise((resolve,reject)=>{
      const abort=()=>{this.entries.delete(requestId);reject(problem('REVIEW_CANCELLED'));};
      const cleanup=()=>signal?.removeEventListener('abort',abort);
      this.entries.set(requestId,{ticket,claimed:false,resolve,reject,cleanup});
      signal?.addEventListener('abort',abort,{once:true});
      for(const wake of this.changed)wake();
    });
  }
  async next(owner:ReviewOwner,signal?:AbortSignal,waitMs=20_000):Promise<ReviewTicket|null> {
    if(!owner.sessionId||!owner.invocationId)throw problem('REVIEW_HOST_SESSION_REQUIRED');
    const claim=()=>{for(const entry of this.entries.values())if(!entry.claimed&&sameOwner(entry.ticket.owner,owner)){entry.claimed=true;return structuredClone(entry.ticket);}return null;};
    signal?.throwIfAborted();const immediate=claim();if(immediate)return immediate;
    return new Promise((resolve,reject)=>{
      const finish=(value:ReviewTicket|null,error?:unknown)=>{clearTimeout(timer);this.changed.delete(wake);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(value);};
      const wake=()=>{const ticket=claim();if(ticket)finish(ticket);};
      const abort=()=>finish(null,signal?.reason??problem('REVIEW_CANCELLED'));
      const timer=setTimeout(()=>finish(null),Math.min(20_000,Math.max(0,waitMs)));
      this.changed.add(wake);signal?.addEventListener('abort',abort,{once:true});
    });
  }
  complete(requestId:string,claimToken:string,owner:ReviewOwner,completion:ReviewCompletion):void {
    const entry=this.entries.get(requestId);
    if(!entry||!entry.claimed||entry.ticket.claimToken!==claimToken||!sameOwner(entry.ticket.owner,owner))throw problem('REVIEW_CLAIM_MISMATCH');
    if('result'in completion){
      const result=completion.result,input=entry.ticket.input;
      if(!result||result.reviewer!=='independent-agent'||!result.reviewerId||!result.model||!result.versions
        ||result.versions.source!==input.versions.source||result.versions.draft!==input.versions.draft||result.versions.policy!==input.versions.policy
        ||!Array.isArray(result.questions)||result.questions.length!==input.questions.length
        ||new Set(result.questions.map(row=>row.id)).size!==input.questions.length
        ||input.questions.some(question=>!result.questions.some(row=>row.id===question.id&&row.version===question.version&&['passed','rejected','pending'].includes(row.status))))throw problem('REVIEW_RESULT_MISMATCH');
    }
    this.entries.delete(requestId);entry.cleanup();
    if('result'in completion)entry.resolve(structuredClone(completion.result));else entry.reject(problem('INDEPENDENT_REVIEW_UNAVAILABLE'));
  }
  dispose():void {for(const entry of this.entries.values()){entry.cleanup();entry.reject(problem('REVIEW_HOST_CLOSED'));}this.entries.clear();for(const wake of this.changed)wake();}
}
