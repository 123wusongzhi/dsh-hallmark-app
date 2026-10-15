import { realScenarioDetail, realScenarioProduct, realScenarioSku, realDetail, realCorpus, realStoreProducts, realSourceSummaries, realAncillary, realRaw, realRawContent } from '../real-data/corpus.ts';
import { normalizeProduct } from '../../packages/collection/src/index.ts';

/** Unspecified fields retain their recorded values; field removal is an explicit per-call fault. */
function omitFields(value: any, fields: string[]): any {
  for (const field of fields) delete value[field];
  return value;
}
const recordedSources = realCorpus().records.map(row => row.detail.source);
const recordedSkuSources = realCorpus().records.map((row, index) => ({ source: row.detail.source, index, nonempty: !!row.detail.skus?.length })).filter(row => row.nonempty);
const recordedSalesCount = realStoreProducts().products.length;
export function recordedSample(overrides: any): number {
  const matches = recordedSources.map((source, index) => ({ source, index })).filter(({ source, index }) => (!overrides.source || source === overrides.source) && (!overrides.nonempty || recordedSkuSources.some(row => row.index === index)));
  const key = String(overrides.id ?? overrides.sourceSkuId ?? 'baseline');
  const hash = [...key].reduce((total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0, 0);
  return matches.length ? matches[hash % matches.length].index : hash % recordedSources.length;
}
export function recordedDetail(overrides: any = {}, selector: number | string = 0, omittedFields: string[] = []): any {
  const patches = Object.hasOwn(overrides, 'title') && !Object.hasOwn(overrides, 'originalTitle') ? { ...overrides, originalTitle: overrides.title } : overrides;
  return omitFields(realScenarioDetail(patches, selector), omittedFields);
}
export function recordedSku(overrides: any = {}, selector: number | string = 0, index = 0, omittedFields: string[] = []): any {
  return omitFields(realScenarioSku(overrides, selector, index), omittedFields);
}
export function recordedProduct(overrides: any = {}, index = [...String(overrides.offerId ?? 'baseline')].reduce((n, c) => n + c.charCodeAt(0), 0) % recordedSalesCount, omittedFields: string[] = []): any {
  return omitFields(realScenarioProduct(overrides, index), omittedFields);
}
export function recordedNormalizedProduct(overrides: any = {}, selector: number | string = 0): any {
  return { ...normalizeProduct(realDetail(selector)), ...overrides };
}
/** Native API shape derived from the recorded sales catalogue; sparse receipts deliberately keep missing identities absent. */
export function recordedPlatformProduct(overrides: any = {}, index = 0): any {
  const base = realScenarioProduct({}, index);
  // These native receipts test absence of identifiers and values; only declared receipt fields are returned.
  const value = { id: base.productId, product_id: base.productId, offer_id: base.offerId, sku: base.sku, name: base.title, images: [base.imageUrl], price: base.price, currency_code: base.currency, stock: base.stock, ...overrides };
  return omitFields(value, ['id', 'product_id', 'offer_id', 'sku', 'price', 'currency_code', 'stock'].filter(field => !Object.hasOwn(overrides, field)));
}
const recordedSummaries = realSourceSummaries();
export function recordedSummary(overrides: any = {}, selector = recordedSample(overrides)): any {
  return { ...structuredClone(recordedSummaries[selector]), ...overrides };
}
const recordedWarehouses = realAncillary('ozonWarehouses').response.warehouses;
export function recordedWarehouse(overrides: any = {}, index = 0): any {
  return { ...structuredClone(recordedWarehouses[index]), ...overrides };
}
const recordedCategoryAttributes = realAncillary('ozonCategoryTemplate').attributes;
export function recordedCategoryAttribute(overrides: any = {}, index = 0): any {
  const attribute = recordedCategoryAttributes[index % recordedCategoryAttributes.length];
  const result = { id: Number(attribute.id), name: attribute.name, description: attribute.description, type: attribute.valueType, is_required: attribute.required,
    is_collection: attribute.isCollection, dictionary_id: attribute.dictionaryId ?? 0, attribute_complex_id: attribute.attributeComplexId ?? 0,
    max_value_count: attribute.maxValueCount, ...overrides };
  for (const key of Object.keys(result)) if (result[key] === undefined) delete result[key];
  return result;
}
export function recordedRaw(overrides: any = {}, selector: number | string = 0): any {
  const result = { ...realRaw(selector), ...overrides };
  if (typeof overrides.content === 'string') {
    let scenario: any;
    try { scenario = JSON.parse(overrides.content); } catch { return result; }
    if (scenario && typeof scenario === 'object' && !Array.isArray(scenario)) result.content = JSON.stringify({ ...realRawContent(selector), ...scenario });
  }
  return result;
}
