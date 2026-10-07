import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import type {AppsView} from '../../app-presentation/src/types.ts';
import type {ViewPublication} from '../../app-presentation/src/authoring-types.ts';
import type {NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import {openSessionComponents} from '../../dsh-plugin/client/sidebar-contract.ts';
import {appsResource} from './api.ts';

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
  if(publication.state==='mounting'&&Date.parse(publication.readyDeadlineAt)>Date.now())return publication;
}
export function announceAppsPublication(sessionId:string,viewId:string,publicationId:string):void {
  window.dispatchEvent(new CustomEvent('apps-publication-discovered',{detail:{sessionId,viewId,publicationId}}));
}
const absentMounted={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
/** Independent of ToolView rows: only the native on-screen chat may open its global right pane. */
export function NativePublicationObserver({sidebarRight}:{sidebarRight?:NativeSidebarRight}) {
  const store=sidebarRight?.mounted??absentMounted;
  const sessionId=useSyncExternalStore(store.subscribe??absentMounted.subscribe,store.getSnapshot,store.getSnapshot);
  const consumed=useRef(new Set<string>()),active=useRef<{sessionId:string;viewId:string;publicationId:string}>();
  useOwnedAppsViews(sessionId,async(views,signal)=>{
    if(active.current?.sessionId===sessionId&&views.some(view=>view.viewId===active.current?.viewId&&view.pendingPublicationId===active.current.publicationId))return;
    active.current=undefined;
    for(const view of views){
      if(!view.pendingPublicationId||sidebarRight?.mounted.getSnapshot()!==sessionId)continue;
      const key=publicationKey(sessionId!,view.viewId,view.pendingPublicationId);if(consumed.current.has(key))continue;
      const publication=await readOwnedPendingPublication(sessionId!,view,signal);
      if(signal.aborted||sidebarRight?.mounted.getSnapshot()!==sessionId)return;
      if(!publication){consumed.current.add(key);continue;}
      const opened=openSessionComponents(sidebarRight,sessionId,view.viewId);
      if(opened.ok){consumed.current.add(key);active.current={sessionId:sessionId!,viewId:view.viewId,publicationId:view.pendingPublicationId};announceAppsPublication(sessionId!,view.viewId,view.pendingPublicationId);return;}
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
