import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { hash, normalizeProduct, object } from './normalize.ts';
import type { CollectionAsset, CollectionOptions, CollectionProduct, CollectionReadInput, CollectionResourceInput, CollectionSearchInput } from './types.ts';
export * from './types.ts';
export { normalizePackage, normalizeProduct } from './normalize.ts';

export class CollectionError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'CollectionError'; this.code = code; }
}
const fail = (code: string, message: string): never => { throw new CollectionError(code, message); };
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
/** Reserve 2 KiB for the host capability envelope; callers cannot opt out. */
export const COLLECTION_RESPONSE_MAX_BYTES = 14 * 1024;
const responseBudget = (requested?: number, minimum = 1024) => limit(requested, COLLECTION_RESPONSE_MAX_BYTES, COLLECTION_RESPONSE_MAX_BYTES, minimum);
const preview = (value: string, maximum = 256): string => { let result = ''; for (const char of value) { if (Buffer.byteLength(result + char, 'utf8') > maximum) break; result += char; } return result; };
const limit = (n: unknown, fallback: number, max: number, min = 1) => typeof n === 'number' && Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
const cursor = (value: Record<string, any>) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(value: string | undefined, kind: string, revision: string, scope: unknown): number {
  if (!value) return 0;
  let c: any; try { c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { return fail('COLLECTION_CURSOR_INVALID', '分页引用无效'); }
  if (c.kind !== kind || c.scope !== hash(scope)) return fail('COLLECTION_CURSOR_INVALID', '分页引用与当前查询不一致');
  if (c.revision !== revision) return fail('COLLECTION_REVISION_CHANGED', '资料已更新，请从第一页重新读取');
  if (!Number.isInteger(c.offset) || c.offset < 0) return fail('COLLECTION_CURSOR_INVALID', '分页位置无效');
  return c.offset;
}
const next = (kind: string, revision: string, scope: unknown, offset: number) => cursor({ kind, revision, scope: hash(scope), offset });
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));
interface CachedProduct { product: CollectionProduct; detail: Record<string, any>; fetchedAtMs: number }

function commonAttributes(skus: CollectionProduct['skus']): Record<string, string> {
  if (!skus.length) return {};
  return Object.fromEntries(Object.entries(skus[0].attributes).filter(([key, value]) => skus.every(s => s.attributes[key] === value)));
}

/** Network/source interpretation is isolated here; compact projection never changes facts. */
export class CollectionService {
  readonly options: CollectionOptions;
  private inflight = new Map<string, Promise<CachedProduct>>();
  private indexCache?: { rows: Record<string, any>[]; fetchedAtMs: number };
  constructor(options: CollectionOptions) { this.options = options; }
  private key(id: string): string { return `${this.options.sourceId ?? 'legacy-collection'}:${id}`; }
  private fresh(time: number): boolean { return Date.now() - time < (this.options.cacheTtlMs ?? 300_000); }
  private reference(id: string, value: unknown): { id: string; kind: 'raw'; path: string } {
    const resource = hash(value);
    this.options.store.put('collection_response_resources', this.key(`${id}:${resource}`), { value: clean(value) });
    return { id, kind: 'raw', path: `/response/${resource}` };
  }
  private checked<T>(value: T, budget: number): T {
    if (bytes(value) > budget) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '资料身份或返回元数据过长，无法放入安全页；请按稳定商品 ID 读取');
    return value;
  }
  private async cached(id: string, refresh = false): Promise<CachedProduct> {
    if (!id || typeof id !== 'string') return fail('COLLECTION_ID_REQUIRED', '需要稳定的采集商品 ID');
    const key = this.key(id);
    const saved = this.options.store.get<CachedProduct>('collection_products', key);
    if (!refresh && saved && this.fresh(saved.fetchedAtMs)) return saved;
    const running = this.inflight.get(key); if (running) return running;
    const promise = (async () => {
      if (!this.options.client.getCollectedItemDetail) return fail('COLLECTION_DETAIL_UNAVAILABLE', '当前采集提供者不支持规范商品详情');
      const response = await this.options.client.getCollectedItemDetail(id);
      if (response.status !== 'ok' || !response.raw) return fail(response.error?.code ?? 'COLLECTION_READ_FAILED', response.error?.message ?? '采集商品读取失败');
      const detail = object(response.raw);
      if (String(detail.id) !== id) return fail('COLLECTION_ID_MISMATCH', '来源返回商品身份与请求不一致');
      const entry = { detail: clean(detail), product: normalizeProduct(detail, this.options.sourceId), fetchedAtMs: Date.now() };
      this.options.store.put('collection_products', key, entry);
      return entry;
    })();
    this.inflight.set(key, promise);
    try { return await promise; } finally { this.inflight.delete(key); }
  }
  async getProduct(id: string, options: { refresh?: boolean } = {}): Promise<CollectionProduct> { return clean((await this.cached(id, options.refresh)).product); }
  async getLegacyDetail(id: string, options: { refresh?: boolean } = {}): Promise<Record<string, any>> { return clean((await this.cached(id, options.refresh)).detail); }
  /** Previously downloaded source references only; never downloads or treats a cache entry as an Agent's viewing declaration. */
  cachedImageAssets(product: CollectionProduct, options: { excludeAssetIds?: string[]; assetIds?: string[]; limit?: number } = {}): Array<CollectionAsset & { contentHash: string }> {
    if (product.sourceId !== (this.options.sourceId ?? 'legacy-collection')) return [];
    const current = this.options.store.get<CachedProduct>('collection_products', this.key(product.id));
    if (!current || current.product.revision !== product.revision) return [];
    const result: Array<CollectionAsset & { contentHash: string }> = [], excluded = new Set(options.excludeAssetIds), requested = options.assetIds && new Set(options.assetIds), bound = limit(options.limit, 8, 8, 0);
    for (const asset of product.assets) {
      if (result.length >= bound) break;
      if (excluded.has(asset.id) || requested && !requested.has(asset.id)) continue;
      const saved = this.options.store.get<{ revision?: string; bytes?: number }>('collection_assets', `${this.key(product.id)}:${hash(asset.url)}`);
      if (saved && /^[a-f0-9]{64}$/.test(saved.revision ?? '') && Number(saved.bytes) > 0) result.push({ ...asset, contentHash: saved.revision! });
    }
    return clean(result);
  }
  private async index(refresh = false): Promise<Record<string, any>[]> {
    if (!refresh && this.indexCache && this.fresh(this.indexCache.fetchedAtMs)) return this.indexCache.rows;
    // Empty query avoids the legacy client's JSON/task-text search.
    const response = await this.options.client.searchCollectedItems('');
    const rows = Array.isArray(response.raw) ? response.raw : response.raw?.items;
    if (response.status !== 'ok' || !Array.isArray(rows)) return fail(response.error?.code ?? 'COLLECTION_SEARCH_FAILED', response.error?.message ?? '采集商品目录读取失败');
    this.indexCache = { rows, fetchedAtMs: Date.now() };
    return rows;
  }
  async search(input: CollectionSearchInput = {}): Promise<any> {
    let rows = await this.index(input.refresh);
    if (input.source) rows = rows.filter(r => r.source === input.source);
    if (input.category) rows = rows.filter(r => String(r.categoryId ?? '') === input.category || r.categoryPath?.includes(input.category));
    const query = (input.query ?? '').trim().toLocaleLowerCase();
    if (query) {
      const matches = new Set<string>();
      // Attribute queries are resolved within the service, never as a sequence of Agent tool calls.
      let offset = 0;
      await Promise.all(Array.from({ length: Math.min(6, rows.length) }, async () => {
        while (offset < rows.length) {
          const r = rows[offset++];
          const p = await this.getProduct(String(r.id), { refresh: input.refresh });
          const facts = [p.title, p.originalTitle, p.category.path, p.attributes, p.skus.map(s => ({ spec: s.spec, attributes: s.attributes }))];
          if (JSON.stringify(facts).toLocaleLowerCase().includes(query)) matches.add(p.id);
        }
      }));
      rows = rows.filter(r => matches.has(String(r.id)));
    }
    const states = this.options.listingStates ? await this.options.listingStates(rows.map(r => String(r.id)), rows.map(r => ({ id: String(r.id), skuCount: Number(r.skuCount ?? 0) })), { refresh: input.refresh }) : {};
    function range(r: any): any {
      if (r.goodsMinPrice !== undefined && r.goodsMaxPrice !== undefined && r.currency) return { meaning: 'purchase_cost', min: String(r.goodsMinPrice), max: String(r.goodsMaxPrice), currency: r.currency, unit: r.unit ?? null };
      const d = r.sourceSellingPrice;
      if (d?.currency && (d.amount !== undefined || d.min !== undefined)) return { meaning: 'source_display_price', min: String(d.amount ?? d.min), max: String(d.amount ?? d.max ?? d.min), currency: d.currency, unit: r.unit ?? null };
      return null;
    }
    if (input.price) rows = rows.filter(r => {
      const p = range(r), f = input.price!;
      return p && p.meaning === f.meaning && p.currency === f.currency && (f.min === undefined || Number(p.max) >= f.min) && (f.max === undefined || Number(p.min) <= f.max);
    });
    const recordStates = input.store ? rows.map(r => states[r.id]?.find(s => s.storeId === input.store!.id)) : [];
    const unavailableRecords = recordStates.filter(s => !s?.listingRecord || s.listingRecord === 'unavailable').length;
    const incompleteRecordFilter = !!input.store?.listingRecord && input.store.listingRecord !== 'unavailable' && unavailableRecords > 0;
    const recordReasons = [...new Set(recordStates.filter(s => !s?.listingRecord || s.listingRecord === 'unavailable').map(s => s?.listingRecordReason ?? 'RECORD_SOURCE_UNAVAILABLE'))];
    const unlinkedHistory = recordStates.some(s => s?.hasUnlinkedHistory);
    if (input.store) rows = rows.filter(r => {
      const filter = input.store!, state = states[r.id]?.find(s => s.storeId === filter.id);
      if (filter.listingRecord && (state?.listingRecord ?? 'unavailable') !== filter.listingRecord) return false;
      if (filter.status && (state?.status ?? 'unknown') !== filter.status) return false;
      if (filter.association && (state?.association ?? 'unknown') !== filter.association) return false;
      if (filter.saleState) {
        if (!state?.saleStates) return filter.saleState === 'unknown';
        return state.saleStates[filter.saleState] > 0 || filter.saleState === 'unknown' && state.offerCount === 0 && state.association === 'unknown';
      }
      return true;
    });
    const cards = rows.map(r => ({ id: String(r.id), title: String(r.title ?? ''), source: String(r.source ?? 'unknown'), category: r.categoryPath?.at(-1) ?? null, skuCount: Number(r.skuCount ?? 0), price: range(r), ...(states[r.id] ? { listedIn: states[r.id].map(state => {
      if ((state.listedSkuIds?.length ?? 0) <= 12 && (state.associatedSkuIds?.length ?? 0) <= 12) return state;
      return { ...state, listedSkuCount: state.listedSkuCount ?? state.listedSkuIds?.length, associatedSkuCount: state.associatedSkuCount ?? state.associatedSkuIds?.length,
        listedSkuIds: state.listedSkuIds?.slice(0, 12), associatedSkuIds: state.associatedSkuIds?.slice(0, 12), skuIdsComplete: false, available: this.reference(String(r.id), state) };
    }) } : {}) }));
    const recordLookup = input.store ? {storeId:input.store.id,status:unavailableRecords===0?'complete':unavailableRecords===recordStates.length?'unavailable':'partial',knownMatches:cards.length,unavailableItems:unavailableRecords,reasonCodes:recordReasons,meaning:'found 包含已保存草稿和精确销售关联；not_found 表示本店记录查询完成但未找到，不证明平台历史从未上架。',message:incompleteRecordFilter?'记录查询未完成，匹配总数暂不可确定；已知结果可用。':unavailableRecords?`商品检索完成；${unavailableRecords} 件的上品记录暂不可查。`:`查询完成，符合筛选条件的商品为 ${cards.length} 件。`,...(unlinkedHistory?{warning:'本店部分历史商品尚未关联；无上品记录不等于历史上绝对没有同款。'}:{})} : undefined;
    const revision = hash({cards,...(recordLookup?{recordLookup}:{})});
    const scope = { query, source: input.source, category: input.category, price: input.price, store: input.store };
    const start = decode(input.cursor, 'search', revision, scope);
    const sourceCounts: Record<string, number> = {}, categoryCounts: Record<string, number> = {};
    for (const card of cards) { sourceCounts[card.source] = (sourceCounts[card.source] ?? 0) + 1; const c = card.category ?? '未分类'; categoryCounts[c] = (categoryCounts[c] ?? 0) + 1; }
    const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const budget = responseBudget();
    let facets: any = { sources: sourceCounts, categories: Object.fromEntries(categories), categoryCount: categories.length, categoriesOmitted: 0 };
    if (bytes(facets) > Math.floor(budget / 3)) facets = { sources: {}, categories: {}, categoryCount: categories.length, categoriesOmitted: categories.length, completeness: 'partial', available: [this.reference(cards[0].id, facets)] };
    const page: any[] = [];
    const result = () => ({ revision, items: page, returned: page.length, total: incompleteRecordFilter?null:cards.length, nextCursor: start + page.length < cards.length ? next('search', revision, scope, start + page.length) : null, completeness: incompleteRecordFilter || start + page.length < cards.length || page.some(c => c.deferred) || facets.completeness === 'partial' ? 'partial' : 'complete', facets,...(recordLookup?{recordLookup}:{}), listingState: this.options.listingStates ? 'operating_records' : 'unknown' });
    for (const card of cards.slice(start, start + limit(input.limit, 30, 100))) {
      let shown: any = card;
      if (bytes(shown) > budget / 2) {
        shown = { id: card.id, title: preview(card.title), source: preview(card.source, 96), category: typeof card.category === 'string' ? preview(card.category, 96) : card.category, skuCount: card.skuCount, ...(card.listedIn ? { listedIn: card.listedIn } : {}), deferred: { reason: '卡片含超长字段，显示预览；完整字段可继续读取', resource: this.reference(card.id, card) } };
        if (bytes(shown) > budget / 2 && card.listedIn) { delete shown.listedIn; shown.listingSummary = { stores: card.listedIn.length, available: this.reference(card.id, card.listedIn) }; }
      }
      page.push(shown);
      if (bytes(result()) > budget) { page.pop(); break; }
    }
    if (!page.length && start < cards.length) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '商品身份过长，无法放入安全搜索页');
    return this.checked(result(), budget);
  }
  private project(product: CollectionProduct, selection: { skuIds?: string[]; cursor?: string }, pageLimit: number, compact = false): any {
    const selected = selection.skuIds ? product.skus.filter(s => s.id && selection.skuIds!.includes(s.id)) : product.skus;
    if (selection.skuIds?.some(id => !product.skus.some(s => s.id === id))) return fail('COLLECTION_SKU_NOT_FOUND', `${product.id} 中不存在所选 SKU`);
    const scope = { id: product.id, skuIds: selection.skuIds };
    const offset = decode(selection.cursor, 'skus', product.revision, scope);
    const page = selected.slice(offset, offset + pageLimit);
    const common = commonAttributes(selected);
    const attrKeys = [...new Set(selected.flatMap(s => Object.keys(s.attributes)))].filter(k => !(k in common));
    const commonPrice = selected.length && selected.every(s => JSON.stringify(s.purchaseCost) === JSON.stringify(selected[0].purchaseCost)) ? selected[0].purchaseCost : undefined;
    const needsSpec = selected.some(s => !Object.keys(s.attributes).length && s.spec);
    const columns = ['id', ...(needsSpec ? ['spec'] : []), ...attrKeys, ...(commonPrice === undefined ? ['purchaseCost'] : []), 'sourceDisplayPrice', 'imageRef', 'package'];
    const rows = page.map(s => [s.id, ...(needsSpec ? [s.spec] : []), ...attrKeys.map(k => s.attributes[k] ?? null), ...(commonPrice === undefined ? [s.purchaseCost] : []), s.sourceDisplayPrice, s.imageRef, s.package]);
    const main = product.assets.filter(a => a.roles.includes('main'));
    const text = Array.from(product.description);
    const descriptionLength = compact ? 0 : 1500;
    const available: any[] = [{ kind: 'raw', id: product.id, path: '/detail' }];
    if (text.length > descriptionLength) available.push({ kind: 'description', id: product.id, revision: product.revision });
    const skuCount = product.assets.filter(a => a.roles.includes('sku')).length, detailCount = product.assets.filter(a => a.roles.includes('detail')).length;
    if (skuCount || detailCount || main.length > (compact ? 1 : 12)) available.push({ kind: 'images', id: product.id, revision: product.revision });
    const mainShown = main.slice(0, compact ? 1 : 12).map(({ id, url }) => ({ id, url }));
    return {
      id: product.id, sourceId: product.sourceId, revision: product.revision,
      facts: { title: product.title, source: product.source, category: product.category, attributes: product.attributes, unit: product.unit, minimumOrder: product.minimumOrder, customsCodes: product.customsCodes },
      package: product.package,
      skus: { common: { attributes: common, scope: selection.skuIds ? 'selected_skus' : 'all_skus', ...(commonPrice !== undefined ? { purchaseCost: commonPrice } : {}) }, columns, rows, returned: page.length, total: selected.length, nextCursor: offset + page.length < selected.length ? next('skus', product.revision, scope, offset + page.length) : null },
      assets: { main: mainShown, mainCount: main.length, skuCount, detailCount },
      description: { text: text.slice(0, descriptionLength).join(''), returned: Math.min(text.length, descriptionLength), totalCharacters: text.length, characterUnit: 'Unicode code points', purpose: '来源描述，可能包含公司介绍', nextCursor: text.length > descriptionLength ? next('description', product.revision, { id: product.id }, descriptionLength) : null },
      unknowns: product.unknowns.filter(u => !selection.skuIds || !u.skuIds || u.skuIds.some(id => selection.skuIds!.includes(id))), available,
    };
  }
  async read(input: CollectionReadInput): Promise<any> {
    let selections = input.selections ?? (input.ids ?? (input.id ? [input.id] : [])).map(id => ({ id, skuIds: input.skuIds, cursor: input.id ? input.cursor : undefined, revision: input.revision }));
    if (!selections.length && input.cursor?.startsWith('batch:')) {
      const saved = this.options.store.get<{ selections: typeof selections }>('collection_read_batches', this.key(input.cursor));
      if (!saved) return fail('COLLECTION_CURSOR_INVALID', '批量续读引用不存在或属于其他采集来源');
      selections = saved.selections;
    }
    if (!selections.length || selections.length > 100) return fail('COLLECTION_SELECTION_REQUIRED', '每次读取需包含 1–100 个稳定商品 ID');
    const maxBytes = responseBudget(input.maxBytes, 2048);
    const items: any[] = [], remaining: any[] = [];
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];
      const p = await this.getProduct(selection.id, { refresh: input.refresh });
      if (selection.revision && selection.revision !== p.revision) return fail('COLLECTION_REVISION_CHANGED', `${p.id} 资料版本已改变`);
      let pageLimit = limit(input.limit, 40, 40);
      let projected = this.project(p, selection, pageLimit);
      while (bytes(projected) > maxBytes - 1024 && pageLimit > 1) { pageLimit = Math.max(1, Math.floor(pageLimit / 2)); projected = this.project(p, selection, pageLimit, true); }
      if (bytes(projected) > maxBytes - 1024) {
        projected = { id: p.id, revision: p.revision, facts: { title: preview(p.title) }, available: [{ kind: 'raw', id: p.id, path: '/normalized' }], omitted: '此商品单段资料超过响应预算，标题仅显示预览；完整字段和 SKU 可按资料路径读取', completeness: 'partial', skus: { returned: 0, total: selection.skuIds?.length ?? p.skus.length, nextCursor: null } };
      }
      if (items.length && bytes({ items: [...items, projected] }) > maxBytes - 512) { remaining.push(...selections.slice(i)); break; }
      items.push(projected);
    }
    let continuation: any = null;
    if (remaining.length) {
      const batch = `batch:${hash(remaining)}`;
      this.options.store.put('collection_read_batches', this.key(batch), { selections: remaining });
      continuation = { capability: 'collection.read', remaining: remaining.length, input: { cursor: batch, maxBytes } };
    }
    const partial = remaining.length || items.some(item => item.omitted || item.skus?.nextCursor || item.description?.nextCursor || item.assets?.mainCount > item.assets?.main?.length);
    return this.checked({ items, returned: items.length, total: selections.length, completeness: partial ? 'partial' : 'complete', continuation, maxBytes }, maxBytes);
  }
  async resourceRead(input: CollectionResourceInput): Promise<any> {
    const entry = await this.cached(input.id);
    const p = entry.product;
    if (input.revision && input.revision !== p.revision) return fail('COLLECTION_REVISION_CHANGED', '资料版本已改变，请使用当前资源引用');
    const budget = responseBudget(input.maxBytes);
    const kind = input.kind ?? 'raw';
    if (kind === 'description') {
      const chars = Array.from(p.description), scope = { id: input.id };
      const offset = decode(input.cursor, 'description', p.revision, scope);
      const result = (count: number) => ({ id: p.id, revision: p.revision, text: chars.slice(offset, offset + count).join(''), returned: count, totalCharacters: chars.length, characterUnit: 'Unicode code points', nextCursor: offset + count < chars.length ? next('description', p.revision, scope, offset + count) : null, completeness: offset + count < chars.length ? 'partial' : 'complete' });
      const count = this.textPageSize(Math.min(limit(input.limit, 1500, 8000), Math.max(0, chars.length - offset)), result, budget);
      return this.checked(result(count), budget);
    }
    if (kind === 'images') {
      const all = p.assets.filter(a => (!input.role || a.roles.includes(input.role)) && (!input.skuIds || a.skuIds.some(id => input.skuIds!.includes(id))));
      const scope = { id: p.id, role: input.role, skuIds: input.skuIds };
      const offset = decode(input.cursor, 'images', p.revision, scope), items: any[] = [];
      const result = () => ({ id: p.id, revision: p.revision, items, returned: items.length, total: all.length, nextCursor: offset + items.length < all.length ? next('images', p.revision, scope, offset + items.length) : null, completeness: offset + items.length < all.length || items.some(item => item.deferred) ? 'partial' : 'complete' });
      for (const asset of all.slice(offset, offset + limit(input.limit, 30, 100))) {
        const shown = bytes(asset) > budget / 2 ? { id: asset.id, roles: asset.roles, deferred: this.reference(p.id, asset), view: { id: p.id, kind: 'image', assetId: asset.id } } : asset;
        items.push(shown); if (bytes(result()) > budget) { items.pop(); break; }
      }
      if (!items.length && offset < all.length) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '图片身份过长，无法放入安全页');
      return this.checked(result(), budget);
    }
    if (kind === 'image') {
      const image = await this.image(p, input.assetId);
      if (bytes(image) <= budget) return image;
      return this.checked({ id: p.id, assetId: image.assetId, path: image.path, mimeType: image.mimeType, bytes: image.bytes, revision: image.revision, completeness: 'partial', deferred: this.reference(p.id, image) }, budget);
    }
    if (kind !== 'raw') return fail('COLLECTION_RESOURCE_KIND', '不支持的采集资源类型');
    let root: any = { detail: entry.detail, normalized: p };
    if (input.path?.startsWith('/response/')) {
      const token = input.path.split('/')[2];
      const saved = this.options.store.get<{ value: unknown }>('collection_response_resources', this.key(`${p.id}:${token}`));
      if (!saved) return fail('COLLECTION_PATH_NOT_FOUND', '该分页资料引用不存在或属于其他商品');
      root.response = { [token]: saved.value };
    }
    if (!input.path || input.path === '/source' || input.path.startsWith('/source/')) {
      const rawKey = `${this.key(p.id)}:${p.revision}`;
      let raw = this.options.store.get<any>('collection_raw', rawKey);
      if (!raw) {
        const response = await this.options.client.getCollectedItem(p.id);
        if (response.status !== 'ok' || response.raw?.truncated) return fail('COLLECTION_RAW_UNAVAILABLE', response.error?.message ?? '无法读取完整原始依据');
        const content = response.raw?.content;
        let value = response.raw;
        if (typeof content === 'string') { try { value = JSON.parse(content); } catch { value = content; } }
        raw = { value }; this.options.store.put('collection_raw', rawKey, raw);
      }
      root.source = raw.value;
    }
    const path = input.path ?? '/source';
    if (!path.startsWith('/')) return fail('COLLECTION_PATH_INVALID', '依据路径使用 JSON Pointer，例如 /detail/attributes');
    const segments = path.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    let value = root;
    for (const s of segments) {
      if (['__proto__', 'prototype', 'constructor'].includes(s) || !value || typeof value !== 'object' || !Object.hasOwn(value, s)) return fail('COLLECTION_PATH_NOT_FOUND', '该原始资料路径不存在');
      value = value[s];
    }
    return this.valuePage(p.id, p.revision, path, value, input, budget);
  }
  private textPageSize(maximum: number, result: (count: number) => unknown, budget: number): number {
    let low = 0, high = maximum;
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (bytes(result(middle)) <= budget) low = middle; else high = middle - 1; }
    if (!low && maximum) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '返回元数据过长，无法放入一个完整字符');
    return low;
  }
  private valuePage(id: string, productRevision: string, originalPath: string, value: any, input: CollectionResourceInput, budget: number): any {
    // Very long field names become stable, compact paths. The complete key remains independently readable.
    const path = Buffer.byteLength(originalPath, 'utf8') > budget / 8 ? this.reference(id, value).path : originalPath;
    const revision = hash(value), scope = { id, path };
    const offset = decode(input.cursor, 'raw', revision, scope);
    const base = { id, revision: productRevision, contentRevision: revision, path };
    if (typeof value === 'string') {
      const chars = Array.from(value);
      const result = (count: number) => ({ ...base, value: chars.slice(offset, offset + count).join(''), returned: count, total: chars.length, nextCursor: offset + count < chars.length ? next('raw', revision, scope, offset + count) : null, completeness: offset + count < chars.length ? 'partial' : 'complete' });
      const count = this.textPageSize(Math.min(limit(input.limit, 1500, 8000), Math.max(0, chars.length - offset)), result, budget);
      return this.checked(result(count), budget);
    }
    if (Array.isArray(value)) {
      const items: unknown[] = []; let i = offset;
      const result = () => ({ ...base, value: items, returned: items.length, total: value.length, nextCursor: i < value.length ? next('raw', revision, scope, i) : null, completeness: i < value.length || items.some((item: any) => item?.expand) ? 'partial' : 'complete' });
      while (i < value.length && items.length < limit(input.limit, 40, 100)) {
        const v = bytes(value[i]) > budget / 2 ? { ...this.reference(id, value[i]), bytes: bytes(value[i]), expand: true } : value[i];
        items.push(v); i++;
        if (bytes(result()) > budget) { items.pop(); i--; break; }
      }
      if (!items.length && i < value.length) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '数组元素身份过长，无法放入安全页');
      return this.checked(result(), budget);
    }
    if (value && typeof value === 'object' && bytes({ ...base, value, nextCursor: null, completeness: 'complete' }) > budget) {
      const keys = Object.keys(value), items: any[] = []; let i = offset;
      const result = () => ({ ...base, directory: items, returned: items.length, total: keys.length, nextCursor: i < keys.length ? next('raw', revision, scope, i) : null, completeness: 'partial' });
      while (i < keys.length && items.length < limit(input.limit, 40, 100)) {
        const key = keys[i], childPath = `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        const compact = Buffer.byteLength(childPath, 'utf8') > budget / 8;
        const entry = { key: compact ? preview(key, 96) : key, ...(compact ? { keyPreview: true, keyResource: this.reference(id, key) } : {}), type: Array.isArray(value[key]) ? 'array' : typeof value[key], bytes: bytes(value[key]), path: compact ? this.reference(id, value[key]).path : childPath };
        items.push(entry); i++;
        if (bytes(result()) > budget) { items.pop(); i--; break; }
      }
      if (!items.length && i < keys.length) return fail('COLLECTION_RESPONSE_METADATA_TOO_LARGE', '目录字段身份过长，无法放入安全页');
      return this.checked(result(), budget);
    }
    return this.checked({ ...base, value, nextCursor: null, completeness: 'complete' }, budget);
  }
  private async image(product: CollectionProduct, assetId?: string): Promise<any> {
    const asset = product.assets.find(a => a.id === assetId);
    if (!asset) return fail('COLLECTION_ASSET_NOT_FOUND', '该图片不属于本商品的素材');
    const key = `${this.key(product.id)}:${hash(asset.url)}`;
    const cached = this.options.store.get<any>('collection_assets', key);
    let record = cached;
    if (record && this.fresh(record.checkedAtMs)) {
      try { await stat(record.path); } catch { record = undefined; }
    } else record = undefined;
    if (!record) {
      const fetcher = this.options.fetch ?? globalThis.fetch;
      const response = await fetcher(asset.url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
      if (!response.ok) return fail('COLLECTION_IMAGE_DOWNLOAD_FAILED', `图片读取失败：HTTP ${response.status}`);
      const max = 20 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > max) return fail('COLLECTION_IMAGE_TOO_LARGE', '图片超过 20 MiB');
      const chunks: Uint8Array[] = []; let size = 0;
      if (!response.body) return fail('COLLECTION_IMAGE_EMPTY', '图片内容为空');
      const reader = response.body.getReader();
      try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) return fail('COLLECTION_IMAGE_TOO_LARGE', '图片超过 20 MiB'); chunks.push(value); } } finally { await reader.cancel(); }
      const data = Buffer.concat(chunks);
      const mimeType = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : data[0] === 255 && data[1] === 216 && data[2] === 255 ? 'image/jpeg' : data.subarray(0, 3).toString() === 'GIF' ? 'image/gif' : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
      if (!mimeType) return fail('COLLECTION_IMAGE_TYPE', '资源内容不是支持的 PNG、JPEG、GIF 或 WebP 图片');
      const revision = createHash('sha256').update(data).digest('hex');
      const directory = this.options.cacheDir ?? join(tmpdir(), 'hallmark-collection-assets');
      await mkdir(directory, { recursive: true });
      const extension = mimeType.split('/')[1].replace('jpeg', 'jpg'), path = join(directory, `${revision}.${extension}`);
      await writeFile(path, data);
      record = { path, mimeType, revision, checkedAtMs: Date.now(), bytes: data.length };
      this.options.store.put('collection_assets', key, record);
    }
    const resourceId = `${this.key(product.id)}:${asset.id}`;
    const access = this.options.exposeAsset ? await this.options.exposeAsset({ path: record.path, mimeType: record.mimeType, resourceId, revision: record.revision }) : { path: record.path, environment: 'collection_service_host', sameHostRequired: true };
    return { id: product.id, assetId: asset.id, resourceId, revision: record.revision, sourceRevision: product.revision, mimeType: record.mimeType, bytes: record.bytes, skuIds: asset.skuIds, roles: asset.roles, ...access };
  }
}
