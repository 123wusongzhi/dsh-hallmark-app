import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionReviewer } from '../../packages/service/src/decision-review.ts';
import { createDecisionImageProtocol } from '../../packages/service/src/decision-image-protocol.ts';
import type { IndependentReviewRequest, IndependentReviewResult, SemanticReviewQuestion, SemanticReviewRequest } from '../../packages/app-contracts/src/business-review.ts';

const question = (id = 'consistent'): SemanticReviewQuestion => ({
  id, version: 'q1', instructions: 'Is the stated quantity consistent with the source?',
  passCriteria: 'The quantities agree.', failCriteria: 'The quantities differ or the source is missing.',
  issue: { field: 'quantity', message: 'The sales quantity differs from the source.', suggestion: 'Correct the quantity.' },
});
const input = (questions = [question()]): SemanticReviewRequest => ({
  source: { title: 'Cup', quantity: 1 }, draft: { title: 'One cup', quantity: 1 },
  versions: { source: 'source-hash', draft: 'draft-hash', policy: 'policy-v1' }, questions,
});
const resultResponse = (answers: unknown, extra = {}) => new Response(JSON.stringify({
  model: 'openai/gpt-6-luna-decisions-20261006', answers, usage: { input_tokens: 100, cost: 0.00001 }, ...extra,
}), { status: 200 });
const fallbackResult = (request: IndependentReviewRequest, status: 'passed' | 'rejected' | 'pending' = 'passed'): IndependentReviewResult => ({
  reviewer: 'independent-agent', reviewerId: 'child-21', model: 'vision-review-model',
  versions: { ...request.versions }, questions: request.questions.map(q => ({ id: q.id, version: q.version, status })),
});

test('routes positive and negative probabilities by criterion and never emits the API key', async () => {
  const secret = 'sk-or-v1-fixture-secret-123456789';
  let submitted: any;
  const reviewer = createDecisionReviewer({ key: secret, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${secret}`);
    submitted = JSON.parse(String(init?.body));
    return resultResponse({ consistent: { type: 'noul', noul: 0.99 }, bad: { type: 'noul', noul: 0.01 } });
  } });
  const request = input([question(), question('bad')]);
  const result = await reviewer.review(request);
  assert.equal(result.status, 'rejected');
  assert.deepEqual(result.questions.map(q => q.status), ['passed', 'rejected']);
  assert.equal(result.questions[1].field, 'quantity');
  assert.equal(result.questions[1].suggestion, 'Correct the quantity.');
  assert.deepEqual(result.evidence.versions, request.versions);
  assert.equal(submitted.model, 'openai/gpt-6-luna-decisions');
  assert.equal(submitted.questions.consistent.type, 'noul');
  assert.deepEqual(submitted.state.source, request.source);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('missing, refused, out-of-range and ambiguous answers go to the independent reviewer only', async () => {
  let fallbackInput: IndependentReviewRequest | undefined;
  const request = input(['ok', 'missing', 'refused', 'invalid', 'uncertain'].map(id => question(id)));
  const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => resultResponse({
    ok: { type: 'noul', noul: 1 }, refused: { type: 'refusal' }, invalid: { type: 'noul', noul: 1.2 }, uncertain: { type: 'noul', noul: 0.5 },
  }), fallback: async request => { fallbackInput = request; return fallbackResult(request); } });
  const result = await reviewer.review(request);
  assert.equal(result.status, 'passed');
  assert.deepEqual(fallbackInput?.questions.map(q => q.id), ['missing', 'refused', 'invalid', 'uncertain']);
  assert.deepEqual(fallbackInput?.context.writeTools, []);
  assert.equal(fallbackInput?.context.toolPolicy, 'read-only');
  assert.equal(result.questions[0].reviewer, 'decisions');
  assert.ok(result.questions.slice(1).every(q => q.reviewer === 'independent-agent'));
  assert.equal(result.evidence.requests[1].reviewerId, 'child-21');
});

test('a transport that ignores abort cannot hang the review and a timeout invokes fallback', async () => {
  let receivedSignal: AbortSignal | undefined;
  let fallbackCalls = 0;
  const reviewer = createDecisionReviewer({ key: 'test', timeoutMs: 10, fetchImpl: async (_url, options) => {
    receivedSignal = options?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }, fallback: async request => { fallbackCalls++; return fallbackResult(request); } });
  const result = await reviewer.review(input());
  assert.equal(result.status, 'passed');
  assert.equal(fallbackCalls, 1);
  assert.equal(receivedSignal?.aborted, true);
  assert.equal(result.evidence.requests[0].reasonCode, 'review_timeout');
});

test('errors in either provider are pending and raw error messages or secrets never escape', async () => {
  const secret = 'sk-or-v1-sensitive-api-key-123456789';
  const reviewer = createDecisionReviewer({ key: secret,
    fetchImpl: async () => { throw new Error(`Request Authorization: Bearer ${secret}`); },
    fallback: async () => { throw new Error(`Failed ${secret}`); },
  });
  const result = await reviewer.review(input());
  assert.equal(result.status, 'pending');
  assert.equal(result.questions[0].reasonCode, 'fallback_unavailable');
  assert.equal(JSON.stringify(result).includes(secret), false);
  const redacting = createDecisionReviewer({ key: secret, fetchImpl: async () => resultResponse({ consistent: { type: 'noul', noul: 0.5 } }),
    fallback: async request => ({ ...fallbackResult(request, 'rejected'), model: secret,
      questions: [{ id: 'consistent', version: 'q1', status: 'rejected', message: `bad ${secret}`, suggestion: `Bearer ${secret}` }] }),
  });
  assert.equal(JSON.stringify(await redacting.review(input())).includes(secret), false);
});

test('fallback with stale snapshot, stale question version, duplicate answers or missing answer never passes', async () => {
  for (const corruption of ['snapshot', 'question', 'duplicate', 'missing'] as const) {
    const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => resultResponse({}), fallback: async request => {
      const result = fallbackResult(request);
      if (corruption === 'snapshot') result.versions.draft = 'another-draft';
      if (corruption === 'question') result.questions[0].version = 'old';
      if (corruption === 'duplicate') result.questions.push(result.questions[0]);
      if (corruption === 'missing') result.questions = [];
      return result;
    } });
    assert.equal((await reviewer.review(input())).status, 'pending', corruption);
  }
});

test('real image evidence is preserved for the independent vision reviewer; URLs alone never count as visual review', async () => {
  const pixels = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t8sAAAAASUVORK5CYII=';
  const request = input([question('visual'), { ...question('text'), imageIds: [] }]);
  request.images = [{ id: 'source-photo', role: 'source', url: pixels }, { id: 'draft-photo', role: 'draft', url: 'https://example.test/draft.png' }];
  let fallbackInput: IndependentReviewRequest | undefined;
  let httpCalls = 0;
  const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async (_url, options) => {
    httpCalls++;
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(Object.keys(body.questions), ['text']);
    assert.equal(JSON.stringify(body).includes(pixels), false);
    return resultResponse({ text: { type: 'noul', noul: 1 } });
  }, fallback: async request => { fallbackInput = request; return fallbackResult(request); } });
  const result = await reviewer.review(request);
  assert.equal(httpCalls, 1);
  assert.equal(result.status, 'passed');
  assert.deepEqual(fallbackInput?.images, request.images);
  assert.deepEqual(fallbackInput?.context.reasons, [{ id: 'visual', reasonCode: 'image_protocol_unverified' }]);
  assert.equal(result.questions[0].reviewer, 'independent-agent');
  assert.equal(result.questions[1].reviewer, 'decisions');
});

test('image-dependent questions wait when neither a verified protocol nor independent vision reviewer exists', async () => {
  const request = input();
  request.images = [{ id: 'photo', role: 'draft', url: 'https://example.test/photo.png' }];
  let calls = 0;
  const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => { calls++; return resultResponse({ consistent: { type: 'noul', noul: 1 } }); } });
  const result = await reviewer.review(request);
  assert.equal(calls, 0);
  assert.equal(result.status, 'pending');
  assert.equal(result.questions[0].reasonCode, 'image_protocol_unverified');
});

test('a host-provided verified image protocol sends image parts rather than a text URL', async () => {
  const pixels = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t8sAAAAASUVORK5CYII=';
  const request = input();
  request.images = [{ id: 'photo', role: 'source', url: pixels }];
  const reviewer = createDecisionReviewer({ key: 'test', imageProtocol: createDecisionImageProtocol(), fetchImpl: async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(typeof body.state[0], 'string');
    assert.equal(body.state[1], 'Image photo (source)');
    assert.deepEqual(body.state[2], { type: 'image_url', image_url: { url: pixels } });
    return resultResponse({ consistent: { type: 'noul', noul: 1 } });
  } });
  const result = await reviewer.review(request);
  assert.equal(result.status, 'passed');
  assert.equal(result.evidence.requests[0].protocol, 'openrouter-decisions-native-images-v1');
});

const choiceQuestion = (): SemanticReviewQuestion => ({ ...question('printed-spec'), choices: {
  matches: { criteria: 'Printed specification agrees with the real SKU.', status: 'passed' },
  differs: { criteria: 'Printed specification contradicts the real SKU.', status: 'rejected' },
  no_spec_text: { criteria: 'There is no printed specification text.', status: 'passed', applicable: false },
  evidence_insufficient: { criteria: 'The evidence does not support a reliable decision.', status: 'pending' },
} });
const choiceAnswer = (choice = 'matches', confidence = 0.99, probability = 0.99) => ({
  type: 'choice', choice, confidence,
  probabilities: Object.fromEntries(Object.keys(choiceQuestion().choices!).map(id => [id, id === choice ? probability : (1 - probability) / 3])),
});

test('application choices preserve N/A separately from positive and negative content findings', async () => {
  for (const [choice, status] of [['matches', 'passed'], ['differs', 'rejected'], ['no_spec_text', 'passed'], ['evidence_insufficient', 'pending']] as const) {
    const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.questions['printed-spec'].type, 'choice');
      assert.deepEqual(body.questions['printed-spec'].criteria, Object.fromEntries(Object.entries(choiceQuestion().choices!).map(([id, item]) => [id, item.criteria])));
      return resultResponse({ 'printed-spec': choiceAnswer(choice) });
    } });
    const result = await reviewer.review(input([choiceQuestion()]));
    assert.equal(result.status, status); assert.equal(result.questions[0].choice, choice);
    assert.equal(result.questions[0].confidence, 0.99);
    assert.equal(result.questions[0].applicable, choice === 'no_spec_text' ? false : undefined);
    if (choice === 'no_spec_text') assert.equal(result.questions[0].reasonCode, 'not_applicable');
  }
});

test('low-confidence, malformed and unknown choice answers use fallback rather than granting a pass', async () => {
  for (const answer of [choiceAnswer('matches', 0.7), choiceAnswer('matches', 0.99, 0.7),
    { ...choiceAnswer(), choice: 'invented' }, { ...choiceAnswer(), confidence: undefined },
    { ...choiceAnswer(), probabilities: { matches: 0.99 } }, { ...choiceAnswer(), probabilities: { ...choiceAnswer().probabilities, differs: 2 } }]) {
    let calls = 0;
    const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => resultResponse({ 'printed-spec': answer }),
      fallback: async request => { calls++; return { ...fallbackResult(request), questions: [{ id: 'printed-spec', version: 'q1', status: 'passed', choice: 'no_spec_text' }] }; } });
    const result = await reviewer.review(input([choiceQuestion()]));
    assert.equal(calls, 1); assert.equal(result.status, 'passed');
    assert.equal(result.questions[0].reasonCode, 'not_applicable');
    assert.equal(result.questions[0].applicable, false);
  }
});

test('independent choice mapping rejects absent choices and never upgrades an explicit pending answer', async () => {
  for (const choice of [undefined, 'invented', 'matches', 'no_spec_text']) {
    const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => resultResponse({}), fallback: async request => ({
      ...fallbackResult(request), questions: [{ id: 'printed-spec', version: 'q1', status: 'pending', choice }],
    }) });
    const result = await reviewer.review(input([choiceQuestion()]));
    assert.equal(result.status, 'pending'); assert.equal(result.questions[0].applicable, undefined);
    assert.notEqual(result.questions[0].reasonCode, 'not_applicable');
  }
});

test('image preparation is inside the request timeout and cannot send a delayed request after it expires', async () => {
  let calls = 0, fallbackCalls = 0, preparationSignal: AbortSignal | undefined;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const reviewer = createDecisionReviewer({ key: 'test', timeoutMs: 10,
    imageProtocol: { name: 'delayed-images', buildState: async (_request, signal) => { preparationSignal = signal; await barrier; return []; } },
    fetchImpl: async () => { calls++; return resultResponse({ consistent: { type: 'noul', noul: 1 } }); },
    fallback: async request => { fallbackCalls++; return fallbackResult(request); },
  });
  const request = input(); request.images = [{ id: 'image', role: 'draft', url: 'https://example.test/image.png' }];
  const result = await reviewer.review(request);
  assert.equal(result.status, 'passed'); assert.equal(fallbackCalls, 1); assert.equal(preparationSignal?.aborted, true);
  assert.equal(result.evidence.requests[0].reasonCode, 'review_timeout');
  release(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls, 0);
});

test('chunks only requested independent criteria and preserves question order and versions', async () => {
  const batches: string[][] = [];
  const reviewer = createDecisionReviewer({ key: 'test', maxQuestionsPerRequest: 2, fetchImpl: async (_url, options) => {
    const questions = Object.keys(JSON.parse(String(options?.body)).questions);
    batches.push(questions);
    return resultResponse(Object.fromEntries(questions.map(id => [id, { type: 'noul', noul: 1 }])));
  } });
  const result = await reviewer.review(input(['a', 'b', 'c', 'd', 'e'].map(id => question(id))));
  assert.deepEqual(batches, [['a', 'b'], ['c', 'd'], ['e']]);
  assert.deepEqual(result.questions.map(q => q.id), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(result.questions.every(q => q.version === 'q1'));
});

test('editing the caller draft while review runs cannot alter the reviewer snapshot', async () => {
  const request = input();
  let release: () => void = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => { await barrier; return resultResponse({}); }, fallback: async snapshot => {
    assert.deepEqual(snapshot.draft, { title: 'One cup', quantity: 1 });
    assert.equal(snapshot.versions.draft, 'draft-hash');
    return fallbackResult(snapshot);
  } });
  const resultPromise = reviewer.review(request);
  (request.draft as { quantity: number }).quantity = 99;
  request.versions.draft = 'edited-hash';
  release();
  const result = await resultPromise;
  assert.equal(result.status, 'passed');
  assert.equal(result.evidence.versions.draft, 'draft-hash');
});

test('an explicit cancellation never starts fallback; invalid question identities never reach a provider', async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  let calls = 0;
  const reviewer = createDecisionReviewer({ key: 'test', fetchImpl: async () => { calls++; return resultResponse({}); },
    fallback: async request => { calls++; return fallbackResult(request); } });
  assert.equal((await reviewer.review(input(), cancelled.signal)).status, 'pending');
  assert.equal((await reviewer.review(input([question(), question()]))).status, 'pending');
  assert.equal(calls, 0);
});

test('empty semantic work passes without consuming a model request', async () => {
  const reviewer = createDecisionReviewer({ key: '', fetchImpl: async () => { throw new Error('must not call'); } });
  assert.equal((await reviewer.review(input([]))).status, 'passed');
});
