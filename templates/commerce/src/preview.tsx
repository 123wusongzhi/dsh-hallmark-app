import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Workbench} from './Workbench';
import {templates} from './data';
import type {TemplateId} from './data';
import {fixture} from './fixture';
function Gallery(){const [id,setId]=useState<TemplateId>('products'),[narrow,setNarrow]=useState(false),[refresh,setRefresh]=useState(0);return <div className="gallery"><nav className="gallery-nav"><div className="brand">Commerce.<small>经营组件 / 模板集</small></div><div className="nav-label">TEMPLATES · 07</div>{templates.map((t,i)=><button key={t[0]} data-template={t[0]} className={id===t[0]?'active':''} onClick={()=>setId(t[0])}><span>0{i+1}</span>{t[1]}</button>)}<p>适配 DSH Apps 源码组件<br/>React · SDK 数据绑定<br/>当前为本地示例数据</p></nav><div className={`gallery-content ${narrow?'narrow':''}`}><div className="preview-bar"><span>交互预览 · 示例数据 {refresh?`· 已刷新 ${refresh} 次`:''}</span><button onClick={()=>setNarrow(v=>!v)}>{narrow?'展开预览':'窄屏预览'}</button></div><div className="preview-stage"><Workbench key={id} id={id} dataset={fixture} demo onRefresh={()=>setRefresh(n=>n+1)}/></div></div></div>}
createRoot(document.getElementById('root')!).render(<Gallery/>);
