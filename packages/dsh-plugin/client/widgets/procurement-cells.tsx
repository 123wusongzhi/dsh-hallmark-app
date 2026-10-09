import React from 'react';
import type {DataBinding,WidgetSpec} from '../../../presentation/src/types.ts';
import type {Row} from '../model.ts';
import {materialDisplay,materialValue} from './material-format.ts';

/** Navigation is allowed only to explicit web URLs, never embedded credentials. */
export function procurementLink(value:unknown):string|undefined{
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return undefined;
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
function text(value:unknown):string|undefined{return typeof value==='string'&&value.trim()?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):undefined;}
function finite(value:unknown):number|undefined{if(value==null||value==='')return undefined;const n=typeof value==='number'?value:typeof value==='string'?Number(value):NaN;return Number.isFinite(n)?n:undefined;}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function minorAmount(value:unknown,currency:unknown):string{
  const amount=finite(value);if(amount===undefined)return '待补充';
  if(typeof currency!=='string'||!/^[a-z]{3}$/i.test(currency))return '币种待确认';
  try{return new Intl.NumberFormat('zh-CN',{style:'currency',currency:currency.toUpperCase(),currencyDisplay:'code',maximumFractionDigits:2}).format(amount/100);}catch{return '币种待确认';}
}
function ProcurementLinks({value,purchase}:{value:unknown;purchase:boolean}){
  const values=Array.isArray(value)?value:value==null||value===''?[]:[value],action=purchase?'采购页':'商品页';
  if(!values.length)return <span className="hm-procurement-missing">待补充</span>;
  return <div className="hm-procurement-links">{values.map((item,index)=>{
    const entry=object(item),url=procurementLink(typeof item==='string'?item:entry.url),label=text(entry.label),name=values.length>1?`${action} ${index+1}`:action;
    return <div className="hm-procurement-link-item" key={`${url??'invalid'}:${index}`}>{url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label={label?`${name}：${label}`:name} onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>{name}<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M6 3H3v10h10v-3M9 3h4v4M7 9l6-6"/></svg></a>:<span className="hm-procurement-missing" title="仅支持不含账号密码的 http 或 https 网址">链接不可用</span>}{label&&values.length>1?<small>{label}</small>:null}</div>;
  })}</div>;
}
function ProcurementMargin({row,widget,binding}:{row:Row;widget:WidgetSpec;binding?:DataBinding}){
  const profit=object(row.referenceProfit),margin=finite(materialValue(row,'metric.margin',widget,binding));
  const display=materialDisplay(row,'metric.margin',widget,binding),known=margin!==undefined&&!display.startsWith('暂无数据');
  const reason=text(profit.reason)??(margin!==undefined?'利润比例口径待确认':'采购价、售价或计费信息待补充');
  const currency=materialValue(row,'price.currency',widget,binding)??row.currency;
  // Procurement costs are CNY. The current profit model only confirms fees for CNY sales.
  const profitCurrency=typeof currency==='string'&&currency.toUpperCase()==='CNY'?'CNY':undefined;
  const amounts=[['售价',row.sellerMinor,currency],['采购价',row.purchaseMinor,'CNY'],['运费',profit.logisticsMinor,profitCurrency],['佣金',profit.commissionMinor,profitCurrency],['固定费',profit.fixedMinor,profitCurrency],['参考利润',profit.profitMinor,profitCurrency]];
  return <div className="hm-procurement-margin" data-negative={known&&margin<0?true:undefined}>
    <strong className={known?'hm-procurement-rate':'hm-procurement-missing'}>{known?display:'待补充'}</strong>
    {!known?<span className="hm-procurement-reason">{reason}</span>:null}
    <details className="hm-procurement-calculation" onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
      <summary>计算明细</summary>
      <div className="hm-procurement-breakdown"><dl>{amounts.map(([label,value,amountCurrency])=><div key={String(label)}><dt>{String(label)}</dt><dd>{minorAmount(value,amountCurrency)}</dd></div>)}{finite(row.packageGrams)!==undefined?<div><dt>计费重量</dt><dd>{new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(finite(row.packageGrams)!)} 克</dd></div>:null}</dl><p className="hm-procurement-formula">（售价 − 采购价 − 运费 − 佣金 − 固定费）÷ 售价 × 100%</p><p>{text(profit.metricBasis)??'参考试算，非实际结算利润。'}</p></div>
    </details>
  </div>;
}
export function ProcurementCell({row,role,widget,binding,image}:{row:Row;role:string;widget:WidgetSpec;binding?:DataBinding;image?:React.ReactNode}){
  if(role==='product.name')return <div className="hm-procurement-product">{image}<div><strong title={materialDisplay(row,role,widget,binding)}>{materialDisplay(row,role,widget,binding)}</strong><span className="hm-procurement-identifiers">{text(row.sku)?<small>SKU {text(row.sku)}</small>:null}{text(row.offerId)?<small>货号 {text(row.offerId)}</small>:null}</span></div></div>;
  if(role==='product.url'||role==='purchase.url')return <ProcurementLinks value={materialValue(row,role,widget,binding)} purchase={role==='purchase.url'}/>;
  if(role==='metric.margin')return <ProcurementMargin row={row} widget={widget} binding={binding}/>;
  const display=materialDisplay(row,role,widget,binding);
  if(role==='sku.specification'||role==='purchase.specification')return <span className={display==='暂无数据'?'hm-procurement-missing':'hm-procurement-specification'} title={display==='暂无数据'?undefined:display}>{display==='暂无数据'?'待补充':display}</span>;
  return <span title={display}>{display}</span>;
}
