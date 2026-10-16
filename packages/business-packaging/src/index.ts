import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DimensionsCm, PackagingCompositionMember, PackagingMember, PackagingOrigin, PackagingOverride, PackagingOverrideInput, PackagingResolveInput, PackagingStore, PackagingTarget, PackagingValues, ResolvedPackaging } from './types.ts';
export type * from './types.ts';

const COLLECTION = 'business_packaging_overrides';
const id = z.string().trim().min(1).max(500);
const positive = z.number().finite().positive().max(Number.MAX_SAFE_INTEGER / 1_000_000);
export const dimensionsCmSchema = z.object({ length: positive, width: positive, height: positive }).strict();
export const packagingValuesSchema = z.object({ weightKg: positive.nullable().optional(), dimensionsCm: dimensionsCmSchema.nullable().optional() }).strict();
const memberSchema = z.object({ itemId: id, sourceSkuId: id, quantity: z.number().int().positive().max(1_000_000) }).strict();
const targetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sku'), itemId: id, sourceSkuId: id }).strict(),
  z.object({ kind: z.literal('combination'), id, composition: z.array(memberSchema).min(1).max(1000) }).strict(),
]);

export class BusinessPackagingError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message); this.name = 'BusinessPackagingError'; this.code = code; this.details = details;
  }
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = <T>(value: T): T => structuredClone(value);
const rounded = (value: number) => Math.round(value * 1_000_000_000) / 1_000_000_000;
const identity = (member: Pick<PackagingCompositionMember, 'itemId' | 'sourceSkuId'>) => JSON.stringify([member.itemId, member.sourceSkuId]);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BusinessPackagingError('INVALID_PACKAGING', '包装记录格式不正确', result.error.issues);
  return result.data;
}

/** Merge repeated members while preserving the first appearance for the dimension rule. */
function composition(members: PackagingCompositionMember[]): PackagingCompositionMember[] {
  if (!Array.isArray(members) || members.length === 0 || members.length > 1000)
    throw new BusinessPackagingError('INVALID_PACKAGING', '包装组成需要 1 至 1000 个成员');
  const result: PackagingCompositionMember[] = [];
  const seen = new Map<string, PackagingCompositionMember>();
  for (const member of members) {
    const parsed = parse(memberSchema, { itemId: member.itemId, sourceSkuId: member.sourceSkuId, quantity: member.quantity });
    const key = identity(parsed);
    const existing = seen.get(key);
    if (existing) {
      existing.quantity += parsed.quantity;
      if (existing.quantity > 1_000_000) throw new BusinessPackagingError('INVALID_PACKAGING', '同一 SKU 的组成数量超过支持范围');
    } else { seen.set(key, parsed); result.push(parsed); }
  }
  return result;
}

function target(value: PackagingTarget): PackagingTarget {
  const parsed = parse(targetSchema, value);
  return parsed.kind === 'combination' ? { ...parsed, composition: composition(parsed.composition) } : parsed;
}

export function packagingTarget(input: PackagingResolveInput): PackagingTarget {
  const parts = composition(input.members);
  if (input.combinationId === undefined && parts.length === 1 && parts[0].quantity === 1)
    return { kind: 'sku', itemId: parts[0].itemId, sourceSkuId: parts[0].sourceSkuId };
  return { kind: 'combination', id: input.combinationId === undefined ? `composition-${hash(parts).slice(0, 32)}` : parse(id, input.combinationId), composition: parts };
}

function sourceValues(value?: PackagingValues): PackagingValues {
  // Unsupported or missing source values are facts to complete, never zero-weight defaults.
  const weight = positive.safeParse(value?.weightKg);
  const dimensions = dimensionsCmSchema.safeParse(value?.dimensionsCm);
  return { weightKg: weight.success ? weight.data : null, dimensionsCm: dimensions.success ? dimensions.data : null };
}

function keyFor(value: PackagingTarget): unknown {
  return value.kind === 'sku' ? ['sku', value.itemId, value.sourceSkuId] : ['combination', value.composition];
}

/** Owns user maintenance only; collection synchronization cannot overwrite this store. */
export class BusinessPackagingRepository {
  readonly store: PackagingStore;
  readonly namespace: string;
  private readonly now: () => string;
  constructor(store: PackagingStore, namespace = 'default', now: () => string = () => new Date().toISOString()) {
    this.store = store; this.namespace = parse(id, namespace); this.now = now;
  }

  private recordKey(value: PackagingTarget) { return hash([this.namespace, keyFor(value)]); }
  private stored(value: PackagingTarget) { return this.store.get<PackagingOverride>(COLLECTION, this.recordKey(value)); }

  list(): PackagingOverride[] {
    return this.store.list<PackagingOverride>(COLLECTION).filter(record => record.namespace === this.namespace).map(clone);
  }

  /** Composition is the identity, so prepare and submission need no extra alias field. */
  readOverride(value: PackagingTarget): PackagingOverride | undefined {
    const wanted = target(value), record = this.stored(wanted);
    return record ? clone(record) : undefined;
  }

  readRevision(value: PackagingTarget): number { return this.stored(target(value))?.revision ?? 0; }

  saveOverride(value: PackagingTarget, rawValues: PackagingValues, expectedRevision?: number): PackagingOverride {
    const wanted = target(value), values = parse(packagingValuesSchema, rawValues);
    if (expectedRevision !== undefined) parse(z.number().int().nonnegative(), expectedRevision);
    return this.store.transaction(() => {
      const existing = this.stored(wanted);
      if (expectedRevision !== undefined && (existing?.revision ?? 0) !== expectedRevision)
        throw new BusinessPackagingError('PACKAGING_REVISION_CONFLICT', '包装记录已更新，请刷新后保存', { expectedRevision, actualRevision: existing?.revision ?? 0 });
      const merged = existing ? clone(existing.values) : {};
      for (const field of ['weightKg', 'dimensionsCm'] as const) {
        if (values[field] === null) delete merged[field];
        else if (values[field] !== undefined) Object.assign(merged, { [field]: clone(values[field]) });
      }
      const record: PackagingOverride = { schemaVersion: 1, namespace: this.namespace, target: wanted, values: merged, revision: (existing?.revision ?? 0) + 1, updatedAt: this.now() };
      this.store.put(COLLECTION, this.recordKey(wanted), record);
      return clone(record);
    });
  }

  /** The table can atomically maintain many rows; one conflict leaves every row unchanged. */
  saveOverrides(inputs: PackagingOverrideInput[]): PackagingOverride[] {
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 1000)
      throw new BusinessPackagingError('INVALID_PACKAGING', '一次保存需要 1 至 1000 条包装记录');
    const keys = new Set<string>();
    for (const input of inputs) {
      const key = this.recordKey(target(input.target));
      parse(packagingValuesSchema, input.values);
      if (keys.has(key)) throw new BusinessPackagingError('DUPLICATE_PACKAGING_TARGET', '同一批保存不能重复包含同一包装记录');
      keys.add(key);
    }
    return this.store.transaction(() => inputs.map(input => this.saveOverride(input.target, input.values, input.expectedRevision)));
  }

  /** Retains the row/composition so an automatically calculated combination stays discoverable. */
  clearOverride(value: PackagingTarget, fields: Array<'weightKg' | 'dimensionsCm'> = ['weightKg', 'dimensionsCm'], expectedRevision?: number): PackagingOverride {
    if (!Array.isArray(fields) || fields.some(field => field !== 'weightKg' && field !== 'dimensionsCm'))
      throw new BusinessPackagingError('INVALID_PACKAGING', '只能恢复重量或完整尺寸的自动规则');
    return this.saveOverride(value, Object.fromEntries(fields.map(field => [field, null])), expectedRevision);
  }

  resolve(input: PackagingResolveInput): ResolvedPackaging {
    const wanted = packagingTarget(input);
    const parts = composition(input.members);
    const firstById = new Map<string, PackagingMember>();
    for (const member of input.members) {
      const memberKey = identity({ itemId: parse(id, member.itemId), sourceSkuId: parse(id, member.sourceSkuId) });
      if (!firstById.has(memberKey)) firstById.set(memberKey, member);
    }
    const members = parts.map(part => {
      const member = firstById.get(identity(part))!;
      const manual = this.readOverride({ kind: 'sku', itemId: part.itemId, sourceSkuId: part.sourceSkuId });
      const sku = sourceValues(member.skuPackage), common = sourceValues(member.commonPackage);
      const weightKg = manual?.values.weightKg ?? sku.weightKg ?? common.weightKg ?? null;
      const dimensionsCm = manual?.values.dimensionsCm ?? sku.dimensionsCm ?? common.dimensionsCm ?? null;
      return {
        ...part, weightKg, dimensionsCm,
        weightOrigin: (manual?.values.weightKg !== undefined ? 'user' : sku.weightKg !== null ? 'sku-source' : common.weightKg !== null ? 'product-common' : 'missing') as PackagingOrigin,
        dimensionsOrigin: (manual?.values.dimensionsCm !== undefined ? 'user' : sku.dimensionsCm !== null ? 'sku-source' : common.dimensionsCm !== null ? 'product-common' : 'missing') as PackagingOrigin,
        evidence: { sku, common, sourceRevision: member.sourceRevision ?? null, overrideRevision: manual?.revision ?? null },
      };
    });
    const override = this.readOverride(wanted);
    let weightKg: number | null;
    let dimensionsCm: DimensionsCm | null;
    let weightOrigin: PackagingOrigin;
    let dimensionsOrigin: PackagingOrigin;
    if (wanted.kind === 'sku') {
      ({ weightKg, dimensionsCm, weightOrigin, dimensionsOrigin } = members[0]);
    } else {
      const existing = sourceValues(input.existingPackage);
      weightKg = override?.values.weightKg ?? (members.some(member => member.weightKg === null) ? null : rounded(members.reduce((sum, member) => sum + member.weightKg! * member.quantity, 0)));
      weightOrigin = override?.values.weightKg !== undefined ? 'user' : weightKg === null ? 'missing' : 'quantity-sum';
      const available = members.find(member => member.dimensionsCm !== null);
      dimensionsCm = override?.values.dimensionsCm ?? existing.dimensionsCm ?? available?.dimensionsCm ?? null;
      dimensionsOrigin = override?.values.dimensionsCm !== undefined ? 'user' : existing.dimensionsCm !== null ? 'existing-combination' : available ? 'member-dimensions' : 'missing';
    }
    const draft = sourceValues(input.draftPackage);
    if (weightKg === null && draft.weightKg !== null) { weightKg = draft.weightKg!; weightOrigin = 'draft'; }
    if (dimensionsCm === null && draft.dimensionsCm !== null) { dimensionsCm = draft.dimensionsCm!; dimensionsOrigin = 'draft'; }
    if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > Number.MAX_SAFE_INTEGER / 1_000_000))
      throw new BusinessPackagingError('PACKAGING_OVERFLOW', '组合包装重量超过支持范围');
    const missing: ResolvedPackaging['missing'] = [];
    if (weightKg === null) missing.push({ field: 'weightKg', message: '缺少发货包装重量', members: members.filter(member => member.weightKg === null).map(({ itemId, sourceSkuId }) => ({ itemId, sourceSkuId })) });
    if (dimensionsCm === null) missing.push({ field: 'dimensionsCm', message: '没有可用的完整发货包装尺寸' });
    return {
      target: clone(wanted), composition: clone(parts), weightKg, weightGrams: weightKg === null ? null : rounded(weightKg * 1000),
      dimensionsCm: clone(dimensionsCm), dimensionsMm: dimensionsCm === null ? null : { length: rounded(dimensionsCm.length * 10), width: rounded(dimensionsCm.width * 10), height: rounded(dimensionsCm.height * 10) },
      origin: { weight: weightOrigin, dimensions: dimensionsOrigin }, missing,
      version: `pkg-${hash({ target: keyFor(wanted), members, override: override?.revision ?? null, existingPackage: sourceValues(input.existingPackage), weightKg, dimensionsCm }).slice(0, 32)}`,
    };
  }
}
