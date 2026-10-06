import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const COLLECTIONS = ['operations', 'snapshots', 'internal_tasks', 'session_apps', 'result_sets', 'queries', 'views', 'components', 'templates', 'entries', 'settings'] as const;
export type Collection = typeof COLLECTIONS[number];
export const SCHEMA_VERSION = 2;

type RecordValue = Record<string, any>;
const forbidden = new Set(['clientid', 'apikey', 'ozoncredentials']);
function assertJSON(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || seen.has(value as object)) throw new TypeError('Store accepts finite, acyclic JSON values only');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) throw new TypeError('Store accepts plain JSON objects only');
  seen.add(value as object);
  for (const [key, item] of Object.entries(value as RecordValue)) {
    if (forbidden.has(key.toLowerCase().replace(/[-_]/g, ''))) throw new Error(`CREDENTIAL_FIELD_FORBIDDEN: ${key}`);
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`UNSAFE_FIELD: ${key}`);
    assertJSON(item, seen);
  }
  seen.delete(value as object);
}
function field(value: RecordValue, camel: string, snake: string): any { return value[camel] ?? value[snake] ?? null; }
const transitions: Record<string, string[]> = {
  pending: ['pending', 'running', 'succeeded', 'failed', 'partial', 'unknown'],
  running: ['running', 'succeeded', 'failed', 'partial', 'unknown'],
  unknown: ['unknown', 'succeeded', 'failed', 'partial'],
  succeeded: ['succeeded'], failed: ['failed'], partial: ['partial'],
};

/** Synchronous, transactional SQLite storage. Callers must never await inside transaction(). */
export class AppStore {
  db: DatabaseSync;
  #depth = 0;
  #closed = false;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }
  private migrate(): void {
    const version = Number((this.db.prepare('PRAGMA user_version').get() as RecordValue).user_version);
    if (version > SCHEMA_VERSION) { this.db.close(); throw new Error('DATABASE_VERSION_TOO_NEW'); }
    this.transaction(() => {
      if (version < 1) {
        for (const table of COLLECTIONS) this.db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, value_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        this.db.exec('PRAGMA user_version = 1');
      }
      if (version < 2) {
        this.db.exec(`
          ALTER TABLE operations ADD COLUMN operation_id TEXT;
          ALTER TABLE operations ADD COLUMN kind TEXT;
          ALTER TABLE operations ADD COLUMN session_id TEXT;
          ALTER TABLE operations ADD COLUMN client_key TEXT;
          ALTER TABLE operations ADD COLUMN store_id TEXT;
          ALTER TABLE operations ADD COLUMN targets TEXT;
          ALTER TABLE operations ADD COLUMN input TEXT;
          ALTER TABLE operations ADD COLUMN state TEXT;
          ALTER TABLE operations ADD COLUMN hallmark_refs TEXT;
          ALTER TABLE operations ADD COLUMN result TEXT;
          ALTER TABLE operations ADD COLUMN error TEXT;
          ALTER TABLE snapshots ADD COLUMN dataset_key TEXT;
          ALTER TABLE snapshots ADD COLUMN payload TEXT;
          ALTER TABLE snapshots ADD COLUMN data_time TEXT;
          ALTER TABLE snapshots ADD COLUMN last_success_at TEXT;
          ALTER TABLE snapshots ADD COLUMN state TEXT;
          ALTER TABLE snapshots ADD COLUMN last_error TEXT;
          ALTER TABLE snapshots ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE internal_tasks ADD COLUMN store_id TEXT;
          ALTER TABLE internal_tasks ADD COLUMN purpose TEXT;
          ALTER TABLE internal_tasks ADD COLUMN task_id TEXT;
          ALTER TABLE session_apps ADD COLUMN session_id TEXT;
          ALTER TABLE session_apps ADD COLUMN app_id TEXT;
          ALTER TABLE session_apps ADD COLUMN active INTEGER;
          ALTER TABLE session_apps ADD COLUMN activated_at TEXT;
          CREATE UNIQUE INDEX operation_client_key ON operations(client_key) WHERE client_key IS NOT NULL AND client_key <> '';
          CREATE INDEX operation_recent ON operations(session_id, store_id, created_at);
          CREATE UNIQUE INDEX snapshot_dataset ON snapshots(dataset_key);
          CREATE INDEX internal_task_lookup ON internal_tasks(store_id, purpose);
          PRAGMA user_version = 2;
        `);
        // Populate indexed fields when upgrading a v1 generic database.
        for (const table of ['operations', 'snapshots', 'internal_tasks', 'session_apps'] as Collection[]) {
          const rows = this.db.prepare(`SELECT id, value_json FROM ${table}`).all() as RecordValue[];
          for (const row of rows) this.put(table, row.id, JSON.parse(row.value_json));
        }
      }
    });
  }
  private table(collection: string): Collection {
    if (!(COLLECTIONS as readonly string[]).includes(collection)) throw new Error(`UNKNOWN_COLLECTION: ${collection}`);
    if (this.#closed) throw new Error('STORE_CLOSED');
    return collection as Collection;
  }
  get<T = RecordValue>(collection: string, id: string): T | undefined {
    const table = this.table(collection);
    const row = this.db.prepare(`SELECT value_json FROM ${table} WHERE id = ?`).get(id) as RecordValue | undefined;
    return row ? JSON.parse(row.value_json) : undefined;
  }
  put<T>(collection: string, id: string, value: T): T {
    if (!this.#depth) return this.transaction(() => this.put(collection, id, value));
    const table = this.table(collection);
    if (typeof id !== 'string' || !id.trim()) throw new Error('ID_REQUIRED');
    assertJSON(value);
    const record = value as RecordValue;
    const previous = this.get<RecordValue>(table, id);
    if (['operations','snapshots','internal_tasks','session_apps'].includes(table) && (!record || typeof record !== 'object' || Array.isArray(record))) throw new TypeError('Specialized collections require object records');
    if (table === 'operations' && !Object.hasOwn(transitions, record.state)) throw new Error('INVALID_OPERATION_STATE');
    let stored: any = value;
    if (table === 'operations' && previous?.state && record?.state && !transitions[previous.state]?.includes(record.state)) throw new Error('INVALID_OPERATION_TRANSITION');
    if (table === 'snapshots' && previous && record.state !== 'ready' && record.state !== 'succeeded' && record.state !== 'ok') {
      stored = { ...record };
      for (const key of ['payload', 'dataTime', 'data_time', 'lastSuccessAt', 'last_success_at', 'version']) {
        if (Object.hasOwn(previous, key)) stored[key] = previous[key]; else delete stored[key];
      }
    }
    const now = new Date().toISOString();
    const columns = ['id', 'value_json', 'created_at', 'updated_at'];
    const values: any[] = [id, JSON.stringify(stored), field(record ?? {}, 'createdAt', 'created_at') ?? now, field(record ?? {}, 'updatedAt', 'updated_at') ?? now];
    const json = (item: any) => item == null ? null : JSON.stringify(item);
    const add = (name: string, item: any) => { columns.push(name); values.push(item); };
    if (table === 'operations') {
      add('operation_id', field(stored, 'operationId', 'operation_id') ?? id);
      for (const [column, camel] of [['kind','kind'], ['session_id','sessionId'], ['client_key','clientKey'], ['store_id','storeId'], ['state','state']] as const) {
        add(column, field(stored, camel, column) ?? (column === 'client_key' ? stored.clientOperationKey ?? null : null));
      }
      for (const [column, camel] of [['targets','targets'], ['input','input'], ['hallmark_refs','hallmarkRefs'], ['result','result'], ['error','error']] as const) add(column, json(field(stored, camel, column)));
    } else if (table === 'snapshots') {
      add('dataset_key', field(stored, 'datasetKey', 'dataset_key') ?? id);
      add('payload', json(stored.payload));
      add('data_time', field(stored, 'dataTime', 'data_time'));
      add('last_success_at', field(stored, 'lastSuccessAt', 'last_success_at'));
      add('state', stored.state ?? 'empty'); add('last_error', json(field(stored, 'lastError', 'last_error'))); add('version', stored.version ?? 0);
    } else if (table === 'internal_tasks') {
      add('store_id', field(stored, 'storeId', 'store_id')); add('purpose', stored.purpose ?? null); add('task_id', field(stored, 'taskId', 'task_id'));
    } else if (table === 'session_apps') {
      add('session_id', field(stored, 'sessionId', 'session_id') ?? id); add('app_id', field(stored, 'appId', 'app_id')); add('active', stored.active ? 1 : 0); add('activated_at', field(stored, 'activatedAt', 'activated_at'));
    }
    this.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(c => c !== 'id' && c !== 'created_at').map(c => `${c}=excluded.${c}`).join(',')}`).run(...values);
    return JSON.parse(JSON.stringify(stored));
  }
  list<T = RecordValue>(collection: string): T[] {
    const table = this.table(collection);
    return (this.db.prepare(`SELECT value_json FROM ${table} ORDER BY created_at, id`).all() as RecordValue[]).map(row => JSON.parse(row.value_json));
  }
  delete(collection: string, id: string): boolean { return Number(this.db.prepare(`DELETE FROM ${this.table(collection)} WHERE id = ?`).run(id).changes) > 0; }
  transaction<T>(fn: (store: AppStore) => T): T {
    if (this.#closed) throw new Error('STORE_CLOSED');
    const level = this.#depth++;
    const savepoint = `app_store_${level}`;
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      const result = fn(this);
      if (result && typeof (result as any).then === 'function') throw new Error('ASYNC_TRANSACTION_NOT_SUPPORTED');
      this.db.exec(level ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec(level ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : 'ROLLBACK'); } catch { /* Preserve original failure. */ }
      throw error;
    } finally { this.#depth--; }
  }
  getOperationByClientKey<T = RecordValue>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value_json FROM operations WHERE client_key = ?').get(key) as RecordValue | undefined;
    return row ? JSON.parse(row.value_json) : undefined;
  }
  updateSnapshotSuccess(datasetKey: string, payload: unknown, dataTime: string | null, metadata: RecordValue = {}): RecordValue {
    return this.transaction(() => {
      const previous = this.get('snapshots', datasetKey);
      return this.put('snapshots', datasetKey, { ...metadata, datasetKey, payload, dataTime, state: 'ready', lastSuccessAt: new Date().toISOString(), lastError: null, version: (previous?.version ?? 0) + 1 });
    });
  }
  updateSnapshotState(datasetKey: string, state: 'empty' | 'refreshing' | 'failed', error: unknown = null): RecordValue {
    return this.transaction(() => this.put('snapshots', datasetKey, { ...this.get('snapshots', datasetKey), datasetKey, state, lastError: error }));
  }
  exportJSON(path?: string): string {
    const output = this.transaction(() => JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), collections: Object.fromEntries(COLLECTIONS.map(table => [table, (this.db.prepare(`SELECT id, value_json FROM ${table}`).all() as RecordValue[]).map(row => ({ id: row.id, value: JSON.parse(row.value_json) }))])) }, null, 2));
    if (path) writeFileSync(path, output, { encoding: 'utf8', mode: 0o600 });
    return output;
  }
  close(): void { if (!this.#closed) { this.db.close(); this.#closed = true; } }
}
