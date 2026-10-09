import React,{useState} from 'react';
import type {DataSourceDefinition} from '../../app-presentation/src/types.ts';
import {FIELD_ROLE_MAP} from '../../app-presentation/src/field-roles.ts';
import {OZON_COMPOSITION_FIELDS,OZON_COMPOSITION_SOURCES,type OzonCompositionRecipe} from '../../app-hallmark/src/ozon-composition.ts';
import {AppsIcon} from './ui.tsx';
import {SourceIcon} from './material-thumbnail.tsx';
import {fieldKey} from './module-config.tsx';

export function InformationPicker({source,recipe,selected,onToggle,onCreate,allowedRoles,samples={}}:{source?:DataSourceDefinition;recipe?:OzonCompositionRecipe;selected:string[];onToggle:(key:string)=>void;onCreate:()=>void;allowedRoles?:string[];samples?:Record<string,string>}){
  const [search,setSearch]=useState(''),[category,setCategory]=useState('all');
  const fields=recipe?OZON_COMPOSITION_FIELDS.filter(field=>field.grains.includes(recipe.grain)).map(field=>({...field,sourceLabel:field.sourceLabel??OZON_COMPOSITION_SOURCES.find(source=>source.key===field.source)?.label??field.source})):source?.fields.filter(field=>field.confirmed&&(!allowedRoles||allowedRoles.includes(field.role))).map(field=>({key:fieldKey(field),role:field.role,label:field.label??FIELD_ROLE_MAP[field.role]?.label??field.role,source:field.origin?.source??source.id,sourceLabel:field.origin?.label??source.title,description:field.description??FIELD_ROLE_MAP[field.role]?.description??'',example:'',requires:[] as string[]}))??[];
  const groups=[...new Map(fields.map(field=>[field.source,field.sourceLabel])).entries()],visible=fields.filter(field=>(category==='all'||field.source===category)&&`${field.label} ${field.sourceLabel} ${field.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="apps-information-picker" aria-label="添加信息">
    <p className="apps-panel-subtitle">{recipe?.grain==='posting'?'按包裹组合':recipe?'按商品组合':'选择组件显示的信息'}</p>
    <label className="apps-search"><AppsIcon name="search"/><input aria-label="搜索信息" placeholder="搜索信息" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <nav className="apps-information-categories" aria-label="信息来源"><button type="button" aria-pressed={category==='all'} onClick={()=>setCategory('all')}>全部</button>{groups.map(([key,label])=><button type="button" key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{label.replace(/^商品|^Ozon /g,'').replace('资料','商品').replace('分仓','').replace('分析','')||label}</button>)}</nav>
    <div className="apps-information-grid">{visible.map(field=>{const added=selected.includes(field.key),real=Object.hasOwn(samples,field.key);return <button type="button" className="apps-information-card" key={field.key} aria-label={`${added?'移除':'添加'}${field.label}`} aria-pressed={added} disabled={added&&selected.length===1||!added&&selected.length>=30} title={field.description} onClick={()=>onToggle(field.key)}><span className="apps-information-symbol"><SourceIcon source={field.source}/></span><span className={`apps-information-check${added?' is-selected':''}`}><AppsIcon name={added?'check':'plus'}/></span><strong>{field.label}</strong><span className="apps-information-example">{real?samples[field.key]:field.example?`示例 · ${field.example}`:'预览后显示数据'}</span><small>{field.sourceLabel}</small>{field.requires?.includes('action')?<em>需选择活动</em>:field.requires?.includes('warehouse')&&field.source==='warehouses'?<em>需选择仓库</em>:null}</button>;})}</div>
    {!visible.length?<div className="apps-information-empty"><AppsIcon name="search"/><p>{search?'没有匹配的信息':'先选择数据来源'}</p></div>:null}
    <p className="apps-information-hint">{selected.length>=30?'已选 30 项，可先移除不需要的信息。':recipe?'仅提供可按当前粒度关联的信息。':'显示名称可调整，字段含义保持不变。'}</p>
    <button type="button" className="apps-agent-source" onClick={onCreate}>找不到需要的信息？让 Agent 帮我封装</button>
  </section>;
}
