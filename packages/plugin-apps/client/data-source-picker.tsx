import React from 'react';
import type {DataSourceDefinition} from '../../app-presentation/src/types.ts';
import {dataSourceCompatibility,FIELD_ROLE_MAP} from '../../app-presentation/src/field-roles.ts';

export function compatibleDataSources(sources:DataSourceDefinition[],requiredRoles:readonly string[]){
  return sources.map(source=>({source,...dataSourceCompatibility(source,requiredRoles)}))
    .sort((a,b)=>Number(b.compatible)-Number(a.compatible)||a.source.title.localeCompare(b.source.title,'zh-CN'));
}

export function DataSourcePicker({label,sources,requiredRoles,value,onChange,onCreate}:{label:string;sources:DataSourceDefinition[];requiredRoles:readonly string[];value?:string;onChange:(id:string)=>void;onCreate:()=>void}){
  const choices=compatibleDataSources(sources,requiredRoles);
  const selected=choices.find(choice=>choice.source.id===value);
  return <section className="apps-source-picker" aria-label={`${label}数据源`}>
    <label className="apps-config-label"><span>{label} · 数据来源</span><select aria-label={`${label}数据来源`} value={value??''} onChange={event=>onChange(event.target.value)}><option value="">选择数据源</option>{choices.map(({source,compatible,missingRoles})=><option key={source.id} value={source.id} disabled={!compatible}>{source.title}{compatible?'':` · 缺少${missingRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')||'验证'}`}</option>)}</select></label>
    {selected?<div className="apps-source-summary"><strong>{selected.source.title}</strong><p>{selected.source.description??'读取平台业务数据，刷新时重新查询。'}</p><small>{selected.source.storeScoped?'使用顶部所选店铺 · ':''}版本 {selected.source.revision}</small>{selected.source.validation.status!=='verified'?<p className="apps-muted" role="status">{selected.source.validation.status==='failed'?'此数据源上次验证未成功；请查看当前店铺的实际读取结果。':'字段定义已登记，当前店铺的数据将在预览时读取。'}{selected.source.validation.issues.length?` ${selected.source.validation.issues.join('；')}`:''}</p>:null}{!selected.compatible?<p className="apps-field-gap" role="alert">缺少：{selected.missingRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')||'可用字段定义'}</p>:null}</div>:null}
    {!choices.length?<p className="apps-muted">此应用还没有可用数据源。先让 Agent 创建并验证，再刷新列表。</p>:choices.every(choice=>!choice.compatible)?<p className="apps-field-gap">没有完整匹配的数据源，需要：{requiredRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')}。</p>:null}
    {choices.some(choice=>!choice.compatible)?<details className="apps-source-gaps"><summary>查看其他数据源的字段缺口</summary>{choices.filter(choice=>!choice.compatible).map(choice=><p key={choice.source.id}>{choice.source.title}：{choice.missingRoles.length?`缺少${choice.missingRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')}`:'尚未通过真实数据验证'}</p>)}</details>:null}
    <button className="apps-agent-source" type="button" onClick={onCreate}>没有需要的数据？让 Agent 创建数据源</button>
  </section>;
}

export function dataSourceRequest(materialTitle:string,requiredRoles:readonly string[],appId:string):string{
  return `请为 ${appId} 工作台的「${materialTitle}」创建可复用数据源。\n需要的业务字段：${requiredRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')}。\n请先查素材目录与已有数据源，优先复用。若有缺口，请使用已登记的只读能力，根据接口说明确认参数、中文字段、单位及分页方式，调用少量真实数据验证；验证成功后自动登记到数据源库。不要创建新聊天，不要把示例数据登记为真实数据源。`;
}
