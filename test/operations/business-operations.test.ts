import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeStore } from '../../packages/app-runtime/src/store.ts';
import { HallmarkStorePort } from '../../packages/app-hallmark/src/store.ts';
import { BusinessOperations } from '../../packages/app-hallmark/src/operations/index.ts';
import type { BusinessOperationsOptions, BusinessRowInput, BusinessTransportResult, TrustedRowContext, ReviewUnit } from '../../packages/app-hallmark/src/operations/types.ts';
import type { SemanticReviewRequest, SemanticReviewResult } from '../../packages/app-contracts/src/business-review.ts';

const answer = (request: SemanticReviewRequest, status: 'passed' | 'rejected' | 'pending' = 'passed'): SemanticReviewResult => ({ status, questions: request.questions.map(q => ({ id: q.id, version: q.version, status, reviewer: 'decisions', reasonCode: status })), evidence: { versions: request.versions, requests: [], thresholds: { pass: .95, reject: .1 } } });
const price = (offerId: string, value = '12'): BusinessRowInput => ({ action: 'price', target: { offerId }, payload: { price: value, currency_code: 'CNY' } });
const listing = (offerId: string): BusinessRowInput => ({ action: 'listing', target: { offerId }, procurement: [{ itemId: 'source', sourceSkuId: offerId, quantity: 2 }], payload: { offer_id: offerId, price: '30', currency_code: 'CNY', name: 'Cup', description: 'Shared detail', images: [`https://test/${offerId}.jpg`] } });
const unit = (id: string, draft: unknown, source: unknown = { product: 'cup' }): ReviewUnit => ({ id, source, draft, questions: [{ id, version: '1', instructions: 'Check', passCriteria: 'Matches', failCriteria: 'Conflicts', imageIds: [] }] });

test('price policy changed during semantic review is checked before dispatch without repeating unrelated content review',async()=>{
 const f=fixture();try{
  let version='1',floor=0;
  f.source((context,row)=>{context.policy={version,minimumPrice:floor};context.reviewUnits=[unit('content',{name:row.payload.name})];});
  f.review(async request=>{version='2';floor=60;return answer(request);});
  const plan=await f.engine.create({storeId:'bill',rows:[listing('one')]});
  const blocked=await f.engine.submit({planId:plan.planId,expectedRevision:1});assert.equal(blocked.rows[0].status,'blocked');assert.ok(blocked.rows[0].issues.some(issue=>issue.code==='PRICE_BELOW_FLOOR'));assert.equal(f.sends.length,0);assert.equal(f.reviews.length,1);
  version='3';floor=0;const completed=await f.engine.submit({planId:plan.planId,expectedRevision:1});assert.equal(completed.rows[0].status,'succeeded');assert.equal(f.reviews.length,1,'logistics rule revisions are not semantic cache revisions');assert.equal(f.sends.length,1);
 }finally{f.database.close();}
});

test('actual source content changed while a reviewer runs cannot authorize a stale write',async()=>{
 const f=fixture();try{
  let facts='red';f.source((context,row)=>{context.reviewUnits=[unit('content',row.payload.name,{color:facts})];});f.review(async request=>{facts='blue';return answer(request);});
  const plan=await f.engine.create({storeId:'bill',rows:[listing('one')]});const result=await f.engine.submit({planId:plan.planId,expectedRevision:1});assert.equal(result.rows[0].status,'blocked');assert.equal(result.rows[0].issues[0].code,'CONTENT_CHANGED_DURING_REVIEW');assert.equal(f.sends.length,0);
 }finally{f.database.close();}
});

test('restoring an automatically priced row keeps its chosen channel and treats the original price as an exact manual target',async()=>{
 const f=fixture();try{
  f.source((context,row)=>{if(row.pricing?.mode==='automatic')context.normalizedPayload={...row.payload,price:'99'};});
  const draft=await f.engine.create({storeId:'bill',rows:[{...price('one'),pricing:{planId:'channel-b',mode:'automatic'}}]});const changed=await f.engine.submit({planId:draft.planId,expectedRevision:1});assert.equal(changed.rows[0].payload.price,'99');
  const restore=await f.engine.restore({planId:draft.planId});assert.deepEqual(restore.rows[0].pricing,{planId:'channel-b',mode:'manual'});assert.equal(restore.rows[0].payload.price,'10');
  const restored=await f.engine.submit({planId:restore.planId,expectedRevision:1});assert.equal(restored.rows[0].status,'succeeded');assert.equal(f.current.get('one')?.price,'10');
 }finally{f.database.close();}
});

test('a pricing rule configured after saving a draft still persists its program-selected automatic pricing mode at submit',async()=>{
 const f=fixture();try{
  let configured=false;f.source((context,row)=>{if(configured){context.normalizedPricing={planId:'new-channel',mode:'automatic'};context.normalizedPayload={...row.payload,price:'42'};}});
  const draft=await f.engine.create({storeId:'bill',rows:[price('one')]});configured=true;const result=await f.engine.submit({planId:draft.planId,expectedRevision:1});assert.deepEqual(result.rows[0].pricing,{planId:'new-channel',mode:'automatic'});assert.equal(result.rows[0].payload.price,'42');
 }finally{f.database.close();}
});

function fixture() {
  const database = new RuntimeStore(':memory:'), store = new HallmarkStorePort(database, 'fixture');
  const current = new Map<string, Record<string, unknown>>(), sends: string[] = [], inspections: string[] = [], reviews: SemanticReviewRequest[] = [];
  let modify = (_: TrustedRowContext, _row: BusinessRowInput): void => {}, onSend = async (_: string): Promise<BusinessTransportResult> => ({ status: 'succeeded' }), onInspect = async (): Promise<BusinessTransportResult> => ({ status: 'succeeded' }), onReview = async (input: SemanticReviewRequest): Promise<SemanticReviewResult> => answer(input);
  const options: BusinessOperationsOptions = {
    store,
    source: { async load({ storeId, row }) {
      const context: TrustedRowContext = { identity: { storeId, ...row.target }, current: current.get(row.target.offerId) ?? (row.action === 'listing' ? {} : { price: '10', currency_code: 'CNY' }), source: { sourceId: 'source', original: 'Trusted original cup' }, procurement: [{ itemId: 'source', sourceSkuId: row.target.offerId, unitPrice: 12, currency: 'CNY', unit: 'piece' }], assets: [{ url: `https://test/${row.target.offerId}.jpg`, contentHash: `image-${row.target.offerId}` }] };
      modify(context, row); return structuredClone(context);
    } },
    transport: {
      async execute(input) { assert.equal(store.get('business_executions', input.executionId)?.status, 'dispatching', 'write intent persisted before network'); sends.push(input.row.target.offerId); const result = await onSend(input.row.target.offerId); if (result.status === 'succeeded') current.set(input.row.target.offerId, structuredClone(input.row.payload)); return result; },
      async inspect(input) { inspections.push(input.executionId); return onInspect(); },
    },
    reviewer: { async review(input) { reviews.push(structuredClone(input)); return onReview(input); } },
  };
  return { engine: new BusinessOperations(options), options, database, store, current, sends, inspections, reviews, source(fn: typeof modify) { modify = fn; }, write(fn: typeof onSend) { onSend = fn; }, inspect(fn: typeof onInspect) { onInspect = fn; }, review(fn: typeof onReview) { onReview = fn; } };
}

test('drafts do not review or write; submit isolates rejected rows and never resends successful rows', async () => {
  const f = fixture(); try {
    f.write(async offer => offer === 'bad' ? { status: 'rejected', issues: [{ code: 'PLATFORM_FIELD', field: 'price', message: 'Fix field' }] } : { status: 'succeeded' });
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('ok'), price('bad')] });
    assert.equal(f.sends.length, 0); assert.equal(f.reviews.length, 0);
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.status, 'partial'); assert.deepEqual(result.rows.map(r => r.status), ['succeeded', 'rejected']);
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.deepEqual(f.sends, ['ok', 'bad']);
    const repaired = await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: [{ ...price('bad', '13'), rowId: draft.rows[1].rowId }] });
    f.write(async () => ({ status: 'succeeded' })); await f.engine.submit({ planId: draft.planId, expectedRevision: repaired.revision });
    assert.deepEqual(f.sends, ['ok', 'bad', 'bad']);
  } finally { f.database.close(); }
});

test('reference subjects survive draft revisions and fresh review loads without entering Ozon payload',async()=>{
 const f=fixture();try{
  const seen:BusinessRowInput[]=[];
  f.source((context,row)=>{seen.push(structuredClone(row));context.reviewUnits=[unit('subject',row.payload.images,{references:row.referenceSubjects})];});
  f.review(async request=>answer(request,'rejected'));
  const input:BusinessRowInput={...listing('one'),referenceSubjects:[{sourceImageUrl:'https://source.test/both.jpg',subject:'左侧银色贴片'}]};
  const draft=await f.engine.create({storeId:'bill',rows:[input]});
  await f.engine.submit({planId:draft.planId,expectedRevision:draft.revision});
  assert.ok(seen.length>=2);for(const row of seen)assert.deepEqual(row.referenceSubjects,input.referenceSubjects);
  assert.deepEqual(f.engine.get(draft.planId).rows[0].referenceSubjects,input.referenceSubjects);
  const revised=await f.engine.revise({planId:draft.planId,expectedRevision:draft.revision,rows:[{...input,rowId:draft.rows[0].rowId,referenceSubjects:[{sourceImageUrl:'https://source.test/both.jpg',subject:'右侧金色贴片'}]}]});
  const result=await f.engine.submit({planId:draft.planId,expectedRevision:revised.revision});
  assert.equal(f.reviews.length,2,'changed comparison subject invalidates its completed question');
  assert.equal(seen.at(-1)!.referenceSubjects![0].subject,'右侧金色贴片');
  assert.equal(Object.hasOwn(result.rows[0].payload,'referenceSubjects'),false);
  assert.equal(f.sends.length,0);
 }finally{f.database.close();}
});

test('shared content is reviewed once; a local repair only rechecks its own changed evidence', async () => {
  const f = fixture(); try {
    f.source((c, row) => { c.reviewUnits = [unit('shared', row.payload.description), unit('variant', { offerId: row.target.offerId, name: row.payload.name })]; });
    f.review(async request => answer(request, request.questions[0].id === 'variant' && (request.draft as any).name === 'Wrong' ? 'rejected' : 'passed'));
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red'), { ...listing('blue'), payload: { ...listing('blue').payload, name: 'Wrong' } }] });
    const first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.deepEqual(first.rows.map(r => r.status), ['succeeded', 'blocked']); assert.equal(f.reviews.length, 3);
    const fixed = await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: [{ ...listing('blue'), rowId: draft.rows[1].rowId }] });
    await f.engine.submit({ planId: draft.planId, expectedRevision: fixed.revision });
    assert.equal(f.reviews.length, 4); assert.deepEqual(f.sends, ['red', 'blue']);
  } finally { f.database.close(); }
});

test('changing shared evidence invalidates every dependent row but shares the new review', async () => {
  const f = fixture(); try {
    f.source((c, row) => { c.reviewUnits = [unit('shared', row.payload.description)]; });
    f.review(async request => answer(request, request.draft === 'Shared detail' ? 'rejected' : 'passed'));
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red'), listing('blue')] });
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.reviews.length, 1); assert.equal(f.sends.length, 0);
    const fixed = await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: draft.rows.map(r => ({ ...listing(r.target.offerId), rowId: r.rowId, payload: { ...r.payload, description: 'Corrected detail' } })) });
    await f.engine.submit({ planId: draft.planId, expectedRevision: fixed.revision });
    assert.equal(f.reviews.length, 2); assert.deepEqual(f.sends, ['red', 'blue']);
  } finally { f.database.close(); }
});

test('procurement cost comes only from trusted source and explicit sales quantity; full cost is separate', async () => {
  const f = fixture(); try {
    const row = listing('red'); row.procurement![0] = { ...row.procurement![0], unitPrice: 0.01 } as any;
    f.source(c => { c.policy = { requireCost: true, breakEvenPrice: null, currency: 'CNY' }; });
    const draft = await f.engine.create({ storeId: 'bill', rows: [row, { action: 'archive', target: { offerId: 'old' }, payload: { archived: true } }] });
    assert.equal(draft.rows[0].binding?.amount, 24); assert.equal(draft.rows[0].binding?.components[0].unitPrice, 12);
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(result.rows[0].issues[0].code, 'COST_BASIS_MISSING'); assert.deepEqual(f.sends, ['old']);
  } finally { f.database.close(); }
});

test('stale source price, mismatched identity and unbound pictures block only affected rows', async () => {
  const f = fixture(); try {
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('stale'), price('foreign'), { ...listing('image'), payload: { ...listing('image').payload, images: ['https://other/image.jpg'] } }] });
    f.current.set('stale', { price: '11', currency_code: 'CNY' });
    f.source((c, row) => { if (row.target.offerId === 'foreign') c.identity.storeId = 'other'; });
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.deepEqual(result.rows.map(r => r.issues[0].code), ['CURRENT_VALUE_CHANGED', 'TARGET_IDENTITY_MISMATCH', 'IMAGE_BINDING_MISSING']); assert.equal(f.sends.length, 0);
  } finally { f.database.close(); }
});

test('concurrent submits and independent engine instances dispatch each exact row at most once', async () => {
  const f = fixture(); let release!: () => void; try {
    f.write(async () => { await new Promise<void>(resolve => { release = resolve; }); return { status: 'succeeded' }; });
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('one')] });
    const first = f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    while (!release) await new Promise(resolve => setImmediate(resolve));
    const second = new BusinessOperations(f.options).submit({ planId: draft.planId, expectedRevision: 1 });
    await second; release(); await first; assert.deepEqual(f.sends, ['one']);
  } finally { release?.(); f.database.close(); }
});

test('unknown requests survive restart, block the same SKU, allow unrelated SKUs and inspect without resend', async () => {
  const f = fixture(); try {
    f.write(async () => ({ status: 'unknown', receipt: { requestId: 'original-request' } }));
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('one')] });
    const first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(first.rows[0].status, 'unknown');
    const restarted = new BusinessOperations(f.options); await restarted.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.sends.length, 1);
    f.write(async () => ({ status: 'succeeded' }));
    const other = await restarted.create({ storeId: 'bill', rows: [price('one', '13'), price('two')] });
    const result = await restarted.submit({ planId: other.planId, expectedRevision: 1 }); assert.equal(result.rows[0].issues[0].code, 'TARGET_BUSY'); assert.equal(result.rows[1].status, 'succeeded');
    await restarted.inspect(draft.planId); assert.equal(f.inspections.length, 1); assert.deepEqual(f.sends, ['one', 'two']);
  } finally { f.database.close(); }
});

test('restoration is a new draft and rejects externally changed values; stock is never blindly reversed', async () => {
  const f = fixture(); try {
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('one')] }); await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    const restore = await f.engine.restore({ planId: draft.planId }); assert.deepEqual(restore.rows[0].payload, { price: '10', currency_code: 'CNY' });
    f.current.set('one', { price: '99', currency_code: 'CNY' });
    const blocked = await f.engine.submit({ planId: restore.planId, expectedRevision: 1 }); assert.ok(blocked.rows[0].issues.some(i => i.code === 'RESTORE_CONFLICT')); assert.equal(f.sends.length, 1);
    const stock = await f.engine.create({ storeId: 'bill', rows: [{ action: 'stock', target: { offerId: 'stock' }, payload: { stock: 3, warehouse_id: 1 } }] }); await f.engine.submit({ planId: stock.planId, expectedRevision: 1 });
    await assert.rejects(f.engine.restore({ planId: stock.planId }), /STOCK_RESTORE/);
  } finally { f.database.close(); }
});

test('two failed repairs count per question, pending service failures never consume a repair round', async () => {
  const f = fixture(); try {
    f.review(async request => answer(request, 'rejected'));
    let plan = await f.engine.create({ storeId: 'bill', rows: [listing('red')] });
    plan = await f.engine.submit({ planId: plan.planId, expectedRevision: plan.revision }); assert.equal(plan.rows[0].status, 'blocked');
    plan = await f.engine.submit({ planId: plan.planId, expectedRevision: plan.revision }); assert.equal(Object.values(plan.rows[0].repairHistory)[0].count, 0);
    for (let attempt = 1; attempt <= 2; attempt++) {
      plan = await f.engine.revise({ planId: plan.planId, expectedRevision: plan.revision, rows: [{ ...listing('red'), rowId: plan.rows[0].rowId, payload: { ...plan.rows[0].payload, name: `Repair ${attempt}` } }] });
      if (attempt === 1) { f.review(async request => answer(request, 'pending')); const pending = await f.engine.submit({ planId: plan.planId, expectedRevision: plan.revision }); assert.equal(Object.values(pending.rows[0].repairHistory)[0].count, 0); }
      f.review(async request => answer(request, 'rejected')); plan = await f.engine.submit({ planId: plan.planId, expectedRevision: plan.revision });
    }
    assert.equal(plan.rows[0].status, 'needs_user'); assert.equal(Object.values(plan.rows[0].repairHistory)[0].count, 2); assert.equal(f.sends.length, 0);
  } finally { f.database.close(); }
});

test('wrong review evidence versions cannot authorize a write', async () => {
  const f = fixture(); try {
    f.review(async request => { const result = answer(request); result.evidence.versions = { source: 'wrong', draft: 'wrong' }; return result; });
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red')] });
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(result.rows[0].status, 'review_pending'); assert.equal(f.sends.length, 0);
  } finally { f.database.close(); }
});

test('cancellation during review never sends a subsequent platform request', async () => {
  const f = fixture(), controller = new AbortController(); try {
    f.review(async request => { controller.abort(); return answer(request); });
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red')] });
    await assert.rejects(f.engine.submit({ planId: draft.planId, expectedRevision: 1 }, controller.signal)); assert.equal(f.sends.length, 0); assert.equal(f.engine.get(draft.planId).rows[0].status, 'review_pending');
  } finally { f.database.close(); }
});

test('explicit row dependencies are ordered internally and imported identities bind procurement', async () => {
  const f = fixture(); try {
    f.write(async offer => ({ status: 'succeeded', identity: { offerId: offer, productId: 123, sku: 456 } }));
    const draft = await f.engine.create({ storeId: 'bill', rows: [{ ...price('next'), rowId: 'next', dependsOn: ['listing'] }, { ...listing('red'), rowId: 'listing' }] });
    const result = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(result.status, 'done'); assert.deepEqual(f.sends, ['red', 'next']);
    const binding = f.store.list<any>('business_procurement_bindings').find(r => r.target.offerId === 'red'); assert.equal(binding.target.productId, 123); assert.equal(binding.binding.amount, 24);
  } finally { f.database.close(); }
});

test('explicit product-not-created rejection backs off and only resume creates a new attempt', async () => {
  const f = fixture(); let now = Date.parse('2026-10-10T00:00:00Z'); f.options.now = () => new Date(now).toISOString(); try {
    f.write(async () => ({ status: 'rejected', issues: [{ code: 'PRODUCT_IS_NOT_CREATED', message: 'Still importing' }], retryAfterMs: 1000 }));
    const draft = await f.engine.create({ storeId: 'bill', rows: [{ action: 'stock', target: { offerId: 'new' }, payload: { stock: 2, warehouse_id: 1 } }] });
    const first = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    await f.engine.resume({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.sends.length, 1);
    now += 2000; await f.engine.inspect(draft.planId); assert.equal(f.sends.length, 1);
    f.write(async () => ({ status: 'succeeded' })); const finished = await f.engine.resume({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(finished.rows[0].status, 'succeeded'); assert.notEqual(finished.rows[0].executionId, first.rows[0].executionId); assert.equal(finished.rows[0].executionAttempt, 2); assert.equal(f.sends.length, 2);
  } finally { f.database.close(); }
});

test('source refresh keeps the desired edit while replacing stale before values', async () => {
  const f = fixture(); try {
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('one')] });
    f.current.set('one', { price: '11', currency_code: 'CNY' });
    const refreshed = await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: [{ ...price('one'), rowId: draft.rows[0].rowId }] });
    assert.equal(refreshed.revision, 2); assert.equal(refreshed.rows[0].before?.price, '11');
    assert.equal((await f.engine.submit({ planId: draft.planId, expectedRevision: 2 })).status, 'done');
  } finally { f.database.close(); }
});

test('an image whose bytes change at the same URL invalidates its cached semantic review', async () => {
  const f = fixture(); let imageVersion = 'one'; try {
    f.source(c => { c.assets![0].contentHash = imageVersion; });
    f.review(async request => answer(request, 'rejected'));
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red')] });
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.reviews.length, 1);
    imageVersion = 'two'; await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(f.reviews.length, 2);
  } finally { f.database.close(); }
});

test('promotion restoration compares actual membership and preserves the original quota', async () => {
  const f = fixture(); try {
    f.current.set('promo', { action_id: 7, price: '10', stock: 4, member: true });
    const draft = await f.engine.create({ storeId: 'bill', rows: [{ action: 'promotion.update', target: { offerId: 'promo' }, payload: { action_id: 7, price: '8', stock: 3 } }] });
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    f.current.set('promo', { action_id: 7, price: '8', stock: 3, member: true });
    const restore = await f.engine.restore({ planId: draft.planId });
    assert.equal(restore.rows[0].payload.stock, 4);
    assert.equal((await f.engine.submit({ planId: restore.planId, expectedRevision: 1 })).status, 'done');
  } finally { f.database.close(); }
});

test('later operations retain and reuse saved procurement identity instead of replacing it with an empty binding', async () => {
  const f = fixture(); try {
    f.write(async offerId => ({ status: 'succeeded', identity: { offerId, productId: 123, sku: 456 } }));
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red')] }); await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    const edit = await f.engine.create({ storeId: 'bill', rows: [price('red', '31')] });
    assert.deepEqual(edit.rows[0].procurement, [{ itemId: 'source', sourceSkuId: 'red', quantity: 2 }]); assert.equal(edit.rows[0].target.productId, 123);
    await f.engine.submit({ planId: edit.planId, expectedRevision: 1 });
    const binding = f.store.list<any>('business_procurement_bindings').find(value => value.target.offerId === 'red'); assert.equal(binding.binding.amount, 24); assert.equal(binding.binding.components.length, 1);
  } finally { f.database.close(); }
});

test('background continues an explicitly submitted stock dependency after import inspection without another model call', async () => {
  const f = fixture(); try {
    let writes = 0; f.write(async () => ++writes === 1 ? { status: 'pending', receipt: { importTaskId: 7 } } : { status: 'succeeded' });
    const draft = await f.engine.create({ storeId: 'bill', rows: [{ ...listing('red'), rowId: 'listing' }, { rowId: 'stock', action: 'stock', target: { offerId: 'red' }, payload: { stock: 0, warehouse_id: 7 }, dependsOn: ['listing'] }] });
    assert.equal(f.engine.hasContinuation(draft.planId), false);
    const pending = await f.engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.deepEqual(pending.rows.map(r => r.status), ['pending', 'blocked']);
    assert.equal(f.engine.hasContinuation(draft.planId), false); await f.engine.inspect(draft.planId); assert.equal(f.engine.hasContinuation(draft.planId), true);
    const modelCalls = f.reviews.length; const finished = await f.engine.continueSubmitted(draft.planId); assert.equal(finished.status, 'done'); assert.equal(f.sends.length, 2); assert.equal(f.reviews.length, modelCalls);
    await f.engine.continueSubmitted(draft.planId); assert.equal(f.sends.length, 2);
  } finally { f.database.close(); }
});

test('editing a pending dependency revokes background submission for that revised row', async () => {
  const f = fixture(); try {
    f.write(async () => ({ status: 'pending' }));
    const draft = await f.engine.create({ storeId: 'bill', rows: [{ ...listing('red'), rowId: 'listing' }, { rowId: 'stock', action: 'stock', target: { offerId: 'red' }, payload: { stock: 0, warehouse_id: 7 }, dependsOn: ['listing'] }] });
    await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    await f.engine.revise({ planId: draft.planId, expectedRevision: 1, rows: [{ rowId: 'stock', action: 'stock', target: { offerId: 'red' }, payload: { stock: 99, warehouse_id: 7 }, dependsOn: ['listing'] }] });
    await f.engine.inspect(draft.planId); assert.equal(f.engine.hasContinuation(draft.planId), false); await f.engine.continueSubmitted(draft.planId); assert.equal(f.sends.length, 1);
  } finally { f.database.close(); }
});

test('background retries only due explicit rate-limit rejections and never resends unknown requests', async () => {
  const f = fixture(); let now = Date.parse('2026-10-10T00:00:00Z'); f.options.now = () => new Date(now).toISOString(); try {
    f.write(async offer => offer === 'limited' ? { status: 'rejected', issues: [{ code: 'OZON_RATE_LIMIT', message: 'Rate limited' }], retryAfterMs: 1000 } : { status: 'unknown' });
    const draft = await f.engine.create({ storeId: 'bill', rows: [price('limited'), price('unknown')] }); await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    assert.equal(f.engine.hasContinuation(draft.planId), false); now += 2000; assert.equal(f.engine.hasContinuation(draft.planId), true);
    f.write(async () => ({ status: 'succeeded' })); await f.engine.continueSubmitted(draft.planId); assert.deepEqual(f.sends, ['limited', 'unknown', 'limited']); assert.equal(f.engine.get(draft.planId).rows[1].status, 'unknown');
  } finally { f.database.close(); }
});

test('background never retries pending semantic review or creates fresh semantic requests for a dependency', async () => {
  const f = fixture(); try {
    f.source((c, row) => { c.reviewUnits = [unit('semantic', row.payload)]; });
    f.review(async request => answer(request, 'pending'));
    const draft = await f.engine.create({ storeId: 'bill', rows: [listing('red')] }); await f.engine.submit({ planId: draft.planId, expectedRevision: 1 });
    await f.engine.continueSubmitted(draft.planId); assert.equal(f.reviews.length, 1);
    f.review(async request => answer(request)); f.write(async () => ({ status: 'pending' }));
    const dependent = await f.engine.create({ storeId: 'bill', rows: [{ ...listing('blue'), rowId: 'listing' }, { ...price('next'), rowId: 'next', dependsOn: ['listing'] }] }); await f.engine.submit({ planId: dependent.planId, expectedRevision: 1 });
    await f.engine.inspect(dependent.planId); const calls = f.reviews.length; const after = await f.engine.continueSubmitted(dependent.planId);
    assert.equal(after.rows[1].status, 'review_pending'); assert.equal(f.reviews.length, calls); assert.equal(f.engine.hasContinuation(dependent.planId), false);
  } finally { f.database.close(); }
});
