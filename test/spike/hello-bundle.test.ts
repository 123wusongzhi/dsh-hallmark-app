import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { apply } from './hello-bundle/lib/index.js';

test('installable hello uses fixed read-only health and session-derived metadata', async () => {
  let tool: any;
  apply({ tools: { register(value: unknown) { tool = value; return () => {}; } } });
  const original = globalThis.fetch;
  const requests: unknown[] = [];
  globalThis.fetch = (async (url, init) => { requests.push([url, init?.method]); return new Response('{"service":"hallmark-control"}', { status: 200 }); }) as typeof fetch;
  try {
    const result = await tool.execute({ text: 'runtime hello' }, { agent: { id: 'test-A' }, signal: new AbortController().signal });
    assert.equal(result.echo, 'runtime hello');
    assert.equal(result.sessionId, 'test-A');
    assert.equal(result.hallmarkHealth.status, 'ok');
    assert.deepEqual(requests, [['http://127.0.0.1:4173/api/health', 'GET']]);
    assert.deepEqual(tool.output.presentationMeta({}, result), { helloSpike: result });
    assert.equal(tool.output.render({}, result)[0].type, 'text');
  } finally { globalThis.fetch = original; }
});

test('npm client factory registers only new scoped slots and reads block.meta', () => {
  let registration: any;
  runInNewContext(readFileSync(new URL('./hello-bundle/client/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value: unknown) { registration = value; } } }, console });
  const React = { createElement(type: unknown, props: unknown, ...children: unknown[]) { return { type, props, children }; }, useState() { return [false, () => {}]; } };
  const client = registration.factory((id: string) => { assert.equal(id, 'react'); return React; });
  const entries: any[] = [];
  client.apply({ slots: { inject(_name: string, callback: () => unknown) { return callback(); }, register(options: unknown, component: unknown) { entries.push({ options, component }); return () => {}; } } });
  assert.deepEqual(JSON.parse(JSON.stringify(entries.map(e => e.options))), [
    { name: 'conversation.input.left', id: 'hallmark.hello', order: 80, label: 'Hello 应用' },
    { name: 'tool.call.toolview', key: 'hello_echo' },
  ]);
  const tree = entries[1].component({ phase: 'result', sessionId: 'test-A', block: { meta: { helloSpike: { echo: 'echo-from-meta', sessionId: 'test-A', hallmarkHealth: { status: 'ok' } } } } });
  assert.match(JSON.stringify(tree), /echo-from-meta/);
});
