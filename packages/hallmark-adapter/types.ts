export interface Provenance {
  source: 'ozon_api' | 'hallmark_snapshot' | 'collected_item' | 'hallmark_compute';
  endpoint: string;
  fetchedAt: string;
  dataTime?: string;
  storeId?: string;
}
export interface AdapterError { code: string; message: string; retryable: boolean; retryAfterMs?: number }
export interface AdapterResult<T = unknown> {
  status: 'ok' | 'failed' | 'unknown' | 'unavailable';
  /** Never projected, renamed or truncated. Tool presenters must prefer spill summaries for large values. */
  raw?: T;
  provenance?: Provenance;
  error?: AdapterError;
  spill?: { path: string; bytes: number; summary: { kind: string; count?: number }; cursor: string };
}
export interface HallmarkStore { id: string; shopName: string; platform?: string; status?: string; authStatus?: string; [key: string]: unknown }
export interface HallmarkTask {
  id: string; kind: string; status: string; storeId?: string; productId?: string;
  salesVariants?: TaskSalesVariant[];
  listingGroup?: { skuCodes?: string[]; [key: string]: unknown };
  autonomousSkuCodes?: string[];
  assignmentSnapshot?: { item?: { skuCodes?: string[]; [key: string]: unknown }; [key: string]: unknown };
  [key: string]: unknown;
}
export interface TaskSalesVariant {
  salesSkuId: string;
  sourceSkuId?: string;
  components?: Array<{ sourceSkuId: string; quantity: number }>;
  spec: string;
  [key: string]: unknown;
}
export interface RegisterTaskSalesVariantsInput { variants: TaskSalesVariant[]; reason: string }
export interface RegisterTaskSalesVariantsResult { taskId: string; created: boolean; salesVariants: TaskSalesVariant[]; directContext: unknown }
export interface CollectedItemSummary { id: string; title: string; skuCount: number; source?: string; [key: string]: unknown }
export interface CollectedItemRaw { id: string; content: string; truncated: boolean }
export interface StoreProductSnapshot {
  stores: Array<{ id: string; lastSuccessAt?: string; lastAttemptAt?: string; error?: string; [key: string]: unknown }>;
  products: Array<{ storeId: string; offerId: string; [key: string]: unknown }>;
  [key: string]: unknown;
}
export interface AssignmentInput { storeId: string; itemIds: string[]; instruction?: string }
export interface AssignmentResult { ok: true; created: number; reused: number; taskIds: string[]; tasks: HallmarkTask[] }
export interface PlatformCallInput {
  requestId: string; agentId: string; path: string; method?: 'GET' | 'POST'; body: unknown; note?: string;
  mappings?: Array<{ skuCode: string; offerId: string; [key: string]: unknown }>;
}
export interface PlatformCallRecord extends PlatformCallInput {
  taskId: string; storeId: string; requestHash: string; startedAt: string; finishedAt?: string;
  outcome: 'pending' | 'response_received' | 'outcome_unknown'; httpStatus?: number; response?: unknown;
  error?: string; retryAfter?: string; replayed?: true; [key: string]: unknown;
}
/** Existing board-only Source HTTP contract; no task, currency guessing or extra write fields. */
export interface OrdinaryCnyPriceProduct { productId: number; offerId: string; price: string }
export interface SubmitOrdinaryCnyPriceInput {
  /** Caller-generated lowercase UUID, persisted for this exact logical change. Never regenerated on retry. */
  operationId: string;
  storeId: string;
  products: OrdinaryCnyPriceProduct[];
}
export interface OrdinaryCnyOperationProduct extends OrdinaryCnyPriceProduct { stock: '0'; [key: string]: unknown }
export interface OrdinaryCnyOperationRow extends OrdinaryCnyOperationProduct {
  status: 'pending' | 'verified' | 'rejected'; reason: string;
  actualMinor: number | null; sellerMinor: number | null;
}
/** Unmodified Source operation JSON. There is no Source .state, .stage or platform .outcome here. */
export interface OrdinaryCnyOperationRaw {
  id: string; storeId: string; kind: 'ordinary'; actionId: 0;
  products: OrdinaryCnyOperationProduct[];
  title: string; createdAt: string; updatedAt: string; requestId: string;
  status: 'pending' | 'finished'; error: string | null;
  results: OrdinaryCnyOperationRow[];
  [key: string]: unknown;
}
export type OrdinaryCnyOperationStage = 'pending' | 'verified' | 'rejected' | 'mixed' | 'outcome_unknown' | 'not_found';
export interface OrdinaryCnyOperationResult extends AdapterResult<OrdinaryCnyOperationRaw> {
  /** Adapter-only stage; never injected into raw. verified means historical price-state readback, not a write receipt. */
  stage?: OrdinaryCnyOperationStage;
}
/** Explicit full store identity is mandatory even where Source permits an omitted default. IDs are canonical decimal strings. */
export type CategoryDataInput =
  | { mode: 'search'; storeId: string; q: string; aspects?: string[]; requireAspects?: boolean; limit?: number }
  | { mode: 'show'; storeId: string; descriptionCategoryId: string; typeId: string }
  | { mode: 'template'; storeId: string; descriptionCategoryId: string; typeId: string }
  | { mode: 'values'; storeId: string; descriptionCategoryId: string; typeId: string; attributeId: string; q?: string; limit?: number }
  | { mode: 'validate_value'; storeId: string; descriptionCategoryId: string; typeId: string; attributeId: string; valueId: string; dictionaryId: string }
  | { mode: 'sync'; storeId: string };
/** Source DTOs differ by mode; all fields, partial/stale markers and unverified search candidates remain raw. */
export type CategoryDataRaw = Record<string, unknown>;
export interface ArchiveProductSelection { storeId: string; offerId: string }
export interface SubmitArchiveProductsInput { requestId: string; selected: ArchiveProductSelection[] }
export interface ArchiveProductResult extends ArchiveProductSelection {
  state: 'archived' | 'pending' | 'unknown' | 'rejected'; message?: string; [key: string]: unknown;
}
/** Public Source DTO does not expose its internal product-ID/is_archived verification response. */
export interface ArchiveProductsRaw { requestId: string; results: ArchiveProductResult[]; [key: string]: unknown }
export type ArchiveProductsStage = 'archived' | 'pending' | 'unknown' | 'rejected' | 'mixed';
export interface ArchiveProductsResult extends AdapterResult<ArchiveProductsRaw> {
  /** Adapter aggregate only. Never put stage into Source raw or infer archived from result:true. */
  stage?: ArchiveProductsStage;
}
export interface HallmarkClientOptions {
  baseUrl?: string;
  /** Optional store data gateway; legacy queries and every mutation retain baseUrl. */
  ozonDataBaseUrl?: string;
  fetchImpl?: typeof fetch;
  operatorToken?: string | (() => string | undefined | Promise<string | undefined>);
  readTimeoutMs?: number; platformTimeoutMs?: number; healthTimeoutMs?: number; healthCacheMs?: number;
  spillDirectory?: string; spillThresholdBytes?: number;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
}
export interface TaskMapping { id: string; storeId: string; purpose: string; taskId: string; createdAt: string; collectedItemId?: string; skuScope?: string[] }
/** Structural port accepted by AppStore; no sqlite or other runtime dependency here. */
export interface MappingStore {
  get<T>(collection: string, id: string): T | undefined;
  put<T>(collection: string, id: string, value: T): T;
}
export interface TaskAuditEvent { kind: 'internal_task_associated' | 'listing_task_prepared'; storeId: string; taskId: string; purpose: string; created: boolean; at: string; collectedItemId?: string; skuScope?: string[] }
export interface TaskBrokerOptions { now?: () => Date; audit?: (event: TaskAuditEvent) => void | Promise<void> }
export interface BrokerTask { taskId: string; task: HallmarkTask; created: boolean; reused: boolean; skuScope?: string[] }
