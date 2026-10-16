import {formatMaterialCurrency,formatMaterialInteger,formatMaterialPercent} from './number-format.ts';
import type {DataBinding,WidgetSpec} from '../../../presentation/src/types.ts';
import {FIELD_ROLE_MAP} from '../../../app-presentation/src/field-roles.ts';
import {payloadRows,valueAt} from '../model.ts';
import type {Row} from '../model.ts';

export interface MaterialColumn {field:string;label?:string}
export interface MaterialFieldMeta {label?:string;description?:string;format?:string;unit?:string;currency?:string;currencyPath?:string;percentScale?:'fraction'|'whole';numericScale?:number;confirmed?:boolean}
export function materialRows(payload:unknown,widget:WidgetSpec):Row[]{
  const path=widget.options?.rowsPath;
  if(typeof path!=='string')return payloadRows(payload);
  const value=path?valueAt(payload,path):payload;
  return Array.isArray(value)?value.filter((row):row is Row=>!!row&&typeof row==='object'&&!Array.isArray(row)):value&&typeof value==='object'?[value as Row]:[];
}
export function materialValue(row:Row,role:string,widget:WidgetSpec,binding?:DataBinding):unknown{
  const meta=(widget.options?.fieldMeta as Record<string,MaterialFieldMeta>|undefined)?.[role];
  if(meta?.confirmed===false)return undefined;
  const path=widget.fields?.[role]??binding?.fieldMap?.[role]??role;
  return Object.hasOwn(row,path)?row[path]:valueAt(row,path);
}
export function materialFieldMeta(role:string,widget:WidgetSpec):MaterialFieldMeta{
  return {...FIELD_ROLE_MAP[role],...((widget.options?.fieldMeta as Record<string,MaterialFieldMeta>|undefined)?.[role]??{})};
}
export function materialColumns(widget:WidgetSpec,defaults:string[]):MaterialColumn[]{
  const configured=widget.options?.columns;
  return Array.isArray(configured)?configured.filter((column):column is MaterialColumn=>!!column&&typeof column==='object'&&typeof column.field==='string'):(widget.columns??defaults.map(field=>({field})));
}
export function materialLabel(column:MaterialColumn,widget:WidgetSpec):string{return column.label??materialFieldMeta(column.field,widget).label??'未命名字段';}
function readable(value:unknown):string{
  if(value===null||value===undefined||value==='')return '暂无数据';
  if(Array.isArray(value))return value.map(readable).join(' · ')||'暂无数据';
  if(typeof value==='object')return Object.entries(value).filter(([,item])=>item!=null&&item!=='').map(([key,item])=>`${key}：${readable(item)}`).join(' / ')||'暂无数据';
  return String(value);
}
export function materialDisplay(row:Row,role:string,widget:WidgetSpec,binding?:DataBinding):string{
  const raw=materialValue(row,role,widget,binding),meta=materialFieldMeta(role,widget);
  if(raw==null||raw===''||typeof raw==='number'&&!Number.isFinite(raw))return '暂无数据';
  if(['currency','integer','percent'].includes(meta.format??'')){
    const number=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()?Number(raw):NaN;
    if(!Number.isFinite(number))return '暂无数据';
    const scaled=number*(meta.numericScale??1);
    if(meta.format==='currency'){
      const currency=meta.currency??(meta.currencyPath?valueAt(row,meta.currencyPath):undefined)??materialValue(row,'price.currency',widget,binding)??widget.options?.currency;
      if(typeof currency!=='string'||!/^[A-Z]{3}$/i.test(currency))return '暂无数据（币种未确认）';
      try{return formatMaterialCurrency(scaled,currency.toUpperCase());}catch{return '暂无数据（币种未确认）';}
    }
    if(meta.format==='percent')return meta.percentScale?formatMaterialPercent(meta.percentScale==='whole'?scaled/100:scaled):'暂无数据（比例未确认）';
    return formatMaterialInteger(scaled)+(meta.unit?` ${meta.unit}`:'');
  }
  if(meta.format==='datetime'){
    if(typeof raw!=='string'||!/^\d{4}-\d\d-\d\d/.test(raw)||!Number.isFinite(Date.parse(raw)))return '暂无数据';
    return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(raw));
  }
  return readable(raw);
}
