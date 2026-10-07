/** Project-owned Host capability evidence. This is not a DSH SDK. */
export const HOST_CAPABILITIES = ['toolRegistration', 'toolDisposal', 'outputProjection', 'clientBridge', 'dynamicSchema', 'requestAgent', 'persistentContext'] as const;
export type HostCapability = typeof HOST_CAPABILITIES[number];
/** Opt-in to the exact installed contract verified by the isolated Host probes. */
export const NATIVE_SESSION_ADAPTERS = ['disabled','dsh-0.2.0-rc.2'] as const;
export type NativeSessionAdapterMode = typeof NATIVE_SESSION_ADAPTERS[number];
export type ProbeLevel = 'live' | 'fixture' | 'code' | 'not_run';
export interface CapabilityProbe {
  supported: boolean;
  evidenceLevel: ProbeLevel;
  signature?: string;
  reason?: string;
  evidence?: string[];
}
export interface HostCapabilityMatrix {
  hostVersion: string | null;
  capabilities: Partial<Record<HostCapability, CapabilityProbe>>;
}
/** Static source and test doubles never enable a production Host method. */
export function hasVerifiedHostCapability(matrix: HostCapabilityMatrix, capability: HostCapability): boolean {
  const probe = matrix.capabilities[capability];
  return probe?.supported === true && probe.evidenceLevel === 'live' && !!probe.signature;
}
export function hostFeatureModes(matrix: HostCapabilityMatrix) {
  return {
    discovery: hasVerifiedHostCapability(matrix, 'dynamicSchema') ? 'dynamic' as const : 'fixed_gateway' as const,
    requestAgent: hasVerifiedHostCapability(matrix, 'requestAgent'),
    updateContext: hasVerifiedHostCapability(matrix, 'persistentContext'),
    fallback: 'attachSelection_then_user_send' as const,
  };
}
export function requireHostCapability(matrix: HostCapabilityMatrix, capability: HostCapability): {status: 'failed'; error: {code: 'UNSUPPORTED_HOST_CAPABILITY'; message: string; retryable: false}} | undefined {
  if (hasVerifiedHostCapability(matrix, capability)) return undefined;
  const alternative = capability === 'dynamicSchema' ? '使用固定的应用发现、说明与调用工具。' : '可将所选内容附加到当前会话输入，再由用户发送。';
  return {status: 'failed', error: {code: 'UNSUPPORTED_HOST_CAPABILITY', message: `当前 DSH Host 尚未核实 ${capability}。${alternative}`, retryable: false}};
}
