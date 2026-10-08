import type {AppsView,AppsViewData} from '../../app-presentation/src/types.ts';
import type {ViewPublication,ComponentDisplay,AuthoringView} from '../../app-presentation/src/authoring-types.ts';
import {appsAuthoring,appsResource} from './api.ts';
export interface PublicationTarget {sessionId:string;viewId:string;publicationId:string;buildId?:string;viewRevision?:number}
/** A click carries the original publication, never the view's latest candidate. */
export function ownedPublication(target:PublicationTarget,value:AppsView&{publication?:ViewPublication}):ViewPublication {
  const publication=value.publication;
  if(value.ownerSessionId!==target.sessionId||value.viewId!==target.viewId||publication?.ownerSessionId!==target.sessionId||publication.viewId!==target.viewId||publication.publicationId!==target.publicationId||target.buildId&&publication.candidateBuildId!==target.buildId||target.viewRevision!==undefined&&target.viewRevision!==publication.expectedViewRevision&&target.viewRevision!==publication.committedViewRevision||publication.source?.buildId!==publication.candidateBuildId||!Number.isSafeInteger(publication.attemptEpoch)||!Number.isSafeInteger(publication.expectedViewRevision)||!publication.attemptId)throw new Error('原消息的发布身份不一致，请检查原 publication。');
  if(!['prepared','mounting','mounted','failed_mount','interrupted'].includes(publication.state))throw new Error('原发布已结束，请在原聊天准备新的组件。');
  return publication;
}
export interface DisplayTarget extends PublicationTarget {displayId:string}
export interface OpenDisplayResult {publication:ViewPublication;display:ComponentDisplay;source:ViewPublication['source'];view:AuthoringView;data?:AppsViewData}
// Native navigation keeps the displayId it was opened with, even after an in-pane reopen created a newer display.
const latestOpened=new Map<string,string>();
const scopeKey=(target:Pick<PublicationTarget,'sessionId'|'viewId'|'publicationId'>)=>JSON.stringify([target.sessionId,target.viewId,target.publicationId]);
/** The display this client opened last for a publication; callers fall back to their navigation id when none is known. */
export function latestOpenedDisplayId(target:Pick<PublicationTarget,'sessionId'|'viewId'|'publicationId'>):string|undefined {return latestOpened.get(scopeKey(target));}
function rememberOpenedDisplay(target:DisplayTarget):void {
  const key=scopeKey(target);latestOpened.delete(key);latestOpened.set(key,target.displayId);
  while(latestOpened.size>64)latestOpened.delete(latestOpened.keys().next().value as string);
}
/** Display generations belong to explicit clicks; no lease from a closed document is reused. */
export function ownedDisplay(target:DisplayTarget,publication:ViewPublication,display:ComponentDisplay):ComponentDisplay {
  if(display.ownerSessionId!==target.sessionId||display.viewId!==target.viewId||display.publicationId!==publication.publicationId||display.displayId!==target.displayId||display.attemptId!==publication.attemptId||display.attemptEpoch!==publication.attemptEpoch||display.buildId!==publication.candidateBuildId||display.expectedViewRevision!==publication.expectedViewRevision||display.view?.ownerSessionId!==target.sessionId||display.view.viewId!==target.viewId||display.view.source?.buildId!==publication.candidateBuildId||!Number.isSafeInteger(display.generation)||display.generation<1)throw new Error('原消息的展示身份不一致。');
  return display;
}
export async function readOwnedDisplay(target:DisplayTarget,publication:ViewPublication,signal:AbortSignal):Promise<ComponentDisplay> {
  const inspected=await appsAuthoring<{latestDisplay?:ComponentDisplay|null;displays?:ComponentDisplay[]}>(target.sessionId,'inspect',{publicationId:publication.publicationId,displayId:target.displayId},signal);
  const display=inspected.displays?.find(value=>value.displayId===target.displayId);
  if(!display||inspected.latestDisplay?.displayId!==target.displayId)throw new Error('此展示已被新的打开操作替换，请重新打开组件。');
  return ownedDisplay(target,publication,display);
}
/** A lost response is inspected with this exact click id, never replaced by another candidate. */
export async function openOwnedPublicationDisplay(target:DisplayTarget,publication:ViewPublication,isCurrent:()=>boolean,signal:AbortSignal):Promise<OpenDisplayResult> {
  const check=()=>{signal.throwIfAborted();if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');};
  check();ownedPublication(target,{viewId:target.viewId,ownerSessionId:target.sessionId,publication} as AppsView&{publication?:ViewPublication});
  let opened:OpenDisplayResult;
  try{opened=await appsAuthoring<OpenDisplayResult>(target.sessionId,'openDisplay',{viewId:target.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,expectedViewRevision:publication.expectedViewRevision,displayId:target.displayId},AbortSignal.any([signal,AbortSignal.timeout(5000)]));}
  catch(error){
    check();
    const display=await readOwnedDisplay(target,publication,AbortSignal.any([signal,AbortSignal.timeout(5000)])).catch(()=>{throw new Error(`本次打开结果尚未确认；请重新点击打开。${error instanceof Error?' '+error.message:''}`);});
    opened={publication,display,source:publication.source,view:display.view};
  }
  check();ownedPublication(target,{...opened.view,publication:opened.publication});ownedDisplay(target,opened.publication,opened.display);
  if(!['opening','ready'].includes(opened.display.state)||opened.source.buildId!==publication.candidateBuildId||opened.source.entry!==publication.source.entry||opened.view.ownerSessionId!==target.sessionId||opened.view.viewId!==target.viewId)throw new Error('本次展示没有可加载的原构建，请重新打开或让 Agent 检查展示错误。');
  rememberOpenedDisplay(target);
  return opened;
}
