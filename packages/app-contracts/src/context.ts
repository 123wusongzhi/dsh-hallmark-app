import type {Freshness,JsonValue,SelectionEnvelope} from './index.ts';

/** A context update is local state; it never requests a model step. */
export interface ComponentContextUpdate {
  expectedContextRevision:number;
  selections:SelectionEnvelope[];
  summary?:string;
}
export interface ComponentContextSnapshot {
  snapshotId:string;
  sessionId:string;
  viewId:string;
  buildId:string;
  contextRevision:number;
  selections:SelectionEnvelope[];
  summary:string;
  createdAt:string;
  bindingEvidence:{bindingId:string;datasetId:string;datasetRevision:string;evidenceRef:string;sourceDataTime:string|null;freshness:Freshness}[];
}
export interface ComponentContextReceipt {
  status:'updated';
  contextRevision:number;
  snapshotId:string;
  snapshot:ComponentContextSnapshot;
}
export interface ComponentAgentRequest {text:string;expectedContextRevision:number}
export type ComponentAgentState='prepared'|'dispatching'|'accepted'|'unknown'|'failed';
/** accepted means native input was queued durably, not that a model consumed it. */
export interface ComponentAgentIntent {
  status:ComponentAgentState;
  requestId:string;
  sessionId:string;
  viewId:string;
  buildId:string;
  frameInstanceId:string;
  requestHash:string;
  text:string;
  /** Literal request and its pinned immutable context; also fixes the native content hash. */
  content:{type:'text';text:string}[];
  contentHash:string;
  contextSnapshotId:string|null;
  contextRevision:number;
  createdAt:string;
  updatedAt:string;
  receipt?:JsonValue;
  error?:JsonValue;
}
export type ComponentAgentReceipt=ComponentAgentIntent;
