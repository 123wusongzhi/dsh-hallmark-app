import assert from 'node:assert/strict';
import test from 'node:test';
import { BusinessPackagingError, BusinessPackagingRepository, packagingTarget } from '../../packages/business-packaging/src/index.ts';
import type { PackagingMember, PackagingStore, PackagingTarget } from '../../packages/business-packaging/src/index.ts';

function memory(): PackagingStore {
  let records = new Map<string, unknown>();
  return {
    get<T>(collection: string, id: string) { return structuredClone(records.get(`${collection}/${id}`)) as T | undefined; },
    put<T>(collection: string, id: string, value: T) { records.set(`${collection}/${id}`, structuredClone(value)); return value; },
    list<T>(collection: string) { return [...records.entries()].filter(([key]) => key.startsWith(`${collection}/`)).map(([, value]) => structuredClone(value) as T); },
    transaction<T>(fn: (store: any) => T) { const before = structuredClone(records); try { return fn(this); } catch (error) { records = before; throw error; } },
  };
}
const dimensions = { length: 25, width: 10, height: 10 };
const single: PackagingMember = { itemId: 'cup', sourceSkuId: 'red', quantity: 1, commonPackage: { weightKg: 0.33, dimensionsCm: dimensions }, sourceRevision: 'source-1' };
const singleTarget: PackagingTarget = { kind: 'sku', itemId: 'cup', sourceSkuId: 'red' };
const repo = () => new BusinessPackagingRepository(memory(), 'source-a', () => '2026-10-10T12:00:00.000Z');
const isCode = (code: string) => (error: unknown) => error instanceof BusinessPackagingError && error.code === code;

test('one common package applies to every SKU and converts cm/kg to mm/g once', () => {
  const packaging = repo();
  for (const sourceSkuId of ['red', 'blue', 'black']) {
    const result = packaging.resolve({ members: [{ ...single, sourceSkuId }] });
    assert.equal(result.weightKg, 0.33);
    assert.equal(result.weightGrams, 330);
    assert.deepEqual(result.dimensionsCm, dimensions);
    assert.deepEqual(result.dimensionsMm, { length: 250, width: 100, height: 100 });
    assert.deepEqual(result.origin, { weight: 'product-common', dimensions: 'product-common' });
    assert.deepEqual(result.missing, []);
  }
});

test('SKU fields override common independently and incomplete dimensions fall back as a whole group', () => {
  const packaging = repo();
  const result = packaging.resolve({ members: [{ ...single, skuPackage: { weightKg: 0.5, dimensionsCm: { length: 99 } as any } }] });
  assert.equal(result.weightKg, 0.5);
  assert.deepEqual(result.dimensionsCm, dimensions);
  assert.deepEqual(result.origin, { weight: 'sku-source', dimensions: 'product-common' });
});

test('manual single override survives source synchronization and clear returns current source values', () => {
  const store = memory();
  const packaging = new BusinessPackagingRepository(store, 'source-a');
  const saved = packaging.saveOverride(singleTarget, { weightKg: 0.75 }, 0);
  const changed: PackagingMember = { ...single, skuPackage: { weightKg: 0.6, dimensionsCm: { length: 30, width: 20, height: 10 } }, sourceRevision: 'source-2' };
  const loaded = new BusinessPackagingRepository(store, 'source-a');
  const result = loaded.resolve({ members: [changed] });
  assert.equal(result.weightKg, 0.75);
  assert.equal(result.origin.weight, 'user');
  assert.equal(result.dimensionsCm?.length, 30);
  loaded.clearOverride(singleTarget, ['weightKg'], saved.revision);
  assert.equal(loaded.resolve({ members: [changed] }).weightKg, 0.6);
  assert.equal(loaded.list().length, 1);
  assert.deepEqual(loaded.list()[0].values, {});
});

test('mixed and repeated SKU quantities add exact weights, with the first complete dimensions', () => {
  const packaging = repo();
  const result = packaging.resolve({ members: [
    { itemId: 'plate', sourceSkuId: 'small', quantity: 2, skuPackage: { weightKg: 0.1 } },
    { ...single, quantity: 3, commonPackage: { weightKg: 0.2, dimensionsCm: dimensions } },
  ] });
  assert.equal(result.weightKg, 0.8);
  assert.equal(result.weightGrams, 800);
  assert.deepEqual(result.dimensionsCm, dimensions);
  assert.deepEqual(result.origin, { weight: 'quantity-sum', dimensions: 'member-dimensions' });
  assert.equal(result.target.kind, 'combination');
});

test('combination sums members after their manual single-SKU overrides', () => {
  const packaging = repo();
  packaging.saveOverride(singleTarget, { weightKg: 0.4, dimensionsCm: { length: 50, width: 15, height: 20 } }, 0);
  const result = packaging.resolve({ members: [{ ...single, quantity: 2 }] });
  assert.equal(result.weightKg, 0.8);
  assert.equal(result.dimensionsCm?.length, 50);
});

test('unknown member weight yields null, retains dimensions, and reports only missing members', () => {
  const packaging = repo();
  const result = packaging.resolve({ members: [single, { itemId: 'saucer', sourceSkuId: 'white', quantity: 1 }] });
  assert.equal(result.weightKg, null);
  assert.equal(result.weightGrams, null);
  assert.deepEqual(result.dimensionsCm, dimensions);
  assert.deepEqual(result.missing, [{ field: 'weightKg', message: '缺少发货包装重量', members: [{ itemId: 'saucer', sourceSkuId: 'white' }] }]);
});

test('weight and dimensions are independent; neither zero nor partial dimensions count as available', () => {
  const packaging = repo();
  const result = packaging.resolve({ members: [{ itemId: 'a', sourceSkuId: 'b', quantity: 1, skuPackage: { weightKg: 0, dimensionsCm: { length: 1, width: 1, height: 0 } } }] });
  assert.equal(result.weightKg, null);
  assert.equal(result.dimensionsCm, null);
  assert.equal(result.missing.length, 2);
  assert.deepEqual(result.origin, { weight: 'missing', dimensions: 'missing' });
  const hasWeight = packaging.resolve({ members: [{ itemId: 'a', sourceSkuId: 'b', quantity: 1, skuPackage: { weightKg: 0.2 } }] });
  assert.equal(hasWeight.weightKg, 0.2);
  assert.equal(hasWeight.dimensionsCm, null);
});

test('combination manual values take precedence independently and null clears only that field', () => {
  const packaging = repo();
  const input = { combinationId: 'red-pair', members: [{ ...single, quantity: 2 }] };
  const target = packagingTarget(input);
  packaging.saveOverride(target, { weightKg: 0.9, dimensionsCm: { length: 40, width: 20, height: 20 } }, 0);
  assert.equal(packaging.resolve(input).weightKg, 0.9);
  packaging.saveOverride(target, { weightKg: null }, 1);
  const result = packaging.resolve(input);
  assert.equal(result.weightKg, 0.66);
  assert.equal(result.dimensionsCm?.length, 40);
  assert.deepEqual(result.origin, { weight: 'quantity-sum', dimensions: 'user' });
});

test('known combination dimensions are used before a member but existing combination weight does not replace sum', () => {
  const result = repo().resolve({ members: [{ ...single, quantity: 2 }], existingPackage: { weightKg: 99, dimensionsCm: { length: 12, width: 12, height: 12 } } });
  assert.equal(result.weightKg, 0.66);
  assert.equal(result.dimensionsCm?.length, 12);
  assert.equal(result.origin.dimensions, 'existing-combination');
});

test('composition changes do not inherit a named combination override or change its old record', () => {
  const packaging = repo();
  const original = { combinationId: 'bundle', members: [{ ...single, quantity: 2 }] };
  const changed = { combinationId: 'bundle', members: [{ ...single, quantity: 3 }] };
  packaging.saveOverride(packagingTarget(original), { weightKg: 5, dimensionsCm: { length: 2, width: 2, height: 2 } }, 0);
  assert.equal(packaging.resolve(changed).weightKg, 0.99);
  assert.equal(packaging.readOverride(packagingTarget(changed)), undefined);
  assert.equal(packaging.resolve(original).weightKg, 5);
  assert.equal(packaging.readRevision(packagingTarget(changed)), 0);
  packaging.saveOverride(packagingTarget(changed), {}, 0);
  assert.equal(packaging.list().length, 2);
  assert.equal(packaging.resolve(changed).weightKg, 0.99);
  assert.equal(packaging.resolve(original).weightKg, 5);
});

test('combination aliases do not affect override lookup from prepare or submission', () => {
  const packaging = repo();
  const input = { members: [{ ...single, quantity: 2 }] };
  packaging.saveOverride(packagingTarget({ ...input, combinationId: 'ui-name' }), { weightKg: 0.9 }, 0);
  assert.equal(packaging.resolve(input).weightKg, 0.9);
  assert.equal(packaging.resolve({ ...input, combinationId: 'a-different-row-id' }).weightKg, 0.9);
  assert.equal(packaging.resolve({ ...input, combinationId: 'a-different-row-id' }).version, packaging.resolve(input).version);
  assert.equal(packaging.readRevision(packagingTarget(input)), 1);
});

test('automatic combinations can be registered without manual values and remain after restoring rules', () => {
  const packaging = repo();
  const target = packagingTarget({ members: [{ ...single, quantity: 2 }] });
  const saved = packaging.saveOverride(target, {}, 0);
  assert.equal(packaging.list().length, 1);
  assert.deepEqual(saved.values, {});
  packaging.clearOverride(target, undefined, 1);
  assert.equal(packaging.list().length, 1);
  assert.equal(packaging.list()[0].revision, 2);
});

test('stable composition order governs dimension selection, and repeated member quantities merge', () => {
  const packaging = repo();
  const other: PackagingMember = { itemId: 'other', sourceSkuId: 'one', quantity: 1, commonPackage: { weightKg: 0.1, dimensionsCm: { length: 2, width: 3, height: 4 } } };
  const forward = packaging.resolve({ members: [single, other] });
  const reverse = packaging.resolve({ members: [other, single] });
  assert.equal(forward.dimensionsCm?.length, 25);
  assert.equal(reverse.dimensionsCm?.length, 2);
  assert.notEqual(forward.version, reverse.version);
  assert.deepEqual(packagingTarget({ members: [single, single] }), packagingTarget({ members: [{ ...single, quantity: 2 }] }));
  assert.equal(packaging.resolve({ members: [single, single] }).weightKg, 0.66);
});

test('versions are deterministic, track relevant source and overrides, and results are detached', () => {
  const packaging = repo();
  const first = packaging.resolve({ members: [single] });
  assert.equal(first.version, packaging.resolve({ members: [structuredClone(single)] }).version);
  first.dimensionsCm!.length = 999;
  assert.equal(packaging.resolve({ members: [single] }).dimensionsCm?.length, 25);
  assert.notEqual(first.version, packaging.resolve({ members: [{ ...single, sourceRevision: 'source-2' }] }).version);
  packaging.saveOverride({ kind: 'sku', itemId: 'unrelated', sourceSkuId: 'one' }, { weightKg: 1 }, 0);
  assert.equal(first.version, packaging.resolve({ members: [single] }).version);
  packaging.saveOverride(singleTarget, { weightKg: 1 }, 0);
  assert.notEqual(first.version, packaging.resolve({ members: [single] }).version);
});

test('persistence namespaces and cloned records prevent cross-source contamination', () => {
  const store = memory(), a = new BusinessPackagingRepository(store, 'a'), b = new BusinessPackagingRepository(store, 'b');
  const saved = a.saveOverride(singleTarget, { dimensionsCm: dimensions }, 0);
  saved.values.dimensionsCm!.length = 999;
  assert.equal(a.readOverride(singleTarget)?.values.dimensionsCm?.length, 25);
  assert.equal(b.readOverride(singleTarget), undefined);
  assert.equal(b.list().length, 0);
});

test('concurrent saves and any batch conflict preserve all preceding values', () => {
  const packaging = repo();
  const second: PackagingTarget = { kind: 'sku', itemId: 'other', sourceSkuId: 'one' };
  packaging.saveOverride(singleTarget, { weightKg: 0.6 }, 0);
  assert.throws(() => packaging.saveOverride(singleTarget, { weightKg: 0.7 }, 0), isCode('PACKAGING_REVISION_CONFLICT'));
  assert.throws(() => packaging.saveOverrides([
    { target: second, values: { weightKg: 0.8 }, expectedRevision: 0 },
    { target: singleTarget, values: { weightKg: 0.9 }, expectedRevision: 0 },
  ]), isCode('PACKAGING_REVISION_CONFLICT'));
  assert.equal(packaging.readOverride(second), undefined);
  assert.equal(packaging.readOverride(singleTarget)?.values.weightKg, 0.6);
  const saved = packaging.saveOverrides([
    { target: second, values: { weightKg: 0.8 }, expectedRevision: 0 },
    { target: singleTarget, values: { weightKg: 0.9 }, expectedRevision: 1 },
  ]);
  assert.equal(saved.length, 2);
  assert.equal(packaging.readOverride(singleTarget)?.values.weightKg, 0.9);
});

test('invalid maintenance values and duplicate bulk rows are rejected before any write', () => {
  const packaging = repo();
  for (const values of [{ weightKg: 0 }, { weightKg: -1 }, { weightKg: Number.NaN }, { dimensionsCm: { length: 1, width: 1 } }])
    assert.throws(() => packaging.saveOverride(singleTarget, values as any, 0), isCode('INVALID_PACKAGING'));
  assert.throws(() => packaging.saveOverrides([{ target: singleTarget, values: { weightKg: 0.5 } }, { target: singleTarget, values: { weightKg: 0.6 } }]), isCode('DUPLICATE_PACKAGING_TARGET'));
  assert.equal(packaging.list().length, 0);
});
