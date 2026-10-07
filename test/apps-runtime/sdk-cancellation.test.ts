import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppsClient, HttpRuntimeTransport } from '../../packages/app-sdk/src/index.ts';
import { NOTES_DESCRIPTORS } from '../../packages/app-notes/src/index.ts';
import type { CapabilityResult, InvocationRequest } from '../../packages/app-contracts/src/index.ts';

const descriptor = NOTES_DESCRIPTORS.find(item => item.capabilityId === 'notes.notes.create')!;
const ref = { appId: 'notes', connectionId: 'fixture' };
const source = { kind: 'agent', sessionId: 'fixture-session', nativeCallId: 'fixture-call' } as const;
const payload = { title: 'Cancellation fixture', content: 'No external side effect' };
const identity = { transportMajor: 1, catalogSchemaVersion: 1, catalogDigest: 'fixture' };
const evidence: Record<string, unknown>[] = [];
const route = (input: Parameters<typeof fetch>[0]) => new URL(String(input)).pathname;
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const transport = (fetcher: typeof fetch) => new HttpRuntimeTransport('http://127.0.0.1:9999', 'fixture-token', fetcher);
function record(name: string, facts: Record<string, unknown>): void { evidence.push({ name, status: 'PASS', ...facts }); }
function cancelled(result: CapabilityResult): void {
  assert.equal(result.status, 'cancelled', JSON.stringify(result));
  assert.ok('error' in result); assert.equal(result.error.code, 'CANCELLED_BEFORE_DISPATCH');
  assert.equal(result.operation, undefined); assert.equal(result.error.retryPolicy, 'never');
}
/** The spy stays pending until its actual fetch signal aborts; guard prevents a broken implementation hanging the suite. */
function waitForAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  assert.ok(signal, 'Every network read must receive a bounded signal');
  return new Promise((_resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('FETCH_ABORT_NOT_PROPAGATED')), 1500);
    const abort = () => { clearTimeout(timeout); reject(signal.reason ?? new Error('ABORTED')); };
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
after(() => {
  const root = process.env.APPS_SDK_CANCELLATION_EVIDENCE_DIR; if (!root) return;
  mkdirSync(resolve(root), { recursive: true });
  writeFileSync(join(resolve(root), 'sdk-cancellation.json'), JSON.stringify({ kind: 'synthetic_fetch_spy', executedAt: new Date().toISOString(), nodeVersion: process.version, testFile: 'test/apps-runtime/sdk-cancellation.test.ts', status: evidence.length === 9 ? 'PASS' : 'INCOMPLETE', results: evidence, realRuntimeNetwork: 'NOT_RUN', realBusinessMutation: 'NOT_RUN' }, null, 2));
});

test('SDK already-aborted call returns before identity and submits no mutation', async () => {
  let fetches = 0; const controller = new AbortController(); controller.abort(new Error('Already cancelled'));
  const client = new AppsClient(transport(async () => { fetches++; throw new Error('No HTTP call is allowed'); }), source);
  const result = await client.invoke(ref, descriptor, payload, { signal: controller.signal, idempotencyKey: 'pre-cancel', invocationId: 'pre-cancel' });
  cancelled(result); assert.equal(fetches, 0); assert.equal(result.invocationId, 'pre-cancel');
  record('already_cancelled', { fetches, mutationPosts: 0, status: result.status });
});

test('SDK expired absolute deadline returns before identity and submits no mutation', async () => {
  let fetches = 0; const deadlineAt = new Date(Date.now() - 1).toISOString();
  const client = new AppsClient(transport(async () => { fetches++; throw new Error('Expired calls cannot read identity'); }), source, { deadlineAt });
  const result = await client.invoke(ref, descriptor, payload, { idempotencyKey: 'expired', invocationId: 'expired' });
  cancelled(result); assert.equal(fetches, 0);
  record('expired_absolute_deadline', { fetches, mutationPosts: 0, status: result.status });
});

test('SDK absolute deadline aborts stalled identity fetch before any mutation POST', { timeout: 2500 }, async () => {
  const calls: { path: string; method: string }[] = []; let observed: AbortSignal | null | undefined;
  const client = new AppsClient(transport(async (input, options) => { calls.push({ path: route(input), method: options?.method ?? 'GET' }); observed = options?.signal; return waitForAbort(observed); }), source, { deadlineAt: new Date(Date.now() + 40).toISOString() });
  const result = await client.invoke(ref, descriptor, payload, { idempotencyKey: 'deadline', invocationId: 'deadline' });
  cancelled(result); assert.equal(observed?.aborted, true); assert.deepEqual(calls, [{ path: '/v1/runtime', method: 'GET' }]);
  record('handshake_absolute_deadline', { calls, fetchSignalAborted: observed?.aborted, mutationPosts: 0, status: result.status });
});

test('SDK cancellation during identity reaches its fetch and submits no mutation', { timeout: 2500 }, async () => {
  const controller = new AbortController(), calls: string[] = []; let observed: AbortSignal | null | undefined;
  let started!: () => void; const activeFetch = new Promise<void>(resolve => { started = resolve; });
  const client = new AppsClient(transport(async (input, options) => { calls.push(route(input)); observed = options?.signal; started(); return waitForAbort(observed); }), source);
  const active = client.invoke(ref, descriptor, payload, { signal: controller.signal, idempotencyKey: 'active-cancel', invocationId: 'active-cancel' });
  await activeFetch; controller.abort(new Error('Fixture cancellation')); const result = await active;
  cancelled(result); assert.equal(observed?.aborted, true); assert.deepEqual(calls, ['/v1/runtime']);
  record('handshake_external_cancellation', { calls, fetchSignalAborted: observed?.aborted, mutationPosts: 0, status: result.status });
});

test('SDK incompatible identity returns expected/actual protocol details and zero mutation POST', async () => {
  const calls: { path: string; method: string }[] = [];
  const client = new AppsClient(transport(async (input, options) => { calls.push({ path: route(input), method: options?.method ?? 'GET' }); return response({ ...identity, transportMajor: 2, catalogSchemaVersion: 3 }); }), source);
  const result = await client.invoke(ref, descriptor, payload, { idempotencyKey: 'incompatible' });
  assert.equal(result.status, 'failed'); assert.ok('error' in result); assert.equal(result.error.code, 'INCOMPATIBLE_PROTOCOL');
  assert.deepEqual(result.error.details, { expected: { transportMajor: 1, catalogSchemaVersion: 1 }, actual: { transportMajor: 2, catalogSchemaVersion: 3 } });
  assert.deepEqual(calls, [{ path: '/v1/runtime', method: 'GET' }]);
  record('incompatible_handshake', { calls, mutationPosts: 0, status: result.status });
});

test('SDK unavailable identity returns an explicit pre-dispatch failure and zero mutation POST', async () => {
  const calls: string[] = [];
  const client = new AppsClient(transport(async input => { calls.push(route(input)); throw new Error('Runtime unavailable'); }), source);
  const result = await client.invoke(ref, descriptor, payload, { idempotencyKey: 'offline' });
  assert.equal(result.status, 'unavailable'); assert.ok('error' in result); assert.equal(result.error.code, 'RUNTIME_UNAVAILABLE_BEFORE_DISPATCH');
  assert.equal(result.operation, undefined); assert.deepEqual(calls, ['/v1/runtime']);
  record('unavailable_handshake', { calls, mutationPosts: 0, status: result.status });
});

test('SDK preserves the original absolute deadline after a completed identity handshake', async () => {
  const calls: string[] = [], deadlineAt = new Date(Date.now() + 1000).toISOString(); let submitted: InvocationRequest | undefined;
  const client = new AppsClient(transport(async (input, options) => {
    calls.push(route(input)); assert.ok(options?.signal);
    if (route(input) === '/v1/runtime') { await new Promise(resolve => setTimeout(resolve, 20)); return response(identity); }
    assert.equal(route(input), '/v1/invocations'); assert.equal(options.method, 'POST'); submitted = JSON.parse(String(options.body)) as InvocationRequest;
    return response({ status: 'ok', invocationId: submitted.invocationId, traceId: submitted.traceId, data: { fixture: true } });
  }), source, { deadlineAt });
  const result = await client.invoke(ref, descriptor, payload, { idempotencyKey: 'absolute', invocationId: 'absolute' });
  assert.equal(result.status, 'ok'); assert.equal(submitted?.deadlineAt, deadlineAt); assert.deepEqual(calls, ['/v1/runtime', '/v1/invocations']);
  record('deadline_preserved_after_handshake', { calls, deadlineAtPreserved: submitted?.deadlineAt === deadlineAt, mutationPosts: 1, status: result.status });
});

const mutationRequest = (invocationId: string, deadlineAt = new Date(Date.now() + 1000).toISOString()): InvocationRequest => ({ protocolVersion: '1.0', invocationId, traceId: `trace:${invocationId}`, ...ref, capabilityId: descriptor.capabilityId, capabilityVersion: descriptor.version, input: payload, source, deadlineAt, idempotencyKey: invocationId });
test('direct transport losing a known mutation response reads the original attempt without a second POST', async () => {
  const request = mutationRequest('response-lost'), calls: { path: string; method: string }[] = [];
  const original: CapabilityResult = { status: 'ok', invocationId: request.invocationId, traceId: request.traceId, operation: { operationId: 'original-operation', state: 'succeeded' }, data: { fixture: true } };
  const direct = transport(async (input, options) => {
    const path = route(input); calls.push({ path, method: options?.method ?? 'GET' });
    if (path === '/v1/invocations') { assert.equal(options?.method, 'POST'); throw new Error('Lost response after acceptance'); }
    assert.equal(path, '/v1/invocations/response-lost'); assert.equal(options?.method, 'GET'); return response({ invocationId: request.invocationId, operationId: 'original-operation', result: original });
  });
  const result = await direct.invoke(request); assert.deepEqual(result, original);
  assert.deepEqual(calls, [{ path: '/v1/invocations', method: 'POST' }, { path: '/v1/invocations/response-lost', method: 'GET' }]);
  record('lost_mutation_response', { calls, mutationPosts: 1, originalInvocationIdPreserved: result.invocationId === request.invocationId, originalOperationIdPreserved: result.operation?.operationId === 'original-operation' });
});

test('direct mutation deadline aborts POST and keeps read-only recovery bounded without resubmission', { timeout: 2500 }, async () => {
  const request = mutationRequest('post-deadline', new Date(Date.now() + 40).toISOString()), calls: { path: string; method: string }[] = [], signals: AbortSignal[] = [];
  const direct = transport(async (input, options) => { calls.push({ path: route(input), method: options?.method ?? 'GET' }); assert.ok(options?.signal); signals.push(options.signal); return waitForAbort(options.signal); });
  const result = await direct.invoke(request); assert.equal(result.status, 'unavailable'); assert.ok('error' in result);
  assert.equal(result.error.retryPolicy, 'inspect_only'); assert.deepEqual(result.error.details, { invocationId: request.invocationId, doNotResubmitMutation: true });
  assert.deepEqual(calls, [{ path: '/v1/invocations', method: 'POST' }, { path: '/v1/invocations/post-deadline', method: 'GET' }]); assert.equal(signals.every(signal => signal.aborted), true);
  record('dispatched_mutation_deadline', { calls, fetchSignalsAborted: signals.every(signal => signal.aborted), mutationPosts: 1, retryPolicy: result.error.retryPolicy, originalInvocationId: result.invocationId });
});
