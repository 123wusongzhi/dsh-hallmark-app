import { createHash } from 'node:crypto';
import type { CollectionAsset, CollectionPackage, CollectionPrice, CollectionProduct, CollectionSku } from './types.ts';

export const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
export const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const positive = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
function attributes(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(object(value)).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean').map(([k, v]) => [k, String(v)]));
}
function dimensionValues(value: any): unknown[] | null {
  if (Array.isArray(value)) return value.length === 3 ? value : null;
  if (Array.isArray(value?.inputArray)) return dimensionValues(value.inputArray);
  if (value && typeof value === 'object') return [value.length, value.width, value.height];
  if (typeof value === 'string' && /^\s*\d+(?:\.\d+)?\s*[×xX*]\s*\d+(?:\.\d+)?\s*[×xX*]\s*\d+(?:\.\d+)?\s*$/.test(value)) return value.split(/[×xX*]/).map(s => s.trim());
  return null;
}
/** cm/kg are the user's declared source format, not inferred physical measurements. */
export function normalizePackage(value: unknown, basis = '来源字段；尺寸 cm、重量 kg（已确认）；单组默认共用'): CollectionPackage {
  const p = object(value);
  const weight = p.weightGrams !== undefined ? p.weightGrams : p.pkgWeightSku ?? p.pkgWeight ?? p.weightKg ?? p.weight;
  const weightUnit = p.weightGrams !== undefined ? 'g' : p.weightUnit ?? 'kg';
  const dims = p.dimensionsMm ?? p.dimensionsCm ?? p.pkgMeasure ?? p.dimensions ?? (p.pkgMeasureLengthSku !== undefined ? [p.pkgMeasureLengthSku, p.pkgMeasureWidthSku, p.pkgMeasureHeightSku] : null);
  const dimensionUnit = p.dimensionsMm !== undefined ? 'mm' : p.dimensionUnit ?? 'cm';
  const factors: Record<string, number> = { g: 1, kg: 1000, mm: 1, cm: 10 };
  const values = dimensionValues(dims);
  const dimensions = values?.map(positive);
  return {
    weightGrams: positive(weight) !== null && ['kg', 'g'].includes(weightUnit) ? Math.round(positive(weight)! * factors[weightUnit] * 1000) / 1000 : null,
    dimensionsMm: dimensions?.length === 3 && dimensions.every(v => v !== null) && ['cm', 'mm'].includes(dimensionUnit)
      ? { length: dimensions[0]! * factors[dimensionUnit], width: dimensions[1]! * factors[dimensionUnit], height: dimensions[2]! * factors[dimensionUnit] } : null,
    original: { ...(weight !== undefined ? { weight, weightUnit } : {}), ...(dims !== null && dims !== undefined ? { dimensions: dims, dimensionUnit } : {}) },
    basis,
  };
}
function price(amount: unknown, currency: unknown, unit: string | null, meaning: CollectionPrice['meaning']): CollectionPrice | null {
  if ((typeof amount !== 'number' && typeof amount !== 'string') || String(amount).trim() === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !text(currency)) return null;
  return { amount: String(amount), currency: String(currency), unit, meaning };
}
function skuProperties(sku: Record<string, any>): Record<string, string> {
  const explicit = attributes(sku.properties);
  if (Object.keys(explicit).length) return explicit;
  const pairs = String(sku.spec ?? '').split(/\s*\|\s*/).map(s => s.split(/[:：](.*)/s));
  return Object.fromEntries(pairs.filter(pair => pair[0] && pair[1]).map(pair => [pair[0], pair[1]]));
}
function skuImage(sku: Record<string, any>, editor: Record<string, any>): string | null {
  if (text(sku.image)) return text(sku.image);
  const props = skuProperties(sku);
  for (const options of Object.values(object(editor.saleProp))) {
    if (!Array.isArray(options)) continue;
    const matched = options.filter(o => o.imageUrl && Object.values(props).includes(o.alias ?? o.text));
    if (matched.length === 1) return text(matched[0].imageUrl);
  }
  return null;
}
/** Only selected facts enter this model. Full detail remains in the service cache for evidence. */
export function normalizeProduct(detail: Record<string, any>, sourceId = 'legacy-collection', fetchedAt = new Date().toISOString()): CollectionProduct {
  const source = String(detail.source ?? 'unknown');
  const sd = object(detail.sourceDetails);
  const editor = object(sd.editorFields);
  const logistics = object(sd.logistics);
  const unit = text(detail.unit ?? detail.priceUnit?.text ?? sd.pricing?.priceUnit?.text ?? editor.priceUnit?.text);
  const commonPackage = normalizePackage(detail.package ?? detail.packaging ?? sd.packaging ?? editor);
  const assets: CollectionAsset[] = [];
  function asset(url: unknown, role: CollectionAsset['roles'][number], skuId?: string | null): string | null {
    if (typeof url !== 'string' || !url.trim()) return null;
    const address = url.startsWith('//') ? `https:${url}` : url;
    if (!/^https?:\/\//i.test(address)) return null;
    const id = `img-${hash(address).slice(0, 12)}`;
    let found = assets.find(a => a.id === id);
    if (!found) { found = { id, url: address, roles: [], skuIds: [] }; assets.push(found); }
    if (!found.roles.includes(role)) found.roles.push(role);
    if (skuId && !found.skuIds.includes(skuId)) found.skuIds.push(skuId);
    return id;
  }
  for (const url of Array.isArray(detail.images) ? detail.images : detail.mainImage ? [detail.mainImage] : []) asset(url, 'main');
  const rawSkus = Array.isArray(detail.skus) ? detail.skus.map(object) : [];
  const identities = rawSkus.map(s => text(s.sourceSkuId ?? s.code ?? s.id));
  const skus: CollectionSku[] = rawSkus.map((s, index) => {
    const candidateId = identities[index];
    const id = candidateId && identities.filter(other => other === candidateId).length === 1 ? candidateId : null;
    const entries = Array.isArray(logistics.logisticsSku ?? editor.logisticsSku) ? logistics.logisticsSku ?? editor.logisticsSku : [];
    const logisticsMatches = entries.filter((entry: any) => (s.id && String(entry.skuId) === String(s.id)) || (id && String(entry.skuOuterId) === id));
    const specific = s.package ?? s.packaging ?? (logisticsMatches.length === 1 ? logisticsMatches[0] : null);
    // Alibaba seller offers are never promoted to purchase cost. Taobao goodsPrice excludes its separately captured freight.
    const cost = price(s.goodsPrice ?? (['taobao_tmall', 'alibaba_com'].includes(source) ? undefined : s.price), s.currency ?? detail.currency, text(s.unit) ?? unit, 'purchase_cost');
    const display = price(s.sourceSellingPrice?.amount, s.sourceSellingPrice?.currency ?? detail.currency, text(s.unit) ?? unit, 'source_display_price');
    return {
      id, ...(text(s.id) ? { nativeId: String(s.id) } : {}), ...(text(s.code) ? { code: String(s.code) } : {}),
      spec: text(s.spec) ?? '', attributes: skuProperties(s), purchaseCost: cost, sourceDisplayPrice: display,
      package: specific ? normalizePackage(specific, '来源 SKU 专属；尺寸 cm、重量 kg（已确认）') : null,
      imageRef: asset(skuImage(s, editor), 'sku', id),
      stock: Number.isFinite(s.stock) && s.stock >= 0 ? s.stock : null,
      enabled: typeof s.enabled === 'boolean' ? s.enabled : null,
    };
  });
  for (const url of Array.isArray(detail.descriptionImages) ? detail.descriptionImages : []) asset(url, 'detail');
  const unknowns: CollectionProduct['unknowns'] = [];
  if (skus.some(s => !s.id)) unknowns.push({ field: 'sku.id', reason: '来源 SKU 身份缺失或重复，未以列表行号代替' });
  const missingCost = skus.filter(s => !s.purchaseCost).map(s => s.id).filter((s): s is string => !!s);
  if (missingCost.length) unknowns.push({ field: 'purchaseCost', reason: source === 'alibaba_com' ? '来源只有卖家报价，采购成本未知' : '采购成本未知', skuIds: missingCost });
  const weightMissing = skus.filter(s => s.package?.weightGrams == null && commonPackage.weightGrams == null).map(s => s.id).filter((s): s is string => !!s);
  const dimsMissing = skus.filter(s => s.package?.dimensionsMm == null && commonPackage.dimensionsMm == null).map(s => s.id).filter((s): s is string => !!s);
  if (weightMissing.length) unknowns.push({ field: 'package.weightGrams', reason: '来源未提供可用发货重量', skuIds: weightMissing });
  if (dimsMissing.length) unknowns.push({ field: 'package.dimensionsMm', reason: '来源未提供完整发货尺寸', skuIds: dimsMissing });
  const sourceCodes = logistics.tariffsHsCode ?? editor.tariffsHsCode ?? detail.customsCodes ?? [];
  const result: Omit<CollectionProduct, 'revision'> = {
    id: String(detail.id), sourceId, fetchedAt, source, title: String(detail.title ?? ''), originalTitle: text(detail.originalTitle), sourceUrl: text(detail.sourceUrl),
    category: { id: text(detail.categoryId), path: Array.isArray(detail.categoryPath) ? detail.categoryPath.map(String) : [] },
    attributes: attributes(detail.attributes), package: commonPackage, unit,
    minimumOrder: positive(detail.minimumOrder ?? sd.pricing?.minOrderQuantity ?? editor.minOrderQuantity),
    customsCodes: Array.isArray(sourceCodes) ? [...new Set(sourceCodes.map((v: any) => String(v.hsCode ?? v)).filter(Boolean))] : [],
    description: String(detail.description ?? sd.description?.textDesc ?? ''), skus, assets, unknowns,
    mapping: { version: 'collection-1', coverage: ['alibaba_com', 'taobao_tmall'].includes(source) ? 'verified_structure' : 'partial' },
  };
  if (result.mapping.coverage === 'partial') result.unknowns.push({ field: 'sourceMapping', reason: '该来源目前仅覆盖通用字段，专有字段仍可按原始依据读取' });
  return { ...result, revision: hash({ ...result, fetchedAt: undefined }) };
}
