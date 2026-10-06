import type { ToolResult } from '../../contracts/src/index.ts';
import type { ViewSpec } from '../../presentation/src/types.ts';
import type { CorePresentation, CoreStore } from './types.ts';
import { readOperationReceipt } from './receipt.ts';
import type { BindingData } from '../../presentation/src/types.ts';

export interface SessionViewSummary {
  viewId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  state: 'ready' | 'expired';
}
export interface SessionViewList { sessionId: string; views: SessionViewSummary[] }
export type SessionViewChange = {action:'rename';title:string}|{action:'remove'};
export interface SessionViewChangeResult {sessionId:string;viewId:string;action:'rename'|'remove';title?:string}
interface OwnedView {
  sessionId: string;
  viewId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  widgetTypes: string[];
  removed?: boolean;
}
export class SessionViewError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name='SessionViewError'; this.code=code; }
}

/** Draft ownership survives service restarts independently of the explicitly saved component catalog. */
export class SessionViewRegistry {
  #presentation: CorePresentation;
  #store: CoreStore;
  #views = new Map<string, OwnedView>();
  constructor(presentation: CorePresentation,store: CoreStore) {
    this.#presentation=presentation;this.#store=store;
    for(const row of store.list<{kind?:string;owner?:OwnedView}>('views'))if(['source-owner','component-owner'].includes(row.kind??'')&&row.owner)this.#views.set(row.owner.viewId,row.owner);
  }
  private persistSourceOwner(viewId:string):void {
    const owner=this.#views.get(viewId);
    if(owner)this.#store.put('views',`owner:${viewId}`,{kind:'component-owner',owner});
  }

  /** Run before rendering any caller-chosen ID, so a foreign or unowned existing view is never overwritten. */
  assertCanRender(sessionId: string, viewId: unknown): void {
    if (typeof viewId!=='string' || !viewId.trim()) return; // Presentation validates malformed specs.
    const owned=this.#views.get(viewId);
    if (owned && owned.sessionId!==sessionId) throw new SessionViewError('VIEW_NOT_OWNED','该组件不属于当前会话。');
    if (!owned && this.#presentation.getView?.(viewId)) throw new SessionViewError('VIEW_NOT_OWNED','既有全局或历史组件没有本进程会话所有权，不能通过重新展示认领。');
    if (!this.#presentation.getView) throw new SessionViewError('VIEW_REGISTRY_UNAVAILABLE','展示后端没有可核实的组件读取接口。');
  }

  /** Existing shared global designs remain shareable, but a known foreign temporary view cannot be saved by guessing its ID. */
  assertNotForeign(sessionId: string, viewId: string): void {
    const owned=this.#views.get(viewId);
    if (owned && owned.sessionId!==sessionId) throw new SessionViewError('VIEW_NOT_OWNED','该临时组件不属于当前会话，不能跨会话保存。');
    if (owned?.removed) throw new SessionViewError('VIEW_NOT_FOUND','组件已从本会话移除，请重新创建或从组件库打开。');
  }

  /** Only successful trusted render/update results enter this index; no Spec or entries are persisted here. */
  recordSuccess(sessionId: string, view: ViewSpec): void {
    const existing=this.#views.get(view.id);
    if (existing && existing.sessionId!==sessionId) throw new SessionViewError('VIEW_NOT_OWNED','该组件不属于当前会话。');
    const actual=this.#presentation.getView?.(view.id);
    if (!actual || actual.id!==view.id) throw new SessionViewError('VIEW_NOT_FOUND','展示成功结果没有对应的实际组件。');
    const timestamp=new Date().toISOString();
    this.#views.set(view.id,{sessionId,viewId:view.id,title:actual.title,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,widgetTypes:actual.widgets.map(widget=>widget.type)});
    this.persistSourceOwner(view.id);
  }

  requireOwnedView(sessionId: string, viewId: string): ViewSpec {
    const owned=this.#views.get(viewId);
    if (!owned || owned.sessionId!==sessionId) throw new SessionViewError('VIEW_NOT_OWNED','仅本会话成功生成的组件可在会话展示中修改。');
    if (owned.removed) throw new SessionViewError('VIEW_NOT_FOUND','组件已从本会话移除。');
    const actual=this.#presentation.getView?.(viewId);
    if (!actual || actual.id!==viewId) throw new SessionViewError('VIEW_NOT_FOUND','会话临时组件已过期。');
    return actual;
  }

  manage(sessionId:string,viewId:string,change:SessionViewChange):SessionViewChangeResult {
    const owned=this.#views.get(viewId);
    if(!owned||owned.sessionId!==sessionId||owned.removed)throw new SessionViewError('VIEW_NOT_OWNED','此组件不在本会话列表中。');
    if(!change||typeof change!=='object'||!['rename','remove'].includes(change.action)||Object.keys(change).some(key=>!['action',...(change.action==='rename'?['title']:[])].includes(key)))throw new SessionViewError('INVALID_INPUT','仅支持重命名或从本会话移除。');
    if(change.action==='remove') {
      // Retain the owner tombstone: removing the listing must never make a private ID globally claimable.
      // Saved components, templates, snapshots and source data are deliberately untouched.
      owned.removed=true;
      this.persistSourceOwner(viewId);
      return {sessionId,viewId,action:'remove'};
    }
    if(typeof change.title!=='string'||!change.title.trim()||change.title.trim().length>200)throw new SessionViewError('INVALID_INPUT','名称需要 1–200 个字符。');
    const current=this.requireOwnedView(sessionId,viewId);this.assertCanReadSpec(sessionId,current);
    const updated=this.#presentation.updateView(viewId,[{op:'replace',path:'/title',value:change.title.trim()}]);
    this.recordSuccess(sessionId,updated);
    return {sessionId,viewId,action:'rename',title:updated.title};
  }

  /** Shared saved designs may be opened elsewhere; private operation bindings may not. */
  assertCanReadSpec(sessionId:string, spec:ViewSpec):void {
    for(const binding of spec.bindings){
      if(!binding.datasetKey?.startsWith('operation:'))continue;
      const receipt=readOperationReceipt(this.#store,binding.datasetKey.slice(10));
      if(!receipt||receipt.sessionId!==sessionId)throw new SessionViewError('VIEW_NOT_OWNED','组件引用了不属于当前会话的操作记录。');
    }
  }

  list(sessionId: string): SessionViewList {
    const views:SessionViewSummary[]=[];
    for (const owned of this.#views.values()) {
      if (owned.sessionId!==sessionId||owned.removed) continue;
      const present=this.#presentation.getView?.(owned.viewId);
      const actual=present?.id===owned.viewId?this.get(sessionId,owned.viewId):undefined;
      const ready=Boolean(actual);
      views.push({viewId:owned.viewId,title:ready?actual!.title:present?'组件不可用':owned.title,createdAt:owned.createdAt,updatedAt:owned.updatedAt,state:ready?'ready':'expired'});
    }
    return {sessionId,views};
  }

  get(sessionId: string, viewId: string): ViewSpec|undefined {
    const owned=this.#views.get(viewId);
    if (!owned || owned.sessionId!==sessionId || owned.removed) return undefined;
    const actual=this.#presentation.getView?.(viewId);
    if(actual?.id!==viewId)return undefined;
    // Cached scope is not authority: check the actual ledger before returning even the Spec/title.
    try {this.assertCanReadSpec(sessionId,actual);}catch{return undefined;}
    return actual;
  }

  getData(sessionId: string, viewId: string): ToolResult|undefined {
    const view=this.get(sessionId,viewId);if(!view)return undefined;
    const receipts=new Map<string,BindingData>();
    try {for(const binding of view.bindings){
      if(!binding.datasetKey?.startsWith('operation:'))continue;
      const receipt=readOperationReceipt(this.#store,binding.datasetKey.slice(10));if(!receipt||receipt.sessionId!==sessionId)return undefined;
      receipts.set(binding.id,{bindingId:binding.id,datasetKey:receipt.datasetKey,payload:receipt.payload,...(receipt.dataTime?{dataTime:receipt.dataTime}:{}),state:'ready',lastError:null,provenance:{...receipt.provenance,timeBasis:receipt.timeBasis,recordUpdatedAt:receipt.recordUpdatedAt},metricBasis:receipt.metricBasis});
    }}catch{return undefined;}
    const result=this.#presentation.getViewData?.(viewId);if(!receipts.size||!result)return result;
    const data=result.data as {viewId:string;bindings:BindingData[];missing:string[]}|undefined;
    if(!data||!Array.isArray(data.bindings)||!Array.isArray(data.missing))return {status:'failed',error:{code:'VIEW_DATA_INVALID',message:'本地组件数据接口不可用。',retryable:false}};
    const byId=new Map(data.bindings.map(binding=>[binding.bindingId,binding]));for(const [id,binding] of receipts)byId.set(id,binding);
    const missing=data.missing.filter(id=>!receipts.has(id));
    const bindings=view.bindings.map(binding=>byId.get(binding.id)).filter((binding):binding is BindingData=>Boolean(binding));
    const rest={...result};delete rest.error;
    return {...rest,status:missing.length?bindings.length?'partial':'failed':'ok',data:{...data,bindings,missing},...(missing.length?{error:{code:'SNAPSHOT_EMPTY',message:`No successful snapshot for: ${missing.join(', ')}`,retryable:false}}:{})};
  }
}
