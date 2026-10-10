import type { AdapterResponse } from '../../core/src/types.ts';
import { ozonBusinessEndpoint } from './endpoints.ts';
import { OzonStoreDirectory } from './store-directory.ts';
import { OzonBusinessError } from './types.ts';
import type { OzonBusinessGatewayOptions, OzonBusinessRequest, OzonBusinessStore, OzonProductTargets, SaveOzonBusinessStoreInput } from './types.ts';
export * from './types.ts';
export { ozonBusinessEndpoint } from './endpoints.ts';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const failed = (code: string, message: string, status: AdapterResponse['status'] = 'failed', retryable = false, extra: Partial<AdapterResponse> = {}): AdapterResponse => ({ status, error: { code, message, retryable }, ...extra });
const privateField = /(?:api.?key|client.?id|token|cookie|password|authorization|secret)/i;

function sanitized(value: unknown, credentials: { clientId: string; apiKey: string }): any {
  return JSON.parse(JSON.stringify(value, (name, child) => {
    if (privateField.test(name)) return '[redacted]';
    if (typeof child !== 'string') return child;
    for (const secret of [credentials.apiKey, credentials.clientId]) if (secret) child = child.split(secret).join('[redacted]');
    return child;
  }));
}

function plainJson(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 40 || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const valid = Object.entries(value).every(([key, child]) => !privateField.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && plainJson(child, seen, depth + 1));
  seen.delete(value); return valid;
}

async function responseText(response: Response): Promise<string> {
  const maximum = 20 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('RESPONSE_TOO_LARGE');
  if (!response.body) return '';
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > maximum) throw new Error('RESPONSE_TOO_LARGE'); chunks.push(item.value); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Math.min(24 * 60 * 60 * 1000, Math.ceil(Number(value) * 1000));
  const at = Date.parse(value); return Number.isFinite(at) ? Math.min(24 * 60 * 60 * 1000, Math.max(0, at - Date.now())) : undefined;
}

function productRows(raw: any): any[] | undefined {
  const result = raw?.items ?? raw?.result?.items ?? raw?.products ?? raw?.result?.products;
  return Array.isArray(result) ? result : undefined;
}

/** Private transport used by the operation engine after review. This class is never registered as an Agent tool. */
export class OzonBusinessGateway {
  #stores: OzonStoreDirectory;
  #fetch: typeof fetch;
  #timeout: number;
  constructor(directory: string, options: OzonBusinessGatewayOptions = {}) {
    this.#stores = new OzonStoreDirectory(directory); this.#fetch = options.fetchImpl ?? fetch; this.#timeout = options.requestTimeoutMs ?? 60_000;
    if (!Number.isFinite(this.#timeout) || this.#timeout <= 0) throw new OzonBusinessError('TIMEOUT_INVALID', '请求超时必须为正数。');
  }
  listStores(): OzonBusinessStore[] { return this.#stores.listStores(); }
  getStore(id: string): OzonBusinessStore | undefined { return this.#stores.getStore(id); }
  hasStore(id: string): boolean { return this.#stores.hasStore(id); }
  saveStore(input: SaveOzonBusinessStoreInput): OzonBusinessStore { return this.#stores.saveStore(input); }
  importLegacyStore(input: Omit<SaveOzonBusinessStoreInput, 'id' | 'expectedRevision'> & { legacyStoreId: string; sourceConnectionId: string }): OzonBusinessStore { return this.#stores.importLegacyStore(input); }

  async request(storeId: string, input: OzonBusinessRequest, signal?: AbortSignal): Promise<AdapterResponse> {
    const endpoint = input && ozonBusinessEndpoint(input.path);
    if (!endpoint || (input.method ?? endpoint.method) !== endpoint.method) return failed('OZON_ENDPOINT_UNSUPPORTED', '该接口不属于已接入的经营操作。');
    const body = input.body ?? {};
    if (!object(body) || !plainJson(body) || Buffer.byteLength(JSON.stringify(body)) > 10 * 1024 * 1024 || endpoint.method === 'GET' && Object.keys(body).length) return failed('OZON_REQUEST_INVALID', '经营请求参数无效，不接受请求头、凭据或自定义地址。');
    if (signal?.aborted) return failed('OZON_REQUEST_CANCELLED', '请求已取消，尚未发送。');
    let store: OzonBusinessStore | undefined, credential: { clientId: string; apiKey: string } | undefined;
    try { store = this.getStore(storeId); }
    catch { return failed('STORE_DIRECTORY_UNAVAILABLE', '经营店铺目录暂时无法读取。', 'unavailable'); }
    if (!store) return failed('OZON_STORE_NOT_FOUND', '经营店铺不存在。');
    if (!store.enabled && !endpoint.readOnly) return failed('OZON_STORE_DISABLED', '店铺已停用，不能提交新的经营写入。');
    const revision = input.credentialRevision ?? store.credentialRevision;
    if (!Number.isSafeInteger(revision) || revision < 1) return failed('OZON_CREDENTIAL_UNAVAILABLE', '店铺尚未配置凭据。', 'unavailable');
    if (!endpoint.readOnly && revision !== store.credentialRevision) return failed('OZON_CREDENTIAL_REVISION_CHANGED', '店铺凭据已更新，请读取最新店铺设置后再提交。');
    try { credential = this.#stores.credential(storeId, revision); }
    catch { return failed('OZON_CREDENTIAL_UNAVAILABLE', '当前系统用户无法读取店铺凭据。', 'unavailable'); }
    if (!credential) return failed('OZON_CREDENTIAL_REVISION_UNAVAILABLE', '原请求使用的店铺凭据版本不可用。', 'unavailable');
    // Never forward or record accidental secret copies in business payloads.
    if (JSON.stringify(sanitized(body, credential)) !== JSON.stringify(body)) return failed('OZON_REQUEST_CONTAINS_CREDENTIAL', '经营内容包含私有凭据，未发送。');
    const base = { credentialRevision: revision };
    let httpStatus: number | undefined;
    try {
      // Exactly one fetch. The caller durably owns intent/receipt and decides whether a definite rejection is eligible for a new attempt.
      const response = await this.#fetch(`https://api-seller.ozon.ru${input.path}`, {
        method: endpoint.method, redirect: 'error', headers: { 'Client-Id': credential.clientId, 'Api-Key': credential.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(endpoint.method === 'POST' ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([AbortSignal.timeout(this.#timeout), ...(signal ? [signal] : [])]),
      });
      httpStatus = response.status;
      const text = await responseText(response); let payload: unknown;
      try { payload = text ? JSON.parse(text) : {}; }
      catch {
        // A successful HTTP response with an unreadable body is not evidence that a write failed.
        if (response.ok) throw new Error('OZON_RESPONSE_INVALID');
        payload = { message: text.slice(0, 2000) };
      }
      const raw = { ...base, httpStatus, response: sanitized(payload, credential), outcome: response.ok ? 'succeeded' : 'rejected' };
      if (httpStatus === 408 || httpStatus >= 500) {
        return failed(endpoint.readOnly ? 'OZON_READ_UNAVAILABLE' : 'OZON_OUTCOME_UNKNOWN', endpoint.readOnly ? 'Ozon 查询暂时不可用。' : '未确认 Ozon 写入结果；请核查原请求，不要重新发送。', endpoint.readOnly ? 'unavailable' : 'unknown', endpoint.readOnly, { raw: { ...raw, outcome: 'outcome_unknown' } });
      }
      if (!response.ok) {
        const retryAfterMs = retryAfter(response.headers.get('Retry-After'));
        return { status: 'failed', raw, error: { code: httpStatus === 429 ? 'OZON_RATE_LIMITED' : 'OZON_REJECTED', message: httpStatus === 429 ? 'Ozon 请求限流，请等待后处理。' : `Ozon 拒绝请求（HTTP ${httpStatus}），请查看字段错误。`, retryable: httpStatus === 429, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) } };
      }
      return { status: 'ok', raw };
    } catch {
      return failed(endpoint.readOnly ? 'OZON_READ_UNAVAILABLE' : 'OZON_OUTCOME_UNKNOWN', endpoint.readOnly ? '未取得完整的 Ozon 查询结果。' : '未取得完整的 Ozon 写入结果；请核查原请求，不要重新发送。', endpoint.readOnly ? 'unavailable' : 'unknown', endpoint.readOnly, { raw: { ...base, ...(httpStatus !== undefined ? { httpStatus } : {}), outcome: 'outcome_unknown' } });
    }
  }

  checkStore(storeId: string, signal?: AbortSignal): Promise<AdapterResponse> { return this.request(storeId, { path: '/v1/seller/info', body: {} }, signal); }

  async getProducts(storeId: string, targets?: OzonProductTargets, signal?: AbortSignal): Promise<AdapterResponse> {
    const selected = targets ? [targets.offerIds ?? [], targets.productIds ?? [], targets.skus ?? []] : undefined;
    if (selected && (selected.some(values => !Array.isArray(values)) || selected[0].some(value => typeof value !== 'string' || !value) || selected.slice(1).some(values => values.some(value => !/^[1-9]\d*$/.test(String(value)))))) return failed('OZON_PRODUCT_TARGET_INVALID', '商品查询需要明确有效的 Offer、商品编号或 SKU。');
    const credentialRevision = this.getStore(storeId)?.credentialRevision;
    if (!this.hasStore(storeId)) return failed('OZON_STORE_NOT_FOUND', '经营店铺不存在。');
    const products: any[] = [], seenIds = new Set<string>(); let lastResponse: AdapterResponse | undefined;
    const offersByProduct = new Map<string, string | undefined>(), productsByOffer = new Map<string, string>();
    const validProductId = (value: unknown): string | undefined => typeof value === 'string' && /^[1-9]\d*$/.test(value)
      ? value : typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
    const identify = (row: unknown): { id: string; offer?: string } | AdapterResponse => {
      if (!object(row)) return failed('OZON_PRODUCTS_INVALID', 'Ozon 商品数据格式不完整。', 'unavailable');
      const id = validProductId(row.id ?? row.product_id);
      if (!id || row.offer_id !== undefined && (typeof row.offer_id !== 'string' || !row.offer_id))
        return failed('OZON_PRODUCTS_INVALID', 'Ozon 商品数据包含无法识别的商品编号或 Offer。', 'unavailable');
      if (row.id !== undefined && row.product_id !== undefined && validProductId(row.product_id) !== id)
        return failed('OZON_PRODUCT_IDENTITY_CONFLICT', 'Ozon 返回的商品编号互相冲突，请重新读取商品目录。', 'unavailable');
      const offer = row.offer_id as string | undefined;
      const knownOffer = offersByProduct.get(id), knownProduct = offer === undefined ? undefined : productsByOffer.get(offer);
      if (knownOffer !== undefined && offer !== undefined && knownOffer !== offer || knownProduct !== undefined && knownProduct !== id)
        return failed('OZON_PRODUCT_IDENTITY_CONFLICT', 'Ozon 商品编号与 Offer 对应关系冲突，请重新读取商品目录。', 'unavailable');
      if (!offersByProduct.has(id) || offer !== undefined) offersByProduct.set(id, offer);
      if (offer !== undefined) productsByOffer.set(offer, id);
      return { id, ...(offer !== undefined ? { offer } : {}) };
    };
    const readBatch = async (body: Record<string, unknown>, expectedIds?: Set<string>): Promise<AdapterResponse | undefined> => {
      const response = await this.request(storeId, { path: '/v3/product/info/list', body, credentialRevision }, signal);
      if (response.status !== 'ok') return response;
      const rows = productRows(response.raw.response);
      if (!rows) return failed('OZON_PRODUCTS_INVALID', 'Ozon 未返回完整的商品列表。', 'unavailable');
      const received = new Set<string>();
      for (const row of rows) {
        let id: string;
        if (expectedIds) {
          const identity = identify(row); if ('status' in identity) return identity;
          id = identity.id;
          if (!expectedIds.has(id)) return failed('OZON_PRODUCT_DETAILS_INCOMPLETE', 'Ozon 商品详情与本页目录编号不对应，未返回完整商品目录。', 'unavailable');
          received.add(id);
        } else id = String(row.id ?? row.product_id ?? row.offer_id);
        if (!seenIds.has(id)) { seenIds.add(id); products.push(row); }
      }
      if (expectedIds && received.size !== expectedIds.size)
        return failed('OZON_PRODUCT_DETAILS_INCOMPLETE', 'Ozon 未返回本页全部商品的详情，未返回完整商品目录。', 'unavailable');
      lastResponse = response; return undefined;
    };
    if (selected) {
      for (const [index, values] of selected.entries()) for (let offset = 0; offset < values.length; offset += 1000) {
        const result = await readBatch({ [index === 0 ? 'offer_id' : index === 1 ? 'product_id' : 'sku']: values.slice(offset, offset + 1000) }); if (result) return result;
      }
    } else {
      // ALL is not relied on to include archived products. Each visibility owns its cursor and completeness check.
      for (const visibility of ['ALL', 'ARCHIVED']) {
        let cursor = '', expectedTotal: number | undefined;
        const seenCursors = new Set<string>(), listedIds = new Set<string>();
        for (let page = 0; page < 1000; page++) {
          const listed = await this.request(storeId, { path: '/v3/product/list', body: { filter: { visibility }, limit: 1000, last_id: cursor }, credentialRevision }, signal);
          if (listed.status !== 'ok') return listed;
          lastResponse = listed;
          const items = productRows(listed.raw.response);
          if (!items) return failed('OZON_PRODUCTS_INVALID', 'Ozon 未返回完整的商品目录。', 'unavailable');
          const total = listed.raw.response.result?.total ?? listed.raw.response.total;
          if (total !== undefined) {
            if (!Number.isSafeInteger(total) || total < 0) return failed('OZON_PRODUCTS_INVALID', 'Ozon 商品目录总数无效。', 'unavailable');
            if (expectedTotal !== undefined && total !== expectedTotal) return failed('OZON_PRODUCT_PAGINATION_INCOMPLETE', '商品目录在分页期间发生变化，请重新查询。', 'unavailable');
            expectedTotal = total;
          }
          const unseen = new Map<string, unknown>();
          for (const item of items) {
            const identity = identify(item); if ('status' in identity) return identity;
            listedIds.add(identity.id);
            if (!seenIds.has(identity.id)) unseen.set(identity.id, item.product_id ?? item.id);
          }
          if (unseen.size) {
            const ids = [...unseen.entries()];
            for (let offset = 0; offset < ids.length; offset += 1000) {
              const batch = ids.slice(offset, offset + 1000);
              const result = await readBatch({ product_id: batch.map(([, value]) => value) }, new Set(batch.map(([id]) => id))); if (result) return result;
            }
          }
          const rawNext = listed.raw.response.result?.last_id ?? listed.raw.response.last_id;
          if (rawNext !== undefined && typeof rawNext !== 'string') return failed('OZON_PRODUCTS_INVALID', 'Ozon 商品目录分页标识无效。', 'unavailable');
          if (rawNext === undefined && (expectedTotal === undefined || listedIds.size !== expectedTotal))
            return failed('OZON_PRODUCT_PAGINATION_INCOMPLETE', 'Ozon 未提供完整的分页结束依据，请重新查询。', 'unavailable');
          const next = rawNext ?? '';
          if (!items.length || !next) {
            if (expectedTotal !== undefined && listedIds.size !== expectedTotal) return failed('OZON_PRODUCT_PAGINATION_INCOMPLETE', '商品分页返回数量与目录总数不一致，请重新查询。', 'unavailable');
            break;
          }
          if (seenCursors.has(next) || page === 999) return failed('OZON_PRODUCT_PAGINATION_INCOMPLETE', '商品分页未完整结束，请重新查询。', 'unavailable');
          seenCursors.add(next); cursor = next;
        }
      }
    }
    return { status: 'ok', raw: { ...(lastResponse?.raw ?? { credentialRevision, httpStatus: 200, outcome: 'succeeded' }), response: { items: products } } };
  }
}
