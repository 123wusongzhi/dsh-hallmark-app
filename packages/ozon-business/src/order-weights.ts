import { createHash, randomUUID } from 'node:crypto';
import type { AdapterResponse, CoreStore, RecordData } from '../../core/src/types.ts';
import type { OzonBusinessGateway } from './index.ts';
import { parseOrderWeightReport, type OrderWeightReport } from './order-weight-csv.ts';

const namespace = 'business_weight_reports';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code: string, message: string, retryable = false): AdapterResponse => ({ status: 'failed', error: { code, message, retryable } });
const cancelled = () => fail('OZON_REQUEST_CANCELLED', '实重读取已取消。');
const unknown = () => fail('WEIGHT_REPORT_OUTCOME_UNKNOWN', '报告创建结果未确认，已保留原请求；请核查原报告，不会重复创建。');
type Saved = {
  intent: string; requestKey: string; state: 'creating' | 'pending' | 'ready' | 'unknown' | 'failed';
  checkedAt: string; code?: string; report?: OrderWeightReport; reportHash?: string; error?: NonNullable<AdapterResponse['error']>; retryAt?: number;
};
type Flight = { promise: Promise<AdapterResponse>; controller: AbortController; waiters: number };
const flights = new WeakMap<CoreStore, Map<string, Flight>>();

function dates(input: RecordData): { from: string; to: string; requestKey: string } | undefined {
  const valid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!valid(input.dateFrom) || !valid(input.dateTo)) return undefined;
  const duration = Date.parse(input.dateTo) - Date.parse(input.dateFrom);
  if (duration < 0 || duration >= 90 * 86_400_000 || input.requestId !== undefined && (typeof input.requestId !== 'string' || !input.requestId.trim() || input.requestId.length > 256)) return undefined;
  return { from: input.dateFrom, to: input.dateTo, requestKey: hash(input.requestId ?? 'default') };
}

/** Durable report ownership is independent of the legacy Hallmark service and survives runtime restart. */
export class OzonOrderWeightReports {
  #gateway: OzonBusinessGateway; #store: CoreStore; #connection: string; #revision: number;
  constructor(gateway: OzonBusinessGateway, store: CoreStore, connectionId: string, configRevision = 1) {
    this.#gateway = gateway; this.#store = store; this.#connection = connectionId; this.#revision = configRevision;
  }

  async read(storeId: string, input: RecordData, signal?: AbortSignal): Promise<AdapterResponse> {
    if (signal?.aborted) return cancelled();
    const range = dates(input);
    if (!range) return fail('WEIGHT_DATE_RANGE_INVALID', '实重日期范围必须是有效日期，按顺序且最多 90 天。');
    let entry;
    try { entry = this.#gateway.getStore(storeId); } catch { return fail('STORE_DIRECTORY_UNAVAILABLE', '经营店铺目录暂时无法读取。', true); }
    if (!entry || entry.sourceConnectionId && entry.sourceConnectionId !== this.#connection) return fail('STORE_CONNECTION_MISMATCH', '店铺不属于当前经营连接。');
    if (!entry.enabled) return fail('OZON_STORE_DISABLED', '店铺已停用，不能创建新的报告。');
    const credentialRevision = entry.credentialRevision;
    const key = hash([this.#connection, this.#revision, storeId, credentialRevision, range.from, range.to]);
    let active = flights.get(this.#store); if (!active) { active = new Map(); flights.set(this.#store, active); }
    let flight = active.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      flight = { controller, waiters: 0, promise: Promise.resolve().then(() => this.#read(key, storeId, credentialRevision, range, controller.signal)).catch(() => fail('WEIGHT_REPORT_UNAVAILABLE', '未取得完整重量报告，请保留原请求重试。', true)) };
      active.set(key, flight);
      const owned = flight;
      void flight.promise.finally(() => { if (active.get(key) === owned) active.delete(key); });
    }
    // A cancelled caller stops waiting. Other callers keep their shared read; the last cancellation aborts transport.
    const shared = flight;
    return new Promise(resolve => {
      let done = false; shared.waiters++;
      const finish = (result: AdapterResponse) => { if (done) return; done = true; signal?.removeEventListener('abort', abort); shared.waiters--; resolve(result); };
      const abort = () => { finish(cancelled()); if (!shared.waiters) shared.controller.abort(); };
      signal?.addEventListener('abort', abort, { once: true });
      shared.promise.then(finish);
      if (signal?.aborted) abort();
    });
  }

  async #read(key: string, storeId: string, credentialRevision: number, range: { from: string; to: string; requestKey: string }, signal: AbortSignal): Promise<AdapterResponse> {
    const now = () => new Date().toISOString();
    const response = (saved: Saved): AdapterResponse => ({ status: 'ok', raw: { storeId, status: saved.state === 'ready' ? 'ready' : 'pending', checkedAt: saved.checkedAt, ...(saved.state === 'ready' ? { ...saved.report, reportHash: saved.reportHash } : { items: [], skipped: [] }) } });
    const current = () => this.#gateway.getStore(storeId)?.credentialRevision === credentialRevision;
    const changed = () => fail('OZON_CREDENTIAL_REVISION_CHANGED', '店铺凭据已更新，请重新读取实重。');
    let saved: Saved, ownsCreation = false;
    if (signal.aborted) return cancelled();
    this.#store.transaction(() => {
      const prior = this.#store.get<Saved>(namespace, key);
      if (prior && (prior.state !== 'ready' && prior.state !== 'failed'
        || prior.state === 'ready' && prior.requestKey === range.requestKey
        || prior.state === 'failed' && (prior.retryAt !== undefined ? Date.now() < prior.retryAt : prior.requestKey === range.requestKey && prior.error?.code !== 'OZON_REQUEST_CANCELLED'))) { saved = prior; return; }
      saved = { intent: randomUUID(), requestKey: range.requestKey, state: 'creating', checkedAt: now() };
      this.#store.put(namespace, key, saved); ownsCreation = true;
    });
    saved = saved!;
    const save = (value: Saved): Saved => this.#store.transaction(() => {
      const current = this.#store.get<Saved>(namespace, key);
      // Separate runtime/store instances can poll concurrently. A late pending/failed response must not demote ready.
      if (current?.intent !== value.intent) return value;
      if (current.state === 'ready') return current;
      return this.#store.put(namespace, key, value);
    });
    if (!ownsCreation) {
      if (saved.state === 'unknown' || saved.state === 'creating') return unknown();
      if (saved.state === 'failed') return { status: 'failed', error: { ...saved.error!, ...(saved.retryAt === undefined ? {} : { retryAfterMs: Math.max(0, saved.retryAt - Date.now()) }) } };
      if (saved.state === 'ready') return current() ? response(saved) : changed();
    } else {
      const created = await this.#gateway.createOrderWeightReport(storeId, range.from, range.to, credentialRevision, signal);
      const code = created.raw?.response?.result?.code;
      if (created.status !== 'ok' || typeof code !== 'string' || !code.trim() || code.length > 4096) {
        const uncertain = created.status === 'unknown' || created.status === 'ok';
        const error = uncertain ? unknown().error! : created.error ?? fail('WEIGHT_REPORT_CREATE_FAILED', '未创建重量报告。').error!;
        const retryAt = !uncertain && error.retryable ? Date.now() + (error.retryAfterMs ?? 60_000) : undefined;
        saved = save({ ...saved, state: uncertain ? 'unknown' : 'failed', error, checkedAt: now(), ...(retryAt === undefined ? {} : { retryAt }) });
        return { status: 'failed', error: { ...error, ...(retryAt === undefined ? {} : { retryAfterMs: retryAt - Date.now() }) } };
      }
      // Persist a complete receipt even when the caller cancelled while the response was arriving.
      saved = save({ ...saved, code, state: 'pending', checkedAt: now() });
    }
    if (signal.aborted) return cancelled();
    if (!current()) return changed();
    const info = await this.#gateway.inspectOrderWeightReport(storeId, saved.code!, credentialRevision, signal);
    if (info.status !== 'ok') {
      const diagnostics = info.raw?.response;
      return { status: info.status, error: { ...(info.error ?? fail('WEIGHT_REPORT_LOOKUP_FAILED', '重量报告进度查询失败。', true).error!),
        message: `重量报告进度查询失败，原报告已保留。${info.error?.message ?? ''}${diagnostics && Object.keys(diagnostics).length ? ` 平台诊断：${JSON.stringify(diagnostics)}` : ''}` } };
    }
    if (signal.aborted) return cancelled();
    if (!current()) return changed();
    const result = info.raw?.response?.result;
    saved = { ...saved, checkedAt: now() };
    if (['waiting', 'processing', 'created'].includes(result?.status)) { saved = save(saved); return response(saved); }
    if (result?.status === 'failed') {
      saved = save({ ...saved, state: 'failed', error: { ...fail('WEIGHT_REPORT_FAILED', 'Ozon 已确认报告生成失败；请等待 60 秒后重新查询。', true).error!, retryAfterMs: 60_000 }, retryAt: Date.now() + 60_000 });
      return saved.state === 'ready' ? response(saved) : { status: 'failed', error: saved.error };
    }
    if (result?.status !== 'success' || typeof result.file !== 'string' || !result.file) return fail('WEIGHT_REPORT_RESPONSE_INVALID', 'Ozon 未返回可读取的报告，保留原报告等待核查。', true);
    try {
      const csv = await this.#gateway.downloadOrderWeightReport(result.file, signal);
      if (signal.aborted) return cancelled();
      if (!current()) return changed();
      const report = parseOrderWeightReport(csv), reportHash = createHash('sha256').update(csv).digest('hex');
      saved = save({ ...saved, state: 'ready', requestKey: range.requestKey, report, reportHash, checkedAt: now() });
      return response(saved);
    } catch {
      // Do not persist signed URLs, report text or customer columns, including in errors.
      return signal.aborted ? cancelled() : fail('WEIGHT_REPORT_UNREADABLE', '重量报告无法安全下载或解析，请缩小日期范围并确认英文报告包含实重列；原报告已保留。', true);
    }
  }
}
