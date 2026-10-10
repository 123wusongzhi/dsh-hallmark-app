import type { BusinessAction, BusinessPlan, BusinessRow, BusinessRowInput, BusinessRowStatus } from '../../../app-hallmark/src/operations/types.ts';
import type { BusinessPriceQuote } from '../../../business-pricing/src/types.ts';

export const BUSINESS_ACTION_LABELS: Record<BusinessAction, string> = {
  price: '调整售价', stock: '调整库存', archive: '下架归档',
  'promotion.enroll': '报名活动', 'promotion.update': '调整活动价格', 'promotion.exit': '退出活动', listing: '上品',
};
export const BUSINESS_STATUS_LABELS: Record<BusinessRowStatus, string> = {
  draft: '草稿', reviewing: '正在审核', blocked: '待修正', needs_user: '需要经营判断', review_pending: '等待审核',
  ready: '可以提交', dispatching: '正在发送', pending: '平台处理中', unknown: '结果待核查', succeeded: '已完成', rejected: '平台退回',
};
export const BUSINESS_FIELD_LABELS: Record<string, string> = {
  price: '售价', old_price: '划线价', min_price: '最低售价', currency_code: '币种', stock: '数量', warehouse_id: '仓库编号',
  action_id: '活动编号', archived: '归档', member: '已参加活动', name: '商品标题', offer_id: '销售货号',
  description_category_id: '类目编号', type_id: '商品类型', attributes: '商品属性', images: '商品图片', primary_image: '主图',
  description: '详情', vat: '税率', height: '高', width: '宽', depth: '长', dimension_unit: '尺寸单位', weight: '重量', weight_unit: '重量单位',
};
export function editableBusinessRow(row: BusinessRow): boolean {
  return !['succeeded', 'dispatching', 'pending', 'unknown', 'reviewing'].includes(row.status);
}
export function businessRowInput(row: BusinessRow, payload = row.payload, pricing = row.pricing): BusinessRowInput {
  return { rowId: row.rowId, action: row.action, target: row.target, payload,
    ...(row.procurement ? { procurement: row.procurement } : {}), ...(row.referenceSubjects ? { referenceSubjects: row.referenceSubjects } : {}), ...(row.dependsOn ? { dependsOn: row.dependsOn } : {}), ...(pricing ? { pricing } : {}) };
}
/** Public plans project this quote outside the private execution context. */
export function businessPricingQuote(row: BusinessRow): BusinessPriceQuote | undefined {
  return (row as BusinessRow & { pricingQuote?: BusinessPriceQuote }).pricingQuote ?? row.context?.pricingQuote;
}
export function businessPriceAction(action: BusinessAction): boolean { return ['price', 'listing', 'promotion.enroll', 'promotion.update'].includes(action); }
export function businessMoney(minor: number | null | undefined, currency = 'CNY'): string { return minor == null ? '待补充' : `${(minor / 100).toFixed(2)} ${currency}`; }
export function filterBusinessRows(plan: BusinessPlan | undefined, query: string, status: string): BusinessRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return (plan?.rows ?? []).filter(row => (!status || row.status === status) && (!needle ||
    [row.target.offerId, row.target.productId, row.target.sku, BUSINESS_ACTION_LABELS[row.action], row.payload.name,
      ...(row.binding?.components.map(item => item.sourceSkuId) ?? []), businessPricingQuote(row)?.planName, businessPricingQuote(row)?.selectionReason,
      ...(businessPricingQuote(row)?.issues.map(issue => issue.message) ?? []), ...row.issues.map(issue => issue.message)]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(needle))));
}
export function businessValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return `${value.length} 项`;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
/** Only business fields are editable; backend-owned identity, costs and review evidence never round-trip through form input. */
export function parseBusinessPayload(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('商品内容必须是字段对象。');
  return value as Record<string, unknown>;
}
