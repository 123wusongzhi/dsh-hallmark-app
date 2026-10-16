import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {AppsComponent,AppsView} from '../../app-presentation/src/types.ts';
import {appsApiError,appsResource} from './api.ts';
import {usePresentationRecovery} from './presentation-recovery.tsx';
import {updateOwnedAppsView} from './native-publication.tsx';
import {AppsIcon} from './ui.tsx';
import {SESSION_HUB_STYLES} from './session-hub-styles.ts';
import {canFavoriteCurrentView} from './session-component-state.ts';

export interface ComponentFavorite {componentId:string;appId:string;title:string;revision:number;hasPreview?:boolean;createdAt:string;available:boolean}
export interface ComponentFavorites {sessionId:string;favorites:ComponentFavorite[]}
interface FavoriteSnapshot {favorites:ComponentFavorite[];loading:boolean;loaded:boolean;error:string}
interface FavoriteWatch {snapshot:FavoriteSnapshot;listeners:Set<()=>void>;flight?:Promise<ComponentFavorites>;generation:number;reloadAfterFlight?:boolean}
const favoriteWatches=new Map<string,FavoriteWatch>(),favoriteWrites=new Map<string,Promise<ComponentFavorites>>();
let favoriteWriteTail:Promise<unknown>=Promise.resolve();
function watchFor(sessionId:string):FavoriteWatch {let watch=favoriteWatches.get(sessionId);if(!watch){watch={snapshot:{favorites:[],loading:false,loaded:false,error:''},listeners:new Set(),generation:0};favoriteWatches.set(sessionId,watch);}return watch;}
function publish(watch:FavoriteWatch,next:Partial<FavoriteSnapshot>){watch.snapshot={...watch.snapshot,...next};for(const listener of watch.listeners)listener();}
function validated(value:ComponentFavorites,sessionId:string):ComponentFavorites {if(value.sessionId!==sessionId||!Array.isArray(value.favorites))throw new Error('收藏列表尚未确认，请稍后重试。');return value;}
function acceptFavorites(sessionId:string,value:ComponentFavorites){validated(value,sessionId);const watch=watchFor(sessionId);watch.generation++;publish(watch,{favorites:value.favorites,loaded:true,loading:false,error:''});}
/** One metadata read is shared by every star in this session. No timer or business data reads. */
export async function refreshComponentFavorites(sessionId:string):Promise<ComponentFavorites>{
  const watch=watchFor(sessionId);if(watch.flight)return watch.flight;
  const generation=watch.generation;publish(watch,{loading:true,error:''});
  const flight=appsResource<ComponentFavorites>('favorites',{sessionId}).then(value=>{validated(value,sessionId);if(watch.generation===generation)publish(watch,{favorites:value.favorites,loaded:true,error:''});return value;}).catch(error=>{if(watch.generation===generation)publish(watch,{error:error instanceof Error?error.message:String(error)});throw error;}).finally(()=>{if(watch.flight===flight){watch.flight=undefined;publish(watch,{loading:false});if(watch.reloadAfterFlight){watch.reloadAfterFlight=false;if(watch.listeners.size)void refreshComponentFavorites(sessionId).catch(()=>{});else publish(watch,{loaded:false});}}});
  watch.flight=flight;return flight;
}
export function useComponentFavorites(sessionId:string){
  const watch=watchFor(sessionId),snapshot=useSyncExternalStore(listener=>{watch.listeners.add(listener);return()=>watch.listeners.delete(listener);},()=>watch.snapshot,()=>watch.snapshot);
  useEffect(()=>{void refreshComponentFavorites(sessionId).catch(()=>{});},[sessionId]);
  return {...snapshot,refresh:()=>refreshComponentFavorites(sessionId)};
}
/** Favorite writes are idempotent; a lost response is checked once before any explicit retry. */
export async function setComponentFavorite(sessionId:string,componentId:string,favorite:boolean):Promise<ComponentFavorites>{
  if(favoriteWrites.has(componentId))throw new Error('这项收藏正在更新，请稍候。');
  const operation=favoriteWriteTail.catch(()=>{}).then(async()=>{
    let value:ComponentFavorites;
    try{const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'favorite',sessionId,componentId,favorite})});const result=await response.json();if(!response.ok||result?.status==='failed')throw appsApiError(result,response.status,'收藏暂未更新。');value=validated(result,sessionId);}
    catch(error){
      // Read the result even after a lost HTTP response; never claim an optimistic star was saved.
      try{value=validated(await appsResource<ComponentFavorites>('favorites',{sessionId}),sessionId);}catch{throw new Error('收藏结果暂未确认，稍后可重新查看。');}
      acceptFavorites(sessionId,value);
      if(value.favorites.some(row=>row.componentId===componentId)!==favorite)throw error;
    }
    if(value.favorites.some(row=>row.componentId===componentId)!==favorite)throw new Error('收藏结果尚未确认，请重新查看。');
    acceptFavorites(sessionId,value);
    // Other open chats re-read their own authorization-aware metadata.
    for(const [id,watch]of favoriteWatches)if(id!==sessionId){watch.generation++;if(watch.flight)watch.reloadAfterFlight=true;else if(watch.listeners.size)void refreshComponentFavorites(id).catch(()=>{});else publish(watch,{loaded:false});}
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('apps-favorites-changed',{detail:{sessionId,favorites:value.favorites}}));
    return value;
  });
  favoriteWriteTail=operation.catch(()=>{});
  favoriteWrites.set(componentId,operation);
  try{return await operation;}finally{if(favoriteWrites.get(componentId)===operation)favoriteWrites.delete(componentId);}
}
export function FavoriteStar({filled=false}:{filled?:boolean}){return <svg viewBox="0 0 24 24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9Z"/></svg>;}
export function SavedComponentFavoriteAction(props:{sessionId:string;componentId:string;title:string}){return <SavedFavoriteAction key={`${props.sessionId}:${props.componentId}`} {...props}/>;}
function SavedFavoriteAction({sessionId,componentId,title}:{sessionId:string;componentId:string;title:string}){
  const favorites=useComponentFavorites(sessionId),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),live=useRef(true),inFlight=useRef(false),favorite=favorites.favorites.some(row=>row.componentId===componentId);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const toggle=async()=>{if(inFlight.current||!favorites.loaded)return;inFlight.current=true;setBusy(true);setNotice('');try{await setComponentFavorite(sessionId,componentId,!favorite);if(live.current)setNotice(favorite?'已取消收藏，组件仍然保留。':'已收入收藏，随时可再访。');}catch(error){if(live.current)setNotice(error instanceof Error?error.message:String(error));}finally{inFlight.current=false;if(live.current)setBusy(false);}};
  return <div className="apps-favorite-action"><style>{SESSION_HUB_STYLES}</style><button type="button" className={`apps-favorite-button${favorite?' is-favorite':''}`} aria-label={`${favorite?'取消收藏':'收藏'}${title}`} aria-pressed={favorite} title={favorite?'取消收藏，组件仍会保留':'加入我的收藏，随时可以打开'} disabled={busy||!favorites.loaded} onClick={()=>void toggle()}><FavoriteStar filled={favorite}/>{busy?'正在更新…':favorite?'已收藏':'收藏'}</button>{notice?<span className="apps-favorite-message" role="status">{notice}</span>:null}{favorites.error&&!favorites.loaded?<button type="button" className="apps-hub-quiet-link" onClick={()=>void favorites.refresh().catch(()=>{})}>重新读取收藏</button>:null}</div>;
}
function FriendlyRecovery({recovery,onError}:{recovery:ReturnType<typeof usePresentationRecovery>;onError:(message:string)=>void}){return recovery.pending?<div className="apps-favorite-recovery" role="status"><p>刚才的操作还在确认中，请稍候。</p><button type="button" disabled={recovery.inspecting} onClick={()=>void recovery.inspect().then(known=>{if(!known)onError('结果仍在确认中，已有内容会继续保留。');}).catch(error=>onError(error instanceof Error?error.message:String(error)))}>{recovery.inspecting?'正在确认…':'查看操作结果'}</button></div>:null;}

export interface CurrentComponentFavoriteActionProps {sessionId:string;view:AppsView;compact?:boolean}
/** Key the recovery scope so a late save never starts a favorite write for a different view/chat. */
export function CurrentComponentFavoriteAction(props:CurrentComponentFavoriteActionProps){return <ComponentFavoriteAction key={`${props.sessionId}:${props.view.viewId}`} {...props}/>;}
function ComponentFavoriteAction({sessionId,view,compact=false}:CurrentComponentFavoriteActionProps){
  const favorites=useComponentFavorites(sessionId),recovery=usePresentationRecovery(),[current,setCurrent]=useState(view),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[savedToFavorite,setSavedToFavorite]=useState<AppsComponent>();
  const live=useRef(true),latest=useRef(current),inFlight=useRef(false),favoriteFlight=useRef(false);latest.current=current;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{setCurrent(previous=>(view.viewRevision??0)>=(previous.viewRevision??0)?view:previous);},[view]);
  const componentId=current.sourceComponentId??savedToFavorite?.componentId,favorite=!!componentId&&favorites.favorites.some(row=>row.componentId===componentId),saveable=canFavoriteCurrentView(current,sessionId);
  const apply=async(id:string,selected:boolean)=>{
    if(favoriteFlight.current||!live.current)return;favoriteFlight.current=true;setBusy(true);
    try{await setComponentFavorite(sessionId,id,selected);if(live.current){setSavedToFavorite(undefined);setNotice(selected?'已收入收藏，随时可再访。':'已取消收藏，组件仍然保留。');}}
    catch(error){if(live.current)setNotice(error instanceof Error?error.message:String(error));}
    finally{favoriteFlight.current=false;if(live.current)setBusy(false);}
  };
  const toggle=async()=>{
    if(inFlight.current||favoriteFlight.current||recovery.pending||!favorites.loaded||(!favorite&&!saveable))return;
    inFlight.current=true;setNotice('');
    try{
      if(favorite&&componentId){await apply(componentId,false);return;}
      if(savedToFavorite){await apply(savedToFavorite.componentId,true);return;}
      setSaving(true);
      await recovery.run<AppsComponent>(sessionId,'apps.authoring.save_component',{viewId:current.viewId,expectedViewRevision:current.viewRevision!,userRequest:`保存当前组件“${current.title}”并加入我的收藏`,title:current.title,mode:current.sourceComponentId?'update':'save_as',...(current.sourceComponentId?{componentId:current.sourceComponentId,expectedRevision:current.baseRevision??current.baseRevisionAtOpen!}:{})},saved=>{
        window.dispatchEvent(new CustomEvent('apps-library-changed',{detail:{sessionId,viewId:saved.view.viewId,component:saved}}));
        if(!live.current)return;
        const observed=latest.current,newer=(observed.viewRevision??0)>(saved.view.viewRevision??0)||(observed.authoringEpoch??0)>(saved.view.authoringEpoch??0),next=newer?{...observed,sourceComponentId:saved.view.sourceComponentId,baseRevision:saved.view.baseRevision,baseRevisionAtOpen:saved.view.baseRevisionAtOpen,selectedSourceRevision:saved.view.selectedSourceRevision}:{...saved.view,authoringState:saved.view.authoringState??observed.authoringState,authoringUpdatedAt:saved.view.authoringUpdatedAt??observed.authoringUpdatedAt,authoringEpoch:saved.view.authoringEpoch??observed.authoringEpoch};
        setCurrent(next);updateOwnedAppsView(next);setSavedToFavorite(saved);void apply(saved.componentId,true);
      });
    }catch(error){if(live.current)setNotice(error instanceof Error?error.message:String(error));}
    finally{inFlight.current=false;if(live.current)setSaving(false);}
  };
  const waiting=!favorite&&!saveable,disabled=busy||saving||!!recovery.pending||!favorites.loaded||waiting,description=waiting?'待预览确认后，便可收入收藏。':favorite?'取消收藏，组件仍会保留':'保存当前版本并收藏，以后随时打开';
  return <div className={`apps-favorite-action${notice||recovery.pending?' has-message':''}`}><style>{SESSION_HUB_STYLES}</style><button type="button" className={`apps-favorite-button${compact?' is-compact':''}${favorite?' is-favorite':''}`} aria-label={`${favorite?'取消收藏':'收藏'}${current.title}`} aria-pressed={favorite} disabled={disabled} title={description} onClick={()=>void toggle()}><FavoriteStar filled={favorite}/>{compact?null:saving?'正在保存…':busy?'正在收藏…':favorite?'已收藏':savedToFavorite?'重试收藏':'收藏'}</button>{waiting&&!compact?<span className="apps-favorite-message">{description}</span>:null}{favorites.error&&!favorites.loaded?<button type="button" className="apps-hub-quiet-link" onClick={()=>void favorites.refresh().catch(()=>{})}>重新读取收藏</button>:null}{notice?<span className="apps-favorite-message" role="status">{notice}</span>:null}<FriendlyRecovery recovery={recovery} onError={setNotice}/></div>;
}

export interface AppsFavoritesHubProps {sessionId:string;onOpenView:(view:AppsView)=>void;onOpenLibrary?:()=>void}
export function AppsFavoritesHub(props:AppsFavoritesHubProps){return <FavoritesHub key={props.sessionId} {...props}/>;}
function FavoritesHub({sessionId,onOpenView,onOpenLibrary}:AppsFavoritesHubProps){
  const favorites=useComponentFavorites(sessionId),recovery=usePresentationRecovery(),[query,setQuery]=useState(''),[notice,setNotice]=useState(''),[opening,setOpening]=useState<string>(),[removing,setRemoving]=useState<string>();
  const owner=useRef(sessionId),mounted=useRef(true),inFlight=useRef(false),removeFlight=useRef(false);owner.current=sessionId;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setQuery('');setNotice('');setOpening(undefined);setRemoving(undefined);},[sessionId]);
  const matches=(title:string)=>title.normalize('NFKC').toLocaleLowerCase().includes(query.trim().normalize('NFKC').toLocaleLowerCase()),items=favorites.favorites.filter(row=>matches(row.title));
  const open=async(component:ComponentFavorite)=>{
    if(inFlight.current||recovery.pending||!component.available)return;const target=sessionId;inFlight.current=true;setOpening(component.componentId);setNotice('');
    try{await recovery.run<AppsView>(target,'apps.presentation.open_component',{componentId:component.componentId,revision:component.revision},view=>{if(mounted.current&&owner.current===target){updateOwnedAppsView(view);onOpenView(view);}});}
    catch(error){if(mounted.current&&owner.current===target)setNotice(error instanceof Error?error.message:String(error));}
    finally{inFlight.current=false;if(mounted.current&&owner.current===target)setOpening(undefined);}
  };
  const remove=async(component:ComponentFavorite)=>{if(removeFlight.current)return;const target=sessionId;removeFlight.current=true;setRemoving(component.componentId);setNotice('');try{await setComponentFavorite(target,component.componentId,false);if(mounted.current&&owner.current===target)setNotice('已取消收藏，组件仍然保留。');}catch(error){if(mounted.current&&owner.current===target)setNotice(error instanceof Error?error.message:String(error));}finally{removeFlight.current=false;if(mounted.current&&owner.current===target)setRemoving(undefined);}};
  return <section className="apps-favorites-hub" aria-label="我的收藏组件" aria-busy={favorites.loading}><style>{SESSION_HUB_STYLES}</style><header className="apps-hub-heading"><div><h2>我的收藏</h2><p>点亮星标的组件，随时可以再访。</p></div></header>
    {favorites.favorites.length?<label className="apps-hub-search"><AppsIcon name="search"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="找一找收藏的组件" aria-label="搜索我的收藏"/></label>:null}
    {favorites.error?<div className="apps-hub-notice" role="status">收藏暂未更新，已有内容仍然保留。<button type="button" className="apps-hub-quiet-link" onClick={()=>void favorites.refresh().catch(()=>{})}>再试一次</button></div>:null}{notice?<p className="apps-hub-notice" role="status">{notice}</p>:null}<FriendlyRecovery recovery={recovery} onError={setNotice}/>
    {!favorites.loaded&&favorites.loading?<div className="apps-hub-empty" role="status"><h3>请稍候，正在整理收藏</h3><div className="apps-hub-loading-line"/><div className="apps-hub-loading-line"/></div>:items.length?<div className="apps-hub-list">{items.map(component=><article className="apps-hub-row" key={component.componentId} data-favorite-id={component.componentId}><button type="button" className="apps-hub-row-open" disabled={!!opening||!!recovery.pending||!component.available} aria-label={`打开收藏组件${component.title}`} onClick={()=>void open(component)}><span className="apps-hub-row-mark"><AppsIcon name="component"/></span><span className="apps-hub-row-title"><strong>{component.title}</strong><small>{opening===component.componentId?'请稍候，正在打开…':component.available?'在独立标签中打开':'暂时无法打开，收藏仍然保留'}</small></span><AppsIcon name="chevron"/></button><button type="button" className="apps-favorite-button is-compact is-favorite" aria-label={`取消收藏${component.title}`} title="取消收藏，组件仍会保留" aria-pressed={true} disabled={!!removing} onClick={()=>void remove(component)}><FavoriteStar filled/></button></article>)}</div>:!favorites.error?<div className="apps-hub-empty"><FavoriteStar/><h3>{query?'暂未找到':'留一颗星，下次再见'}</h3><p>{query?'换个关键词，或清空搜索再看看。':'在组件旁点亮星标，便可将它收藏于此。'}</p>{query?<button type="button" className="apps-hub-secondary" onClick={()=>setQuery('')}>清空搜索</button>:onOpenLibrary?<button type="button" className="apps-hub-secondary" onClick={onOpenLibrary}>去素材库看看</button>:null}</div>:null}
    {favorites.favorites.length&&onOpenLibrary?<p className="apps-hub-footnote"><button type="button" className="apps-hub-quiet-link" onClick={onOpenLibrary}>浏览素材库 <span aria-hidden="true">↗</span></button></p>:null}
  </section>;
}
