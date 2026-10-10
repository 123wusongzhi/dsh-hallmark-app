import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { COMPONENTS_SIDEBAR_DEFINITION, COMPONENTS_SIDEBAR_ID } from './sidebar-contract.ts';
import type { NativeSidebarRegistry, NativeSidebarRight } from './sidebar-contract.ts';
import { mainSessionSelection } from './session-selection.ts';
import type { SessionSnapshot } from './session-selection.ts';
import { selectionInputBridge } from './selection.ts';
import { nativeAttachmentRuntime, nativeSessionDisabledReason } from './selection-native.ts';
import type { NativeAttachmentRuntime, NativeInputActions, NativeInputState } from './selection-native.ts';
import { chatEntryIntent } from './chat-entry.ts';
import { nativeDraftBridge } from './native-draft.ts';
import {configureComponentHandlers} from './component-handlers.ts';
import type {ComponentHandlerFactory} from './component-handlers.ts';
export interface ClientLayout {selectPanel:(id:string|null)=>void}
export interface ClientUIWorkspace {openSession:(sessionId:string)=>void}
export interface ClientContext {
  get:(name:string)=>unknown;
  inject?:(services:string[],effect:(ctx:ClientContext)=>void|(()=>void))=>unknown;
  effect?:(factory:()=>()=>void)=>unknown;
  slots:{register:(options:{name:string;id?:string;key?:string;order?:number;label?:string},component:ComponentType<any>)=>()=>void;inject:(name:string,effect:()=> (()=>void)|Iterable<()=>void>)=>unknown};
}
/** The always-mounted root entry observes the host's exact Session; workspace display retains only that target. */
function observeNativeInputTarget(Component:ComponentType<any>,workspace:ClientUIWorkspace|undefined,runtime:NativeAttachmentRuntime|undefined,Observer?:ComponentType<any>):ComponentType<any>{
  return function NativeInputTarget(props:{useSessions?:(selector:(state:SessionSnapshot)=>string|undefined)=>string|undefined;usePanelInfo?:(selector:(state:{activePanelId:string|null})=>string|null)=>string|null}){
    const panel=props.usePanelInfo?.(state=>state.activePanelId)??null;
    const current=props.useSessions?.(snapshot=>mainSessionSelection.observe(snapshot,panel));
    useEffect(()=>{selectionInputBridge.observeSession(current);chatEntryIntent.observeSession(current);nativeDraftBridge.observeSession(current);},[current]);
    useEffect(()=>{selectionInputBridge.attachmentRuntime(runtime);return()=>selectionInputBridge.attachmentRuntime(undefined);},[runtime]);
    useEffect(()=>{selectionInputBridge.navigation(workspace?sessionId=>workspace.openSession(sessionId):undefined);return()=>{selectionInputBridge.navigation(undefined);selectionInputBridge.observeSession(undefined);chatEntryIntent.reset();nativeDraftBridge.reset();};},[workspace]);
    return React.createElement(React.Fragment,null,React.createElement(Component,props),Observer?React.createElement(Observer,props):null);
  };
}
/** Session-standard inputActions comes from uiSession.provide, not from DOM or a private editor service. */
const emptyBlockStore={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
function bindNativeInput(Component:ComponentType<any>,sidebar:NativeSidebarRight|undefined,runtime:NativeAttachmentRuntime|undefined,Observer?:ComponentType<any>):ComponentType<any>{
  return function NativeSelectionInput(props:{sessionId?:string;inputActions?:NativeInputActions;useInput?:(selector:(state:NativeInputState)=>NativeInputState)=>NativeInputState|undefined;useSession?:(selector:(state:{removed?:boolean;subagent?:unknown})=>string|undefined)=>string|undefined}){
    const input=props.useInput?.(state=>state);
    const sessionReason=props.useSession?props.useSession(nativeSessionDisabledReason):'无法核实原聊天状态，请重新打开聊天。';
    const blockStore=useMemo(()=>props.sessionId&&runtime?runtime.blocks.storeFor(props.sessionId):emptyBlockStore,[props.sessionId,runtime]);
    const block=useSyncExternalStore(blockStore.subscribe,blockStore.getSnapshot,blockStore.getSnapshot);
    const live=useRef({input,sessionReason});live.current={input,sessionReason};
    useSyncExternalStore(selectionInputBridge.subscribe,selectionInputBridge.getSnapshot,selectionInputBridge.getSnapshot);
    useSyncExternalStore(nativeDraftBridge.subscribe,nativeDraftBridge.getSnapshot,nativeDraftBridge.getSnapshot);
    const chatEntryRevision=useSyncExternalStore(chatEntryIntent.subscribe,chatEntryIntent.getSnapshot,chatEntryIntent.getSnapshot);
    useEffect(()=>props.sessionId?selectionInputBridge.bind(props.sessionId,props.inputActions?{actions:props.inputActions,readState:()=>live.current.input,disabledReason:()=>live.current.sessionReason??blockStore.getSnapshot()?.reason}:undefined):undefined,[props.sessionId,props.inputActions,input?.phase,sessionReason,block,blockStore]);
    useEffect(()=>props.sessionId?nativeDraftBridge.bind(props.sessionId,props.inputActions?{actions:props.inputActions,readState:()=>live.current.input,disabledReason:()=>live.current.sessionReason??blockStore.getSnapshot()?.reason}:undefined):undefined,[props.sessionId,props.inputActions,input?.phase,sessionReason,block,blockStore]);
    useEffect(()=>chatEntryIntent.inputCommitted(props.sessionId,sidebar),[props.sessionId,sidebar,chatEntryRevision]);
    const notice=props.sessionId?selectionInputBridge.notice(props.sessionId):undefined;
    const entryNotice=props.sessionId?chatEntryIntent.notice(props.sessionId):undefined;
    const draftNotice=props.sessionId?nativeDraftBridge.notice(props.sessionId):undefined;
    return React.createElement(React.Fragment,null,React.createElement(Component,props),Observer?React.createElement(Observer,{sessionId:props.sessionId,input,disabledReason:sessionReason??block?.reason}):null,entryNotice?React.createElement('span',{className:'hm-root hm-button-notice',role:'status'},entryNotice):null,notice?React.createElement('span',{className:'hm-root hm-button-notice',role:'status'},notice):null,draftNotice?React.createElement('span',{className:'hm-root hm-button-notice',role:'status'},draftNotice):null);
  };
}
/** Every injection returns cleanup, including stage-one tab registry ownership. */
export function createClientPlugin(components:{sidebarIcon:ComponentType<any>;runtimeObserver?:(sidebar:NativeSidebarRight|undefined)=>ComponentType<any>;main:(layout:ClientLayout|undefined,workspace:ClientUIWorkspace|undefined,sidebar?:NativeSidebarRight)=>ComponentType<any>;toolview:ComponentType<any>;toolviewForSidebar?:(sidebar:NativeSidebarRight|undefined)=>ComponentType<any>;toolKeys?:readonly string[];toolviewForKey?:(key:string,sidebar:NativeSidebarRight|undefined)=>ComponentType<any>;componentHandlers?:ComponentHandlerFactory;nativeInput?:{register(ctx:ClientContext):()=>void;observer:ComponentType<any>};sidebar?:{body:(layout:ClientLayout|undefined,sidebar:NativeSidebarRight|undefined)=>ComponentType<any>;title:ComponentType<any>;input:(sidebar:NativeSidebarRight|undefined)=>ComponentType<any>}}){
  return {name:'dsh-plugin-hallmark-client',inject:['slots','layout','uiWorkspace','conversation',...(components.sidebar?['sidebarRightTabs','sidebarRight']:[])],apply(ctx:ClientContext){
    const layout=ctx.get('layout') as ClientLayout|undefined;const workspace=ctx.get('uiWorkspace') as ClientUIWorkspace|undefined;
    const sidebar=(components.sidebar||components.toolviewForSidebar||components.runtimeObserver?ctx.get('sidebarRight'):undefined) as NativeSidebarRight|undefined;
    const registry=(components.sidebar?ctx.get('sidebarRightTabs'):undefined) as NativeSidebarRegistry|undefined;
    const runtime=nativeAttachmentRuntime(ctx.get('conversation'));
    if(components.nativeInput)ctx.slots.inject('conversation.input.left',()=>components.nativeInput!.register(ctx));
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'hallmark-apps',order:10,label:'应用'},observeNativeInputTarget(components.sidebarIcon,workspace,runtime,components.runtimeObserver?.(sidebar))));
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'hallmark-apps'},components.main(layout,workspace,sidebar)));
    const toolview=components.toolviewForSidebar?.(sidebar)??components.toolview;
    ctx.slots.inject('tool.call.toolview',()=>[
      ...(components.componentHandlers?[configureComponentHandlers(components.componentHandlers)]:[]),
      ...(components.toolKeys??['hallmark_render_view','hallmark_update_view','hallmark_open_component','hallmark_open_source_component']).map(key=>ctx.slots.register({name:'tool.call.toolview',key},components.toolviewForKey?.(key,sidebar)??toolview)),
    ]);
    if(components.sidebar&&registry&&typeof registry.register==='function'&&sidebar){
      const contribution=components.sidebar;
      ctx.slots.inject('sidebar.right.pane.tab',()=>[
        registry.register(COMPONENTS_SIDEBAR_DEFINITION),
        ctx.slots.register({name:'sidebar.right.pane.tab',key:COMPONENTS_SIDEBAR_ID},contribution.body(layout,sidebar)),
      ]);
      ctx.slots.inject('sidebar.right.pane.tab.title',()=>ctx.slots.register({name:'sidebar.right.pane.tab.title',key:COMPONENTS_SIDEBAR_ID},contribution.title));
      ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'hallmark-session-components',order:30,label:'本会话组件'},bindNativeInput(contribution.input(sidebar),sidebar,runtime,components.nativeInput?.observer)));
    }
  }};
}
