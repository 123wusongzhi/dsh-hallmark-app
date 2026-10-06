import type { ThemeTokens, Template } from './types.ts';
export const THEMES: Record<'light'|'dark', ThemeTokens> = {
  light: { background:'#f8fafc',surface:'#ffffff',text:'#172033',mutedText:'#475569',primary:'#1d4ed8',profit:'#166534',loss:'#b91c1c',warning:'#92400e',fontSize:{small:12,body:14,title:22},spacing:16,radius:8,shadow:'none' },
  dark: { background:'#0f172a',surface:'#1e293b',text:'#f8fafc',mutedText:'#cbd5e1',primary:'#93c5fd',profit:'#86efac',loss:'#fca5a5',warning:'#fde68a',fontSize:{small:12,body:14,title:22},spacing:16,radius:8,shadow:'none' },
};
export const INITIAL_TEMPLATES: Template[] = [
  {id:'store-overview',name:'店铺商品总览',description:'原始商品字段与时间',theme:{},layout:{type:'column',children:['products']},widgetStyles:[{id:'products',type:'table',bindingId:'main',columns:[{field:'offerId',label:'商品标识'},{field:'title',label:'名称'},{field:'price',label:'售价',format:'currency'},{field:'stock',label:'库存'}],options:{pageSize:20}}],contentRules:{bindingIds:['main']},version:1},
  {id:'profit-filter',name:'利润筛选结果',description:'参考利润，缺成本无法判断，显示计算口径',theme:{},layout:{type:'column',children:['profit']},widgetStyles:[{id:'profit',type:'table',title:'参考利润率',bindingId:'main',columns:[{field:'offerId',label:'商品标识'},{field:'referenceProfit.margin',label:'参考利润率',format:'percent'},{field:'referenceProfit.costMissing',label:'成本缺失'}],options:{sort:{field:'referenceProfit.margin',direction:'desc'},pageSize:20}}],contentRules:{bindingIds:['main'],requiresMetricBasis:true},version:1},
  {id:'operation-receipt',name:'操作结果回执',description:'操作进度与逐项结果',theme:{},layout:{type:'column',children:['status','receipt']},widgetStyles:[{id:'status',type:'status_badge',bindingId:'main',fields:{status:'state'}},{id:'receipt',type:'table',bindingId:'main',columns:[{field:'target',label:'目标'},{field:'state',label:'状态'},{field:'message',label:'结果'}]}],contentRules:{bindingIds:['main']},version:1},
];
export function formatValue(value: unknown, format: 'text'|'currency'|'percent'|'date' = 'text', currency = 'RUB'): string {
  if (value == null) return '—';
  if (format === 'currency' || format === 'percent') {
    const numeric = typeof value === 'number' ? value : format === 'currency' && typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? Number(value.trim()) : NaN;
    if (!Number.isFinite(numeric)) return '无法判断';
    if (format === 'currency' && !/^[A-Z]{3}$/.test(currency)) return '无法判断（币种无效）';
    return new Intl.NumberFormat('zh-CN', format === 'currency' ? {style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2} : {style:'percent',minimumFractionDigits:2,maximumFractionDigits:2}).format(numeric);
  }
  if (format === 'date') { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? '—' : date.toISOString(); }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => { const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4); return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722; };
  const a = luminance(first), b = luminance(second); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
