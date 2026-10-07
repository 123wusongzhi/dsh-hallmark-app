import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { composeAppsRuntime } from '../../packages/service/src/apps-main.ts';

test('composed Runtime abort reaches the Hallmark adapter fetch and releases the active read', { timeout: 5000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-hallmark-cancel-'));
  const originalFetch = globalThis.fetch, controller = new AbortController();
  const calls: string[] = []; let observedSignal: AbortSignal | undefined;
  let notifyStarted!: () => void;
  const started = new Promise<void>(resolve => { notifyStarted = resolve; });
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    if (path === '/api/health') return new Response(JSON.stringify({ service: 'hallmark-control' }), { status: 200 });
    assert.equal(path, '/api/stores'); observedSignal = options?.signal ?? undefined;
    assert.ok(observedSignal); notifyStarted();
    return new Promise<Response>((_resolve, reject) => {
      if (observedSignal!.aborted) reject(observedSignal!.reason);
      else observedSignal!.addEventListener('abort', () => reject(observedSignal!.reason), { once: true });
    });
  };
  let instance: ReturnType<typeof composeAppsRuntime> | undefined;
  try {
    instance = composeAppsRuntime(directory, { connections: [{ appId: 'hallmark', connectionId: 'c', displayName: 'Cancellation fixture', config: { baseUrl: 'http://127.0.0.1:3000' }, configRevision: 1, enabled: true }] });
    instance.runtime.bind({ sessionId: 's', appId: 'hallmark', connectionId: 'c', enabled: true, boundAt: new Date().toISOString() });
    const active = instance.runtime.invoke({ protocolVersion: '1.0', invocationId: 'cancel-read', traceId: 'cancel-trace', appId: 'hallmark', connectionId: 'c', capabilityId: 'hallmark.stores.list', capabilityVersion: '1.0.0', input: {}, source: { kind: 'agent', sessionId: 's', nativeCallId: 'read' }, deadlineAt: new Date(Date.now() + 3000).toISOString() }, controller.signal);
    await started; controller.abort(new Error('Fixture cancellation'));
    const result = await active; assert.equal(observedSignal!.aborted, true); assert.notEqual(result.status, 'ok');
    assert.deepEqual(calls, ['/api/health', '/api/stores']); assert.equal(instance.store.list('operations').length, 0);
  } finally {
    controller.abort(); await instance?.close(); globalThis.fetch = originalFetch;
    const verified = resolve(directory); assert.ok(verified.startsWith(resolve(tmpdir()) + sep) && verified.includes('dsh-hallmark-cancel-'));
    rmSync(verified, { recursive: true, force: true });
  }
});
