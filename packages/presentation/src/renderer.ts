import type { BindingData, LayoutNode, ViewSpec, WidgetSpec } from './types.ts';
import { formatValue, THEMES } from './design.ts';
import { validateViewSpec } from './validation.ts';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
function field(object: any, path: string): any {
  let result = object;
  for (const part of path.split('.')) {if (['__proto__','constructor','prototype'].includes(part) || !result || !Object.hasOwn(result,part)) return undefined; result = result[part];}
  return result;
}
function missingCost(row: any): boolean { return row?.costMissing === true || row?.referenceProfit?.costMissing === true; }
function rows(payload: any): any[] { return Array.isArray(payload) ? payload : payload?.rows ?? payload?.items ?? payload?.products ?? payload?.results ?? [payload]; }
function safeImage(url: unknown): string { if (typeof url !== 'string') return ''; try { const u = new URL(url); return ['https:','http:'].includes(u.protocol) ? escape(u.href) : ''; } catch {return '';} }
export function renderViewHTML(spec: ViewSpec, data: BindingData[], mode: 'light'|'dark' = 'light'): string {
  validateViewSpec(spec);
  const theme = {...THEMES[mode],...spec.theme};
  const widgetHTML = new Map<string,string>();
  for (const widget of spec.widgets) {
    const binding = data.find(b => b.bindingId === widget.bindingId);
    const payload = binding?.payload;
    const list = rows(payload).filter(Boolean);
    const first = list[0] ?? {};
    const read = (key: string, fallback: string) => field(first,widget.fields?.[key] ?? fallback);
    const profit = /profit|margin|利润/i.test(JSON.stringify([widget.fields,widget.columns]));
    const basis = binding?.metricBasis ?? '口径未提供，利润数据无法判断';
    let body = '';
    if (!binding && widget.type !== 'text') body = '<div role="status" class="empty"><p>暂无成功快照</p><p>先查询对应数据，或通过刷新获取最近可用数据。</p></div>';
    else if (widget.type === 'text') body = `<p>${escape(widget.text)}</p>`;
    else if (widget.type === 'table') {
      let sorted = [...list];
      const sort = widget.options?.sort as {field:string;direction:string} | undefined;
      if (sort) sorted.sort((a,b) => {const x = field(a,sort.field),y = field(b,sort.field); if (x == null || a.costMissing) return 1; if (y == null || b.costMissing) return -1; return (typeof x === 'number' && typeof y === 'number' ? x-y : String(x).localeCompare(String(y))) * (sort.direction === 'desc' ? -1 : 1);});
      const pageSize = Number(widget.options?.pageSize ?? 20);
      body = `<div class="table-scroll"><table><thead><tr>${(widget.columns ?? []).map(c => `<th>${escape(c.label)}</th>`).join('')}</tr></thead><tbody>${sorted.slice(0,pageSize).map(row => `<tr>${(widget.columns ?? []).map(c => `<td>${escape(missingCost(row) && /profit|margin|利润/i.test(c.field) ? '无法判断（缺成本）' : profit && !binding?.metricBasis && /profit|margin|利润/i.test(c.field) ? '无法判断（缺口径）' : formatValue(field(row,c.field),c.format,String(widget.options?.currency ?? 'RUB')))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${Math.min(pageSize,sorted.length)} / ${sorted.length} 行</p>`;
    } else if (widget.type === 'stat_card') body = `<strong class="stat">${escape(profit && (missingCost(first) || !binding?.metricBasis) ? '无法判断' : formatValue(read('value','value')))}</strong>`;
    else if (widget.type === 'status_badge') body = `<span class="badge">${escape(read('status','state') ?? binding?.state)}</span>`;
    else if (widget.type === 'product_card') {
      const image = safeImage(read('image','image'));
      body = `${image ? `<img src="${image}" alt="商品图片" loading="lazy" referrerpolicy="no-referrer">` : ''}<h3>${escape(read('title','name'))}</h3><p>价格 ${escape(formatValue(read('price','price'),'currency',String(widget.options?.currency ?? 'RUB')))} · 库存 ${escape(formatValue(read('stock','stock')))}</p><p>参考利润率 ${escape(missingCost(first) ? '无法判断（缺成本）' : !binding?.metricBasis ? '无法判断（缺口径）' : formatValue(read('margin','margin'),'percent'))}</p>`;
    } else if (widget.type === 'bar_chart' || widget.type === 'line_chart') {
      const yField = String(widget.options?.yField ?? widget.fields?.value ?? 'value');
      const xField = String(widget.options?.xField ?? widget.fields?.label ?? 'label');
      const points = list.slice(0,40).map(row => ({label:field(row,xField),value:field(row,yField)})).filter(point => typeof point.value === 'number' && Number.isFinite(point.value));
      const max = Math.max(1,...points.map(p => Math.abs(p.value)));
      const coords = points.map((p,i) => ({...p,x:30+(i+0.5)*520/Math.max(1,points.length),y:110-p.value/max*85}));
      const shape = widget.type === 'line_chart' ? `<polyline fill="none" stroke="${theme.primary}" stroke-width="3" points="${coords.map(p => `${p.x},${p.y}`).join(' ')}"/>` : coords.map(p => `<rect x="${p.x-180/Math.max(1,points.length)}" y="${Math.min(110,p.y)}" width="${360/Math.max(1,points.length)}" height="${Math.abs(110-p.y)}" fill="${theme.primary}"><title>${escape(p.label)}: ${escape(p.value)}</title></rect>`).join('');
      body = profit && !binding?.metricBasis ? '<p>无法判断（缺口径）</p>' : `<svg role="img" aria-label="${escape(widget.title ?? widget.type)}" viewBox="0 0 580 220"><path d="M20 110H560" stroke="${theme.mutedText}"/>${shape}${coords.map(p => `<text x="${p.x}" y="210" text-anchor="middle" fill="${theme.text}" font-size="10">${escape(p.label)}</text>`).join('')}</svg>`;
    }
    const footer = `<footer><span>数据时间：${escape(binding?.dataTime ?? '未知')}</span><span>来源：${escape(binding?.provenance?.source ?? '无数据')}</span>${profit || widget.type === 'product_card' ? `<span>口径：${escape(basis)}</span>` : binding?.metricBasis ? `<span>口径：${escape(binding.metricBasis)}</span>` : ''}${binding?.state === 'failed' ? '<span role="status">更新失败，显示上次成功数据</span>' : binding?.state === 'refreshing' ? '<span role="status">更新中</span>' : ''}</footer>`;
    widgetHTML.set(widget.id,`<section class="widget" data-widget="${widget.type}">${widget.title ? `<h2>${escape(widget.title)}</h2>` : ''}${body}${footer}</section>`);
  }
  const layout = (node: LayoutNode): string => `<div class="layout ${node.type}" style="gap:${node.gap ?? theme.spacing}px;${node.type === 'grid' ? `grid-template-columns:repeat(${node.columns ?? 2},minmax(0,1fr));` : ''}">${node.children.map(child => typeof child === 'string' ? widgetHTML.get(child) : layout(child)).join('')}</div>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(spec.title)}</title><style>body{background:${theme.background};color:${theme.text};font:${theme.fontSize.body}px system-ui;line-height:1.5;font-variant-numeric:tabular-nums;margin:0;padding:${theme.spacing}px}h1{font-size:${theme.fontSize.title}px}h2{font-size:18px}.layout{display:flex;flex-direction:column}.row,.tabs{flex-direction:row;flex-wrap:wrap}.grid{display:grid}.widget{background:${theme.surface};border-radius:${theme.radius}px;padding:${theme.spacing}px;box-shadow:${theme.shadow};min-width:0;flex:1}footer{display:flex;flex-wrap:wrap;gap:4px 16px;color:${theme.mutedText};font-size:${theme.fontSize.small}px;margin-top:12px}:focus-visible{outline:2px solid ${theme.primary};outline-offset:3px}.empty{padding:16px 0;color:${theme.mutedText}}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid ${theme.mutedText}}.stat{font-size:32px}.badge{color:${theme.primary};font-weight:600}img{max-width:100%;max-height:180px}svg{max-width:100%}@media(max-width:767px){.grid{grid-template-columns:1fr!important}.row,.tabs{flex-direction:column}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head><body><h1>${escape(spec.title)}</h1>${layout(spec.layout)}</body></html>`;
}
