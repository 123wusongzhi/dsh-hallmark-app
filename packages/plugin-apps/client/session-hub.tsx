import React from 'react';
import type {AppsView} from '../../app-presentation/src/types.ts';
import {AppsIcon} from './ui.tsx';
import {CurrentComponentFavoriteAction} from './component-favorites.tsx';
import {SESSION_HUB_STYLES} from './session-hub-styles.ts';
import {sessionViewStatus} from './session-component-state.ts';
export {AppsFavoritesHub} from './component-favorites.tsx';
export {sessionViewStatus} from './session-component-state.ts';

export interface AppsSessionHubProps {sessionId:string;views:AppsView[];loading?:boolean;error?:string;onRetry:()=>void;onOpenView:(view:AppsView)=>void}
export function visibleSessionViews(sessionId:string,views:AppsView[]):AppsView[]{return views.filter(view=>view.ownerSessionId===sessionId&&view.panelState!=='closed').sort((a,b)=>(b.authoringUpdatedAt??b.updatedAt).localeCompare(a.authoringUpdatedAt??a.updatedAt));}
export function QuietComponentPreview(){return <div className="apps-hub-preview" aria-hidden="true"><div className="apps-hub-preview-bar"><i/><i/><i/></div>{[0,1,2].map(row=><div className="apps-hub-preview-row" key={row}><span/><div><i/><i/></div><b/></div>)}</div>;}
export function AppsSessionHub({sessionId,views,loading=false,error,onRetry,onOpenView}:AppsSessionHubProps){
  const items=visibleSessionViews(sessionId,views),featured=items.find(view=>sessionViewStatus(view).kind==='making')??items[0],others=items.filter(view=>view!==featured),status=featured?sessionViewStatus(featured):undefined;
  return <section className="apps-session-hub" aria-label="本次会话组件" aria-busy={loading}><style>{SESSION_HUB_STYLES}</style><header className="apps-hub-heading"><div><h2>本次会话</h2><p>与 Agent 一起制作的组件</p></div></header>
    {error?<div className="apps-hub-notice" role="status">{items.length?'暂未取得最新状态，已有组件仍为你保留。':'暂时无法读取会话组件。'}<button className="apps-hub-quiet-link" onClick={onRetry}>再试一次</button></div>:null}
    {featured&&status?<><h3 className="apps-hub-section-title">{status.kind==='making'?'正在制作':'最近的组件'}</h3><article className="apps-hub-feature" data-view-id={featured.viewId}><div className="apps-hub-feature-top"><div><span className={`apps-hub-status is-${status.kind}`}><i className="apps-hub-status-dot"/>{status.label}</span><h3>{featured.title}</h3></div><CurrentComponentFavoriteAction key={`${sessionId}:${featured.viewId}`} sessionId={sessionId} view={featured} compact/></div><QuietComponentPreview/><div className="apps-hub-feature-copy" role={status.kind==='making'?'status':undefined}><p className="apps-hub-poem">{status.heading}</p><p>{status.description}</p></div><div className="apps-hub-feature-footer"><button type="button" className="apps-hub-primary" onClick={()=>onOpenView(featured)}>打开组件<AppsIcon name="chevron"/></button><small>在独立标签中查看</small></div></article>
      {others.length?<><h3 className="apps-hub-section-title">其他临时组件 <span>{others.length}</span></h3><div className="apps-hub-list">{others.map(view=><article className="apps-hub-row" key={view.viewId} data-view-id={view.viewId}><button type="button" className="apps-hub-row-open" aria-label={`打开${view.title}`} onClick={()=>onOpenView(view)}><span className="apps-hub-row-mark"><AppsIcon name="component"/></span><span className="apps-hub-row-title"><strong>{view.title}</strong><small>{sessionViewStatus(view).label}</small></span><AppsIcon name="chevron"/></button><CurrentComponentFavoriteAction sessionId={sessionId} view={view} compact/></article>)}</div></>:null}<p className="apps-hub-footnote">临时组件随当前聊天保留 · 点亮星标，便可随时再访</p></>:loading?<div className="apps-hub-empty" role="status"><h3>请稍候，正在为你整理</h3><p>本次会话的组件即将呈现。</p><div className="apps-hub-loading-line"/><div className="apps-hub-loading-line"/></div>:!error?<div className="apps-hub-empty"><AppsIcon name="component"/><h3>此处，静候你的灵感</h3><p>在聊天中告诉 Agent 想做什么，<br/>新的组件就会出现在这里。</p></div>:null}
  </section>;
}
