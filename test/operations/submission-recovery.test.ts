import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeStore } from '../../packages/app-runtime/src/store.ts';
import { HallmarkStorePort } from '../../packages/app-hallmark/src/store.ts';
import { BusinessOperations } from '../../packages/app-hallmark/src/operations/index.ts';
import { HallmarkBusinessAdapter } from '../../packages/app-hallmark/src/operations-adapter.ts';
import type { BusinessOperationsOptions, BusinessRowInput, BusinessTransportResult } from '../../packages/app-hallmark/src/operations/types.ts';
import type { SemanticReviewRequest, SemanticReviewResult } from '../../packages/app-contracts/src/business-review.ts';
import type { AdapterResponse, CoreBroker, CoreClient } from '../../packages/core/src/types.ts';
import type { OzonBusinessGateway } from '../../packages/ozon-business/src/index.ts';

const turn = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve }; }
const answer = (request: SemanticReviewRequest, status: 'passed' | 'rejected' | 'pending' = 'passed'): SemanticReviewResult => ({ status, questions: request.questions.map(q => ({ id: q.id, version: q.version, status, reviewer: 'decisions', reasonCode: status })), evidence: { versions: { ...request.versions }, requests: [], thresholds: { pass: .95, reject: .1 } } });
const price = (value = '12'): BusinessRowInput => ({ action: 'price', target: { offerId: 'one' }, payload: { price: value, currency_code: 'CNY' } });
function fixture() {
  const database = new RuntimeStore(':memory:'), store = new HallmarkStorePort(database, 'recovery');
  const calls = { execute: 0, inspect: 0, review: 0 };
  const handlers = { execute: async (): Promise<BusinessTransportResult> => ({ status: 'pending' }), inspect: async (): Promise<BusinessTransportResult> => ({ status: 'pending' }), review: async (request: SemanticReviewRequest): Promise<SemanticReviewResult> => answer(request) };
  const options: BusinessOperationsOptions = {
    store,
    source: { async load({ storeId, row }) { return { identity: { storeId, ...row.target, productId: '1' }, current: { price: '10', currency_code: 'CNY' }, source: { name: 'Cup' }, procurement: [] }; } },
    transport: { async execute() { calls.execute++; return handlers.execute(); }, async inspect() { calls.inspect++; return handlers.inspect(); } },
    reviewer: { async review(request) { calls.review++; return handlers.review(request); } },
  };
  return { database, store, calls, handlers, options, engine: new BusinessOperations(options) };
}
function enableReview(f: ReturnType<typeof fixture>, facts = () => 'Cup') {
  const original = f.options.source.load;
  f.options.source.load = async request => ({ ...await original(request), reviewUnits: [{ id: 'content', source: { name: facts() }, draft: { name: 'Cup' }, questions: [{ id: 'facts', version: '1', instructions: 'Check', passCriteria: 'Match', failCriteria: 'Mismatch' }] }] });
}

test('cross-instance late pending inspection cannot replace a terminal row or its durable receipt', async () => {
  const f = fixture(), old = deferred<BusinessTransportResult>(); try {
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] }), submitted = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    f.handlers.inspect = async () => f.calls.inspect === 1 ? old.promise : { status: 'succeeded', receipt: { observed: 'new-complete' } };
    const slow = f.engine.inspect(draft.planId); await turn();
    await new BusinessOperations(f.options).inspect(draft.planId);
    old.resolve({ status: 'pending', receipt: { observed: 'old-pending' } }); const result = await slow;
    assert.equal(result.rows[0].status, 'succeeded'); assert.deepEqual(result.rows[0].receipt, { observed: 'new-complete' });
    assert.equal(f.store.get<{ status: string }>('business_executions', submitted.rows[0].executionId!)!.status, 'succeeded');
    assert.equal(f.calls.execute, 1); assert.equal(result.status, 'done');
  } finally { old.resolve({ status: 'pending' }); f.database.close(); }
});

test('late execute reply cannot regress a completion confirmed by another engine inspection', async () => {
  const f = fixture(), old = deferred<BusinessTransportResult>(); try {
    f.handlers.execute = async () => old.promise; f.handlers.inspect = async () => ({ status: 'succeeded', receipt: { observed: 'confirmed' } });
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    const slow = f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    while (!f.calls.execute) await turn();
    const confirmed = await new BusinessOperations(f.options).inspect(draft.planId);
    assert.equal(confirmed.rows[0].status, 'succeeded');
    old.resolve({ status: 'pending', receipt: { observed: 'older-response' } }); const result = await slow;
    assert.equal(result.rows[0].status, 'succeeded'); assert.deepEqual(result.rows[0].receipt, { observed: 'confirmed' });
    assert.equal(f.store.get<{ status: string }>('business_executions', result.rows[0].executionId!)!.status, 'succeeded'); assert.equal(f.calls.execute, 1);
  } finally { old.resolve({ status: 'pending' }); f.database.close(); }
});

for (const revise of [false, true]) test(`old inspection cannot mutate a newer ${revise ? 'row revision' : 'execution attempt at the same revision'}`, async () => {
  const f = fixture(), old = deferred<BusinessTransportResult>(); try {
    let draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    const first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    f.handlers.inspect = async () => f.calls.inspect === 1 ? old.promise : { status: 'rejected', issues: [{ code: 'REQUEST_NOT_DISPATCHED', message: 'Confirmed not sent' }] };
    const slow = f.engine.inspect(draft.planId); await turn();
    await new BusinessOperations(f.options).inspect(draft.planId);
    if (revise) draft = await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: [{ ...price('13'), rowId: draft.rows[0].rowId }] });
    const next = await f.engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.notEqual(next.rows[0].executionId, first.rows[0].executionId);
    old.resolve({ status: 'succeeded', receipt: { observed: 'old' } }); const result = await slow;
    assert.equal(result.rows[0].status, 'pending'); assert.equal(result.rows[0].executionId, next.rows[0].executionId);
    assert.equal(result.rows[0].revision, next.rows[0].revision); assert.equal(result.rows[0].receipt, undefined);
    assert.equal(f.store.get<{ status: string }>('business_executions', first.rows[0].executionId!)!.status, 'rejected');
    assert.equal(f.calls.execute, 2);
  } finally { old.resolve({ status: 'pending' }); f.database.close(); }
});

test('completed matching review is cached before cancellation but dispatch waits for explicit resumed submission', async () => {
  const f = fixture(), controller = new AbortController(); try {
    enableReview(f); f.handlers.review = async request => { controller.abort(); return answer(request); };
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    await assert.rejects(f.engine.submit({ planId: draft.planId, expectedRevision: 1 }, controller.signal));
    assert.equal(f.calls.execute, 0); assert.equal(f.calls.review, 1); assert.equal(f.store.list('business_review_cache').length, 1);
    assert.equal(f.engine.get(draft.planId).rows[0].status, 'review_pending'); assert.equal(f.engine.hasContinuation(draft.planId), false);
    await f.engine.continueSubmitted(draft.planId); assert.equal(f.calls.execute, 0);
    f.handlers.execute = async () => ({ status: 'succeeded' });
    const result = await new BusinessOperations(f.options).submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.rows[0].status, 'succeeded'); assert.equal(f.calls.review, 1); assert.equal(f.calls.execute, 1);
  } finally { f.database.close(); }
});

for (const invalid of ['pending', 'versions', 'question', 'inconsistent'] as const) test(`cancelled ${invalid} review is not cached or used to authorize a later write`, async () => {
  const f = fixture(), controller = new AbortController(); try {
    enableReview(f); f.handlers.review = async request => {
      const result = answer(request, invalid === 'pending' ? 'pending' : 'passed');
      if (invalid === 'versions') result.evidence.versions.source = 'wrong';
      if (invalid === 'question') result.questions[0].id = 'wrong';
      if (invalid === 'inconsistent') result.questions[0].status = 'rejected';
      controller.abort(); return result;
    };
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    await assert.rejects(f.engine.submit({ planId: draft.planId, expectedRevision: 1 }, controller.signal));
    assert.equal(f.store.list('business_review_cache').length, 0); assert.equal(f.calls.execute, 0);
    f.handlers.review = async request => answer(request); f.handlers.execute = async () => ({ status: 'succeeded' });
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.rows[0].status, 'succeeded'); assert.equal(f.calls.review, 2); assert.equal(f.calls.execute, 1);
  } finally { f.database.close(); }
});

test('cached rejected review after cancellation still blocks dispatch', async () => {
  const f = fixture(), controller = new AbortController(); try {
    enableReview(f); f.handlers.review = async request => { controller.abort(); return answer(request, 'rejected'); };
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    await assert.rejects(f.engine.submit({ planId: draft.planId, expectedRevision: 1 }, controller.signal));
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.rows[0].status, 'blocked'); assert.equal(f.calls.review, 1); assert.equal(f.calls.execute, 0);
  } finally { f.database.close(); }
});

test('changed source after cancelled completed review still requires a fresh semantic decision', async () => {
  const f = fixture(), controller = new AbortController(); let facts = 'Cup'; try {
    enableReview(f, () => facts); f.handlers.review = async request => { controller.abort(); return answer(request); };
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] });
    await assert.rejects(f.engine.submit({ planId: draft.planId, expectedRevision: 1 }, controller.signal));
    facts = 'New cup'; f.handlers.review = async request => answer(request); f.handlers.execute = async () => ({ status: 'succeeded' });
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.rows[0].status, 'succeeded'); assert.equal(f.calls.review, 2); assert.equal(f.calls.execute, 1);
  } finally { f.database.close(); }
});

function directFixture() {
  const f = fixture(); let enabled = true, credentialRevision = 1, sourceRevision = 1, writes = 0;
  let response: AdapterResponse = { status: 'ok', raw: { outcome: 'response_received', httpStatus: 200, response: { result: [{ updated: true }] } } };
  const original = f.options.source.load;
  f.options.source.load = async request => ({ ...await original(request), credentialRevision: sourceRevision });
  const gateway = { hasStore: () => true, getStore: () => ({ enabled, hasCredentials: enabled, credentialRevision }), async request(_id: string, { path }: { path: string }) {
    if (path === '/v1/product/import/prices') { writes++; return response; }
    return { status: 'ok', raw: path === '/v3/product/info/list' ? { items: [{ offer_id: 'one', id: 1 }] } : { items: [{ offer_id: 'one', product_id: 1, price: { price: response.status === 'ok' ? '12' : '10', currency_code: 'CNY' } }] } };
  } } as unknown as OzonBusinessGateway;
  f.options.transport = new HallmarkBusinessAdapter({ store: f.store, gateway, client: {} as CoreClient, broker: {} as CoreBroker });
  return { ...f, get writes() { return writes; }, get enabled() { return enabled; }, set enabled(value: boolean) { enabled = value; }, get credentialRevision() { return credentialRevision; }, set credentialRevision(value: number) { credentialRevision = value; }, get sourceRevision() { return sourceRevision; }, set sourceRevision(value: number) { sourceRevision = value; }, get response() { return response; }, set response(value: AdapterResponse) { response = value; } };
}

for (const cause of ['configuration', 'credential'] as const) test(`definite ${cause} rejection permits only an explicit retry after correction`, async () => {
  const f = directFixture(); try {
    if (cause === 'configuration') f.enabled = false; else f.credentialRevision = 2;
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] }), first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(first.rows[0].status, 'rejected'); assert.equal(f.writes, 0);
    assert.ok(first.rows[0].issues.some(issue => issue.code === (cause === 'configuration' ? 'DIRECT_STORE_CONFIGURATION_REQUIRED' : 'STORE_CONNECTION_CHANGED')));
    assert.ok(first.rows[0].issues.some(issue => issue.code === 'REQUEST_NOT_DISPATCHED'));
    assert.equal(f.engine.hasContinuation(draft.planId), false); await f.engine.continueSubmitted(draft.planId); assert.equal(f.writes, 0);
    const stillBlocked = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(stillBlocked.rows[0].status, 'rejected'); assert.equal(f.writes, 0);
    if (cause === 'configuration') f.enabled = true; else f.sourceRevision = 2;
    await f.engine.continueSubmitted(draft.planId); assert.equal(f.writes, 0);
    const completed = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(completed.rows[0].status, 'succeeded'); assert.equal(f.writes, 1); assert.notEqual(completed.rows[0].executionId, first.rows[0].executionId);
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.writes, 1);
  } finally { f.database.close(); }
});

for (const refusal of [
  { status: 'failed', error: { code: 'OZON_CREDENTIAL_REVISION_CHANGED', message: 'Changed before dispatch', retryable: false } },
  { status: 'unavailable', error: { code: 'OZON_CREDENTIAL_UNAVAILABLE', message: 'Unavailable before dispatch', retryable: false } },
] satisfies AdapterResponse[]) test(`${refusal.error.code} gateway admission refusal supports explicit retry`, async () => {
  const f = directFixture(); try {
    f.response = refusal;
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] }), first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(first.rows[0].status, 'rejected'); assert.ok(first.rows[0].issues.some(issue => issue.code === 'REQUEST_NOT_DISPATCHED'));
    assert.equal(f.store.get<{ dispatchStarted: boolean }>('business_transport_receipts', first.rows[0].executionId!)!.dispatchStarted, false);
    f.response = { status: 'ok', raw: { outcome: 'response_received', httpStatus: 200, response: { result: [{ updated: true }] } } };
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(result.rows[0].status, 'succeeded'); assert.equal(f.writes, 2);
  } finally { f.database.close(); }
});

for (const response of [
  { status: 'unknown', error: { code: 'OZON_OUTCOME_UNKNOWN', message: 'Unknown', retryable: false } },
  { status: 'failed', error: { code: 'UNRECOGNIZED_FAILURE', message: 'No proof of non-dispatch', retryable: false } },
  { status: 'failed', raw: {}, error: { code: 'OZON_CREDENTIAL_REVISION_CHANGED', message: 'A raw reply is not a local preflight', retryable: false } },
  { status: 'failed', raw: { outcome: 'response_received', httpStatus: 400, response: { code: 'OZON_CREDENTIAL_REVISION_CHANGED', message: 'Platform response' } } },
  { status: 'unknown', raw: { outcome: 'outcome_unknown', httpStatus: 500 } },
  { status: 'unknown', raw: { outcome: 'outcome_unknown', httpStatus: 408 } },
  { status: 'failed', raw: { outcome: 'response_received', httpStatus: 400, response: { code: 'BAD_FIELD', message: 'Invalid field' } } },
] satisfies AdapterResponse[]) test(`dispatched outcome ${response.raw?.httpStatus ?? 'unknown'} never gains a pre-dispatch retry`, async () => {
  const f = directFixture(); try {
    f.response = response;
    const draft = await f.engine.create({ storeId: 'bill', rows: [price()] }), first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.ok(!first.rows[0].issues.some(issue => issue.code === 'REQUEST_NOT_DISPATCHED')); assert.equal(f.writes, 1);
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); await f.engine.continueSubmitted(draft.planId); await f.engine.inspect(draft.planId);
    assert.equal(f.writes, 1); assert.equal(f.engine.get(draft.planId).rows[0].executionId, first.rows[0].executionId);
  } finally { f.database.close(); }
});
