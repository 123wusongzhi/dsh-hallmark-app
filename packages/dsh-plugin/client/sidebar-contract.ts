// Exact public subset: official 0.2.0-rc.2 SDK, independently matched to current ASAR JS.
// These reflection-provided faces are not catalogued by the Generic Service Inspector.
export const COMPONENTS_SIDEBAR_KIND='hallmark-components';
export const COMPONENTS_SIDEBAR_ID='dsh-plugin-hallmark/session-components';
export interface SidebarNavigationParams {viewId?:string;publicationId?:string;displayId?:string}
export interface NativeSidebarRight {
  mounted:{getSnapshot:()=>string|undefined;subscribe?:(listener:()=>void)=>()=>void};
  openTab:(kind:string,options?:{params?:SidebarNavigationParams})=>void;
}
export interface NativeSidebarDefinition {
  id:string;kind:string;title:(address:string)=>string;keepMounted?:boolean;
  guide?:{id:string;order:number;title:()=>string;description?:()=>string}[];
}
export interface NativeSidebarRegistry {register:(definition:NativeSidebarDefinition)=>()=>void}
export interface NativeSidebarTabInfo {tab:{navigation:{params:unknown;revision:number};signal:AbortSignal;visible:boolean;actions:{openTab:(kind:string,options?:{params?:SidebarNavigationParams})=>void;bindCommands?:(commands:{refresh?:()=>void})=>()=>void}}}
export interface NativeSidebarProps {sessionId?:string;useTabInfo?:()=>NativeSidebarTabInfo}
export const COMPONENTS_SIDEBAR_DEFINITION:NativeSidebarDefinition={id:COMPONENTS_SIDEBAR_ID,kind:COMPONENTS_SIDEBAR_KIND,title:()=> '组件',keepMounted:true,guide:[{id:'session-components',order:40,title:()=> '本次会话',description:()=> '查看正在制作的组件，或打开我的收藏。'}]};
/** The native boundary accepts JSON-shaped params by convention, so narrow them ourselves. */
export function readSidebarNavigation(params:unknown):{valid:boolean;viewId?:string;publicationId?:string;displayId?:string}{
  if(params===undefined)return {valid:true};
  if(!params||typeof params!=='object'||Array.isArray(params))return {valid:false};
  const prototype=Object.getPrototypeOf(params);if(prototype!==Object.prototype&&prototype!==null)return {valid:false};
  if(Object.getOwnPropertySymbols(params).length||Object.getOwnPropertyNames(params).some(key=>!['viewId','publicationId','displayId'].includes(key)))return {valid:false};
  const property=Object.getOwnPropertyDescriptor(params,'viewId'),publication=Object.getOwnPropertyDescriptor(params,'publicationId'),display=Object.getOwnPropertyDescriptor(params,'displayId');
  if(!property)return publication||display?{valid:false}:{valid:true};
  if(!('value' in property)||publication&&!('value' in publication)||display&&!('value' in display))return {valid:false};const viewId=property.value;
  if(typeof viewId!=='string'||!viewId.trim().length||viewId.length>4000)return {valid:false};
  if(publication&&(typeof publication.value!=='string'||!publication.value.trim().length||publication.value.length>4000))return {valid:false};
  if(display&&(!publication||typeof display.value!=='string'||!display.value.trim().length||display.value.length>4000))return {valid:false};
  return {valid:true,viewId,...(publication?{publicationId:publication.value}:{}),...(display?{displayId:display.value}:{})};
}
/** Global commands are legal only while this exact Session is the native on-screen owner. */
export function openSessionComponents(sidebar:NativeSidebarRight|undefined,sessionId:string|undefined,viewId?:string,publicationId?:string,displayId?:string):{ok:boolean;message?:string}{
  if(!sidebar?.mounted||typeof sidebar.mounted.getSnapshot!=='function'||typeof sidebar.openTab!=='function')return {ok:false,message:'原生侧栏服务尚未就绪。'};
  const params=viewId===undefined?(publicationId===undefined&&displayId===undefined?undefined:{publicationId,displayId}):{viewId,...(publicationId===undefined?{}:{publicationId}),...(displayId===undefined?{}:{displayId})};
  if(!readSidebarNavigation(params).valid)return {ok:false,message:'组件标识无效。'};
  try{if(!sessionId||sidebar.mounted.getSnapshot()!==sessionId)return {ok:false,message:'请先切回此会话，再在侧栏查看组件。'};sidebar.openTab(COMPONENTS_SIDEBAR_KIND,params===undefined?undefined:{params});return {ok:true};}
  catch{return {ok:false,message:'原生会话组件侧栏未就绪，请稍后重试。'};}
}
