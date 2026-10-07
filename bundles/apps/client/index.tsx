import React from 'react';
import {createClientPlugin} from '../../../packages/dsh-plugin/client/plugin.ts';
import {ApplicationsSidebarIcon} from '../../../packages/dsh-plugin/client/page.tsx';
import {HallmarkToolView} from '../../../packages/dsh-plugin/client/index.tsx';
import {SessionComponentsButton, SessionComponentsPane, SessionComponentsTitle} from '../../../packages/dsh-plugin/client/sidebar.tsx';
import {AppsWorkspace} from '../../../packages/plugin-apps/client/workspace.tsx';
import {AppsToolView} from '../../../packages/plugin-apps/client/view.tsx';
import {createAppsComponentHandlers} from '../../../packages/plugin-apps/client/component-handlers.ts';
import {ownedWorkspaceIntent} from '../../../packages/dsh-plugin/client/workspace-intent.ts';
import {chatEntryIntent} from '../../../packages/dsh-plugin/client/chat-entry.ts';
/** One registration owner for the Apps entry and the historical component/tool slots. */
export default createClientPlugin({
  sidebarIcon: ApplicationsSidebarIcon,
  main: (_layout,workspace,sidebar) => props => <AppsWorkspace {...props} onReturn={workspace ? sessionId => chatEntryIntent.enter(sessionId,() => workspace.openSession(sessionId),sidebar) : undefined}/>,
  toolview: HallmarkToolView,
  toolviewForSidebar: sidebarRight => props => <HallmarkToolView {...props} sidebarRight={sidebarRight}/>,
  toolKeys:['hallmark_render_view','hallmark_update_view','hallmark_open_component','hallmark_open_source_component','apps_invoke'],
  toolviewForKey:(key,sidebarRight)=>key==='apps_invoke'?props=><AppsToolView {...props} sidebarRight={sidebarRight}/>:props=><HallmarkToolView {...props} sidebarRight={sidebarRight}/>,
  componentHandlers:createAppsComponentHandlers,
  sidebar: {title: SessionComponentsTitle, input: sidebarRight => props => <SessionComponentsButton {...props} sidebarRight={sidebarRight}/>, body: (layout,sidebarRight) => props => <SessionComponentsPane {...props} onOpenWorkspace={view => {if (!layout||sidebarRight?.mounted.getSnapshot() !== view.sessionId) throw new Error('请先切回组件所属会话。');ownedWorkspaceIntent.open(view);layout.selectPanel('hallmark-apps');}}/>},
});
