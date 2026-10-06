import type { DataBinding, WidgetSpec } from '../../../presentation/src/types.ts';
import { isProfitField, mappedValue, missingCost } from '../model.ts';
import type { Row } from '../model.ts';
import { display } from '../widget-format.ts';

export type TableColumn=NonNullable<WidgetSpec['columns']>[number];
export type TableColumnKind='title'|'date'|'number'|'text';
export interface TableDate {date:string;time?:string;iso:string}
export interface TableCellValue {text:string;title?:string;missing?:boolean;date?:TableDate}

/** Only calendar-valid ISO dates and explicitly zoned ISO timestamps qualify; IDs never do. */
export function readableISODate(value:unknown,timeZone?:string):TableDate|undefined {
  if(typeof value!=='string')return;
  const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if(!match)return;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  if(month<1||month>12||day<1||day>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1])return;
  if(match[4]===undefined)return {date:`${match[1]}/${match[2]}/${match[3]}`,iso:value};
  if(Number(match[4])>23||Number(match[5])>59||Number(match[6]??0)>59)return;
  const zone=match[8];if(zone!=='Z'&&(Number(zone.slice(1,3))>23||Number(zone.slice(4,6))>59))return;
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return;
  const parts=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',...(timeZone?{timeZone}:{})}).formatToParts(date);
  const part=(name:Intl.DateTimeFormatPartTypes)=>parts.find(item=>item.type===name)?.value??'';
  return {date:`${part('year')}/${part('month')}/${part('day')}`,time:`${part('hour')}:${part('minute')}:${part('second')}`,iso:value};
}

export function tableColumnKind(column:TableColumn,rows:Row[],binding?:DataBinding):TableColumnKind {
  const path=binding?.fieldMap?.[column.field]??column.field;
  const fields=[column.field,path];
  if(fields.some(field=>/(?:^|[._])(?:title|name|productName|productTitle|product_name|product_title)$/i.test(field))||/产品名称|商品名称|商品标题/.test(column.label))return 'title';
  if(column.format==='date'||fields.some(field=>/(?:created|updated|collected|imported|published|synced)(?:_?at|_?time)$/i.test(field)||/(?:^|[._])(?:date|timestamp)$/i.test(field)))return 'date';
  if(column.format==='currency'||column.format==='percent')return 'number';
  const values=rows.slice(0,50).map(row=>mappedValue(row,column.field,binding)).filter(value=>value!=null);
  if(values.length&&values.every(value=>typeof value==='number'))return 'number';
  return 'text';
}

export function tableCellValue(row:Row,column:TableColumn,binding:DataBinding|undefined,basis:string|undefined,currency:string,timeZone?:string):TableCellValue {
  const raw=mappedValue(row,column.field,binding);
  if(isProfitField(column.field,binding)&&(missingCost(row)||!basis))return {text:'—',missing:true,title:missingCost(row)?'无法判断（缺成本）':'无法判断（缺口径）'};
  if(raw==null||typeof raw==='number'&&!Number.isFinite(raw))return {text:'—',missing:true,title:'暂无有效数据'};
  const date=readableISODate(raw,timeZone);
  if(date&&(column.format==='date'||tableColumnKind(column,[],binding)==='date'))return {text:date.date+(date.time?' '+date.time:''),title:date.iso,date};
  // An invalid date string stays literal; permissive Date.parse must not turn product IDs into dates.
  const text=display(row,column.field,binding,basis,column.format==='date'?'text':column.format,currency);
  return text.startsWith('无法判断')?{text:'—',missing:true,title:text}:{text,title:text};
}

export function matchesTableSearch(raw:unknown,displayed:string,query:string):boolean {
  const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g,' ').trim();
  const source=typeof raw==='string'||typeof raw==='number'||typeof raw==='boolean'?String(raw):'';
  return normalize(`${displayed} ${source}`).includes(normalize(query));
}

export function tablePageSize(value:unknown):number {
  const parsed=typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  return Number.isFinite(parsed)&&parsed>=1?Math.min(200,Math.trunc(parsed)):10;
}
