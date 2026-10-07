import type {JsonValue,SelectionEnvelope} from './index.ts';
/** Browser-facing authoring contracts have no Runtime or filesystem implementation dependency. */
export interface FileEvidenceRef {path:string;sha256:string;bytes:number}
export interface AuthoringAssertion {id:string;required:boolean;expected:string;actual:string|null;status:'PASS'|'FAIL'|'NOT_RUN'|'BLOCKED';evidenceRefs:FileEvidenceRef[]}
export interface UiSelectionEvidence extends SelectionEnvelope {datasetId:string}
export interface UiStateSnapshot {sessionId:string;viewId:string;sourceBuildId:string;uiStateSchemaVersion:number;stateRevision:number;value:JsonValue;capturedAt:string;selectionEvidence:UiSelectionEvidence[]}
