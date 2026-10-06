import React, { useEffect, useId, useMemo, useState } from 'react';
import type { ComponentDraft, ViewSpec } from '../../presentation/src/types.ts';
import { HallmarkBridge } from './api.ts';
import type { Saved } from './api.ts';
import { ComponentBuilder } from './builder.tsx';
import type { DatasetSummary } from './builder.tsx';
import { draftFromTemplate } from './builder-model.ts';
import { ErrorView } from './renderer.tsx';
import { SnapshotView } from './snapshot.tsx';
import { STYLES } from './styles.ts';
import { MutationGate } from './mutation-gate.ts';
import type { OverviewDto } from '../../contracts/src/overview.ts';
import { AppIcon } from './icons.tsx';
import { DesignPreview, OverviewCards, StoreOverview } from './dashboard.tsx';
import { isSourceView } from './source-bridge.ts';
import { SourceDraftPanel } from './source-draft.tsx';
import { SourceThumbnail } from './source-thumbnail.tsx';
export type WorkbenchBridge=Pick<HallmarkBridge,'saved'|'templates'|'datasets'|'preview'|'viewData'|'saveComponent'|'saveTemplate'|'openEntry'|'manage'> & Partial<Pick<HallmarkBridge,'openComponent'|'openTemplate'|'overview'>>;
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'应用读取失败，请重试。';
export function HallmarkWorkbench({sessionId,bridge:provided,onBack,embedded=false,initialTab='common',onOpenView,onEnterChat}:{sessionId?:string;bridge?:WorkbenchBridge;onBack?:()=>void;embedded?:boolean;initialTab?:'common'|'saved'|'builder';onOpenView?:(view:{viewId:string;title:string})=>void;onEnterChat?:()=>void}){
  const prefix=useId();const reads=useMemo(()=>new MutationGate(),[]);
  const bridge=useMemo(()=>provided??new HallmarkBridge(sessionId??''),[provided,sessionId]);
  const [saved,setSaved]=useState<Saved|undefined>();const [templates,setTemplates]=useState<Awaited<ReturnType<HallmarkBridge['templates']>>>([]);const [datasets,setDatasets]=useState<DatasetSummary[]>([]);
  const [overviewRead,setOverviewRead]=useState<{bridge?:WorkbenchBridge;data?:OverviewDto;loading:boolean;error:string}>({loading:true,error:''});
  const overview=overviewRead.bridge===bridge?overviewRead.data:undefined;
  const overviewLoading=overviewRead.bridge!==bridge||overviewRead.loading;
  const overviewError=overviewRead.bridge===bridge?overviewRead.error:'';
  const [tab,setTab]=useState<'common'|'saved'|'builder'>(initialTab);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [version,setVersion]=useState(0);
  const [view,setView]=useState<ViewSpec|undefined>();const [initial,setInitial]=useState<ViewSpec|undefined>();const [builderKey,setBuilderKey]=useState(0);const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<ComponentDraft|undefined>();
  const [draftRevision,setDraftRevision]=useState<number|undefined>();
  const [manage,setManage]=useState<{id:string;kind:'component'|'entry'|'template';title:string;action:'rename'|'delete'}|undefined>();const [name,setName]=useState('');
  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();setLoading(true);setError('');
    Promise.all([bridge.saved(controller.signal),bridge.templates(controller.signal),bridge.datasets(controller.signal)]).then(([s,t,d])=>{if(!cancelled){setSaved(s);setTemplates(t);setDatasets(d);}}).catch(e=>{if(!cancelled)setError(errorMessage(e));}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;controller.abort();};
  },[bridge,version]);
  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();
    setOverviewRead(previous=>({bridge,data:previous.bridge===bridge?previous.data:undefined,loading:!!bridge.overview,error:''}));
    if(bridge.overview)Promise.resolve().then(()=>bridge.overview!(controller.signal)).then(data=>{
      if(!cancelled)setOverviewRead({bridge,data,loading:false,error:''});
    }).catch(e=>{
      if(!cancelled)setOverviewRead(previous=>({bridge,data:previous.bridge===bridge?previous.data:undefined,loading:false,error:errorMessage(e)}));
    });
    return()=>{cancelled=true;controller.abort();};
  },[bridge,version]);
  useEffect(()=>{const refresh=()=>setVersion(value=>value+1);window.addEventListener('hallmark:workspace-refresh',refresh);return()=>window.removeEventListener('hallmark:workspace-refresh',refresh);},[]);
  useEffect(()=>{setBusy(false);return()=>reads.reset();},[bridge,reads]);
  const load=async(id:string)=>{const ticket=reads.begin();setBusy(true);setError('');try{const opened=await bridge.openEntry(id,ticket.controller.signal);if(!reads.current(ticket))return;if(onOpenView)onOpenView({viewId:opened.id,title:opened.title});else setView(opened);}catch(e){if(reads.current(ticket))setError(errorMessage(e));}finally{if(reads.current(ticket))setBusy(false);}};
  const edit=(spec:ViewSpec)=>{setEditing(undefined);setDraftRevision(undefined);setInitial(spec);setBuilderKey(key=>key+1);setTab('builder');};
  const openDraft=async(componentId:string,revision?:number)=>{const ticket=reads.begin();setBusy(true);setError('');try{if(!bridge.openComponent)throw new Error('请更新服务后编辑已保存组件。');const draft=await bridge.openComponent(componentId,ticket.controller.signal,{revision});if(!reads.current(ticket))return;setEditing(draft);setDraftRevision(revision);setInitial(undefined);setBuilderKey(key=>key+1);setTab('builder');}catch(e){if(reads.current(ticket))setError(errorMessage(e));}finally{if(reads.current(ticket))setBusy(false);}};
  const useTemplate=async(template:(typeof templates)[number])=>{if(template.kind!=='source'){edit(draftFromTemplate(template));return;}const ticket=reads.begin();setBusy(true);setError('');try{if(!bridge.openTemplate)throw new Error('请更新服务后复用源码模板。');const result=await bridge.openTemplate(template.id,ticket.controller.signal);if(reads.current(ticket))edit(result.spec);}catch(reason){if(reads.current(ticket))setError(errorMessage(reason));}finally{if(reads.current(ticket))setBusy(false);}};
  const pin=async(id:string,pinned:boolean)=>{setBusy(true);setError('');try{await bridge.manage('entry',id,'pin',{pinned});setVersion(v=>v+1);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}};
  const allTemplates=[...new Map([...templates,...(saved?.templates??[])].map(template=>[template.id,template])).values()];
  const entries=tab==='common'?(saved?.entries??[]).filter(entry=>entry.pinned):(saved?.entries??[]);
  const recent=[...(saved?.components??[])].sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt)).slice(0,3);
  const withoutEntry=(saved?.components??[]).filter(component=>!(saved?.entries??[]).some(entry=>entry.viewId===component.id));
  const create=()=>{setEditing(undefined);setInitial(undefined);setBuilderKey(key=>key+1);setTab('builder');};
  const openSaved=(id:string,title:string)=>{if(onOpenView)onOpenView({viewId:id,title});else {const spec=saved?.components.find(component=>component.id===id)?.spec;if(spec)setView(spec);}};
  const confirmManage=async()=>{
    if(!manage)return;setBusy(true);setError('');
    try{await bridge.manage(manage.kind,manage.id,manage.action,manage.action==='rename'?{name}:{});setManage(undefined);setVersion(v=>v+1);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  };
  const sourceDraft=editing?.spec??initial;
  return <div className="hm-root hm-workbench"><style>{STYLES}</style>
    {!embedded?<div className="hm-head"><div><h2>Hallmark 工作台</h2><p className="hm-muted">查看店铺数据，管理你的组件。</p></div>{onBack?<button type="button" onClick={onBack}>应用列表</button>:null}</div>:null}
    <div className="hm-workbench-navigation"><div className="hm-tabs" role="tablist" aria-label="Hallmark 工作台功能">{[['common','工作台'],['saved','组件库'],['builder','组件设计']].map(([id,label],i)=><button key={id} type="button" role="tab" id={`${prefix}-workbench-tab-${id}`} aria-selected={tab===id} aria-controls={`${prefix}-workbench-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id as any)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const n=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:-1)+3)%3;const key=['common','saved','builder'][n];setTab(key as any);queueMicrotask(()=>document.getElementById(`${prefix}-workbench-tab-${key}`)?.focus());}}}>{label}{id==='saved'&&saved?.components.length?<span className="hm-tab-count">{saved.components.length}</span>:null}</button>)}</div></div>
    {error?<ErrorView message={error} onRetry={()=>setVersion(v=>v+1)}/>:null}
    <div role="tabpanel" id={tab==='builder'?undefined:`${prefix}-workbench-${tab}`} aria-labelledby={tab==='builder'?undefined:`${prefix}-workbench-tab-${tab}`} hidden={tab==='builder'} tabIndex={0}>
      {tab!=='builder'?<>
        <div className="hm-section-heading"><div><h2>{tab==='common'?'常用组件':'我的组件库'}</h2><p className="hm-muted">{tab==='common'?'店铺数据与常用工作，一目了然。':'保存的设计，随时打开、编辑和复用。'}</p></div><button className="hm-action-secondary" type="button" onClick={create}><AppIcon name="plus" size={16}/>添加组件</button></div>
        {tab==='common'?<>{overviewError?<ErrorView message={`${overview?'概览未更新，当前显示上次读取的数据。':'概览暂未读取成功。'}${overviewError}`} onRetry={()=>setVersion(v=>v+1)}/>:null}<OverviewCards data={overview} loading={overviewLoading}/></>:null}
        <div className={tab==='common'?'hm-dashboard-columns':'hm-library-content'}>
        <section className="hm-dashboard-panel hm-pinned-panel"><header className="hm-panel-heading"><h3>{tab==='common'?'我的常用组件':'保存的组件与入口'}</h3>{tab==='common'?<button className="hm-text-button" type="button" onClick={()=>setTab('saved')}>管理<AppIcon name="arrow-right" size={14}/></button>:<span className="hm-muted">{saved?.components.length??0} 个组件</span>}</header>
          {entries.length?<ul className="hm-saved-list">{entries.map(entry=><li key={entry.id}><div className="hm-entry-row"><button className="hm-entry-open" type="button" onClick={()=>load(entry.id)} disabled={busy}><span className="hm-entry-icon"><AppIcon name={entry.kind==='component'?'layers':'table'} size={20}/></span><span><strong>{entry.title}</strong><span className="hm-muted">{entry.kind==='component'?'已保存组件':'常用数据入口'}</span></span><AppIcon name="arrow-up-right" size={16}/></button>
            {tab==='saved'?<div className="hm-actions"><button type="button" disabled={busy} onClick={()=>pin(entry.id,!entry.pinned)}>{entry.pinned?'取消置顶':'置顶常用'}</button><button type="button" onClick={()=>{setManage({id:entry.id,kind:'entry',title:entry.title,action:'rename'});setName(entry.title);}}>重命名</button><button type="button" onClick={()=>setManage({id:entry.id,kind:'entry',title:entry.title,action:'delete'})}>删除入口</button>{entry.kind==='component'?<button type="button" onClick={()=>{if(entry.viewId)void openDraft(entry.viewId);}}>编辑设计</button>:null}</div>:null}
          </div></li>)}</ul>:tab==='saved'&&withoutEntry.length?null:<div className="hm-component-welcome"><span className="hm-welcome-icon"><AppIcon name="layers" size={30}/></span><h3>{loading?'正在读取组件…':tab==='common'?'把常用工作，变成你的组件':'从第一个组件开始'}</h3><p>{tab==='common'?'在聊天中让 Agent 创建表格、图表，保存后置顶在这里。':'保存商品列表、分析结果或操作回执，下次直接打开。'}</p><div className="hm-actions">{onEnterChat?<button className="hm-action-primary" type="button" onClick={onEnterChat}><AppIcon name="chat" size={16}/>在聊天中创建</button>:null}<button className="hm-action-secondary" type="button" onClick={create}>自己设计<AppIcon name="arrow-right" size={15}/></button></div></div>}
          {tab==='saved'&&withoutEntry.length?<ul className="hm-saved-list hm-unlisted-components">{withoutEntry.map(component=><li className="hm-entry-row" key={component.id}><button type="button" className="hm-entry-open" onClick={()=>openSaved(component.id,component.title)}><span className="hm-entry-icon"><AppIcon name="layers" size={20}/></span><span><strong>{component.title}</strong><span className="hm-muted">已保存组件</span></span><AppIcon name="arrow-up-right" size={16}/></button><div className="hm-actions"><button type="button" disabled={busy} onClick={()=>void openDraft(component.id)}>编辑设计</button><button type="button" onClick={()=>{setManage({id:component.id,kind:'component',title:component.title,action:'rename'});setName(component.title);}}>重命名</button></div></li>)}</ul>:null}
        </section>
        {tab==='common'?<StoreOverview data={overview} loading={overviewLoading}/>:null}
        </div>
        {tab==='common'&&recent.length?<section className="hm-recent-section"><header className="hm-section-heading"><h3>最近保存的组件</h3><button className="hm-text-button" type="button" onClick={()=>setTab('saved')}>查看全部<AppIcon name="arrow-right" size={14}/></button></header><div className="hm-template-grid">{recent.map(component=><article className="hm-template hm-recent-card" key={component.id}><button className="hm-design-open" type="button" onClick={()=>openSaved(component.id,component.title)}><h3>{component.title}</h3>{component.spec.kind==='source'?<SourceThumbnail key={component.spec.source?.buildId} source={component.spec.source} title={component.title}/>:<DesignPreview kind={component.spec.widgets.some(widget=>widget.type==='line_chart')?'line':component.spec.widgets.some(widget=>widget.type==='bar_chart')?'profit':component.spec.widgets.some(widget=>widget.type==='status_badge')?'receipt':'table'}/>}<span className="hm-muted">{component.spec.kind==='source'?'打开组件':'布局示意 · 打开组件'}<AppIcon name="arrow-up-right" size={14}/></span></button></article>)}</div></section>:null}
        <section className="hm-template-section"><header className="hm-section-heading"><div><h3>{tab==='common'?'从模板开始':'组件模板'}</h3><p className="hm-muted">选一个布局，绑定你需要的数据。</p></div><span className="hm-muted">{allTemplates.length} 个模板</span></header><div className="hm-template-grid">{allTemplates.map(template=><article className="hm-template" key={template.id}><button type="button" className="hm-design-open" aria-label={`使用模板：${template.name}`} disabled={busy} onClick={()=>void useTemplate(template)}><div className="hm-template-title"><h3>{template.name}</h3><AppIcon name="arrow-up-right" size={16}/></div><p className="hm-muted">{template.description}</p>{template.kind==='source'?<SourceThumbnail key={template.source?.buildId} source={template.source} title={template.name}/>:<DesignPreview kind={template.id==='profit-filter'?'profit':template.id==='operation-receipt'?'receipt':'table'}/>}<span className="hm-template-cta">使用模板<AppIcon name="arrow-right" size={14}/></span></button>{tab==='saved'&&saved?.templates.some(t=>t.id===template.id)?<button type="button" onClick={()=>setManage({id:template.id,kind:'template',title:template.name,action:'delete'})}>删除模板</button>:null}</article>)}</div></section>
        {view?<SnapshotView sessionId={sessionId??''} viewId={view.id}/>:null}
      </>:null}
    </div>
    <div role="tabpanel" id={`${prefix}-workbench-builder`} aria-labelledby={`${prefix}-workbench-tab-builder`} hidden={tab!=='builder'}>{sourceDraft&&isSourceView(sourceDraft)?<SourceDraftPanel key={`${sessionId}:${builderKey}`} sessionId={sessionId??''} spec={sourceDraft} editing={editing} revision={draftRevision} revisions={saved?.components.find(component=>component.id===editing?.sourceComponentId)?.revisions} api={bridge} onSaved={component=>{if(component){setEditing({spec:sourceDraft,sourceComponentId:component.id,baseRevision:component.revision??1});setDraftRevision(undefined);}setVersion(v=>v+1);}} onOpenRevision={editing?revision=>void openDraft(editing.sourceComponentId,revision):undefined} onEnterChat={onEnterChat}/>:<ComponentBuilder key={builderKey} api={bridge} templates={allTemplates.filter(template=>template.kind!=='source')} datasets={datasets} initial={initial} editing={editing} onSaved={()=>setVersion(v=>v+1)}/>}</div>
    {manage?<section className="hm-section" role="group" aria-label="明确配置管理操作"><h3>{manage.action==='delete'?'确认删除配置':'重命名配置'}：{manage.title}</h3>{manage.action==='rename'?<label>新名称<input value={name} onChange={event=>setName(event.target.value)}/></label>:<p>仅删除本地入口或模板，不删除 Hallmark 业务数据。</p>}<div className="hm-actions"><button type="button" disabled={busy||manage.action==='rename'&&!name.trim()} onClick={confirmManage}>{manage.action==='delete'?'明确删除':'保存名称'}</button><button type="button" onClick={()=>setManage(undefined)}>取消</button></div></section>:null}
  </div>;
}
