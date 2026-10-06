import React from 'react';
import type { WorkspaceAction, WorkspaceState } from './workspace-tabs.ts';
import { AppIcon } from './icons.tsx';
export function workspaceDOMId(prefix:string,tabId:string,part:'tab'|'panel'):string{return `${prefix}-${part}-${encodeURIComponent(tabId)}`;}
export function WorkspaceDockTabs({state,onAction,idPrefix}:{state:WorkspaceState;onAction:(action:WorkspaceAction)=>void;idPrefix:string}){
  const focus=(id:string)=>queueMicrotask(()=>document.getElementById(workspaceDOMId(idPrefix,id,'tab'))?.focus());
  const close=(id:string)=>{const tab=state.tabs.find(item=>item.id===id);if(!tab||tab.pinned)return;onAction({type:'close',id});const destination=state.activeId===id?state.tabs.find(item=>item.kind==='workbench')?.id:state.activeId;if(destination)focus(destination);};
  return <div className="hm-workspace-dock"><div className="hm-dock-tablist" role="tablist" aria-label="工作区标签">{state.tabs.map((tab,index)=><div className="hm-dock-tab" key={tab.id} data-active={tab.id===state.activeId}>
    <button type="button" role="tab" id={workspaceDOMId(idPrefix,tab.id,'tab')} aria-controls={workspaceDOMId(idPrefix,tab.id,'panel')} aria-selected={tab.id===state.activeId} tabIndex={tab.id===state.activeId?0:-1} title={tab.pinned?'固定工作台标签':tab.title} onClick={()=>onAction({type:'activate',id:tab.id})} onKeyDown={event=>{
      if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?state.tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+state.tabs.length)%state.tabs.length;const target=state.tabs[next];onAction({type:'activate',id:target.id});focus(target.id);}
      else if(event.key==='Delete'&&!tab.pinned){event.preventDefault();close(tab.id);}
    }}><AppIcon name={tab.kind==='workbench'?'grid':tab.kind==='draft'?'plus':'layers'} size={15}/><span className="hm-dock-label">{tab.title}</span>{tab.kind==='draft'?<span className="hm-draft-tag">临时</span>:null}</button>
    {!tab.pinned?<button type="button" className="hm-tab-close" aria-label={`关闭 ${tab.title} 标签`} onClick={()=>close(tab.id)}><AppIcon name="close" size={13}/></button>:null}
  </div>)}</div><button type="button" className="hm-tab-add" aria-label="新建组件设计标签" title="新建临时组件设计，不自动保存" onClick={()=>onAction({type:'new-draft',appId:state.appId})}><AppIcon name="plus" size={17}/></button></div>;
}
