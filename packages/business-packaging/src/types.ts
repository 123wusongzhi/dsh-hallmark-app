export interface DimensionsCm { length: number; width: number; height: number }
export interface DimensionsMm { length: number; width: number; height: number }

/** Source values and maintenance inputs use the units displayed to the user. */
export interface PackagingValues {
  weightKg?: number | null;
  dimensionsCm?: DimensionsCm | null;
}
export interface PackagingCompositionMember { itemId: string; sourceSkuId: string; quantity: number }
export interface PackagingMember extends PackagingCompositionMember {
  skuPackage?: PackagingValues;
  commonPackage?: PackagingValues;
  sourceRevision?: string;
  title?: string;
}
export type PackagingTarget =
  | { kind: 'sku'; itemId: string; sourceSkuId: string }
  | { kind: 'combination'; id: string; composition: PackagingCompositionMember[] };
export interface PackagingResolveInput {
  members: PackagingMember[];
  /** Optional display alias. Matching always uses the exact stable composition. */
  combinationId?: string;
  /** An existing package for this exact combination, not a member package. */
  existingPackage?: PackagingValues;
  /** Per-listing package for the whole sale, used only where automatic rules have no value. Never persisted as an override. */
  draftPackage?: PackagingValues;
}
export type PackagingOrigin = 'user' | 'sku-source' | 'product-common' | 'quantity-sum' | 'existing-combination' | 'member-dimensions' | 'draft' | 'missing';
export interface PackagingMissing {
  field: 'weightKg' | 'dimensionsCm';
  message: string;
  members?: Array<{ itemId: string; sourceSkuId: string }>;
}
export interface ResolvedPackaging {
  target: PackagingTarget;
  composition: PackagingCompositionMember[];
  weightKg: number | null;
  weightGrams: number | null;
  dimensionsCm: DimensionsCm | null;
  dimensionsMm: DimensionsMm | null;
  origin: { weight: PackagingOrigin; dimensions: PackagingOrigin };
  missing: PackagingMissing[];
  /** Deterministic version of the source values, composition and applicable overrides. */
  version: string;
}
export interface PackagingOverride {
  schemaVersion: 1;
  namespace: string;
  target: PackagingTarget;
  values: { weightKg?: number; dimensionsCm?: DimensionsCm };
  revision: number;
  updatedAt: string;
}
export interface PackagingOverrideInput {
  target: PackagingTarget;
  values: PackagingValues;
  expectedRevision?: number;
}
export interface PackagingStore {
  get<T>(collection: string, id: string): T | undefined;
  put<T>(collection: string, id: string, value: T): T;
  list<T>(collection: string): T[];
  transaction<T>(fn: (store: any) => T): T;
}
