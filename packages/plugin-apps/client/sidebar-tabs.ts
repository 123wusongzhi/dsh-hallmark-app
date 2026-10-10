import type {SidebarNavigationParams} from '../../dsh-plugin/client/sidebar-contract.ts';

export interface ComponentSidebarTab {id:string;title:string;params:SidebarNavigationParams&{viewId:string}}
export interface ComponentSidebarTabs {active:string;tabs:ComponentSidebarTab[]}
export const initialSidebarTabs=():ComponentSidebarTabs=>({active:'session',tabs:[]});
/** UI tabs never create, close or discard Runtime working copies. */
export function openComponentTab(state:ComponentSidebarTabs,params:SidebarNavigationParams&{viewId:string},title='组件'):ComponentSidebarTabs {
  const id=`view:${params.viewId}`,prior=state.tabs.find(tab=>tab.id===id);
  const tab={id,title:title==='组件'&&prior?prior.title:title,params:{...params}};
  return {active:id,tabs:prior?state.tabs.map(item=>item.id===id?tab:item):[...state.tabs,tab]};
}
export function closeComponentTab(state:ComponentSidebarTabs,id:string):ComponentSidebarTabs {
  if(!state.tabs.some(tab=>tab.id===id))return state;
  return {active:state.active===id?'session':state.active,tabs:state.tabs.filter(tab=>tab.id!==id)};
}
