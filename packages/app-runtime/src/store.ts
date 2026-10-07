import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InvocationRequest, CapabilityResult, OperationState, JsonValue } from '../../app-contracts/src/index.ts';

export const DATABASE_SCHEMA_VERSION = 3;
export const RUNTIME_COLLECTIONS = ['connections', 'session_app_bindings', 'invocations', 'operations', 'invocation_operations', 'operation_events', 'runs', 'run_steps', 'datasets', 'builds', 'views', 'components', 'component_versions', 'component_contexts', 'saved_assets', 'provider_records', 'legacy_aliases', 'artifact_refs', 'migration_records'] as const;
export interface RuntimeOperation {
  operationId: string;
  appId: string;
  connectionId: string;
  capabilityId: string;
  capabilityVersion: string;
  idempotencyKey: string;
  requestHash: string;
  request: InvocationRequest;
  state: OperationState;
  result?: CapabilityResult;
  createdAt: string;
  updatedAt: string;
}
export interface InvocationRecord {
  invocationId: string;
  requestHash: string;
  request: InvocationRequest;
  state: 'received' | 'dispatching' | 'settled';
  result?: CapabilityResult;
  operationId?: string;
  parentRunId?: string;
  startedAt: string;
  durationMs?: number;
}
const transitions: Record<OperationState, readonly OperationState[]> = {
  queued: ['queued', 'dispatching', 'cancelled', 'failed'],
  dispatching: ['dispatching', 'pending', 'unknown', 'succeeded', 'failed', 'partial'],
  pending: ['pending', 'unknown', 'succeeded', 'failed', 'partial'],
  unknown: ['unknown', 'succeeded', 'failed', 'partial'],
  succeeded: ['succeeded'], failed: ['failed'], partial: ['partial'], cancelled: ['cancelled'],
};
function assertJSON(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || seen.has(value)) throw new TypeError('FINITE_ACYCLIC_JSON_REQUIRED');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('PLAIN_JSON_REQUIRED');
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new TypeError('UNSAFE_JSON_FIELD');
    assertJSON(item, seen);
  }
  seen.delete(value);
}

/** Only opens an empty target or an existing schema-3 Runtime database. Never upgrades app.db in place. */
export class RuntimeStore {
  readonly db: DatabaseSync;
  #depth = 0;
  #closed = false;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
    if (version !== 0 && version !== DATABASE_SCHEMA_VERSION) { this.db.close(); throw new Error('OFFLINE_MIGRATION_REQUIRED'); }
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.transaction(() => {
      for (const table of RUNTIME_COLLECTIONS) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, value_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      if (!version) {
        this.db.exec(`ALTER TABLE operations ADD COLUMN app_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN connection_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN capability_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT '';
          CREATE UNIQUE INDEX operation_intent ON operations(app_id,connection_id,capability_id,idempotency_key);
          PRAGMA user_version=3;`);
      }
    });
  }
  private table(collection: string): string {
    if (this.#closed) throw new Error('STORE_CLOSED');
    if (!(RUNTIME_COLLECTIONS as readonly string[]).includes(collection)) throw new Error(`UNKNOWN_RUNTIME_COLLECTION: ${collection}`);
    return collection;
  }
  get<T = Record<string, JsonValue>>(collection: string, id: string): T | undefined {
    const row = this.db.prepare(`SELECT value_json FROM ${this.table(collection)} WHERE id=?`).get(id);
    return row ? JSON.parse(String(row.value_json)) as T : undefined;
  }
  list<T = Record<string, JsonValue>>(collection: string): T[] {
    return this.db.prepare(`SELECT value_json FROM ${this.table(collection)} ORDER BY created_at,id`).all().map(row => JSON.parse(String(row.value_json)) as T);
  }
  put<T>(collection: string, id: string, value: T): T {
    if (!this.#depth) return this.transaction(() => this.put(collection, id, value));
    const table = this.table(collection);
    if (!id || typeof id !== 'string') throw new Error('ID_REQUIRED');
    assertJSON(value);
    const now = new Date().toISOString();
    if ((['operation_events','component_versions'].includes(table) || table==='component_contexts'&&id.startsWith('snapshot:')) && this.get(table,id)) throw new Error('IMMUTABLE_EVIDENCE');
    if (table === 'operations') {
      const operation = value as RuntimeOperation;
      const previous = this.get<RuntimeOperation>(table, id);
      if (!Object.hasOwn(transitions, operation.state) || previous && !transitions[previous.state].includes(operation.state)) throw new Error('INVALID_OPERATION_TRANSITION');
      if (previous && ['appId','connectionId','capabilityId','capabilityVersion','idempotencyKey','requestHash'].some(field => (previous as unknown as Record<string, unknown>)[field] !== (operation as unknown as Record<string, unknown>)[field])) throw new Error('IMMUTABLE_OPERATION_IDENTITY');
      this.db.prepare(`INSERT INTO operations(id,value_json,created_at,updated_at,app_id,connection_id,capability_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(id, JSON.stringify(value), now, now, operation.appId, operation.connectionId, operation.capabilityId, operation.idempotencyKey);
    } else {
      this.db.prepare(`INSERT INTO ${table}(id,value_json,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(id,JSON.stringify(value),now,now);
    }
    return structuredClone(value);
  }
  delete(collection: string, id: string): boolean {
    if(collection==='component_contexts'&&(id.startsWith('snapshot:')||id.startsWith('agent:')))throw new Error('EVIDENCE_DELETE_FORBIDDEN');
    if (['operation_events','operations','invocations','component_versions'].includes(collection)) throw new Error('EVIDENCE_DELETE_FORBIDDEN');
    return Number(this.db.prepare(`DELETE FROM ${this.table(collection)} WHERE id=?`).run(id).changes) > 0;
  }
  transaction<T>(fn: (store: RuntimeStore) => T): T {
    if (this.#closed) throw new Error('STORE_CLOSED');
    const level = this.#depth++;
    const savepoint = `runtime_${level}`;
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      const result = fn(this);
      if (result && typeof (result as {then?: unknown}).then === 'function') throw new Error('ASYNC_TRANSACTION_NOT_SUPPORTED');
      this.db.exec(level ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec(level ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : 'ROLLBACK'); } catch { /* Keep original error. */ }
      throw error;
    } finally { this.#depth--; }
  }
  operationByKey(appId: string, connectionId: string, capabilityId: string, key: string): RuntimeOperation | undefined {
    const row = this.db.prepare('SELECT value_json FROM operations WHERE app_id=? AND connection_id=? AND capability_id=? AND idempotency_key=?').get(appId,connectionId,capabilityId,key);
    return row ? JSON.parse(String(row.value_json)) as RuntimeOperation : undefined;
  }
  appendEvent(operationId: string, event: Record<string, unknown>): void {
    this.transaction(() => {
      const row = this.db.prepare("SELECT COUNT(*) AS total FROM operation_events WHERE json_extract(value_json,'$.operationId')=?").get(operationId);
      const sequence = Number(row?.total ?? 0) + 1;
      this.put('operation_events',`${operationId}:${sequence}`,{operationId,sequence,at:new Date().toISOString(),...event});
    });
  }
  updateOperation(id: string, state: OperationState, result?: CapabilityResult, evidence: Record<string, unknown> = {}): RuntimeOperation {
    return this.transaction(() => {
      const previous = this.get<RuntimeOperation>('operations',id);
      if (!previous) throw new Error('OPERATION_NOT_FOUND');
      const updated = this.put('operations',id,{...previous,state,...(result ? {result} : {}),updatedAt:new Date().toISOString()});
      this.appendEvent(id,{event: 'settled',state,...evidence});
      return updated;
    });
  }
  close(): void { if (!this.#closed) { this.db.close(); this.#closed = true; } }
}
