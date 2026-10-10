import type { CoreStore } from '../../../core/src/types.ts';
import type { SemanticReviewRequest, SemanticReviewer, SemanticReviewResult } from '../../../app-contracts/src/business-review.ts';
import type { BusinessPriceQuote } from '../../../business-pricing/src/types.ts';

export type BusinessAction = 'price' | 'stock' | 'archive' | 'promotion.enroll' | 'promotion.update' | 'promotion.exit' | 'listing';
export interface BusinessTarget { offerId: string; productId?: string | number; sku?: string | number }
export interface ProcurementSelection { itemId: string; sourceSkuId: string; quantity: number }
/** Selects a comparison subject in a real source image; it is not a review verdict. */
export interface ReferenceSubject { sourceImageUrl: string; subject: string }
export interface BusinessRowInput {
  rowId?: string;
  action: BusinessAction;
  target: BusinessTarget;
  /** Native action fields, written once. Source costs and before values are never accepted here. */
  payload: Record<string, unknown>;
  procurement?: ProcurementSelection[];
  /** Application-only image comparison targets, never sent to Ozon. */
  referenceSubjects?: ReferenceSubject[];
  dependsOn?: string[];
  /** Application rule selection; never sent as an Ozon product field. */
  pricing?: {planId?:string;mode:'automatic'|'manual'};
}
export interface ProcurementSource {
  itemId: string;
  sourceSkuId: string;
  unitPrice: number | null;
  currency: string;
  unit: string;
}
export interface PurchaseBinding {
  components: Array<ProcurementSelection & ProcurementSource>;
  amount: number | null;
  currency: string | null;
  missing: string[];
}
export interface BusinessIssue {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
  questionId?: string;
  requiresUser?: boolean;
}
/** Supplied by application code, never by tool input. Each unit contains exactly its real dependencies. */
export type ReviewUnit = Omit<SemanticReviewRequest, 'versions'> & { id: string; policyVersion?: string };
export interface TrustedRowContext {
  /** This is the identity resolved by the source service in the selected store. */
  identity: BusinessTarget & { storeId: string };
  /** Only the affected platform fields, in the same shape as the action payload. */
  current: Record<string, unknown>;
  source: unknown;
  procurement: ProcurementSource[];
  credentialRevision?:number;
  pricingQuote?:BusinessPriceQuote;
  normalizedPricing?:BusinessRowInput['pricing'];
  /** Program-published assets and original source assets. A URL here must be bound to this source/SKU. */
  assets?: Array<{ url: string; contentHash: string }>;
  sourceImages?: Array<{ id: string; url: string }>;
  policy?: {
    version?: string;
    currency?: string;
    minimumPrice?: number;
    maximumPrice?: number;
    /** Full break-even in sale currency, including configured charges, not just procurement cost. */
    breakEvenPrice?: number | null;
    requireCost?: boolean;
  };
  /** Trusted templates/formula/default corrections. They are applied before review and execution. */
  normalizedPayload?: Record<string, unknown>;
  /** Existing source links may supply a known sale composition without Agent re-entry. */
  normalizedProcurement?: ProcurementSelection[];
  corrections?: string[];
  issues?: BusinessIssue[];
  /** Optional dependency-aware questions. Listings otherwise receive the engine's standard content review. */
  reviewUnits?: ReviewUnit[];
}
export interface BusinessSourcePort {
  /** Synchronous local rule revision check; avoids repeating platform reads for a simple rules-only write. */
  currentPolicyVersion?(storeId:string):string;
  load(input: { storeId: string; row: BusinessRowInput; fresh: boolean; signal?: AbortSignal; listingRepairExecutionId?: string }): Promise<TrustedRowContext>;
}
export interface BusinessTransportResult {
  status: 'succeeded' | 'rejected' | 'pending' | 'unknown';
  receipt?: unknown;
  issues?: BusinessIssue[];
  retryAfterMs?: number;
  identity?: BusinessTarget;
}
export interface BusinessExecutionInput {
  executionId: string;
  storeId: string;
  row: BusinessRowInput & { rowId: string };
  context: TrustedRowContext;
  /** Program-provided batch composition, so a source task can freeze every sale identity before its first write. */
  listingGroup?: Array<{ rowId: string; target: BusinessTarget; procurement: ProcurementSelection[] }>;
  signal?: AbortSignal;
}
export interface BusinessTransportPort {
  execute(input: BusinessExecutionInput): Promise<BusinessTransportResult>;
  /** Read-only recovery. Unknown requests must never be dispatched by inspect. */
  inspect(input: BusinessExecutionInput & { receipt?: unknown }): Promise<BusinessTransportResult>;
}
export type BusinessRowStatus = 'draft' | 'reviewing' | 'blocked' | 'needs_user' | 'review_pending' | 'ready' | 'dispatching' | 'pending' | 'unknown' | 'succeeded' | 'rejected';
export interface BusinessRow extends BusinessRowInput {
  rowId: string;
  revision: number;
  status: BusinessRowStatus;
  issues: BusinessIssue[];
  corrections: string[];
  context?: TrustedRowContext;
  before?: Record<string, unknown>;
  beforeHash?: string;
  binding?: PurchaseBinding;
  review?: SemanticReviewResult[];
  executionId?: string;
  executionAttempt?: number;
  receipt?: unknown;
  retryAt?: string;
  completedAt?: string;
  /** A failed question consumes a round only after the relevant content has changed. */
  repairHistory: Record<string, { count: number; fingerprint: string; revision?: number }>;
  restoreOf?: { planId: string; rowId: string; expectedCurrent: Record<string, unknown> };
  /** Program-owned provenance for correcting a rejected import with an already assigned platform identity. */
  listingRepairExecutionId?: string;
}
export interface BusinessPlan {
  planId: string;
  storeId: string;
  title: string;
  revision: number;
  status: 'draft' | 'running' | 'done' | 'partial' | 'blocked' | 'pending' | 'unknown';
  rows: BusinessRow[];
  createdAt: string;
  updatedAt: string;
  /** Only explicit submit records authorization; saving or revising never expands it. */
  submitted?: { at: string; rowRevisions: Record<string, number> };
}
export interface BusinessOperationsOptions {
  store: CoreStore;
  source: BusinessSourcePort;
  transport: BusinessTransportPort;
  reviewer: SemanticReviewer;
  /** Change when reviewer model, thresholds or other review configuration changes. */
  reviewVersion?: string;
  now?: () => string;
  id?: () => string;
}
