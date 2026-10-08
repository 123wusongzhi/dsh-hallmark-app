import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {sourceInputDigest} from '../packages/source-components/src/authoring-evidence.ts';

export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)).digest('hex');
const checkpointPath=(input,stage)=>join(input.evidenceRoot,`resume-${fingerprint([input.sessionId??null,input.viewId??null,input.attemptId,input.epoch,stage])}.json`);
export function checkpoint(input,stage,value){
 const path=checkpointPath(input,stage);
 if(value===undefined)return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
 mkdirSync(input.evidenceRoot,{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n');return value;
}
export function buildFingerprint(input){return fingerprint({attemptId:input.attemptId,epoch:input.epoch,sourceRevision:input.sourceRevision,workspacePath:resolve(input.workspacePath),archiveRoot:resolve(input.archiveRoot),command:input.command,runtime:input.runtime??null,sdk:input.sdkDirectory?sourceInputDigest(input.sdkDirectory):null,node:process.version,platform:process.platform,arch:process.arch,execPath:process.execPath,environment:process.env});}
export async function inspectAttempt(input){
 if(!input.runtime)return null;
 const response=await fetch(new URL('/v1/authoring/inspect',input.runtime.url),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:input.sessionId,params:{attemptId:input.attemptId}}),signal:AbortSignal.timeout(30000)});
 const state=await response.json();if(!response.ok)throw Object.assign(new Error(state.error?.message??'Inspect failed'),{code:state.error?.code??'INSPECT_FAILED'});
 if((input.epoch!==undefined&&state.attempt.epoch!==input.epoch)||state.draft.epoch!==state.attempt.epoch||['cancelled','superseded','interrupted'].includes(state.attempt.state))throw Object.assign(new Error('Inspect the current attempt before continuing.'),{code:'ATTEMPT_SUPERSEDED'});
 return state;
}
export function newAttemptRequired(){return Object.assign(new Error('Inputs changed after an immutable receipt. Start a new authoring attempt; do not rewrite old receipts.'),{code:'NEW_ATTEMPT_REQUIRED'});}
export function previewFingerprint(input){
 return fingerprint({attemptId:input.attemptId,epoch:input.epoch,buildReceiptId:input.buildReceiptId,buildReportRef:input.buildReportRef,mode:input.mode,data:input.data??null,context:input.context??null,capabilityFixtures:input.capabilityFixtures??null,refreshData:input.refreshData??null,assertions:input.assertions??null,noninteractiveReason:input.noninteractiveReason??null,requiredMethods:input.requiredMethods??[],requiredMethodsOnce:input.requiredMethodsOnce??[],runtime:input.runtime??null,browserExecutable:input.browserExecutable??process.env.DSH_PREVIEW_BROWSER_PATH??null});
}
