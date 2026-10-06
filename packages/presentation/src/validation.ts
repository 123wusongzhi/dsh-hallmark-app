import type { DataBinding, ViewSpec, WidgetType } from './types.ts';
import { TOOL_DEFINITIONS } from '../../contracts/src/index.ts';

export const WIDGET_TYPES: WidgetType[] = ['stat_card', 'table', 'bar_chart', 'line_chart', 'product_card', 'status_badge', 'text'];
export const READ_QUERY_TOOLS = new Set(TOOL_DEFINITIONS.filter(tool => tool.readOnly && ['read','compute'].includes(tool.kind) && !['hallmark_app_info','hallmark_resolve_store','hallmark_list_saved','hallmark_get_operation','hallmark_list_operations','hallmark_get_data_status'].includes(tool.name)).map(tool => tool.name));
export class PresentationError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
export function safeJSON(value: unknown, depth = 0): void {
  if (depth > 40) throw new PresentationError('INVALID_SPEC', 'Spec nesting exceeds limit');
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object') throw new PresentationError('INVALID_SPEC', 'Only JSON values are accepted');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new PresentationError('INVALID_SPEC', 'Only plain JSON objects are accepted');
  for (const [key, item] of Object.entries(value)) {
    if (unsafe.has(key)) throw new PresentationError('UNSAFE_PATCH', `Unsafe property: ${key}`);
    if (['clientid','apikey'].includes(key.toLowerCase().replace(/[-_]/g, ''))) throw new PresentationError('INVALID_SPEC', 'Credentials must remain in Hallmark');
    safeJSON(item, depth + 1);
  }
}
function object(value: any, keys: string[], label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PresentationError('INVALID_SPEC', `${label} must be an object`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new PresentationError('INVALID_SPEC', `${label}: unknown field ${key}`);
}
function text(value: any, label: string): void { if (typeof value !== 'string' || !value.trim()) throw new PresentationError('INVALID_SPEC', `${label} is required`); }
function strings(value: any, label: string): void {
  object(value, Object.keys(value ?? {}), label);
  for (const [key, item] of Object.entries(value)) { text(key, label); text(item, label); }
}
export function validateBinding(binding: unknown): asserts binding is DataBinding {
  safeJSON(binding);
  const b: any = binding;
  object(b, ['id','datasetKey','query','fieldMap'], 'binding'); text(b.id, 'binding.id');
  if (!b.datasetKey && !b.query) throw new PresentationError('INVALID_SPEC', 'Binding requires datasetKey or a read-only query');
  if (b.datasetKey !== undefined) text(b.datasetKey, 'datasetKey');
  strings(b.fieldMap, 'fieldMap');
  if (b.query !== undefined) {
    object(b.query, ['tool','params'], 'query');
    if (!READ_QUERY_TOOLS.has(b.query.tool)) throw new PresentationError('QUERY_NOT_READ_ONLY', 'Saved queries cannot write, refresh or invoke arbitrary tools');
    object(b.query.params, Object.keys(b.query.params ?? {}), 'query.params');
  }
}
export function validateViewSpec(value: unknown): asserts value is ViewSpec {
  safeJSON(value);
  const v: any = value;
  object(v, ['id','title','templateId','theme','layout','widgets','bindings'], 'view'); text(v.id, 'view.id'); text(v.title, 'view.title');
  if (v.templateId !== undefined) text(v.templateId, 'templateId');
  if (!Array.isArray(v.widgets) || !v.widgets.length || v.widgets.length > 100) throw new PresentationError('INVALID_SPEC', 'View requires 1–100 widgets');
  if (!Array.isArray(v.bindings) || v.bindings.length > 100) throw new PresentationError('INVALID_SPEC', 'bindings must be an array');
  const bindings = new Set<string>();
  for (const b of v.bindings) { validateBinding(b); if (bindings.has(b.id)) throw new PresentationError('INVALID_SPEC', 'Duplicate binding id'); bindings.add(b.id); }
  const widgets = new Set<string>();
  for (const w of v.widgets) {
    object(w, ['id','type','title','bindingId','fields','columns','text','options'], 'widget'); text(w.id, 'widget.id');
    if (!WIDGET_TYPES.includes(w.type)) throw new PresentationError('INVALID_SPEC', 'Unsupported widget type');
    if (widgets.has(w.id)) throw new PresentationError('INVALID_SPEC', 'Duplicate widget id'); widgets.add(w.id);
    if (w.title !== undefined) text(w.title, 'widget.title');
    if (w.text !== undefined && typeof w.text !== 'string') throw new PresentationError('INVALID_SPEC', 'widget.text must be a string');
    if (w.bindingId !== undefined && !bindings.has(w.bindingId)) throw new PresentationError('INVALID_SPEC', 'Unknown bindingId');
    if (w.type !== 'text' && !w.bindingId) throw new PresentationError('INVALID_SPEC', 'Data widgets require a binding');
    if (w.fields !== undefined) strings(w.fields, 'widget.fields');
    if (w.columns !== undefined) {
      if (!Array.isArray(w.columns)) throw new PresentationError('INVALID_SPEC', 'columns must be an array');
      for (const col of w.columns) { object(col, ['field','label','format'], 'column'); text(col.field, 'column.field'); text(col.label, 'column.label'); if (col.format !== undefined && !['text','currency','percent','date'].includes(col.format)) throw new PresentationError('INVALID_SPEC', 'Invalid column format'); }
    }
    if (w.options !== undefined) {
      object(w.options, ['sort','pageSize','currency','xField','yField','statusField','description','color','showLegend'], 'widget.options');
      if (w.options.sort !== undefined) { object(w.options.sort, ['field','direction'], 'sort'); text(w.options.sort.field, 'sort.field'); if (!['asc','desc'].includes(w.options.sort.direction)) throw new PresentationError('INVALID_SPEC', 'sort.direction must be asc or desc'); }
      if (w.options.pageSize !== undefined && (!Number.isInteger(w.options.pageSize) || w.options.pageSize < 1 || w.options.pageSize > 200)) throw new PresentationError('INVALID_SPEC', 'pageSize must be 1–200');
    }
    const profitFields = [...Object.values(w.fields ?? {}), ...(w.columns ?? []).map((c: any) => c.field)].join(' ');
    if (/profit|margin|利润/i.test(profitFields) && /实际结算|实际净利润|settled net profit/i.test(`${w.title ?? ''} ${(w.columns ?? []).map((c: any) => c.label).join(' ')}`)) throw new PresentationError('METRIC_BASIS_INVALID', 'Reference profits must not be labelled actual settled net profit');
  }
  const used = new Set<string>();
  const visit = (node: any) => {
    object(node, ['type','children','columns','gap'], 'layout');
    if (!['grid','row','column','tabs'].includes(node.type) || !Array.isArray(node.children)) throw new PresentationError('INVALID_SPEC', 'Invalid layout');
    if (node.columns !== undefined && (!Number.isInteger(node.columns) || node.columns < 1 || node.columns > 12)) throw new PresentationError('INVALID_SPEC', 'Grid columns must be 1–12');
    if (node.gap !== undefined && (typeof node.gap !== 'number' || node.gap < 0 || node.gap > 128)) throw new PresentationError('INVALID_SPEC', 'Invalid gap');
    for (const child of node.children) { if (typeof child === 'string') { if (!widgets.has(child) || used.has(child)) throw new PresentationError('INVALID_SPEC', 'Layout references an unknown or repeated widget'); used.add(child); } else visit(child); }
  };
  visit(v.layout);
  if (used.size !== widgets.size) throw new PresentationError('INVALID_SPEC', 'Every widget must occur in layout');
  if (v.theme !== undefined) {
    object(v.theme, ['background','surface','text','mutedText','primary','profit','loss','warning','fontSize','spacing','radius','shadow'], 'theme');
    for (const key of ['background','surface','text','mutedText','primary','profit','loss','warning']) if (v.theme[key] !== undefined && !/^#[\da-f]{6}$/i.test(v.theme[key])) throw new PresentationError('INVALID_SPEC', 'Theme colors must be hex RGB');
    for (const key of ['spacing','radius']) if (v.theme[key] !== undefined && (!Number.isFinite(v.theme[key]) || v.theme[key] < 0 || v.theme[key] > 128)) throw new PresentationError('INVALID_SPEC', 'Invalid theme dimension');
    if (v.theme.fontSize !== undefined) { object(v.theme.fontSize, ['small','body','title'], 'fontSize'); for (const size of Object.values(v.theme.fontSize)) if (typeof size !== 'number' || size < 10 || size > 96) throw new PresentationError('INVALID_SPEC', 'Invalid fontSize'); }
    if (v.theme.shadow !== undefined && !/^[\d\s.pxrgba(),#%-]+$/i.test(v.theme.shadow) && v.theme.shadow !== 'none') throw new PresentationError('INVALID_SPEC', 'Invalid shadow');
  }
}
