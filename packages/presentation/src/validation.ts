import type { DataBinding, ViewSpec, WidgetType } from './types.ts';
import { TOOL_DEFINITIONS } from '../../contracts/src/index.ts';

export const WIDGET_TYPES: WidgetType[] = ['stat_card', 'table', 'bar_chart', 'line_chart', 'product_card', 'product_list', 'sku_detail', 'status_badge', 'text'];
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
  object(v, ['id','title','templateId','theme','layout','widgets','bindings','links'], 'view'); text(v.id, 'view.id'); text(v.title, 'view.title');
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
      const native = w.type === 'product_list' || w.type === 'sku_detail';
      object(w.options, ['sort','pageSize','currency','xField','yField','statusField','description','color','showLegend',...(native?['columns','requiresSelection']:[]),...(native||w.type==='table'?['density','fieldMeta','rowsPath','example','materialId','displayColumns']:[])], 'widget.options');
      if(w.options.materialId!==undefined&&w.options.materialId!=='data-table'&&!(w.type==='product_list'&&w.options.materialId==='product-procurement'))throw new PresentationError('INVALID_SPEC','Unknown material');
      if (w.options.sort !== undefined) { object(w.options.sort, ['field','direction'], 'sort'); text(w.options.sort.field, 'sort.field'); if (!['asc','desc'].includes(w.options.sort.direction)) throw new PresentationError('INVALID_SPEC', 'sort.direction must be asc or desc'); }
      if (w.options.pageSize !== undefined && (!Number.isInteger(w.options.pageSize) || w.options.pageSize < 1 || w.options.pageSize > 200)) throw new PresentationError('INVALID_SPEC', 'pageSize must be 1–200');
      if (w.options.density !== undefined && !['comfortable','compact'].includes(w.options.density)) throw new PresentationError('INVALID_SPEC', 'Invalid material density');
      for(const key of ['requiresSelection','example']) if(w.options[key]!==undefined&&typeof w.options[key]!=='boolean') throw new PresentationError('INVALID_SPEC', `${key} must be boolean`);
      if(w.options.rowsPath!==undefined&&typeof w.options.rowsPath!=='string')throw new PresentationError('INVALID_SPEC','rowsPath must be a string');
      if(w.options.columns!==undefined){
        if(!Array.isArray(w.options.columns)||w.options.columns.length>30)throw new PresentationError('INVALID_SPEC','Material columns must be an array of at most 30 columns');
        const names=new Set();
        for(const col of w.options.columns){object(col,['field','label'],'material column');text(col.field,'material column.field');if(col.label!==undefined)text(col.label,'material column.label');if(names.has(col.field))throw new PresentationError('INVALID_SPEC','Duplicate material column');names.add(col.field);}
      }
      if(w.options.displayColumns!==undefined){
        if(!Array.isArray(w.options.displayColumns)||w.options.displayColumns.length>30)throw new PresentationError('INVALID_SPEC','Display columns must be an array of at most 30 columns');
        const names=new Set();
        for(const col of w.options.displayColumns){object(col,['field','label','visible'],'display column');text(col.field,'display column.field');if(col.label!==undefined)text(col.label,'display column.label');if(typeof col.visible!=='boolean')throw new PresentationError('INVALID_SPEC','Display column visibility must be boolean');if(names.has(col.field))throw new PresentationError('INVALID_SPEC','Duplicate display column');names.add(col.field);}
      }
      if(w.options.fieldMeta!==undefined){
        object(w.options.fieldMeta,Object.keys(w.options.fieldMeta??{}),'fieldMeta');
        for(const meta of Object.values(w.options.fieldMeta) as any[]){
          object(meta,['key','origin','label','description','format','unit','currency','currencyPath','percentScale','numericScale','confirmed','path','role'],'field metadata');
          for(const key of ['key','label','description','unit','currency','currencyPath','path','role'])if(meta[key]!==undefined&&typeof meta[key]!=='string')throw new PresentationError('INVALID_SPEC',`field metadata ${key} must be a string`);
          if(meta.origin!==undefined){object(meta.origin,['source','label'],'field origin');text(meta.origin.source,'field origin.source');text(meta.origin.label,'field origin.label');}
          if(meta.format!==undefined&&!['text','currency','percent','integer','datetime','image'].includes(meta.format))throw new PresentationError('INVALID_SPEC','Invalid semantic format');
          if(meta.percentScale!==undefined&&!['fraction','whole'].includes(meta.percentScale))throw new PresentationError('INVALID_SPEC','Invalid percentage scale');
          if(meta.numericScale!==undefined&&(typeof meta.numericScale!=='number'||!Number.isFinite(meta.numericScale)||meta.numericScale<=0))throw new PresentationError('INVALID_SPEC','Invalid numeric scale');
          if(meta.confirmed!==undefined&&typeof meta.confirmed!=='boolean')throw new PresentationError('INVALID_SPEC','confirmed must be boolean');
        }
      }
    }
    const profitFields = [...Object.values(w.fields ?? {}), ...(w.columns ?? []).map((c: any) => c.field)].join(' ');
    if (/profit|margin|利润/i.test(profitFields) && /实际结算|实际净利润|settled net profit/i.test(`${w.title ?? ''} ${(w.columns ?? []).map((c: any) => c.label).join(' ')}`)) throw new PresentationError('METRIC_BASIS_INVALID', 'Reference profits must not be labelled actual settled net profit');
  }
  if(v.links!==undefined){
    if(!Array.isArray(v.links)||v.links.length>100)throw new PresentationError('INVALID_SPEC','links must be an array');
    const targets=new Set();
    for(const link of v.links){
      object(link,['from','to'],'link');object(link.from,['widgetId','event','field'],'link.from');object(link.to,['bindingId','param'],'link.to');
      if(!widgets.has(link.from.widgetId)||v.widgets.find((w:any)=>w.id===link.from.widgetId)?.type!=='product_list'||link.from.event!=='select'||link.from.field!=='product.id')throw new PresentationError('INVALID_SPEC','Link must select a product from a product list');
      if(!bindings.has(link.to.bindingId))throw new PresentationError('INVALID_SPEC','Unknown linked binding');text(link.to.param,'linked parameter');
      if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(link.to.param)||unsafe.has(link.to.param))throw new PresentationError('INVALID_SPEC','Invalid linked parameter');
      const target=`${link.to.bindingId}:${link.to.param}`;if(targets.has(target))throw new PresentationError('INVALID_SPEC','Duplicate linked parameter');targets.add(target);
    }
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
