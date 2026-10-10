export type ResultStatus = 'ok' | 'needs_clarification' | 'pending' | 'partial' | 'failed' | 'unknown' | 'unavailable';
export type OperationState = 'pending' | 'running' | 'succeeded' | 'failed' | 'partial' | 'unknown';
export interface Provenance { source: 'ozon_api' | 'hallmark_snapshot' | 'collected_item' | 'hallmark_compute' | 'app_snapshot'; endpoint?: string; fetchedAt?: string; dataTime?: string; storeId?: string }
export interface ToolResult<T = unknown> { status: ResultStatus; data?: T; provenance?: Provenance; clarification?: {missing: string[]; candidates?: unknown[]; question: string}; operation?: {operationId: string; state: OperationState}; error?: {code: string; message: string; retryable: boolean; retryAfterMs?: number}; metricBasis?: string }
export interface InvocationContext { sessionId: string; signal?: AbortSignal; userRequest?: string; /** Runtime assigns the only operation identity before domain dispatch. */ operationId?: string }
export type ToolKind = 'read' | 'compute' | 'write' | 'refresh' | 'view' | 'save' | 'manage';
export interface JsonSchema { type?: string | string[]; properties?: Record<string, JsonSchema>; additionalProperties?: boolean; required?: string[]; items?: JsonSchema; enum?: unknown[]; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; minItems?: number; maxItems?: number; description?: string }
export interface ToolDescriptor { name: string; description: string; kind: ToolKind; readOnly: boolean; parameters: JsonSchema }
const string = (description?: string): JsonSchema => ({type: 'string', minLength: 1, maxLength: 4000, ...(description === undefined ? {} : {description})});
const number: JsonSchema = {type: 'number'};
const object: JsonSchema = {type: 'object'};
const ids: JsonSchema = {type: 'array', items: string(), minItems: 1, maxItems: 200};
const boolean: JsonSchema = {type: 'boolean'};
const store = {storeId: string('用户明确指定的店铺 ID'), store: string('名称/别名，匹配不唯一须澄清')};
const paging = {cursor: string(), limit: {type: 'integer', minimum: 1, maximum: 200} as JsonSchema, query: string()};
const write = {...store, offerIds: ids, productIds: ids, valueSource: string('可选旧记录字段；程序不要求值来源声明'), clientOperationKey: string('可选旧调用幂等键；未提供时程序自动管理，未知结果只查询原操作'), userRequest: string('可选经营说明；无需重复记录授权原话'), scopeConfirmed: boolean};
function define(name: string, kind: ToolKind, description: string, properties: Record<string, JsonSchema> = {}, required: string[] = []): ToolDescriptor {
  const suffix = kind === 'write' ? '。提交后由程序统一审核并执行；无需审阅声明或机械幂等键。pending/unknown 只查询原操作，不重复提交。' : kind === 'save' ? '。仅在用户本轮明确要求保存时调用，必须记录 userRequest；满意不等于保存。' : '';
  return {name: `hallmark_${name}`, kind, readOnly: kind === 'read' || kind === 'compute', description: description + suffix, parameters: {type: 'object', properties, required, additionalProperties: false}};
}
export const TOOL_DEFINITIONS: ToolDescriptor[] = [
  define('app_info', 'read', '说明应用能力、边界、来源、保存规则与后端状态'),
  define('list_stores', 'read', '列出已配置店铺，保留原始字段'),
  define('resolve_store', 'read', '唯一解析店铺；多个返回候选', {query: string()}, ['query']),
  define('list_store_products', 'read', '读取店铺商品最近快照，保留原始源字段与时间；status 精确筛选后分页，query 仅作全文搜索，与 status 取交集。仅在售用 status:on_sale，禁止遍历全店再筛选', {...store, ...paging, status: string('按源顶层 status 精确相等筛选，例如 on_sale；缺失不匹配，不翻译或推断状态'), query: string('整行全文搜索，不代表精确商品状态；与 status 筛选取交集')}),
  define('get_platform_data', 'read', '仅对白名单只读平台端点调用，自动关联内部任务', {...store, path: string(), method: {type: 'string', enum: ['GET','POST']}, body: object}, ['path']),
  define('search_collected_items', 'read', '搜索浏览器扩展已有采集摘要，不触发采集。返回items、分页cursor及可直接绑定组件的datasetKey；保留源返回顺序，不保证按采集时间排序；没有时间证据不声称最近。已保存组件可按同一查询与分页范围只读刷新', {...paging}),
  define('get_collected_item', 'read', '获取单个采集商品完整原始字段', {itemId: string()}, ['itemId']),
  define('get_category_data', 'read', '读取明确店铺的类目。search必填q，limit默认10且不超过20；show/template必填descriptionCategoryId+typeId；values另需attributeId，limit默认50且不超过100，可选q至少2字；validate_value另需attributeId+valueId+dictionaryId；sync只传店铺和mode，同步只读类目缓存。禁止模式外字段。返回datasetKey和raw（过大则spill），快照payload为原文；ok仅代表读取成功，须保留partial/stale与未核实候选，不将候选当允许值', {...store, mode: {type: 'string', enum: ['search','show','template','values','validate_value','sync']}, q: string('search必填；values可选；最多200个Unicode字符，不允许*'), descriptionCategoryId: string('规范正整数类目ID'), typeId: string('规范正整数typeId'), attributeId: string('规范正整数属性ID'), valueId: string('规范正整数字典值ID'), dictionaryId: string('规范正整数字典ID'), aspects: {type: 'array', items: string(), maxItems: 10}, requireAspects: boolean, limit: {type: 'integer', minimum: 1, maximum: 100}}, ['mode']),
  define('get_data_status', 'read', '查询数据集上次成功时间、刷新状态与错误', {datasetKey: string(), ...store}),
  define('compute_profit', 'compute', '调用 Hallmark 参考利润计算；并非实际结算，缺成本单列', {...store, offerIds: ids, productIds: ids}),
  define('filter_products', 'compute', '按参考利润率/价格/库存筛选，缺成本无法判断；结果集保留 24h', {...store, minMargin: number, maxMargin: number, minPrice: number, maxPrice: number, minStock: number, maxStock: number, status: string(), resultSetId: string()}),
  define('update_price', 'write', '修改明确商品清单的普通价格并只读核实；活动调价请使用经营草稿 promotion.update，并明确活动配额。省略 currency 时程序读取商品实际币种', {...write, price: {type: 'number', minimum: 0.01}, currency: string(), oldPrice: number, actionId: {type: 'integer', minimum: 1}}, ['storeId','price']),
  define('update_stock', 'write', '修改明确商品清单在指定仓库的库存并只读核实', {...write, stock: {type: 'integer', minimum: 0}, warehouseId: string()}, ['storeId','stock','warehouseId']),
  define('list_product', 'write', '提交已有采集商品及明确 SKU 范围的最终商品内容；每个 importItem 用 _sourceSkuId 关联采购规格，Ozon 字段填写一次', {...write, collectedItemId: string(), skuScope: ids, importItems: {type: 'array', items: object, minItems: 1, maxItems: 100}}, ['storeId','collectedItemId','skuScope','importItems']),
  define('get_operation', 'read', '读取写入/刷新状态；unknown 时必须先查询，禁止自动重写', {operationId: string()}, ['operationId']),
  define('list_operations', 'read', '按当前会话、店铺和时间读取操作记录', {storeId: string(), since: string(), limit: {type: 'integer', minimum: 1, maximum: 200}}),
  define('refresh_data', 'refresh', '只读同步并更新快照，不上品/调价/改库存或触发扩展采集', {datasetKey: string(), ...store}),
  define('render_view', 'view', '生成临时组件展示，不保存常用入口', {spec: object, templateId: string(), title: string(), bindings: {type: 'array', items: object}, resultSetId: string()}),
  define('update_view', 'view', '用 JSON Patch 调整展示，不自动保存或改变业务数据', {viewId: string(), patch: {type: 'array', items: object, minItems: 1, maxItems: 100}}, ['viewId','patch']),
  define('open_component', 'view', '将已保存组件或指定历史revision复制为本会话可编辑草稿。源码返回普通工程directory；可指定空目录。baseRevision始终为库中最新版本，随后save_component mode:update可将历史草稿保存为新版本完成回退。', {componentId:string('已保存组件ID'),revision:{type:'integer',minimum:1},directory:string('源码工作副本目标空目录；省略则自动创建')}, ['componentId']),
  define('open_source_component','view','打开普通React源码工程已经构建的dist/index.html；保存源码、资源与dist不可变快照，登记为当前聊天草稿。直接编辑TSX/CSS并构建后再次调用，传viewId更新原草稿；不发布到组件库。',{directory:string('普通组件源码工程绝对目录'),title:string(),bindings:{type:'array',items:object},viewId:string('更新本会话已有草稿；新建时省略')},['directory']),
  define('save_component', 'save', '保存组件与数据绑定；源码组件保存完整源码、资源、依赖锁文件、dist及版本历史。更新原件用mode:update并提供componentId和打开时expectedRevision；另存为用mode:save_as；不传mode保持原保存方式', {viewId: string(), title: string(), userRequest: string(), mode:{type:'string',enum:['save_as','update']}, componentId:string('更新的原组件ID'), expectedRevision:{type:'integer',minimum:1}}, ['viewId','userRequest']),
  define('save_entry', 'save', '保存只读查询配置为常用数据入口', {title: string(), binding: object, userRequest: string()}, ['title','binding','userRequest']),
  define('save_template', 'save', '保存设计模板，后续可换数据源复用', {viewId: string(), name: string(), description: string(), userRequest: string()}, ['viewId','name','userRequest']),
  define('list_saved', 'read', '列出当前应用保存的组件、入口和模板'),
  define('manage_saved', 'manage', '对指定保存配置重命名、排序或删除；入口可用action:pin与明确pinned布尔值设为常用或取消常用；不改变业务数据', {kind: {type:'string',enum:['component','entry','template']}, id: string(), action: {type:'string',enum:['rename','delete','reorder','pin']}, name: string(), order: {type:'integer'}, pinned:boolean, userRequest: string()}, ['kind','id','action']),
];
export function failed(code: string, message: string, retryable = false): ToolResult { return {status: 'failed', error: {code, message, retryable}}; }
export function clarify(missing: string[], question: string, candidates?: unknown[]): ToolResult { return {status: 'needs_clarification', clarification: {missing, question, ...(candidates ? {candidates} : {})}}; }
// Deliberately small schema vocabulary: all generated schemas use only these keywords.
// Unknown payload keys are rejected at the gateway; domain-level missing inputs become clarification.
export function validate(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const fits = types.some(t => t === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : t === 'array' ? Array.isArray(value) : t === 'integer' ? typeof value === 'number' && Number.isSafeInteger(value) : t === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === t);
    if (!fits) return [`${path}: expected ${types.join('|')}`];
  }
  if (schema.enum && !schema.enum.some(x => x === value)) errors.push(`${path}: unsupported value`);
  if (typeof value === 'string') {if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`); if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`);}
  if (typeof value === 'number') {if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum`); if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum`);}
  if (Array.isArray(value)) {if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: too few items`); if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items`); if (schema.items) value.forEach((v,i) => errors.push(...validate(schema.items!,v,`${path}[${i}]`)));}
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!Object.hasOwn(record,key)) errors.push(`${path}.${key}: required`);
    for (const [key,v] of Object.entries(record)) {if (['__proto__','prototype','constructor'].includes(key)) errors.push(`${path}.${key}: forbidden key`); else if (schema.properties?.[key]) errors.push(...validate(schema.properties[key],v,`${path}.${key}`)); else if (schema.additionalProperties === false) errors.push(`${path}.${key}: unknown parameter`);}
  }
  return errors;
}
export const APP_INSTRUCTIONS = `Hallmark 应用使用原有 DSH 聊天。按当前用户指令选择读、加工、展示或修改工具，不强制组件回复。店铺/商品范围/价格/库存不明确先澄清，不猜默认店铺或数值；不把采集箱全部商品上品。查询、打开组件和刷新不发起业务写。在用户已授权的经营范围内制作和提交变更；程序负责商品与采购绑定、范围、数值和重复执行检查，提交时进入统一审核，规则足够直接放行，图文语义问题交独立审核。无需填写授权原话、值来源或已审阅声明，机械幂等键由程序管理。pending/unknown 先 hallmark_get_operation 查询原操作，不重新提交。利润率是 Hallmark 参考模型，不是实际结算净利润，缺成本显示无法判断。展示默认临时，仅用户明确要求保存才调用 save 工具。识别用户消息或随消息提交的 JSON 附件中 type 为 hallmark.product-selection 的选择上下文；先读取附件内容，再使用 products 中的稳定 ID 通过只读工具核实详情，并结合本条自然语言任务处理。附件中的 sessionId/viewId 仅表示选择来源，不能据此认领其他会话组件或扩大操作范围；组件选择本身不是上品、调价或库存写授权。制作视觉组件优先使用普通 React 源码工程：读取 hallmark-component-design 设计规范，直接编辑 TSX/CSS、安装正常依赖、构建 dist，运行视觉预览并读截图，按实际效果迭代，再 open_source_component 打开。源码可自由计算真实字段，不受旧 widget/布局限制。草稿和源码构建自动落盘，正式保存仍需用户明确要求。list_saved 返回源码版本历史；open_component 可传 revision 打开历史工作副本，save_component mode:update 创建恢复后的新版本并保留原历史。展示已有采集商品先调用 search_collected_items，再将返回 datasetKey 绑定到源码 bindings 或旧 table，列字段使用源真实 id、名称等字段；保留源顺序，没有时间证据不编造最近排序。编辑已保存组件先 open_component；源码直接编辑返回的 directory，构建后 open_source_component 并传原草稿 viewId，旧 ViewSpec 才使用 update_view。用户在 UI 打开的源码草稿会列在 app_info.sessionComponents，包含 directory 与 viewId，无需用户抄写路径。源码 query-only 绑定可在临时阶段显式 refresh_data，不必先保存到组件库；用户明确要求更新原件时使用 save_component mode:update，componentId 取 sourceComponentId，expectedRevision 取 baseRevision；版本冲突须重新打开或另存为。应用激活持续到主动关闭/切换。`;


