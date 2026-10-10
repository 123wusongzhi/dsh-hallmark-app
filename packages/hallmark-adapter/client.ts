import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AdapterResult, ArchiveProductsRaw, ArchiveProductsResult, AssignmentInput, AssignmentResult, CategoryDataInput, CategoryDataRaw, CollectedItemRaw, CollectedItemSummary, HallmarkClientOptions, HallmarkStore, HallmarkTask, OrdinaryCnyOperationRaw, OrdinaryCnyOperationResult, OrdinaryCnyPriceProduct, PlatformCallInput, PlatformCallRecord, Provenance, StoreProductSnapshot, SubmitArchiveProductsInput, SubmitOrdinaryCnyPriceInput, RegisterTaskSalesVariantsInput, RegisterTaskSalesVariantsResult } from './types.ts';
import {OZON_STORE_READ_ENDPOINTS} from './ozon-read-routes.ts';
import { ordinaryResult, ordinarySelection, validateOrdinaryIdentity } from './manual-price.ts';
import { categoryRequest } from './category.ts';
import { archiveInput, archiveResult } from './archive.ts';

export const PLATFORM_READ_ENDPOINTS: Readonly<Record<string, 'GET' | 'POST'>> = Object.freeze({
  '/v3/product/info/list': 'POST', '/v5/product/info/prices': 'POST',
  '/v4/product/info/attributes': 'POST', '/v1/actions': 'GET',
  '/v2/actions/products': 'POST', '/v2/actions/candidates': 'POST',
  '/v2/product/info/stocks-by-warehouse/fbs': 'POST', '/v1/product/import/info': 'POST',
  '/v2/warehouse/list': 'POST',
});
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
export function adapterFailure<T = never>(code: string, message: string, status: AdapterResult<T>['status'] = 'failed', retryable = false, retryAfterMs?: number): AdapterResult<T> {
  return { status, error: { code, message, retryable, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) } };
}
export function validateLoopbackUrl(value: string): string {
  if (!/^https?:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/i.test(value)) throw new Error('HALLMARK_CONTROL_URL must use a literal loopback IP');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('HALLMARK_CONTROL_URL must use a literal loopback IP with no credentials, path, query or fragment');
  }
  // Reject localhost (DNS resolution is not a fixed security boundary), redirects, and unusual aliases.
  return url.origin;
}
function retryDelay(value: unknown, now: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string') return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  const parsed = Date.parse(value); return Number.isFinite(parsed) ? Math.max(0, parsed - now) : undefined;
}
function dataTime(raw: unknown): string | undefined {
  const record = object(raw);
  // No fetchedAt fallback: source time and read time are different facts.
  for (const key of ['lastSuccessAt', 'observedAt', 'collectedAt', 'checkedAt']) if (typeof record?.[key] === 'string') return record[key] as string;
  return undefined;
}

export class HallmarkClient {
  readonly baseUrl: string;
  readonly ozonDataBaseUrl: string;
  private readonly options: HallmarkClientOptions;
  private readonly fetchImpl: typeof fetch;
  private healthEntry?: { until: number; result: AdapterResult<Record<string, unknown>> };
  private healthFlight?: Promise<AdapterResult<Record<string, unknown>>>;
  /** Process-local single-flight/re-send barrier; durable operation ownership remains the Core caller's responsibility. */
  private readonly ordinarySubmissions = new Map<string, { hash: string; products: OrdinaryCnyPriceProduct[]; result: Promise<OrdinaryCnyOperationResult> }>();
  /** Source archive request IDs are global, not per store. No repeat POST is ever used as a lookup. */
  private readonly archiveSubmissions = new Map<string, { hash: string; result: Promise<ArchiveProductsResult> }>();
  constructor(options: HallmarkClientOptions = {}) {
    this.options = options;
    this.baseUrl = validateLoopbackUrl(options.baseUrl ?? process.env.HALLMARK_CONTROL_URL ?? 'http://127.0.0.1:4173');
    this.ozonDataBaseUrl = options.ozonDataBaseUrl === undefined ? this.baseUrl : validateLoopbackUrl(options.ozonDataBaseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  private now(): Date { return this.options.now?.() ?? new Date(); }
  async health(force = false): Promise<AdapterResult<Record<string, unknown>>> {
    if (this.healthFlight) return this.healthFlight;
    if (!force && this.healthEntry && this.healthEntry.until > this.now().getTime()) return this.healthEntry.result;
    this.healthFlight = this.request<Record<string, unknown>>('/api/health', 'GET', undefined, { health: true }).then(result => {
      // Board shares its event loop with platform work. A transient probe failure must
      // not prevent another check for the full successful-health cache interval.
      const cacheMs = this.options.healthCacheMs ?? 10_000;
      this.healthEntry = { result, until: this.now().getTime() + (result.status === 'ok' ? cacheMs : Math.min(cacheMs, 1000)) };
      return result;
    }).finally(() => { this.healthFlight = undefined; });
    return this.healthFlight;
  }
  private async request<T>(endpoint: string, method: 'GET' | 'POST', body?: unknown, config: { source?: Provenance['source']; platform?: boolean; writeRisk?: boolean; platformWork?: boolean; readOnly?: boolean; auth?: boolean; health?: boolean; storeId?: string; ozonData?: boolean; onDispatch?: () => void; onResponse?: (status: number) => void } = {}): Promise<AdapterResult<T>> {
    if (!config.health) {
      const health = await this.health();
      if (health.status !== 'ok') return adapterFailure(health.error?.code ?? 'HALLMARK_UNAVAILABLE', health.error?.message ?? 'Hallmark 健康检查未通过', health.status === 'failed' ? 'failed' : 'unavailable', health.error?.retryable ?? true, health.error?.retryAfterMs);
    }
    let token: string | undefined;
    if (config.auth) {
      try {
        const configured = this.options.operatorToken ?? process.env.HALLMARK_OPERATOR_TOKEN;
        token = typeof configured === 'function' ? await configured() : configured;
      } catch { return adapterFailure('HUMAN_AUTH_REQUIRED', 'Hallmark 操作令牌不可用'); }
      if (!token?.trim()) return adapterFailure('HUMAN_AUTH_REQUIRED', '此原项目接口需要配置 HALLMARK_OPERATOR_TOKEN，不会自动读取令牌文件');
      if (/\s/.test(token)) return adapterFailure('HUMAN_AUTH_INVALID', 'Hallmark 操作令牌格式无效');
    }
    const writeRisk = config.platform || config.writeRisk;
    const timeout = config.health ? (this.options.healthTimeoutMs ?? 10_000) : config.platform || config.platformWork ? (this.options.platformTimeoutMs ?? 70_000) : (this.options.readTimeoutMs ?? 30_000);
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      let raw: unknown; let response: Response;
      try {
        config.onDispatch?.();
        response = await this.fetchImpl(`${config.ozonData ? this.ozonDataBaseUrl : this.baseUrl}${endpoint}`, {
          method, redirect: 'error', signal: controller.signal,
          headers: { 'Accept': 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        });
        config.onResponse?.(response.status);
        const text = await response.text();
        try { raw = JSON.parse(text); } catch {
          return { ...adapterFailure<T>(writeRisk ? 'OUTCOME_UNKNOWN' : 'INVALID_RESPONSE', 'Hallmark 返回不完整或非 JSON 响应', writeRisk ? 'unknown' : config.health ? 'unavailable' : 'failed', !writeRisk),
            ...(config.writeRisk ? { raw: text as T, provenance: { source: config.source ?? 'hallmark_snapshot', endpoint, fetchedAt: this.now().toISOString(), ...(config.storeId ? { storeId: config.storeId } : {}) } } : {}) };
        }
      } catch {
        // A platform POST may have been received and committed. Never call it again here.
        if (writeRisk) return adapterFailure('OUTCOME_UNKNOWN', config.writeRisk ? '原业务提交未取得完整回执；保留原操作请求编号核实，禁止自动重发' : '平台调用未取得完整回执；先按 taskId/requestId 核实，禁止自动重发', 'unknown');
        this.healthEntry = undefined;
        return adapterFailure('HALLMARK_UNAVAILABLE', 'Hallmark Control 网络不可用或超时', 'unavailable', true);
      } finally { clearTimeout(timer); }
      const record = object(raw);
      const delay = typeof record?.retryAfterMs === 'number' ? record.retryAfterMs : retryDelay(record?.retryAfter ?? response.headers.get('retry-after'), this.now().getTime());
      const rateLimited = response.status === 429 || record?.code === 'LOCAL_RATE_LIMIT';
      if (rateLimited && config.readOnly && !writeRisk && !config.health && attempt === 0 && delay !== undefined && delay <= 5000 && delay >= 0) {
        await (this.options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(delay);
        continue;
      }
      if (writeRisk && (response.status >= 500 || config.writeRisk && response.status === 408)) {
        return { ...adapterFailure<T>('OUTCOME_UNKNOWN', 'Hallmark 返回服务错误或超时，写入可能已发送；必须先查询原记录', 'unknown'), raw: raw as T,
          ...(config.writeRisk ? { provenance: { source: config.source ?? 'hallmark_snapshot', endpoint, fetchedAt: this.now().toISOString(), ...(config.storeId ? { storeId: config.storeId } : {}) } } : {}) };
      }
      // Both official entrypoints expose the shared read API; this does not imply write-route parity.
      if (config.health && response.ok && record?.service !== 'hallmark-control' && record?.service !== 'hallmark-board') return adapterFailure('HALLMARK_UNAVAILABLE', '健康响应不是 Hallmark Control 或 Hallmark Board', 'unavailable', true);
      if (!response.ok || rateLimited) {
        const code = rateLimited ? 'LOCAL_RATE_LIMIT' : typeof record?.code === 'string' ? record.code : `HALLMARK_HTTP_${response.status}`;
        const message = typeof record?.error === 'string' ? record.error : 'Hallmark 请求失败';
        const result = adapterFailure<T>(code, message, rateLimited || response.status >= 500 ? 'unavailable' : 'failed', !writeRisk && (rateLimited || response.status >= 500), delay);
        result.raw = raw as T;
        if (config.health && response.status >= 500) this.healthEntry = undefined;
        return result;
      }
      const provenance: Provenance = { source: config.source ?? 'hallmark_snapshot', endpoint, fetchedAt: this.now().toISOString(), ...(config.storeId ? { storeId: config.storeId } : {}), ...(dataTime(raw) ? { dataTime: dataTime(raw) } : {}) };
      const result: AdapterResult<T> = { status: 'ok', raw: raw as T, provenance };
      if (config.platform) {
        if (!record || !['pending', 'response_received', 'outcome_unknown'].includes(String(record.outcome))) {
          return { ...result, ...adapterFailure<T>('OUTCOME_UNKNOWN', '平台回执缺少明确 outcome，先核实记录', 'unknown') };
        }
        if (record.outcome === 'outcome_unknown' || record.outcome === 'pending') {
          result.status = 'unknown'; result.error = { code: 'OUTCOME_UNKNOWN', message: '平台结果不确定，禁止自动重写，请回读核实', retryable: false };
        } else if (typeof record.httpStatus !== 'number') {
          result.status = 'unknown'; result.error = { code: 'OUTCOME_UNKNOWN', message: '平台回执缺少上游 HTTP 状态，请先核实', retryable: false };
        } else if (record.httpStatus < 200 || record.httpStatus >= 300) {
          const upstreamDelay = retryDelay(record.retryAfter, this.now().getTime());
          result.status = record.httpStatus === 429 ? 'unavailable' : 'failed';
          result.error = { code: record.httpStatus === 429 ? 'LOCAL_RATE_LIMIT' : 'PLATFORM_ERROR', message: `平台 HTTP ${record.httpStatus}`, retryable: config.readOnly === true, ...(upstreamDelay !== undefined ? { retryAfterMs: upstreamDelay } : {}) };
        }
        if (typeof record.startedAt === 'string') provenance.dataTime = record.startedAt;
        if (typeof record.storeId === 'string') provenance.storeId = record.storeId;
        // The upstream record is the authority for store/task identity, not an agent-supplied claim.
        if (typeof record.path === 'string') provenance.endpoint = record.path;
      }
      const bytes = Buffer.byteLength(JSON.stringify(raw));
      if (!config.health && bytes > (this.options.spillThresholdBytes ?? 1024 * 1024)) {
        const digest = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
        const dir = this.options.spillDirectory ?? join(process.env.LOCALAPPDATA ?? homedir(), 'dsh-hallmark-app', 'data', 'spill');
        try {
          await mkdir(dir, { recursive: true });
          const path = join(dir, `${digest}.json`);
          await writeFile(path, JSON.stringify(raw), { mode: 0o600 });
          result.spill = { path, bytes, summary: { kind: Array.isArray(raw) ? 'array' : typeof raw, ...(Array.isArray(raw) ? { count: raw.length } : Array.isArray(record?.products) ? { count: record.products.length } : {}) }, cursor: `spill:${digest}:0` };
        } catch { return { ...result, status: 'failed', error: { code: 'SPILL_FAILED', message: '无法持久保存完整大响应；原始结果仍保留', retryable: false } }; }
      }
      return result;
    }
    return adapterFailure('LOCAL_RATE_LIMIT', '读取仍受限，请稍后重试', 'unavailable', true);
  }
  getStores(): Promise<AdapterResult<HallmarkStore[]>> { return this.request('/api/stores', 'GET', undefined, { readOnly: true }); }
  getStoreProducts(): Promise<AdapterResult<StoreProductSnapshot>> { return this.request('/api/store-products', 'GET', undefined, { readOnly: true }); }
  /** Read the current reference fee scheme; this never changes global pricing settings. */
  getPricingSettings(): Promise<AdapterResult<Record<string, unknown>>> { return this.request('/api/dynamic-pricing/settings', 'GET', undefined, { readOnly: true }); }
  /** Hallmark synchronizes ALL Ozon stores. Do not imply single-store side effects. */
  syncStoreProducts(): Promise<AdapterResult<StoreProductSnapshot>> { return this.request('/api/store-products/sync', 'POST', {}, { readOnly: true }); }
  /** Traffic metrics, not a profit calculation endpoint. */
  getAnalytics(period: { dateFrom: string; dateTo: string }): Promise<AdapterResult<StoreProductSnapshot>> { return this.request('/api/store-products/analytics', 'POST', period, { readOnly: true }); }
  getTargetMargin(): Promise<AdapterResult<Record<string, unknown>>> { return this.request('/api/target-margin', 'GET', undefined, { readOnly: true, auth: true, source: 'hallmark_compute' }); }
  async searchCollectedItems(query = ''): Promise<AdapterResult<CollectedItemSummary[]> & { matches?: CollectedItemSummary[] }> {
    const result = await this.request<CollectedItemSummary[]>('/api/items', 'GET', undefined, { readOnly: true, source: 'collected_item' });
    if (result.status !== 'ok' || !Array.isArray(result.raw)) return result;
    const needle = query.trim().toLocaleLowerCase();
    return { ...result, matches: result.raw.filter(item => !needle || JSON.stringify(item).toLocaleLowerCase().includes(needle)) };
  }
  /** Explicit raw endpoint is necessary: /api/items/:id is processed detail. */
  getCollectedItem(id: string): Promise<AdapterResult<CollectedItemRaw>> { return this.request(`/api/items/${encodeURIComponent(id)}/raw?full=1`, 'GET', undefined, { readOnly: true, source: 'collected_item' }); }
  getCollectedItemDetail(id: string): Promise<AdapterResult<Record<string, unknown>>> { return this.request(`/api/items/${encodeURIComponent(id)}`, 'GET', undefined, { readOnly: true, source: 'collected_item' }); }
  getTasks(): Promise<AdapterResult<HallmarkTask[]>> { return this.request('/api/tasks', 'GET', undefined, { readOnly: true }); }
  getTask(id: string): Promise<AdapterResult<HallmarkTask>> { return this.request(`/api/tasks/${encodeURIComponent(id)}`, 'GET', undefined, { readOnly: true }); }
  /** Freezes actual sale compositions on the existing task. This is metadata, not an Ozon write. */
  registerTaskSalesVariants(id: string, input: RegisterTaskSalesVariantsInput): Promise<AdapterResult<RegisterTaskSalesVariantsResult>> {
    if (!id?.trim()) return Promise.resolve(adapterFailure('TASK_ID_REQUIRED', '需要明确的上品任务编号'));
    return this.request(`/api/tasks/${encodeURIComponent(id)}/sales-variants`, 'POST', input, { writeRisk: true });
  }
  getTaskContext(id: string): Promise<AdapterResult<Record<string, unknown> | null>> { return this.request(`/api/tasks/${encodeURIComponent(id)}/context`, 'GET', undefined, { readOnly: true }); }
  verifyTask(id: string): Promise<AdapterResult<Record<string, unknown>>> { return this.request(`/api/tasks/${encodeURIComponent(id)}/verify`, 'POST', {}, { readOnly: true }); }
  async createAssignment(input: AssignmentInput): Promise<AdapterResult<AssignmentResult>> {
    const health = await this.health();
    if (health.status !== 'ok') return {status:health.status,error:health.error,provenance:health.provenance};
    // Board and Control expose the same dispatch service at different public routes.
    // Choose before dispatch; never retry a possibly-created assignment on another route.
    const route = health.raw?.service === 'hallmark-board' ? '/api/tasks' : '/api/assignments';
    return this.request(route, 'POST', input, { auth: true, writeRisk: true });
  }
  /** Six Source catalog read/cache routes. Source capability/partial/stale/search candidates are never promoted. */
  async getCategoryData(input: CategoryDataInput): Promise<AdapterResult<CategoryDataRaw>> {
    const route = categoryRequest(input);
    if ('status' in route) return route;
    const result = await this.request<CategoryDataRaw>(route.endpoint, route.method, route.body, { readOnly: true, storeId: route.storeId });
    if (result.status !== 'ok') return result;
    const raw = object(result.raw);
    if (!raw) return { ...result, ...adapterFailure<CategoryDataRaw>('INVALID_RESPONSE', '类目接口未返回原约定的 JSON 对象') };
    if (raw.storeId !== undefined && raw.storeId !== route.storeId) return { ...result, ...adapterFailure<CategoryDataRaw>('CATALOG_IDENTITY_MISMATCH', '类目响应中的店铺与明确选择不一致') };
    if (result.provenance) {
      // Source fetch time, not the current adapter read time and not an inferred capability timestamp.
      delete result.provenance.dataTime;
      const sourceTime = typeof raw.fetchedAt === 'string' ? raw.fetchedAt : typeof raw.treeFetchedAt === 'string' ? raw.treeFetchedAt : undefined;
      if (sourceTime && Number.isFinite(Date.parse(sourceTime))) result.provenance.dataTime = sourceTime;
    }
    return result;
  }
  /** Real archive mutation, never local deletion/undo. Caller owns current-turn authorization and durable idempotency. */
  async submitArchiveProducts(input: SubmitArchiveProductsInput): Promise<ArchiveProductsResult> {
    const selection = archiveInput(input);
    if ('status' in selection) return selection;
    const key = selection.requestId;
    const hash = createHash('sha256').update(JSON.stringify(selection)).digest('hex');
    const previous = this.archiveSubmissions.get(key);
    if (previous) {
      if (previous.hash !== hash) return adapterFailure('ARCHIVE_REQUEST_ID_REUSED', '同一原归档请求编号不能改变商品清单、店铺或顺序；不会换编号重写');
      return structuredClone(await previous.result);
    }
    const endpoint = '/api/store-products/archive';
    let dispatched = false;
    let httpStatus: number | undefined;
    const flight = Promise.resolve().then(async () => {
      try {
        const result = await this.request<ArchiveProductsRaw>(endpoint, 'POST', selection, {
          auth: true, writeRisk: true, platformWork: true,
          onDispatch: () => { dispatched = true; }, onResponse: status => { httpStatus = status; },
        });
        if (result.raw !== undefined && !result.provenance) result.provenance = { source: 'hallmark_snapshot', endpoint, fetchedAt: this.now().toISOString() };
        return archiveResult(result, selection, httpStatus);
      } finally {
        if (!dispatched) this.archiveSubmissions.delete(key);
      }
    });
    this.archiveSubmissions.set(key, { hash, result: flight });
    return structuredClone(await flight);
  }
  /** Board-only, CNY-only ordinary price. Caller must authorize that currency and exact user values first. */
  async submitOrdinaryCnyPrice(input: SubmitOrdinaryCnyPriceInput): Promise<OrdinaryCnyOperationResult> {
    const selection = ordinarySelection(input);
    if ('status' in selection) return selection;
    const storeId = input.storeId;
    const operationId = selection.id;
    const key = `${storeId}:${operationId}`;
    const hash = createHash('sha256').update(JSON.stringify(selection)).digest('hex');
    const previous = this.ordinarySubmissions.get(key);
    if (previous) {
      if (previous.hash !== hash) return adapterFailure('ORDINARY_PRICE_OPERATION_ID_REUSED', '同一店铺和 UUID 不能用于不同明确商品或价格；不会创建新编号');
      return structuredClone(await previous.result);
    }
    const endpoint = `/api/manual-promotions/operations?storeId=${encodeURIComponent(storeId)}`;
    let dispatched = false;
    let httpStatus: number | undefined;
    const flight = Promise.resolve().then(async () => {
      try {
        const result = await this.request<OrdinaryCnyOperationRaw>(endpoint, 'POST', selection, {
          auth: true, writeRisk: true, platformWork: true, storeId,
          onDispatch: () => { dispatched = true; }, onResponse: status => { httpStatus = status; },
        });
        if (result.raw !== undefined && !result.provenance) result.provenance = { source: 'hallmark_snapshot', endpoint, storeId, fetchedAt: this.now().toISOString() };
        return ordinaryResult(result, storeId, operationId, httpStatus, selection.products);
      } finally {
        // Auth/health refusals did not send Source POST; caller may fix explicit configuration.
        if (!dispatched) this.ordinarySubmissions.delete(key);
      }
    });
    this.ordinarySubmissions.set(key, { hash, products: selection.products, result: flight });
    return structuredClone(await flight);
  }
  /** Read the existing Source record only; GET never re-submits or updates platform prices. */
  async getOrdinaryCnyOperation(storeId: string, operationId: string): Promise<OrdinaryCnyOperationResult> {
    const invalid = validateOrdinaryIdentity(storeId, operationId);
    if (invalid) return invalid;
    const endpoint = `/api/manual-promotions/operations/${encodeURIComponent(operationId)}?storeId=${encodeURIComponent(storeId)}`;
    let httpStatus: number | undefined;
    const result = await this.request<OrdinaryCnyOperationRaw>(endpoint, 'GET', undefined, {
      auth: true, readOnly: true, storeId, onResponse: status => { httpStatus = status; },
    });
    if (result.raw !== undefined && !result.provenance) result.provenance = { source: 'hallmark_snapshot', endpoint, storeId, fetchedAt: this.now().toISOString() };
    const normalized = ordinaryResult(result, storeId, operationId, httpStatus, this.ordinarySubmissions.get(`${storeId}:${operationId}`)?.products);
    return normalized.status === 'unavailable' ? { ...normalized, stage: 'outcome_unknown' } : normalized;
  }
  /** Explicit Source readback (proved read/journal/cache only); a fresh GET must confirm an existing pending record. */
  async inspectOrdinaryCnyOperation(storeId: string, operationId: string): Promise<OrdinaryCnyOperationResult> {
    const existing = await this.getOrdinaryCnyOperation(storeId, operationId);
    if (existing.stage !== 'pending' || !existing.raw || existing.raw.status !== 'pending') return existing;
    const endpoint = `/api/manual-promotions/operations/${encodeURIComponent(operationId)}/inspect?storeId=${encodeURIComponent(storeId)}`;
    let httpStatus: number | undefined;
    const result = await this.request<OrdinaryCnyOperationRaw>(endpoint, 'POST', {}, {
      auth: true, readOnly: true, platformWork: true, storeId, onResponse: status => { httpStatus = status; },
    });
    if (result.raw !== undefined && !result.provenance) result.provenance = { source: 'hallmark_snapshot', endpoint, storeId, fetchedAt: this.now().toISOString() };
    const normalized = ordinaryResult(result, storeId, operationId, httpStatus, this.ordinarySubmissions.get(`${storeId}:${operationId}`)?.products);
    return normalized.status === 'unavailable' ? { ...normalized, stage: 'outcome_unknown' } : normalized;
  }
  platformCall(id: string, input: PlatformCallInput): Promise<AdapterResult<PlatformCallRecord>> { return this.request(`/api/tasks/${encodeURIComponent(id)}/platform`, 'POST', input, { platform: true, source: 'ozon_api' }); }
  /** Store authorization belongs to Hallmark; this gateway never depends on a listing task. */
  storeDataRead(storeId:string,input:PlatformCallInput):Promise<AdapterResult<Record<string,unknown>>>{
    const method=input.method??'POST';
    if(!storeId||(OZON_STORE_READ_ENDPOINTS[input.path]??PLATFORM_READ_ENDPOINTS[input.path])!==method||method==='GET'&&(!object(input.body)||Object.keys(input.body as object).length))return Promise.resolve(adapterFailure('ENDPOINT_NOT_ALLOWED','仅允许已登记的店铺只读路径和精确方法。'));
    return this.request(`/api/stores/${encodeURIComponent(storeId)}/data/read`,'POST',input,{platform:true,readOnly:true,source:'ozon_api',storeId,ozonData:true});
  }
  readOrderWeights(storeId:string,input:Record<string,unknown>):Promise<AdapterResult<Record<string,unknown>>>{
    return this.request(`/api/stores/${encodeURIComponent(storeId)}/data/order-weights`,'POST',input,{platformWork:true,readOnly:true,source:'ozon_api',storeId,ozonData:true});
  }
  platformRead(id: string, input: PlatformCallInput): Promise<AdapterResult<PlatformCallRecord>> {
    const method = input.method ?? 'POST';
    if (PLATFORM_READ_ENDPOINTS[input.path] !== method || method === 'GET' && (!object(input.body) || Object.keys(input.body as object).length)) {
      return Promise.resolve(adapterFailure('ENDPOINT_NOT_ALLOWED', '读工具只允许精确白名单路径和方法；GET body 必须为空对象'));
    }
    return this.request(`/api/tasks/${encodeURIComponent(id)}/platform`, 'POST', input, { platform: true, readOnly: true, source: 'ozon_api' });
  }
}
