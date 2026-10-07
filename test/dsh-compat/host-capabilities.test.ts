import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasVerifiedHostCapability, hostFeatureModes, requireHostCapability, type HostCapabilityMatrix} from '../../packages/dsh-compat/src/index.ts';

test('unverified Host capabilities use fixed discovery and explicit unsupported results', () => {
  const matrix: HostCapabilityMatrix = {hostVersion: '0.2.0-rc.2', capabilities: {dynamicSchema: {supported: false, evidenceLevel: 'not_run'}, requestAgent: {supported: false, evidenceLevel: 'not_run'}, persistentContext: {supported: false, evidenceLevel: 'not_run'}}};
  assert.deepEqual(hostFeatureModes(matrix), {discovery: 'fixed_gateway', requestAgent: false, updateContext: false, fallback: 'attachSelection_then_user_send'});
  for (const capability of ['dynamicSchema', 'requestAgent', 'persistentContext'] as const) {
    const result = requireHostCapability(matrix, capability);
    assert.equal(result?.error.code, 'UNSUPPORTED_HOST_CAPABILITY');
    assert.equal(result?.error.retryable, false);
  }
});

test('code and fixture signatures cannot enable production Host methods', () => {
  for (const evidenceLevel of ['code', 'fixture', 'not_run'] as const) {
    const matrix: HostCapabilityMatrix = {hostVersion: 'synthetic', capabilities: {requestAgent: {supported: true, evidenceLevel, signature: 'synthetic.submit(input)'}}};
    assert.equal(hasVerifiedHostCapability(matrix, 'requestAgent'), false);
    assert.equal(hostFeatureModes(matrix).requestAgent, false);
  }
});

test('a supported Host fixture exercises the verified evidence path without being live acceptance', () => {
  // Synthetic matrix shape only: this test is not evidence that the installed DSH supports these methods.
  const matrix: HostCapabilityMatrix = {hostVersion: 'synthetic', capabilities: {dynamicSchema: {supported: true, evidenceLevel: 'live', signature: 'fixture.schemas(scope)'}, requestAgent: {supported: true, evidenceLevel: 'live', signature: 'fixture.submit(input)'}, persistentContext: {supported: true, evidenceLevel: 'live', signature: 'fixture.persist(context)'}}};
  assert.deepEqual(hostFeatureModes(matrix), {discovery: 'dynamic', requestAgent: true, updateContext: true, fallback: 'attachSelection_then_user_send'});
  assert.equal(requireHostCapability(matrix, 'requestAgent'), undefined);
  matrix.capabilities.requestAgent!.signature = undefined;
  assert.equal(requireHostCapability(matrix, 'requestAgent')?.error.code, 'UNSUPPORTED_HOST_CAPABILITY');
});
