import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createDecisionImageProtocol } from '../../packages/service/src/decision-image-protocol.ts';
import { createDecisionReviewer } from '../../packages/service/src/decision-review.ts';
import type { SemanticReviewRequest } from '../../packages/app-contracts/src/business-review.ts';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t8sAAAAASUVORK5CYII=', 'base64');
const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
const request = (...urls: string[]): SemanticReviewRequest => ({
  source: { sku: 'red', subject: 'red cup' }, draft: { name: 'Red cup' }, versions: { source: 's1', draft: 'd1' },
  questions: [{ id: 'visual', version: '1', instructions: 'Compare supplied subjects.', passCriteria: 'Same subject.', failCriteria: 'Different subject.' }],
  images: urls.map((url, index) => ({ id: `image-${index}`, role: index ? 'draft' : 'source', url })),
});

test('actual HTTP image downloads become labeled top-level native data URL parts with a short reusable cache', async () => {
  let calls = 0;
  const server = createServer((_request, response) => { calls++; response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(png); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/image.png`;
    const protocol = createDecisionImageProtocol();
    const state = await protocol.buildState(request(url, url));
    assert.equal(calls, 1); assert.equal(typeof state[0], 'string');
    assert.equal(state[1], 'Image image-0 (source)'); assert.equal(state[3], 'Image image-1 (draft)');
    assert.deepEqual(state[2], { type: 'image_url', image_url: { url: dataUrl } });
    assert.deepEqual(state[4], state[2]);
    await protocol.buildState(request(url)); assert.equal(calls, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('cache expires, evicts by entry and byte budgets, and never retains failed image downloads', async () => {
  for (const limit of [{ maxCacheEntries: 1 }, { maxCacheBytes: png.length }]) {
    let calls = 0;
    const protocol = createDecisionImageProtocol({ ...limit, fetchImpl: async () => { calls++; return new Response(png, { headers: { 'content-type': 'image/png' } }); } });
    await protocol.buildState(request('https://example.test/a')); await protocol.buildState(request('https://example.test/b'));
    await protocol.buildState(request('https://example.test/a')); assert.equal(calls, 3);
  }
  let calls = 0;
  const protocol = createDecisionImageProtocol({ cacheTtlMs: 1, fetchImpl: async () => {
    calls++; return calls === 1 ? new Response('unavailable', { status: 503 }) : new Response(png, { headers: { 'content-type': 'image/png' } });
  } });
  await assert.rejects(protocol.buildState(request('https://example.test/image')), { code: 'decision_image_unavailable' });
  await protocol.buildState(request('https://example.test/image')); assert.equal(calls, 2);
  await new Promise(resolve => setTimeout(resolve, 5));
  await protocol.buildState(request('https://example.test/image')); assert.equal(calls, 3);
});

test('unsupported types, invalid pixel envelopes and bounded byte/count budgets never become image parts', async () => {
  await assert.rejects(createDecisionImageProtocol().buildState(request('data:image/gif;base64,R0lGODlh')), { code: 'decision_image_unsupported' });
  await assert.rejects(createDecisionImageProtocol().buildState(request('data:image/png;base64,aGVsbG8=')), { code: 'decision_image_invalid' });
  await assert.rejects(createDecisionImageProtocol().buildState(request(...Array(129).fill(dataUrl))), { code: 'decision_image_count_exceeded' });
  await assert.rejects(createDecisionImageProtocol({ maxImageBytes: png.length - 1 }).buildState(request(dataUrl)), { code: 'decision_image_too_large' });
  await assert.rejects(createDecisionImageProtocol({ maxRequestBytes: png.length }).buildState(request(dataUrl, dataUrl)), { code: 'decision_images_too_large' });
  await assert.rejects(createDecisionImageProtocol({ fetchImpl: async () => new Response(png, { headers: { 'content-type': 'image/gif' } }) }).buildState(request('https://example.test/image')), { code: 'decision_image_unsupported' });
  await assert.rejects(createDecisionImageProtocol({ maxImageBytes: png.length - 1,
    fetchImpl: async () => new Response(png, { headers: { 'content-type': 'image/png' } }),
  }).buildState(request('https://example.test/image')), { code: 'decision_image_too_large' });
});

test('image download timeout and unsupported formats retain actual images for independent fallback', async () => {
  for (const mode of ['timeout', 'gif'] as const) {
    let decisionCalls = 0, fallbackCalls = 0, downloadSignal: AbortSignal | undefined;
    const input = request(mode === 'gif' ? 'data:image/gif;base64,R0lGODlh' : 'https://example.test/image');
    const reviewer = createDecisionReviewer({ key: 'fixture', timeoutMs: 10,
      imageProtocol: createDecisionImageProtocol({ fetchImpl: async (_url, init) => { downloadSignal = init?.signal ?? undefined; return new Promise<Response>(() => {}); } }),
      fetchImpl: async () => { decisionCalls++; throw new Error('must not post'); },
      fallback: async input => { fallbackCalls++; assert.deepEqual(input.images, request(mode === 'gif' ? 'data:image/gif;base64,R0lGODlh' : 'https://example.test/image').images); return {
        reviewer: 'independent-agent', reviewerId: 'reviewer-1', model: 'vision', versions: input.versions,
        questions: input.questions.map(question => ({ id: question.id, version: question.version, status: 'pending' })),
      }; },
    });
    const result = await reviewer.review(input);
    assert.equal(result.status, 'pending'); assert.equal(decisionCalls, 0); assert.equal(fallbackCalls, 1);
    assert.equal(result.evidence.requests[0].reasonCode, mode === 'timeout' ? 'review_timeout' : 'decision_image_unsupported');
    if (mode === 'timeout') assert.equal(downloadSignal?.aborted, true);
  }
});
