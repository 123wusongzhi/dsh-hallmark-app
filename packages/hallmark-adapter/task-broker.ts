import { createHash } from 'node:crypto';
import { adapterFailure, HallmarkClient } from './client.ts';
import type { AdapterResult, BrokerTask, HallmarkTask, MappingStore, TaskBrokerOptions, TaskMapping } from './types.ts';

export const HALLMARK_AGENT_ID = 'dsh-hallmark-app';
const unavailableForPlatform = new Set(['cancelled', 'replaced', 'split']);
const terminalForListing = new Set([...unavailableForPlatform, 'listed']);
export function requestId(opType: string, operationId: string, sequence = 0): string {
  if (!opType.trim() || !operationId.trim() || !Number.isSafeInteger(sequence) || sequence < 0) throw new Error('requestId requires a kind, operation identity and nonnegative safe sequence');
  const kind = opType.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
  // Hash the entire identity rather than truncating UUIDs or accepting collisions in long operation IDs.
  return `${kind}-${createHash('sha256').update(operationId).digest('hex').slice(0, 24)}-${sequence}`;
}
function mappingKey(storeId: string, purpose: string, itemId?: string, scope?: string[]): string {
  return createHash('sha256').update(JSON.stringify([storeId, purpose, itemId ?? null, scope ?? null])).digest('hex');
}
function usable(task: HallmarkTask | undefined, storeId: string, listing = false): task is HallmarkTask {
  return Boolean(task && task.kind === 'listing' && task.storeId === storeId && typeof task.id === 'string'
    && !(listing ? terminalForListing : unavailableForPlatform).has(task.status));
}
function propagateFailure<T>(result: AdapterResult<T>): AdapterResult<BrokerTask> {
  return { status: result.status, ...(result.error ? { error: result.error } : {}), ...(result.provenance ? { provenance: result.provenance } : {}) };
}
function validateScope(task: HallmarkTask, scope: string[]): boolean {
  const known = task.salesVariants?.map(row => row.salesSkuId) ?? task.listingGroup?.skuCodes
    ?? task.autonomousSkuCodes ?? task.assignmentSnapshot?.item?.skuCodes;
  return !known || scope.every(sku => known.includes(sku));
}

/** Serializes preparations in one service process. Upstream assignments also deduplicate active item/store pairs. */
export class TaskBroker {
  private readonly client: HallmarkClient;
  private readonly store: MappingStore;
  private readonly options: TaskBrokerOptions;
  private readonly inFlight = new Map<string, Promise<AdapterResult<BrokerTask>>>();
  constructor(client: HallmarkClient, store: MappingStore, options: TaskBrokerOptions = {}) {
    this.client = client; this.store = store; this.options = options;
  }
  requestId(opType: string, operationId: string, sequence = 0): string { return requestId(opType, operationId, sequence); }
  private now(): string { return (this.options.now?.() ?? new Date()).toISOString(); }
  private single(key: string, run: () => Promise<AdapterResult<BrokerTask>>): Promise<AdapterResult<BrokerTask>> {
    const current = this.inFlight.get(key); if (current) return current;
    const promise = run().catch(() => adapterFailure<BrokerTask>('TASK_PREPARATION_FAILED', '内部任务关联或持久化失败；先查询原任务，不自动执行业务写')).finally(() => { this.inFlight.delete(key); });
    this.inFlight.set(key, promise); return promise;
  }
  private async remember(id: string, task: HallmarkTask, purpose: string, created: boolean, itemId?: string, scope?: string[]): Promise<AdapterResult<BrokerTask>> {
    const mapping: TaskMapping = { id, taskId: task.id, storeId: task.storeId!, purpose, createdAt: this.now(), ...(itemId ? { collectedItemId: itemId } : {}), ...(scope ? { skuScope: scope } : {}) };
    this.store.put('internal_tasks', id, mapping);
    await this.options.audit?.({ kind: purpose === 'store_operation' ? 'internal_task_associated' : 'listing_task_prepared', at: this.now(), taskId: task.id, storeId: task.storeId!, purpose, created, ...(itemId ? { collectedItemId: itemId } : {}), ...(scope ? { skuScope: scope } : {}) });
    return { status: 'ok', raw: { taskId: task.id, task, created, reused: !created, ...(scope ? { skuScope: scope } : {}) } };
  }
  getStoreTask(storeId: string): Promise<AdapterResult<BrokerTask>> {
    if (!storeId?.trim()) return Promise.resolve(adapterFailure('MISSING_PARAM', '必须明确店铺'));
    const id = mappingKey(storeId, 'store_operation');
    return this.single(id, async () => {
      const existing = this.store.get<TaskMapping>('internal_tasks', id);
      if (existing) {
        const result = await this.client.getTask(existing.taskId);
        if (result.status === 'ok' && usable(result.raw, storeId)) return { status: 'ok', raw: { taskId: result.raw.id, task: result.raw, created: false, reused: true } };
        if (result.status !== 'ok' && !['TASK_NOT_FOUND', 'NOT_FOUND', 'HALLMARK_HTTP_404'].includes(result.error?.code ?? '')) return propagateFailure(result);
      }
      const tasks = await this.client.getTasks();
      if (tasks.status !== 'ok') return propagateFailure(tasks);
      const candidates = Array.isArray(tasks.raw) ? tasks.raw.filter(task => usable(task, storeId)) : [];
      // Stable identity, prefer active but allow listed task for ordinary price/stock/read operations.
      candidates.sort((a, b) => Number(a.status === 'listed') - Number(b.status === 'listed') || a.id.localeCompare(b.id));
      if (!candidates.length) return adapterFailure('TASK_CONTEXT_REQUIRED', 'Hallmark 无通用店铺任务创建接口，且该店铺无可复用 Listing Task；快照查询仍可用。不会随机选采集商品建任务');
      return this.remember(id, candidates[0], 'store_operation', false);
    });
  }
  getListingTask(input: { storeId: string; collectedItemId: string; skuScope: string[]; instruction?: string }): Promise<AdapterResult<BrokerTask>> {
    if (!input.storeId?.trim() || !input.collectedItemId?.trim() || !Array.isArray(input.skuScope) || !input.skuScope.length
      || input.skuScope.some(sku => typeof sku !== 'string' || !sku.trim()) || new Set(input.skuScope).size !== input.skuScope.length) {
      return Promise.resolve(adapterFailure('MISSING_PARAM', '上品需要明确店铺、一个采集商品和非空唯一 SKU 范围'));
    }
    const scope = [...input.skuScope].sort();
    const id = mappingKey(input.storeId, 'listing', input.collectedItemId, scope);
    // Same-scope preparations coalesce; distinct scopes retain distinct results. Hallmark synchronously deduplicates active item/store assignments.
    return this.single(id, async () => {
      const tasks = await this.client.getTasks();
      if (tasks.status !== 'ok') return propagateFailure(tasks);
      const active = tasks.raw?.find(task => usable(task, input.storeId, true) && task.productId === input.collectedItemId);
      if (active) {
        if (!validateScope(active, scope)) return adapterFailure('SKU_SCOPE_MISMATCH', '已有活动任务冻结范围不包含所选 SKU，不能自动改写或扩展任务');
        return this.remember(id, active, 'listing', false, input.collectedItemId, scope);
      }
      // Validate every source SKU before even creating an internal task. Detail is processed metadata, not raw evidence.
      const detail = await this.client.getCollectedItemDetail(input.collectedItemId);
      if (detail.status !== 'ok') return propagateFailure(detail);
      if (detail.raw?.id !== input.collectedItemId) return adapterFailure('ITEM_AMBIGUOUS', '原项目支持前缀匹配，必须提供完整采集商品 ID');
      const skus = Array.isArray(detail.raw?.skus) ? detail.raw.skus as Array<Record<string, unknown>> : [];
      const available = skus.map(sku => sku.sourceSkuId ?? sku.code ?? sku.id).filter((value): value is string => typeof value === 'string');
      if (!scope.every(sku => available.includes(sku))) return adapterFailure('SKU_SCOPE_MISMATCH', '所选 SKU 不属于此采集商品，未创建任务');
      const result = await this.client.createAssignment({ storeId: input.storeId, itemIds: [input.collectedItemId], instruction: input.instruction ?? `DSH 显式上品范围：${JSON.stringify(scope)}。仅处理此范围，禁止隐式全采集箱。` });
      if (result.status !== 'ok') return propagateFailure(result);
      const task = result.raw?.tasks.find(row => row.storeId === input.storeId && row.productId === input.collectedItemId && usable(row, input.storeId, true));
      if (!task) return adapterFailure('TASK_PREPARATION_FAILED', '任务创建回执缺少明确目标；请先查询现有任务，不执行业务写');
      if (!validateScope(task, scope)) return adapterFailure('SKU_SCOPE_MISMATCH', '原任务冻结范围不包含所选 SKU，已保留原任务但不执行业务写');
      return this.remember(id, task, 'listing', result.raw!.created > 0, input.collectedItemId, scope);
    });
  }
}
