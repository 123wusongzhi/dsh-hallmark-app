import React, { useEffect, useState } from 'react';
import { toolViewId } from './model.ts';
import { EmptyView, LoadingView } from './renderer.tsx';
import { STYLES } from './styles.ts';
import { SnapshotView } from './snapshot.tsx';
import { ApplicationsSidebarIcon, AppRegistryPage } from './page.tsx';
import { createClientPlugin } from './plugin.ts';
import { SessionComponentsButton, SessionComponentsPane, SessionComponentsTitle } from './sidebar.tsx';
import { openSessionComponents } from './sidebar-contract.ts';
import type { NativeSidebarRight } from './sidebar-contract.ts';
import { ownedWorkspaceIntent } from './workspace-intent.ts';
import { chatEntryIntent } from './chat-entry.ts';
export { AppRegistryPage, ApplicationsSidebarIcon } from './page.tsx';
export { HallmarkWorkbench } from './workbench.tsx';
export { ComponentBuilder } from './builder.tsx';
export { WorkspaceDockTabs } from './workspace-dock.tsx';
export { SnapshotView } from './snapshot.tsx';
export { SessionComponentsButton, SessionComponentsPane, SessionComponentsTitle } from './sidebar.tsx';
export * from './model.ts';
export * from './renderer.tsx';
export function HallmarkToolView(props:{sessionId?:string;phase?:string;block?:{meta?:unknown};sidebarRight?:NativeSidebarRight}){
  const viewId=toolViewId(props);const [notice,setNotice]=useState('');
  useEffect(()=>{if(props.phase==='result'&&viewId&&props.sessionId)window.dispatchEvent(new CustomEvent('hallmark-view-updated',{detail:{sessionId:props.sessionId,viewId}}));},[props.phase,props.sessionId,viewId]);
  const open=()=>{const result=openSessionComponents(props.sidebarRight,props.sessionId,viewId);setNotice(result.ok?'':result.message??'侧栏不可用。');};
  return <div className="hm-root"><style>{STYLES}</style>{notice?<p role="status" className="hm-live">{notice}</p>:null}{props.phase!=='result'?<LoadingView/>:viewId&&props.sessionId?<SnapshotView sessionId={props.sessionId} viewId={viewId} owned onOpenSidebar={open}/>:<EmptyView message="此调用没有可展示的组件" detail="请查看原生文字结果；不会猜测工具结果内部结构。"/>}</div>;
}
// Original conversation remains native. The sidebar opens a registered page, never a replacement chat.
export default createClientPlugin({
  sidebarIcon:ApplicationsSidebarIcon,
  main:(_layout,workspace,sidebar)=>(props:any)=> <AppRegistryPage {...props} onReturn={workspace?(sessionId?:string)=>{if(sessionId)chatEntryIntent.enter(sessionId,()=>workspace.openSession(sessionId),sidebar);}:undefined}/>,
  toolview:HallmarkToolView,
  toolviewForSidebar:sidebarRight=>(props:any)=><HallmarkToolView {...props} sidebarRight={sidebarRight}/>,
  sidebar:{
    title:SessionComponentsTitle,
    input:sidebarRight=>(props:any)=><SessionComponentsButton {...props} sidebarRight={sidebarRight}/>,
    body:(layout,sidebarRight)=>(props:any)=><SessionComponentsPane {...props} onOpenWorkspace={view=>{if(!layout||!sidebarRight||sidebarRight.mounted.getSnapshot()!==view.sessionId)throw new Error('请先切回此会话，再在工作区打开组件。');ownedWorkspaceIntent.open(view);layout.selectPanel('hallmark-apps');}}/>,
  },
});
