import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DataTransfers } from '../../packages/app-presentation/src/data-transfers.ts';
import { createDataTransferReader } from '../../packages/component-runtime/src/data-transfer-client.ts';
import type { JsonValue } from '../../packages/app-contracts/src/index.ts';

const row = (text: string): JsonValue => ({ viewId: 'view', bindings: [{ bindingId: 'main', appId: 'app', connectionId: 'connection', payload: { text }, resources: [] }] });

test('chunk byte copy preserves control characters, extended Unicode, chunk boundaries and caller isolation', async () => {
  const source = row((String.fromCharCode(...Array.from({ length: 256 }, (_, index) => index)) + '中文𠮷😀').repeat(1024));
  const transfers = new DataTransfers(); let reads = 0;
  const reader = createDataTransferReader(async (action, params) => {
    const input = params as Record<string, JsonValue>;
    if (action === 'prepare') return transfers.prepare('owner', source, typeof input.knownRevision === 'string' ? input.knownRevision : undefined);
    reads++; return transfers.read('owner', String(input.id), Number(input.index));
  });
  const first = await reader({ method: 'getData' });
  assert.deepEqual(first, source); assert.ok(reads > 1, 'the production server chose multiple chunks');
  (first as any).bindings[0].payload.text = 'caller mutation';
  const before = reads; assert.deepEqual(await reader({ method: 'getData' }), source); assert.equal(reads, before, 'unchanged read remains metadata-only');
});

test('chunk decoding retains malformed base64 and verified invalid UTF-8/JSON failures', async () => {
  for (const defect of ['base64', 'utf8', 'json'] as const) {
    const bytes = defect === 'utf8' ? Buffer.from([255]) : Buffer.from('{"bindings":');
    const revision = createHash('sha256').update(bytes).digest('hex');
    const reader = createDataTransferReader(async (action): Promise<JsonValue> => action === 'prepare'
      ? { kind: 'dsh.data-transfer.v1', revision, metadata: { bindings: [{ bindingId: 'main' }] }, transfer: { id: 'transfer', bytes: bytes.length, chunks: 1 } }
      : { id: 'transfer', index: 0, revision, chunk: defect === 'base64' ? '%%%' : bytes.toString('base64') });
    await assert.rejects(reader({ method: 'getData' }), error => {
      assert.equal((error as Error).name, defect === 'base64' ? 'InvalidCharacterError' : defect === 'utf8' ? 'TypeError' : 'SyntaxError'); return true;
    });
  }
});
