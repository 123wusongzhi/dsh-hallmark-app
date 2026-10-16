import type { ResolvedPackaging } from '../../business-packaging/src/types.ts';
import type { BusinessIssue, ListingPackagingFields } from './operations/types.ts';

const ruleOrigins = new Set(['user', 'sku-source', 'product-common', 'quantity-sum', 'existing-combination', 'member-dimensions']);
/** A small public editing contract, without source identities, evidence or procurement data. */
export function listingPackagingFields(resolved: ResolvedPackaging): ListingPackagingFields {
  const state = (origin: string, available: boolean) => available && ruleOrigins.has(origin) ? 'rules' as const : origin === 'draft' ? 'draft' as const : origin === 'missing' ? 'missing' as const : undefined;
  return { weight: state(resolved.origin.weight, resolved.weightGrams !== null), dimensions: state(resolved.origin.dimensions, resolved.dimensionsMm !== null) };
}
const number = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null;
const supplied = (value: unknown) => value !== undefined && value !== null && value !== '';
/** Validate only fallback groups. Existing source/rule values retain their established priority. */
export function listingPackagingIssues(payload: Record<string, unknown>, fields: ListingPackagingFields): BusinessIssue[] {
  const issues: BusinessIssue[] = [];
  const invalid = (field: string, message: string) => issues.push({code: 'PACKAGING_DRAFT_INVALID', field, message});
  const max = Number.MAX_SAFE_INTEGER / 1_000_000;
  if (fields.weight !== 'rules' && ['weight', 'weight_unit'].some(field => supplied(payload[field]))) {
    const factor = payload.weight_unit === 'g' ? 0.001 : payload.weight_unit === 'kg' ? 1 : null;
    if (factor === null) invalid('weight_unit', '重量单位仅支持 g 或 kg；请核对数值和单位。');
    const value = number(payload.weight);
    if (value === null || value <= 0 || factor !== null && (value * factor > max || Math.round(value * factor * 1000 * 1e9) <= 0)) invalid('weight', '发货总重量须为支持范围和精度内的大于 0 的数值。');
  }
  if (fields.dimensions !== 'rules' && ['depth', 'width', 'height', 'dimension_unit'].some(field => supplied(payload[field]))) {
    const factor = payload.dimension_unit === 'mm' ? 0.1 : payload.dimension_unit === 'cm' ? 1 : null;
    if (factor === null) invalid('dimension_unit', '尺寸单位仅支持 mm 或 cm；请核对数值和单位。');
    for (const [field, label] of [['depth', '长'], ['width', '宽'], ['height', '高']]) {
      const value = number(payload[field]);
      if (value === null || value <= 0 || factor !== null && (value * factor > max || Math.round(value * factor * 10 * 1e9) <= 0)) invalid(field, `发货包装${label}须为支持范围和精度内的大于 0 的数值；长、宽、高请填写完整。`);
    }
  }
  return issues;
}
