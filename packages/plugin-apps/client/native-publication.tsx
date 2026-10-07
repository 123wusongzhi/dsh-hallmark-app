import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import type {AppsView} from '../../app-presentation/src/types.ts';
import type {ViewPublication} from '../../app-presentation/src/authoring-types.ts';
import type {NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import {appsAuthoring,appsResource} from './api.ts';

/** Reads are single-flight and lose authority as soon as their visible Session changes. */
export function watchOwnedAppsViews(sessionId:string,onViews:(views:AppsView[],signal:AbortSignal)=>void|Promise<void>,isCurrent:()=>boolean,onError?:(error:unknown)=>void,pollMs=1000):()=>void {
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const poll=async()=>{
    if(controller.signal.aborted||!isCurrent())return;
    try{
      const value=await appsResource<{views:AppsView[]}>('views',{sessionId},AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]));
      if(!controller.signal.aborted&&isCurrent())await onViews(Array.isArray(value.views)?value.views.filter(view=>view.ownerSessionId===sessionId):[],controller.signal);
    }catch(error){if(!controller.signal.aborted&&isCurrent())onError?.(error);}
    if(!controller.signal.aborted&&isCurrent())timer=setTimeout(()=>void poll(),pollMs);
  };
  void poll();return()=>{controller.abort();if(timer!==undefined)clearTimeout(timer);};
}
export function useOwnedAppsViews(sessionId:string|undefined,onViews:(views:AppsView[],signal:AbortSignal)=>void|Promise<void>,onError?:(error:unknown)=>void,refreshKey=0,enabled=true):void {
  const live=useRef({sessionId,onViews,onError,enabled});live.current={sessionId,onViews,onError,enabled};
  useEffect(()=>sessionId&&enabled?watchOwnedAppsViews(sessionId,(views,signal)=>live.current.onViews(views,signal),()=>live.current.enabled&&live.current.sessionId===sessionId,error=>live.current.onError?.(error)):undefined,[sessionId,refreshKey,enabled]);
}
export function publicationKey(sessionId:string,viewId:string,publicationId:string):string {return JSON.stringify([sessionId,viewId,publicationId]);}
/** Expired/terminal historical candidates are observed without remounting or changing their receipts. */
export async function readOwnedPendingPublication(sessionId:string,view:AppsView,signal:AbortSignal):Promise<ViewPublication|undefined> {
  if(view.ownerSessionId!==sessionId||!view.pendingPublicationId)return;
  const current=await appsResource<AppsView&{publication?:ViewPublication}>('view',{sessionId,viewId:view.viewId,publicationId:view.pendingPublicationId},AbortSignal.any([signal,AbortSignal.timeout(5000)]));
  const publication=current.publication;
  if(current.ownerSessionId!==sessionId||current.viewId!==view.viewId||publication?.ownerSessionId!==sessionId||publication.viewId!==view.viewId||publication.publicationId!==view.pendingPublicationId)throw new Error('候选发布不属于当前屏幕会话。');
  if(publication.state==='prepared'||publication.state==='mounting'&&publication.readyDeadlineAt!==null&&Date.parse(publication.readyDeadlineAt)>Date.now())return publication;
}
export interface PublicationTarget {sessionId:string;viewId:string;publicationId:string;buildId?:string;viewRevision?:number}
/** A click carries the original publication, never the view's latest candidate. */
export function ownedPublication(target:PublicationTarget,value:AppsView&{publication?:ViewPublication}):ViewPublication {
  const publication=value.publication;
  if(value.ownerSessionId!==target.sessionId||value.viewId!==target.viewId||publication?.ownerSessionId!==target.sessionId||publication.viewId!==target.viewId||publication.publicationId!==target.publicationId||target.buildId&&publication.candidateBuildId!==target.buildId||target.viewRevision!==undefined&&target.viewRevision!==publication.expectedViewRevision&&target.viewRevision!==publication.committedViewRevision||publication.source?.buildId!==publication.candidateBuildId||!Number.isSafeInteger(publication.attemptEpoch)||!Number.isSafeInteger(publication.expectedViewRevision)||!publication.attemptId)throw new Error('原消息的发布身份不一致，请检查原 publication。');
  if(!['prepared','mounting','mounted'].includes(publication.state))throw new Error('原发布已结束，请在原聊天准备新的组件。');
  return publication;
}
/** Response loss is resolved by reading this exact publication; it never causes an implicit retry. */
export async function startOwnedPublicationMount(target:PublicationTarget,publication:ViewPublication,isCurrent:()=>boolean,signal:AbortSignal):Promise<ViewPublication> {
  const checkCurrent=()=>{signal.throwIfAborted();if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');};
  const validate=(value:ViewPublication)=>ownedPublication(target,{viewId:target.viewId,ownerSessionId:target.sessionId,publication:value} as AppsView&{publication?:ViewPublication});
  checkCurrent();validate(publication);
  if(publication.state==='mounted')return publication;
  if(publication.state==='mounting'){
    if(publication.readyDeadlineAt===null||!(Date.parse(publication.readyDeadlineAt)>Date.now()))throw new Error('原候选的加载确认时间已过，请在原聊天准备新的组件。');
    return publication;
  }
  let started:ViewPublication;
  try{started=await appsAuthoring<ViewPublication>(target.sessionId,'startMount',{viewId:target.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,expectedViewRevision:publication.expectedViewRevision},AbortSignal.any([signal,AbortSignal.timeout(5000)]));}
  catch(error){
    checkCurrent();
    const current=await appsResource<AppsView&{publication?:ViewPublication}>('view',{sessionId:target.sessionId,viewId:target.viewId,publicationId:target.publicationId,...(target.buildId?{buildId:target.buildId}:{})},AbortSignal.any([signal,AbortSignal.timeout(5000)]));
    checkCurrent();started=ownedPublication(target,current);
    if(started.state==='prepared')throw new Error(`原组件的打开结果尚未确认，仍保留已准备好状态；请检查原发布后再点击。${error instanceof Error?' '+error.message:''}`);
  }
  checkCurrent();validate(started);
  if(started.state!=='mounted'&&(started.state!=='mounting'||started.readyDeadlineAt===null||!(Date.parse(started.readyDeadlineAt)>Date.now())))throw new Error('原组件未进入有效加载状态，请检查原 publication。');
  return started;
}
export function announceAppsPublication(sessionId:string,viewId:string,publicationId:string):void {
  window.dispatchEvent(new CustomEvent('apps-publication-discovered',{detail:{sessionId,viewId,publicationId}}));
}
const absentMounted={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
/** Discovery updates available component entrances; only a user's click opens the right pane. */
export function NativePublicationObserver({sidebarRight}:{sidebarRight?:NativeSidebarRight}) {
  const store=sidebarRight?.mounted??absentMounted;
  const sessionId=useSyncExternalStore(store.subscribe??absentMounted.subscribe,store.getSnapshot,store.getSnapshot);
  const consumed=useRef(new Set<string>());
  useOwnedAppsViews(sessionId,async(views,signal)=>{
    for(const view of views){
      if(!view.pendingPublicationId||sidebarRight?.mounted.getSnapshot()!==sessionId)continue;
      const key=publicationKey(sessionId!,view.viewId,view.pendingPublicationId);if(consumed.current.has(key))continue;
      const publication=await readOwnedPendingPublication(sessionId!,view,signal);
      if(signal.aborted||sidebarRight?.mounted.getSnapshot()!==sessionId)return;
      if(!publication){consumed.current.add(key);continue;}
      consumed.current.add(key);announceAppsPublication(sessionId!,view.viewId,view.pendingPublicationId);
    }
  });
  return null;
}

/** A pending publication grants exactly one document. Switching surfaces cannot grant a second. */
export class CandidateFrameLease {
  private records=new Map<string,{owner?:object;state:'claimed'|'granting'|'settled'}>();
  private listeners=new Set<()=>void>();private revision=0;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  private changed(){this.revision++;for(const listener of this.listeners)listener();}
  acquire(key:string,owner:object):void {if(!this.records.has(key)){this.records.set(key,{owner,state:'claimed'});this.changed();}}
  owns(key:string,owner:object):boolean {return this.records.get(key)?.owner===owner;}
  release(key:string,owner:object):void {const value=this.records.get(key);if(value?.owner===owner&&value.state==='claimed'){this.records.delete(key);this.changed();}}
  authorize(key:string,owner:object):void {const value=this.records.get(key);if(value?.owner!==owner||value.state!=='claimed')throw Object.assign(new Error('此候选已授权原文档；请检查原发布结果后再处理新候选。'),{code:'CANDIDATE_SURFACE_CHANGED'});value.state='granting';}
  settle(key:string):void {this.records.set(key,{owner:this.records.get(key)?.owner,state:'settled'});for(const [id,value]of this.records){if(this.records.size<=256)break;if(value.state==='settled'&&id!==key)this.records.delete(id);}this.changed();}
}
const candidateFrames=new CandidateFrameLease();
export function useCandidateFrameLease(key:string|undefined,enabled=true):{allowed:boolean;authorize:()=>void;settle:()=>void;owns:()=>boolean} {
  const owner=useRef({}),revision=useSyncExternalStore(candidateFrames.subscribe,candidateFrames.getSnapshot,candidateFrames.getSnapshot);
  useEffect(()=>{if(key&&enabled)candidateFrames.acquire(key,owner.current);},[key,enabled,revision]);
  useEffect(()=>()=>{if(key&&enabled)candidateFrames.release(key,owner.current);},[key,enabled]);
  return {allowed:enabled&&(!key||candidateFrames.owns(key,owner.current)),authorize:()=>{if(key)candidateFrames.authorize(key,owner.current);},settle:()=>{if(key)candidateFrames.settle(key);},owns:()=>!!key&&candidateFrames.owns(key,owner.current)};
}
