import type { BindingData, DataBinding, ViewSpec, WidgetSpec } from '../../presentation/src/types.ts';
export type Row = Record<string, unknown>;
export type Sort = {field:string;direction:'asc'|'desc'};
export function valueAt(value: unknown, path: string): unknown {
  let current: any = value;
  for (const key of path.split('.')) { if (['__proto__','constructor','prototype'].includes(key) || !current || typeof current !== 'object' || !Object.hasOwn(current,key)) return undefined; current = current[key]; }
  return current;
}
export function payloadRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload.filter(value => value && typeof value === 'object');
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as any;
  for (const key of ['products','rows','items','results']) if (Array.isArray(root[key])) return payloadRows(root[key]);
  if (root.result && typeof root.result === 'object') return payloadRows(root.result);
  return [root];
}
export function mappedValue(row: Row, field: string, binding?: DataBinding): unknown {
  return valueAt(row,binding?.fieldMap?.[field] ?? field);
}
export function isProfitField(field: string, binding?: DataBinding): boolean { const path=binding?.fieldMap?.[field]??field; return !/costMissing|costMinor|metricBasis|missing/i.test(path) && /profit|margin|利润/i.test(`${field} ${path}`); }
export function missingCost(row: Row): boolean { return row.costMissing === true || valueAt(row,'referenceProfit.costMissing') === true; }
export function sortRows(rows: Row[], sort: Sort | undefined, binding?: DataBinding): Row[] {
  if (!sort) return [...rows];
  return rows.map((row,i) => ({row,i})).sort((a,b) => {
    const x = mappedValue(a.row,sort.field,binding), y = mappedValue(b.row,sort.field,binding);
    const absentX = x == null || (isProfitField(sort.field,binding) && missingCost(a.row));
    const absentY = y == null || (isProfitField(sort.field,binding) && missingCost(b.row));
    if (absentX || absentY) return absentX === absentY ? a.i-b.i : absentX ? 1 : -1;
    const compare = typeof x === 'number' && typeof y === 'number' ? x-y : String(x).localeCompare(String(y),'zh-CN',{numeric:true});
    return compare === 0 ? a.i-b.i : compare*(sort.direction === 'desc' ? -1 : 1);
  }).map(item => item.row);
}
export function paginate(rows: Row[], page: number, size: number): {rows:Row[];page:number;pages:number;total:number} {
  const pageSize = Math.max(1,Math.min(200,Math.trunc(size) || 20));
  const pages = Math.max(1,Math.ceil(rows.length/pageSize)); const current = Math.max(0,Math.min(pages-1,Math.trunc(page) || 0));
  return {rows:rows.slice(current*pageSize,(current+1)*pageSize),page:current,pages,total:rows.length};
}
export function safeImageURL(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function sourceTime(value: unknown): string | undefined { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined; }
export function toolViewId(props: {phase?:string;block?:{meta?:unknown}}): string | undefined {
  const meta = (props.block?.meta as any)?.hallmark;
  return props.phase === 'result' && meta && typeof meta === 'object' && typeof meta.viewId === 'string' && meta.viewId.trim() ? meta.viewId : undefined;
}
export function refreshDatasetKeys(spec: ViewSpec): string[] { return [...new Set(spec.bindings.map(binding => binding.datasetKey).filter((key):key is string => typeof key === 'string' && /^(?:(?:store_products|profit|query|category|collected):.+|dataset:v1:[a-f0-9]{64})$/.test(key)))]; }
export function profitBasis(widget:WidgetSpec,binding:BindingData|undefined): string | undefined {
  return binding?.metricBasis ?? (typeof (binding?.payload as any)?.metricBasis === 'string' ? (binding!.payload as any).metricBasis : undefined);
}
