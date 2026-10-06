import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, type HelloContext } from './hello.ts';

test('hello registers live-contract-shaped output and returns exact execution session', async () => {
  let definition: Parameters<HelloContext['tools']['register']>[0] | undefined;
  apply({ tools: { register(tool) { definition = tool; return () => {}; } } });
  assert.equal(definition?.name, 'hello_echo');
  assert.equal(typeof definition?.output.render, 'function');
  assert.deepEqual(await definition!.execute({ text: 'hello' }, { agent: { id: 'session-A' }, signal: new AbortController().signal }), { echo: 'hello', sessionId: 'session-A' });
  assert.deepEqual(await definition!.execute({ text: 'hello' }, { signal: new AbortController().signal }), { echo: 'hello', sessionId: null });
  await assert.rejects(definition!.execute({ text: 3 }, { signal: new AbortController().signal }), /text must be string/);
});
