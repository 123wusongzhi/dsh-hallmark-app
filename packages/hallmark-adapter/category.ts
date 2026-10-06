import type { AdapterResult, CategoryDataInput, CategoryDataRaw } from './types.ts';

export const explicitStoreId = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9._-]{0,3999}$/.test(value) && !value.includes('..');
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
const bounded = (value: unknown, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
function invalid(): AdapterResult<CategoryDataRaw> {
  return { status: 'failed', error: { code: 'CATALOG_INPUT_INVALID', message: '类目读取需明确完整店铺、对应 mode 的精确字段、正整数类目/类型/属性 ID 与有界查询；不允许全树通配或额外平台载荷', retryable: false } };
}
export interface CategoryRequest { endpoint: string; method: 'GET' | 'POST'; storeId: string; body?: { storeId: string } }
/** Exactly six already-existing Source routes, never a generic platform passthrough. */
export function categoryRequest(input: CategoryDataInput): CategoryRequest | AdapterResult<CategoryDataRaw> {
  if (!plain(input) || !explicitStoreId(input.storeId)) return invalid();
  const allowed: Record<string, string[]> = {
    search: ['mode', 'storeId', 'q', 'aspects', 'requireAspects', 'limit'],
    show: ['mode', 'storeId', 'descriptionCategoryId', 'typeId'],
    template: ['mode', 'storeId', 'descriptionCategoryId', 'typeId'],
    values: ['mode', 'storeId', 'descriptionCategoryId', 'typeId', 'attributeId', 'q', 'limit'],
    validate_value: ['mode', 'storeId', 'descriptionCategoryId', 'typeId', 'attributeId', 'valueId', 'dictionaryId'],
    sync: ['mode', 'storeId'],
  };
  if (typeof input.mode !== 'string' || !Object.hasOwn(allowed, input.mode) || Object.keys(input).some(key => !allowed[input.mode].includes(key))) return invalid();
  const query = new URLSearchParams({ storeId: input.storeId });
  if (input.mode === 'sync') return { endpoint: '/api/catalog/sync', method: 'POST', storeId: input.storeId, body: { storeId: input.storeId } };
  if (input.mode === 'search') {
    if (typeof input.q !== 'string' || !input.q.trim() || [...input.q.trim()].length > 200 || input.q.trim() === '*'
      || input.limit !== undefined && !bounded(input.limit, 20)
      || input.requireAspects !== undefined && typeof input.requireAspects !== 'boolean'
      || input.aspects !== undefined && (!Array.isArray(input.aspects) || input.aspects.length > 10
        || input.aspects.some(value => typeof value !== 'string' || !value.trim() || [...value.trim()].length > 200 || value.includes(','))
        || new Set(input.aspects.map(value => value.trim())).size !== input.aspects.length)
      || input.requireAspects === true && !input.aspects?.length) return invalid();
    query.set('q', input.q.trim()); query.set('limit', String(input.limit ?? 10));
    query.set('requireAspects', String(input.requireAspects ?? false));
    if (input.aspects?.length) query.set('aspects', input.aspects.map(value => value.trim()).join(','));
    return { endpoint: `/api/catalog/search?${query}`, method: 'GET', storeId: input.storeId };
  }
  if (!id(input.descriptionCategoryId) || !id(input.typeId)) return invalid();
  if (input.mode === 'show') {
    query.set('categoryKey', `${input.descriptionCategoryId}:${input.typeId}`);
    return { endpoint: `/api/catalog/show?${query}`, method: 'GET', storeId: input.storeId };
  }
  const base = `/api/catalog/categories/${encodeURIComponent(input.descriptionCategoryId)}/types/${encodeURIComponent(input.typeId)}`;
  if (input.mode === 'template') return { endpoint: `${base}/template?${query}`, method: 'GET', storeId: input.storeId };
  if (!id(input.attributeId)) return invalid();
  if (input.mode === 'validate_value') {
    if (!id(input.valueId) || !id(input.dictionaryId)) return invalid();
    query.set('dictionaryId', input.dictionaryId);
    return { endpoint: `${base}/attributes/${encodeURIComponent(input.attributeId)}/values/${encodeURIComponent(input.valueId)}/validation?${query}`, method: 'GET', storeId: input.storeId };
  }
  if (input.q !== undefined && (typeof input.q !== 'string' || [...input.q.trim()].length < 2 || [...input.q.trim()].length > 200 || input.q.trim() === '*')
    || input.limit !== undefined && !bounded(input.limit, 100)) return invalid();
  if (input.q !== undefined) query.set('q', input.q.trim());
  query.set('limit', String(input.limit ?? 50));
  return { endpoint: `${base}/attributes/${encodeURIComponent(input.attributeId)}/values?${query}`, method: 'GET', storeId: input.storeId };
}
