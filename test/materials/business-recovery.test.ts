import test from 'node:test';
import assert from 'node:assert/strict';
import {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import type {BusinessPlan, BusinessRow} from '../../packages/app-hallmark/src/operations/types.ts';
import {businessRecoveryAction, businessRecoveryDeadline} from '../../packages/app-presentation/src/materials/business-recovery.ts';

test('business recovery guidance preserves engine eligibility for blocked rows and explicit known retries', async () => {
  const now = Date.parse('2026-10-16T06:00:00Z');
  const due = new Date(now).toISOString(), future = new Date(now + 5_000).toISOString();
  const cases: Array<{status: BusinessRow['status']; code?: string; retryAt?: string; action?: BusinessRow['action']; eligible: boolean}> = [
    ...(['draft', 'blocked', 'review_pending', 'ready'] as const).map(status => ({status, eligible: true})),
    ...(['succeeded', 'unknown', 'pending', 'dispatching', 'needs_user'] as const).map(status => ({status, eligible: false})),
    {status: 'rejected', code: 'PLATFORM_FIELD', eligible: false},
    {status: 'rejected', code: 'REQUEST_NOT_DISPATCHED', eligible: true},
    {status: 'rejected', code: 'REQUEST_NOT_DISPATCHED', retryAt: future, eligible: true},
    ...([undefined, 'invalid', future] as const).map(retryAt => ({status: 'rejected' as const, code: 'OZON_RATE_LIMIT', retryAt, eligible: false})),
    {status: 'rejected', code: 'OZON_RATE_LIMIT', retryAt: due, eligible: true},
    {status: 'rejected', code: 'PRODUCT_IS_NOT_CREATED', action: 'stock', retryAt: future, eligible: false},
    {status: 'rejected', code: 'PRODUCT_IS_NOT_CREATED', action: 'stock', retryAt: due, eligible: true},
    {status: 'rejected', code: 'PRODUCT_IS_NOT_CREATED', action: 'price', retryAt: due, eligible: false},
  ];
  for (const [index, control] of cases.entries()) {
    const row: BusinessRow = {rowId: 'row', action: control.action ?? 'price', target: {offerId: 'LOCAL-CONTROL'}, payload: {}, revision: 1, status: control.status, issues: control.code ? [{code: control.code, message: 'Local eligibility control'}] : [], corrections: [], repairHistory: {}, ...(control.retryAt ? {retryAt: control.retryAt} : {})};
    const plan: BusinessPlan = {planId: 'plan', storeId: 'shop', title: 'Local eligibility control', revision: 1, status: 'blocked', rows: [row], createdAt: due, updatedAt: due};
    const db = new RuntimeStore(':memory:');
    try {
      const store = new HallmarkStorePort(db, `eligibility-${index}`);
      store.put('business_plans', 'plan', plan);
      let sourceReads = 0, externalCalls = 0;
      const deny = async (): Promise<never> => { externalCalls++; throw Error('External execution forbidden'); };
      const engine = new BusinessOperations({
        store,
        now: () => due,
        source: {load: async () => { sourceReads++; throw Error('Read-only source admission boundary'); }},
        reviewer: {review: deny}, transport: {execute: deny, inspect: deny},
      });
      assert.equal(businessRecoveryAction(row, now) === 'submit', control.eligible, `UI case ${index}`);
      await engine.submit({planId: 'plan', expectedRevision: 1});
      assert.equal(sourceReads, control.eligible ? 1 : 0, `Engine case ${index}`);
      assert.equal(externalCalls, 0);
    } finally { db.close(); }
  }
  // Keep the existing UI policy for a review already in progress. This helper is
  // guidance, not an authorization check or a replacement for the engine's lock.
  const reviewing = {status: 'reviewing', issues: []} as unknown as BusinessRow;
  assert.equal(businessRecoveryAction(reviewing, now), 'wait_review');
  assert.equal(businessRecoveryDeadline([reviewing], now), undefined);
});
