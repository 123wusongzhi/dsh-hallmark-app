import { canStartChat } from './registry.ts';
export interface WorkspaceTab {id:string;appId:string;kind:'workbench'|'view'|'draft';title:string;pinned:boolean;viewId?:string;owned?:boolean;sessionId?:string}
export interface WorkspaceState {appId:string;tabs:WorkspaceTab[];activeId:string;draftSequence:number}
export type WorkspaceAction = {type:'open-view';appId:string;viewId:string;title:string;owned?:boolean;sessionId?:string;currentSessionId?:string}|{type:'new-draft';appId:string}|{type:'session-change';sessionId?:string}|{type:'activate';id:string}|{type:'close';id:string};
export function createWorkspaceState(appId='hallmark'):WorkspaceState {
  const id=`workbench:${appId}`;
  return {appId,tabs:canStartChat(appId)?[{id,appId,kind:'workbench',title:'工作台',pinned:true}]:[],activeId:canStartChat(appId)?id:'',draftSequence:0};
}
/** Pure display-only reducer: opening/switching/closing never performs a fetch or save. */
export function workspaceReducer(state:WorkspaceState,action:WorkspaceAction):WorkspaceState {
  if(!canStartChat(state.appId))return state;
  if(action.type==='open-view'){
    if(action.appId!==state.appId||!action.viewId.trim()||action.owned&&(!action.sessionId?.trim()||action.currentSessionId!==action.sessionId))return state;
    const existing=state.tabs.find(tab=>tab.kind==='view'&&tab.appId===action.appId&&tab.viewId===action.viewId&&!!tab.owned===!!action.owned&&(!action.owned||tab.sessionId===action.sessionId));
    if(existing)return {...state,activeId:existing.id,tabs:state.tabs.map(tab=>tab.id===existing.id?{...tab,title:action.title||tab.title}:tab)};
    const id=action.owned?`owned-view:${action.appId}:${encodeURIComponent(action.sessionId!)}:${encodeURIComponent(action.viewId)}`:`view:${action.appId}:${action.viewId}`;
    return {...state,activeId:id,tabs:[...state.tabs,{id,appId:action.appId,kind:'view',viewId:action.viewId,title:action.title||'组件',pinned:false,...(action.owned?{owned:true,sessionId:action.sessionId}:{})}]};
  }
  if(action.type==='new-draft'){
    if(action.appId!==state.appId)return state;
    const draftSequence=state.draftSequence+1;const id=`draft:${action.appId}:${draftSequence}`;
    return {...state,draftSequence,activeId:id,tabs:[...state.tabs,{id,appId:action.appId,kind:'draft',title:`新建组件 ${draftSequence}`,pinned:false}]};
  }
  if(action.type==='session-change'){const tabs=state.tabs.filter(tab=>!tab.owned||tab.sessionId===action.sessionId);if(tabs.length===state.tabs.length)return state;return {...state,tabs,activeId:tabs.some(tab=>tab.id===state.activeId)?state.activeId:tabs.find(tab=>tab.kind==='workbench')?.id??''};}
  if(action.type==='activate')return state.tabs.some(tab=>tab.id===action.id)?{...state,activeId:action.id}:state;
  const tab=state.tabs.find(tab=>tab.id===action.id);
  if(!tab||tab.pinned||tab.kind==='workbench')return state;
  return {...state,tabs:state.tabs.filter(item=>item.id!==action.id),activeId:state.activeId===action.id?state.tabs.find(item=>item.kind==='workbench')?.id??'':state.activeId};
}
