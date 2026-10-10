import { DatabaseSync } from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InvocationRequest, CapabilityResult, OperationState, JsonValue } from '../../app-contracts/src/index.ts';

export const DATABASE_SCHEMA_VERSION = 4;
export const RUNTIME_V3_COLLECTIONS = ['connections', 'session_app_bindings', 'invocations', 'operations', 'invocation_operations', 'operation_events', 'runs', 'run_steps', 'datasets', 'builds', 'views', 'components', 'component_versions', 'component_contexts', 'saved_assets', 'provider_records', 'legacy_aliases', 'artifact_refs', 'migration_records'] as const;
export const AUTHORING_COLLECTIONS = ['authoring_drafts', 'authoring_attempts', 'build_receipts', 'preview_receipts', 'view_publications', 'view_ui_states'] as const;
export const RUNTIME_COLLECTIONS = [...RUNTIME_V3_COLLECTIONS, ...AUTHORING_COLLECTIONS] as const;
export interface AuthoringDraftSummary {draftId:string;viewId:string;status:string;updatedAt:string;epoch:number}
export interface RuntimeOperation {
  configRevision?: number;
  resourceScope?: string[];
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
  configRevision?: number;
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
const queryFields:Record<string,readonly string[]>={
  views:['ownerSessionId','sourceComponentId'],component_versions:['componentId'],saved_assets:['kind','appId'],
  provider_records:['namespace','appId','connectionId','value.viewId','value.identity.sessionId','value.identity.viewId','value.candidate.displayId'],
  authoring_drafts:['ownerSessionId','viewId'],authoring_attempts:['draftId','epoch'],
  view_publications:['ownerSessionId','viewId','state','committedViewRevision','candidateBuildId'],
  artifact_refs:['ownerKind','ownerId','targetKind','targetId'],
};

/** Normal Runtime opens schema 4. The explicit schema-3 mode is only for offline legacy migration. */
export class RuntimeStore {
  readonly db: DatabaseSync;
  readonly schemaVersion: 3 | 4;
  readonly collections: readonly string[];
  #depth = 0;
  #closed = false;
  #versionNonce=randomUUID();
  #collectionVersions=new Map<string,number>();
  constructor(path: string, options: {schemaVersion?: 3 | 4} = {}) {
    this.schemaVersion = options.schemaVersion ?? DATABASE_SCHEMA_VERSION;
    this.collections = this.schemaVersion === 3 ? RUNTIME_V3_COLLECTIONS : RUNTIME_COLLECTIONS;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
    if (version !== 0 && version !== this.schemaVersion) { this.db.close(); throw new Error('OFFLINE_MIGRATION_REQUIRED'); }
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.transaction(() => {
      for (const table of this.collections) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, value_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      this.db.exec("CREATE INDEX IF NOT EXISTS views_owner ON views(json_extract(value_json,'$.ownerSessionId'),created_at,id); CREATE INDEX IF NOT EXISTS component_versions_owner ON component_versions(json_extract(value_json,'$.componentId'),created_at,id)");
      this.db.exec(`CREATE INDEX IF NOT EXISTS views_saved_owner ON views(json_extract(value_json,'$.ownerSessionId'),json_extract(value_json,'$.sourceComponentId'),created_at,id);
        CREATE INDEX IF NOT EXISTS saved_assets_kind_app ON saved_assets(json_extract(value_json,'$.kind'),json_extract(value_json,'$.appId'),created_at,id);
        CREATE INDEX IF NOT EXISTS provider_records_namespace_view ON provider_records(json_extract(value_json,'$.namespace'),json_extract(value_json,'$.value.viewId'),created_at,id) WHERE json_extract(value_json,'$.namespace')='component_displays';
        CREATE INDEX IF NOT EXISTS provider_records_frame_owner ON provider_records(json_extract(value_json,'$.namespace'),json_extract(value_json,'$.value.identity.sessionId'),json_extract(value_json,'$.value.identity.viewId'),created_at,id) WHERE json_extract(value_json,'$.namespace')='frame_grants';
        CREATE INDEX IF NOT EXISTS provider_records_frame_display ON provider_records(json_extract(value_json,'$.namespace'),json_extract(value_json,'$.value.candidate.displayId'),created_at,id) WHERE json_extract(value_json,'$.namespace')='frame_grants'`);
      if(this.schemaVersion===4)this.db.exec(`CREATE INDEX IF NOT EXISTS authoring_drafts_owner_view ON authoring_drafts(json_extract(value_json,'$.ownerSessionId'),json_extract(value_json,'$.viewId'),created_at,id);
        CREATE INDEX IF NOT EXISTS authoring_attempts_draft_epoch ON authoring_attempts(json_extract(value_json,'$.draftId'),json_extract(value_json,'$.epoch'),created_at,id);
        CREATE INDEX IF NOT EXISTS view_publications_owner_view ON view_publications(json_extract(value_json,'$.ownerSessionId'),json_extract(value_json,'$.viewId'),json_extract(value_json,'$.state'),created_at,id)`);
      if (!version) {
        this.db.exec(`ALTER TABLE operations ADD COLUMN app_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN connection_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN capability_id TEXT NOT NULL DEFAULT '';
          ALTER TABLE operations ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT '';
          CREATE UNIQUE INDEX operation_intent ON operations(app_id,connection_id,capability_id,idempotency_key);
          PRAGMA user_version=${this.schemaVersion};`);
      }
    });
  }
  private table(collection: string): string {
    if (this.#closed) throw new Error('STORE_CLOSED');
    if (!this.collections.includes(collection)) throw new Error(`UNKNOWN_RUNTIME_COLLECTION: ${collection}`);
    return collection;
  }
  get<T = Record<string, JsonValue>>(collection: string, id: string): T | undefined {
    const row = this.db.prepare(`SELECT value_json FROM ${this.table(collection)} WHERE id=?`).get(id);
    return row ? JSON.parse(String(row.value_json)) as T : undefined;
  }
  list<T = Record<string, JsonValue>>(collection: string): T[] {
    return this.db.prepare(`SELECT value_json FROM ${this.table(collection)} ORDER BY created_at,id`).all().map(row => JSON.parse(String(row.value_json)) as T);
  }
  /** Opaque instance identity + local writes + external SQLite commits, without parsing collection rows. */
  collectionVersion(collection:string):string {
    const table=this.table(collection),externalVersion=Number(this.db.prepare('PRAGMA data_version').get()?.data_version??0);
    return `${this.#versionNonce}:${table}:${this.#collectionVersions.get(table)??0}:${externalVersion}`;
  }
  /** Exact equality over declared indexed paths; never interpolate caller-provided SQL or JSON paths. */
  query<T>(collection:string,filters:Record<string,string|number|boolean|null>):T[] {
    const table=this.table(collection),entries=Object.entries(filters),allowed=queryFields[table];
    if(!entries.length||!allowed||entries.some(([field,value])=>!allowed.includes(field)||!(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))))throw new Error('INVALID_RUNTIME_QUERY');
    const clauses=entries.map(([field,value])=>value===null?`json_type(value_json,'$.${field}')='null'`:`json_extract(value_json,'$.${field}')=?`),values=entries.filter(([,value])=>value!==null).map(([,value])=>typeof value==='boolean'?Number(value):value as string|number);
    return this.db.prepare(`SELECT value_json FROM ${table} WHERE ${clauses.join(' AND ')} ORDER BY created_at,id`).all(...values).map(row=>JSON.parse(String(row.value_json)) as T);
  }
  viewsForSession<T>(sessionId:string):T[] {
    return this.db.prepare(`SELECT value_json FROM ${this.table('views')} WHERE json_extract(value_json,'$.ownerSessionId')=? ORDER BY created_at,id`).all(sessionId).map(row=>JSON.parse(String(row.value_json)) as T);
  }
  authoringDraftSummaries(sessionId:string):AuthoringDraftSummary[] {
    if(this.schemaVersion!==4)return [];
    return this.db.prepare(`SELECT json_extract(value_json,'$.draftId') AS draftId,json_extract(value_json,'$.viewId') AS viewId,json_extract(value_json,'$.status') AS status,json_extract(value_json,'$.updatedAt') AS updatedAt,json_extract(value_json,'$.epoch') AS epoch FROM ${this.table('authoring_drafts')} WHERE json_extract(value_json,'$.ownerSessionId')=? ORDER BY (json_extract(value_json,'$.status')='discarded'),updatedAt DESC,epoch DESC,created_at DESC,id`).all(sessionId) as unknown as AuthoringDraftSummary[];
  }
  componentSummaries(componentId?:string):{componentId:string;title:string;revision:number;savedAt:string}[] {
    const table=this.table(componentId===undefined?'components':'component_versions');
    return this.db.prepare(`SELECT json_extract(value_json,'$.componentId') AS componentId,json_extract(value_json,'$.title') AS title,json_extract(value_json,'$.revision') AS revision,json_extract(value_json,'$.savedAt') AS savedAt FROM ${table} ${componentId===undefined?'':"WHERE json_extract(value_json,'$.componentId')=?"} ORDER BY ${componentId===undefined?'created_at,id':'revision'}`).all(...(componentId===undefined?[]:[componentId])) as {componentId:string;title:string;revision:number;savedAt:string}[];
  }
  put<T>(collection: string, id: string, value: T): T {
    if (!this.#depth) return this.transaction(() => this.put(collection, id, value));
    const table = this.table(collection);
    if (!id || typeof id !== 'string') throw new Error('ID_REQUIRED');
    assertJSON(value);
    const now = new Date().toISOString();
    if ((['operation_events','component_versions','build_receipts','preview_receipts'].includes(table) || table==='component_contexts'&&id.startsWith('snapshot:') || table==='provider_records'&&id.startsWith('view-revision:')) && this.get(table,id)) throw new Error('IMMUTABLE_EVIDENCE');
    if (table === 'operations') {
      const operation = value as RuntimeOperation;
      const previous = this.get<RuntimeOperation>(table, id);
      if (!Object.hasOwn(transitions, operation.state) || previous && !transitions[previous.state].includes(operation.state)) throw new Error('INVALID_OPERATION_TRANSITION');
      if (previous && ['appId','connectionId','capabilityId','capabilityVersion','idempotencyKey','requestHash'].some(field => (previous as unknown as Record<string, unknown>)[field] !== (operation as unknown as Record<string, unknown>)[field])) throw new Error('IMMUTABLE_OPERATION_IDENTITY');
      this.db.prepare(`INSERT INTO operations(id,value_json,created_at,updated_at,app_id,connection_id,capability_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(id, JSON.stringify(value), now, now, operation.appId, operation.connectionId, operation.capabilityId, operation.idempotencyKey);
    } else {
      this.db.prepare(`INSERT INTO ${table}(id,value_json,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(id,JSON.stringify(value),now,now);
    }
    // Rollback may cause an extra refresh. It must never restore an older token and conceal a committed write.
    this.#collectionVersions.set(table,(this.#collectionVersions.get(table)??0)+1);
    return structuredClone(value);
  }
  delete(collection: string, id: string): boolean {
    if(collection==='component_contexts'&&(id.startsWith('snapshot:')||id.startsWith('agent:')))throw new Error('EVIDENCE_DELETE_FORBIDDEN');
    if(collection==='provider_records'&&id.startsWith('view-revision:'))throw new Error('EVIDENCE_DELETE_FORBIDDEN');
    if (['operation_events','operations','invocations','component_versions','build_receipts','preview_receipts'].includes(collection)) throw new Error('EVIDENCE_DELETE_FORBIDDEN');
    const table=this.table(collection),deleted=Number(this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id).changes)>0;
    if(deleted)this.#collectionVersions.set(table,(this.#collectionVersions.get(table)??0)+1);
    return deleted;
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
