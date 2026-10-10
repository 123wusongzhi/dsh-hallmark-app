import React,{useEffect,useRef,useState} from 'react';
import type {AppsComponent,AppsView,Workbench} from '../../app-presentation/src/types.ts';
import {appsResource,appsWorkbench} from './api.ts';
import {PresentationRecovery,usePresentationRecovery} from './presentation-recovery.tsx';
import {updateOwnedAppsView} from './native-publication.tsx';
import {AppsIcon} from './ui.tsx';

export async function pinWorkbenchComponent(appId:string,component:{componentId:string;revision:number}):Promise<Workbench>{
  const board=await appsResource<Workbench>('workbench',{appId});
  return appsWorkbench<Workbench>(appId,'pinComponent',{componentId:component.componentId,revision:component.revision,expectedRevision:board.revision});
}

/** A library item is already saved: pin its exact version without saving or opening a copy. */
export function PinSavedComponentButton({appId,component,added=false,onAdded}:{appId:string;component:{componentId:string;revision:number};added?:boolean;onAdded?:(board:Workbench)=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),inFlight=useRef(false),owner=useRef('');
  const identity=`${appId}:${component.componentId}:${component.revision}`;owner.current=identity;
  useEffect(()=>{setConfirmed(false);setError('');},[identity,added]);
  const add=async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');const target=identity;try{const board=await pinWorkbenchComponent(appId,component);if(owner.current===target){setConfirmed(true);onAdded?.(board);window.dispatchEvent(new CustomEvent('apps-workbench-changed',{detail:{appId,board}}));}}catch(cause){if(owner.current===target)setError(cause instanceof Error?cause.message:String(cause));}finally{inFlight.current=false;if(owner.current===target)setBusy(false);}};
  return <><button type="button" className="apps-primary" disabled={busy||added||confirmed} onClick={()=>void add()}><AppsIcon name="plus"/>{busy?'正在添加…':added||confirmed?'已添加到工作台':'添加到工作台'}</button>{error?<span role="alert" className="apps-pin-error">{error}</span>:null}</>;
}

/** One explicit click saves the confirmed view through the existing receipt/CAS flow, then pins it. */
export function CurrentComponentWorkbenchAction({appId,sessionId,view,onAdded,onShowWorkbench}:{appId:string;sessionId:string;view:AppsView;onAdded?:(board:Workbench)=>void;onShowWorkbench?:()=>void}){
  const recovery=usePresentationRecovery(),[current,setCurrent]=useState(view),[board,setBoard]=useState<Workbench>(),[busy,setBusy]=useState(false),[pinning,setPinning]=useState(false),[notice,setNotice]=useState(''),[savedForPin,setSavedForPin]=useState<AppsComponent>();
  const inFlight=useRef(false),pinFlight=useRef(false),identity=`${appId}:${sessionId}:${view.viewId}`,owner=useRef(identity);owner.current=identity;
  useEffect(()=>{setCurrent(view);},[view]);
  useEffect(()=>{const controller=new AbortController();setBoard(undefined);setSavedForPin(undefined);setNotice('');appsResource<Workbench>('workbench',{appId},controller.signal).then(value=>{if(!controller.signal.aborted)setBoard(value);}).catch(()=>{});const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.appId===appId&&detail.board)setBoard(detail.board);};window.addEventListener('apps-workbench-changed',changed);return()=>{controller.abort();window.removeEventListener('apps-workbench-changed',changed);};},[identity]);
  const alreadyAdded=board?.savedComponents?.some(item=>item.componentId===current.sourceComponentId&&item.revision===current.baseRevision&&(!item.buildId||item.buildId===current.activeBuildId));
  const saveable=current.validationStatus==='verified'&&!current.pendingPublicationId;
  const pin=async(saved:AppsComponent,target:string)=>{
    if(pinFlight.current)return;pinFlight.current=true;setPinning(true);setSavedForPin(saved);
    try{const next=await pinWorkbenchComponent(appId,saved);window.dispatchEvent(new CustomEvent('apps-workbench-changed',{detail:{appId,board:next}}));if(owner.current===target){setBoard(next);setSavedForPin(undefined);setNotice('已添加到工作台。');onAdded?.(next);}}
    catch(cause){if(owner.current===target)setNotice(`组件已保存，添加尚未确认。${cause instanceof Error?cause.message:String(cause)}`);}
    finally{pinFlight.current=false;if(owner.current===target)setPinning(false);}
  };
  const add=async()=>{
    if(inFlight.current||pinFlight.current||recovery.pending||alreadyAdded||!saveable)return;
    const target=identity;inFlight.current=true;setBusy(true);setNotice('');
    try{
      if(savedForPin){await pin(savedForPin,target);return;}
      await recovery.run<AppsComponent>(sessionId,'apps.authoring.save_component',{viewId:current.viewId,expectedViewRevision:current.viewRevision!,userRequest:`保存当前组件“${current.title}”并添加到工作台`,title:current.title,mode:current.sourceComponentId?'update':'save_as',...(current.sourceComponentId?{componentId:current.sourceComponentId,expectedRevision:current.baseRevision!}:{})},saved=>{
        window.dispatchEvent(new CustomEvent('apps-library-changed',{detail:{sessionId,viewId:saved.view.viewId,component:saved}}));updateOwnedAppsView(saved.view);
        if(owner.current===target){setCurrent(saved.view);void pin(saved,target);}
      });
    }catch(cause){if(owner.current===target)setNotice(cause instanceof Error?cause.message:String(cause));}finally{inFlight.current=false;if(owner.current===target)setBusy(false);}
  };
  return <div className="apps-component-workbench-action"><style>{ACTION_STYLES}</style><div><strong>{current.title}</strong>{!saveable?<small>预览确认后即可添加</small>:null}</div><div className="apps-component-workbench-buttons"><button type="button" className={alreadyAdded?'':'apps-primary'} disabled={busy||pinning||!!recovery.pending||!saveable||alreadyAdded} title="保存当前版本并添加到应用工作台" onClick={()=>void add()}><AppsIcon name={alreadyAdded?'check':'plus'}/>{busy?'正在保存…':pinning?'正在添加…':alreadyAdded?'已在工作台':savedForPin?'重试添加':'添加到工作台'}</button>{onShowWorkbench?<button type="button" onClick={onShowWorkbench}>查看工作台</button>:null}</div>{notice?<p role="status">{notice}</p>:null}<PresentationRecovery pending={recovery.pending} inspecting={recovery.inspecting} onInspect={()=>void recovery.inspect().catch(cause=>setNotice(cause instanceof Error?cause.message:String(cause)))}/></div>;
}
const ACTION_STYLES=`.apps-component-workbench-action{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:13px 16px;border:1px solid var(--apps-line,#dce7fa);background:var(--apps-panel,#f6f9ff);border-radius:10px}.apps-component-workbench-action>div:first-of-type{min-width:0;flex:1}.apps-component-workbench-action strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.apps-component-workbench-action small{display:block;font-size:11px;color:var(--apps-muted,#7086a5);margin-top:4px}.apps-component-workbench-buttons{display:flex;gap:8px;flex-wrap:wrap}.apps-component-workbench-action>p,.apps-component-workbench-action>aside{flex-basis:100%;margin:0;font-size:12px}.apps-pin-error{font-size:12px;color:#b44832;flex-basis:100%}.apps-card-actions>.apps-primary{display:inline-flex;align-items:center;gap:5px}.apps-component-workbench-buttons>button{display:inline-flex;align-items:center;gap:5px}`;
