import test from 'node:test';
import assert from 'node:assert/strict';
import { BusinessDraftRecovery, BUSINESS_DRAFT_LIMITS as limits, type BusinessDraftSnapshot } from '../../packages/plugin-apps/client/business-draft-recovery.ts';
const draft = (text = 'unparsed control'): BusinessDraftSnapshot => ({ planId: 'plan-control', revision: 1, edits: {}, pricingEdits: {}, rawEdits: { field: text } });
const exact = (owner: string, bytes: number) => { const base = draft(''); const overhead = new TextEncoder().encode(JSON.stringify([owner, base])).byteLength; return draft('x'.repeat(bytes - overhead)); };

test('private recovery cache bounds owner count, exact byte sizes and lifetime, with explicit loss reasons', () => {
  let now = 1000; const cache = new BusinessDraftRecovery(() => now);
  assert.deepEqual(cache.put('owner-0', exact('owner-0', limits.entryBytes)), { retained: true, notice: undefined });
  assert.equal(cache.bytes, limits.entryBytes);
  assert.deepEqual(cache.put('oversize', exact('oversize', limits.entryBytes + 1)), { retained: false, notice: 'too_large' });
  assert.equal(cache.peek('oversize'), undefined);
  for (let i = 1; i < limits.owners; i++) cache.put('owner-' + i, exact('owner-' + i, limits.entryBytes));
  assert.equal(cache.size, limits.owners); assert.equal(cache.bytes, limits.totalBytes);
  assert.equal(cache.put('owner-next', draft()).notice, 'evicted'); assert.equal(cache.peek('owner-0'), undefined);
  assert.equal(cache.size, limits.owners); assert.ok(cache.bytes <= limits.totalBytes);
  now += limits.ttlMs - 1; assert.ok(cache.peek('owner-next')); now++;
  assert.equal(cache.peek('owner-next'), undefined, 'expired entries cannot be recovered before the next timer sweep');
  assert.equal(cache.prune(), true); assert.equal(cache.size, 0); assert.equal(cache.bytes, 0); assert.equal(cache.prune(), false);
});

test('cache snapshots are isolated copies and new oversized edits cannot leave a stale recoverable snapshot', () => {
  let now = 0; const cache = new BusinessDraftRecovery(() => now), input = draft();
  cache.put('owner', input); input.rawEdits.field = 'changed outside cache';
  const output = cache.peek('owner')!; output.rawEdits.field = 'changed through read'; assert.equal(cache.peek('owner')!.rawEdits.field, 'unparsed control');
  assert.equal(cache.put('owner', exact('owner', limits.entryBytes + 1)).retained, false); assert.equal(cache.peek('owner'), undefined);
  cache.put('owner', draft()); now += limits.ttlMs; assert.equal(cache.put('other', draft()).notice, 'expired');
  cache.drop('other'); assert.equal(cache.size, 0); cache.put('owner', draft()); cache.clear(); assert.equal(cache.size, 0);
});
