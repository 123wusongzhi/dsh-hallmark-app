import React,{useEffect,useState} from 'react';
import type {ComponentDraft,ComponentRevision,SaveComponentOptions,SourceView,SavedComponent,Entry} from '../../presentation/src/types.ts';
import {SnapshotView} from './snapshot.tsx';
import {ErrorView} from './renderer.tsx';

interface SourceDraftAPI {
  saveComponent:(viewId:string,title:string,signal?:AbortSignal,options?:SaveComponentOptions)=>Promise<{component:SavedComponent;entry:Entry}>;
  saveTemplate:(viewId:string,name:string,signal?:AbortSignal)=>Promise<unknown>;
}
export function SourceDraftPanel({sessionId,spec,editing,revision,revisions=[],api,onSaved,onOpenRevision,onEnterChat}:{sessionId:string;spec:SourceView;editing?:ComponentDraft;revision?:number;revisions?:ComponentRevision[];api:SourceDraftAPI;onSaved:(component?:SavedComponent)=>void;onOpenRevision?:(revision:number)=>void;onEnterChat?:()=>void}){
  const [title,setTitle]=useState(spec.title);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [origin,setOrigin]=useState(editing?{id:editing.sourceComponentId,revision:editing.baseRevision}:undefined);
  const [selectedRevision,setSelectedRevision]=useState(revision??editing?.baseRevision);
  const active=React.useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const save=async(mode:'save_as'|'update'|'template')=>{
    if(busy||!title.trim())return;setBusy(true);setError('');setNotice('');
    try{
      let saved:SavedComponent|undefined;
      if(mode==='template'){await api.saveTemplate(spec.id,title.trim());if(active.current)setNotice('源码、样式、资源和构建已保存为可复用模板。');}
      else {const result=await api.saveComponent(spec.id,title.trim(),undefined,mode==='update'&&origin?{mode,componentId:origin.id,expectedRevision:origin.revision}:{mode:'save_as'});saved=result.component;if(active.current){setOrigin({id:result.component.id,revision:result.component.revision??1});setSelectedRevision(result.component.revision??1);setNotice(`已保存第 ${result.component.revision??1} 版，源码与构建一起保留。`);}}
      if(active.current)onSaved(saved);
    }catch(reason){if(active.current)setError(reason instanceof Error?reason.message:String(reason));}finally{if(active.current)setBusy(false);}
  };
  return <section className="hm-source-draft">
    <div className="hm-section-heading"><div><h3>源码组件设计</h3><p className="hm-muted">在聊天中描述要调整的效果，Agent 会修改这个草稿并展示新的预览。</p></div>{onEnterChat?<button type="button" onClick={onEnterChat}>回到聊天继续设计</button>:null}</div>
    <div className="hm-form-row"><label>组件名称<input value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/></label>{revisions.length&&onOpenRevision?<><label>保存版本<select value={selectedRevision??''} onChange={event=>setSelectedRevision(Number(event.target.value))}>{[...revisions].reverse().map(item=><option value={item.revision} key={item.revision}>第 {item.revision} 版 · {new Date(item.savedAt).toLocaleString('zh-CN')}</option>)}</select></label><button type="button" disabled={busy||!selectedRevision} onClick={()=>onOpenRevision(selectedRevision!)}>打开此版草稿</button></>:null}</div>
    {revision!==undefined?<p className="hm-live">当前从第 {revision} 版继续编辑。保存更新会生成新版本，旧版本仍可打开。</p>:null}
    {error?<ErrorView message={error}/>:null}{notice?<p role="status" className="hm-live">{notice}</p>:null}
    <SnapshotView sessionId={sessionId} viewId={spec.id}/>
    <div className="hm-actions hm-section">{origin?<button type="button" disabled={busy||!title.trim()} onClick={()=>void save('update')}>{busy?'保存中…':'保存更新'}</button>:null}<button type="button" disabled={busy||!title.trim()} onClick={()=>void save('save_as')}>{origin?'另存为新组件':'保存到组件库'}</button><button type="button" disabled={busy||!title.trim()} onClick={()=>void save('template')}>保存为模板</button></div>
    <details><summary>源码草稿信息</summary><p className="hm-muted">组件 ID：{spec.id}</p><p className="hm-muted">源码目录：{spec.source.directory}</p></details>
  </section>;
}
