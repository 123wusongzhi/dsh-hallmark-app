import React, { useState, useId, useMemo } from 'react';
import type { BindingData, DataBinding, ViewSpec, WidgetSpec } from '../../presentation/src/types.ts';
import { formatValue } from '../../presentation/src/design.ts';
import { isProfitField, mappedValue, missingCost, payloadRows, profitBasis, safeImageURL, sourceTime } from './model.ts';
import type { Row } from './model.ts';
import { display } from './widget-format.ts';
import { ProductTable } from './widgets/product-table.tsx';
import { BusinessChart } from './widgets/business-chart.tsx';
import { toRenderSpec } from './render-catalog.ts';
import type { RenderSpec } from './render-catalog.ts';
import { readableISODate } from './widgets/table-format.ts';
import { AppIcon } from './icons.tsx';

export function LoadingView(){return <div className="hm-skeleton" role="status" aria-label="正在读取本地快照"><span/><span/><span/><span/><span/><span className="hm-muted">正在读取本地快照…</span></div>;}
export function EmptyView({message='暂无成功快照',detail='先查询对应数据，或点击刷新读取最近可用数据。'}:{message?:string;detail?:string}){return <div className="hm-empty" role="status"><strong>{message}</strong><p>{detail}</p></div>;}
export function ErrorView({message,onRetry}:{message:string;onRetry?:()=>void}){return <div className="hm-error" role="alert"><strong>暂时无法显示</strong><p>{message}</p>{onRetry?<div><button type="button" onClick={onRetry}>重试读取</button></div>:null}</div>;}
function receiptTimeBasis(data?:BindingData):unknown{return data?.provenance?.timeBasis??mappedValue((data??{}) as unknown as Row,'timeBasis')??mappedValue((data??{}) as unknown as Row,'data.timeBasis');}
function receiptRoot(data?:BindingData):Row|undefined{const payload=data?.payload;const root=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Row:undefined;return data?.datasetKey?.startsWith('operation:')||receiptTimeBasis(data)==='operation_record_updated_at'||root&&typeof root.operationId==='string'&&typeof root.kind==='string'?root??{}:undefined;}
export function resolvedBadgeStatus(widget:WidgetSpec,binding:DataBinding|undefined,data:BindingData):unknown{const root=receiptRoot(data);if(root)return mappedValue(root,widget.fields?.status??'status',binding)??mappedValue(root,'state',binding)??'未知';return mappedValue(payloadRows(data.payload)[0]??{},widget.fields?.status??'state',binding)??data.state;}
function Footer({data,basis}:{data?:BindingData;basis?:string}){
  const root=receiptRoot(data);const timeBasis=receiptTimeBasis(data);
  const time=root?sourceTime(data?.provenance?.recordUpdatedAt)??sourceTime(root.updatedAt)??sourceTime(mappedValue(root,'provenance.updatedAt'))??sourceTime(data?.dataTime):sourceTime(data?.dataTime);
  const date=readableISODate(time);
  const metric=basis??data?.metricBasis??(typeof data?.provenance?.metricBasis==='string'?data.provenance.metricBasis:undefined)??(root?'操作回执：根操作状态为汇总，逐项保留原始状态；不是商品或价格业务源时间。':'原始字段，无加工口径');
  return <footer className="hm-footer hm-data-footer">
    <span className="hm-data-stamp"><AppIcon name="layers" size={13}/><span>{root?'操作记录':'数据时间'}</span><time dateTime={time} title={time?`${time} · 显示为本地时间`:'尚无数据时间'}>{date?`${date.date} ${date.time??''}`:time??'未知'}</time></span>
    <details><summary>来源与口径</summary><div className="hm-data-evidence">
      <span>{root?'操作记录时间':'数据时间'}：{time?formatValue(time,'date'):'未知'}</span>
      <span title={sourceTime(data?.lastSuccessAt)}>上次成功：{sourceTime(data?.lastSuccessAt)?formatValue(data!.lastSuccessAt,'date'):'未知'}</span>
      <span>来源：{String(data?.provenance?.source??'无可用数据')}</span><span>口径：{metric}</span>
      {root||typeof timeBasis==='string'?<span>时间口径：{root?'操作记录更新时间（operation_record_updated_at），不是平台商品/价格源数据时间':String(timeBasis)}</span>:null}
    </div></details>
    {root?<span className="hm-data-caveat">操作记录时间不是平台商品或价格的源数据时间。</span>:null}
    {root?.acceptance==='imported-not-sellable-verified'?<span className="hm-data-caveat">上品只核实 imported，不表示 on_sale 或可售验收。</span>:null}
    {data?.state==='failed'?<span role="status">更新失败，保留上次成功数据</span>:data?.state==='refreshing'?<span role="status">更新中，显示上次成功数据</span>:null}
  </footer>;
}
function Widget({widget,binding,data}:{widget:WidgetSpec;binding?:DataBinding;data?:BindingData}){
  const rows=useMemo(()=>payloadRows(data?.payload),[data?.payload]);const first=rows[0]??{};const basis=profitBasis(widget,data);
  const read=(name:string,fallback:string)=>mappedValue(first,widget.fields?.[name]??fallback,binding);
  const hasProfit=widget.type==='product_card'||Object.values(widget.fields??{}).some(field=>isProfitField(field,binding))||(widget.columns??[]).some(col=>isProfitField(col.field,binding));
  const image=safeImageURL(read('image','imageUrl'));
  let content:React.ReactNode;
  if(widget.type==='text')content=<p>{widget.text}</p>;
  else if(!data)content=<EmptyView/>;
  else switch(widget.type){
    case 'table':content=<ProductTable widget={widget} rows={rows} binding={binding} data={data} basis={basis}/>;break;
    case 'bar_chart':case 'line_chart':content=<BusinessChart widget={widget} rows={rows} binding={binding} basis={basis}/>;break;
    case 'stat_card':content=<p className="hm-stat">{display(first,widget.fields?.value??'value',binding,basis)}</p>;break;
    case 'status_badge':content=<span className="hm-badge" role="status">{String(resolvedBadgeStatus(widget,binding,data))}</span>;break;
    case 'product_card':content=<div className="hm-product">{image?<img src={image} alt={String(read('title','title')??'商品图片')} loading="lazy" referrerPolicy="no-referrer"/>:<div className="hm-badge">无商品图片</div>}<div><h3>{String(read('title','title')??'未命名商品')}</h3><p>售价：{display(first,widget.fields?.price??'price',binding,basis,'currency',String(widget.options?.currency??read('currency','currency')??'RUB'))}</p><p>库存：{formatValue(read('stock','stock'))}</p><p>参考利润率：{missingCost(first)?'无法判断（缺成本）':!basis?'无法判断（缺口径）':display(first,widget.fields?.margin??'referenceProfit.margin',binding,basis,'percent')}</p></div></div>;break;
    default:content=<ErrorView message="未知组件类型，请在聊天中调整展示。"/>;
  }
  return <section className="hm-widget" data-widget={widget.type} aria-label={widget.title??widget.type}>{widget.title?<h3>{widget.title}</h3>:null}{content}<Footer data={data} basis={hasProfit&&!receiptRoot(data)?basis??'未提供口径，无法判断参考利润':basis}/></section>;
}
function Layout({elementId,tree,spec,data}:{elementId:string;tree:RenderSpec;spec:ViewSpec;data:BindingData[]}){
  const [tab,setTab]=useState(0);const id=useId();const node=tree.elements[elementId];
  const child=(key:string)=>{const element=tree.elements[key];if(element.props.widgetId){const widget=spec.widgets.find(w=>w.id===element.props.widgetId);return widget?<Widget key={key} widget={widget} binding={spec.bindings.find(b=>b.id===widget.bindingId)} data={data.find(d=>d.bindingId===widget.bindingId)}/>:<ErrorView key={key} message="布局引用的组件不存在。"/>;}return <Layout key={key} elementId={key} tree={tree} spec={spec} data={data}/>;};
  if(node.type==='Tabs'){
    const selected=Math.min(tab,node.children.length-1);
    const choose=(index:number)=>{setTab(index);queueMicrotask(()=>document.getElementById(id+'-tab-'+index)?.focus());};
    return <div><div className="hm-tabs" role="tablist" aria-label="视图选项卡">{node.children.map((key,i)=><button key={key} id={id+'-tab-'+i} type="button" role="tab" tabIndex={selected===i?0:-1} aria-selected={selected===i} aria-controls={id+'-panel-'+i} onClick={()=>setTab(i)} onKeyDown={event=>{const key=event.key;if(['ArrowRight','ArrowLeft','Home','End'].includes(key)){event.preventDefault();choose(key==='Home'?0:key==='End'?node.children.length-1:(selected+(key==='ArrowRight'?1:-1)+node.children.length)%node.children.length);}}}>{spec.widgets.find(w=>w.id===tree.elements[key].props.widgetId)?.title??('视图 '+(i+1))}</button>)}</div>{node.children.map((key,i)=><div key={key} role="tabpanel" id={id+'-panel-'+i} aria-labelledby={id+'-tab-'+i} hidden={selected!==i} tabIndex={0}>{child(key)}</div>)}</div>;
  }
  return <div className={'hm-layout hm-layout-'+node.type.toLowerCase()} style={{gap:node.props.gap,...(node.type==='Grid'?{gridTemplateColumns:'repeat('+node.props.columns+',minmax(0,1fr))'}:{})}}>{node.children.map(child)}</div>;
}
export class RenderBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<ErrorView message="组件字段或格式配置无法渲染，可在聊天中调整设计后重新打开。"/>:this.props.children;}
}
export function ViewRenderer({spec,data}:{spec:ViewSpec;data:BindingData[]}){
  const result=useMemo(()=>{try{return {tree:toRenderSpec(spec)};}catch(error){return {error:error instanceof Error?error.message:'组件配置尚未完整。'};}},[spec]);
  if(!result.tree)return <ErrorView message={result.error??'组件配置尚未完整。'}/>;
  const tree=result.tree;
  const theme=spec.theme;const style:Record<string,string|number>={};if(theme?.primary)style['--hm-accent']=theme.primary;if(theme?.text)style['--hm-text']=theme.text;if(theme?.background){style['--hm-bg']=theme.background;style.background=theme.background;}if(theme?.surface)style['--hm-surface']=theme.surface;if(theme?.radius!==undefined)style['--hm-radius']=`${theme.radius}px`;if(theme?.shadow)style['--hm-shadow']=theme.shadow;if(theme?.fontSize?.body)style.fontSize=theme.fontSize.body;
  return <div className="hm-root hm-renderer" style={style as React.CSSProperties}><Layout elementId={tree.root} tree={tree} spec={spec} data={data}/></div>;
}
