import type {BridgeIdentity,DatasetBinding,JsonValue,ResourceRef,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {SourceArtifact} from '../../presentation/src/types.ts';
import type {SourceComponentStore} from '../../source-components/src/index.ts';
import type {PerformanceEvidence} from '../../source-components/src/authoring-performance.ts';
import type {AppsComponent,AppsView,PresentationStore,SaveAppsComponentOptions,WorkbenchContext,WorkbenchDataSourceRef} from './types.ts';

export type AuthoringState='editing'|'building'|'build_failed'|'previewing'|'preview_failed'|'publish_ready'|'mounting'|'mounted'|'failed_mount'|'cancelled'|'superseded'|'interrupted';
export interface FileEvidenceRef {path:string;sha256:string;bytes:number}
export interface AuthoringDraft {
  schemaVersion:1;draftId:string;ownerSessionId:string;viewId:string;workspacePath:string;sourceRevision:number;epoch:number;
  status:AuthoringState|'closed'|'discarded';createdAt:string;updatedAt:string;
  sourceComponentId?:string;selectedSourceRevision?:number;baseRevisionAtOpen?:number;
}
export interface AuthoringAttempt {
  attemptId:string;draftId:string;epoch:number;sourceRevision:number;state:AuthoringState;startedAt:string;expectedViewRevision:number;
  invocationRefs:string[];evidenceRefs:FileEvidenceRef[];terminalReason:string|null;
  buildReceiptId?:string;previewReceiptId?:string;publicationId?:string;requestHash?:string;
}
export interface BuildReceipt {
  schemaVersion:1;receiptId:string;attemptId:string;sourceRevision:number;sourceInputDigest:string;lockfileDigest:string;command:string[];cwd:string;
  toolchain:Record<string,string>;exitCode:number;startedAt:string;finishedAt:string;logRef:FileEvidenceRef;distDigest:string|null;
  archiveBuildId:string|null;fileManifestRef:FileEvidenceRef|null;inputUnchanged:boolean;verdict:'PASS'|'FAIL';
  executionKind?:'executed'|'reuse';executionId?:string;reusedFrom?:FileEvidenceRef;reuseVerifiedAt?:string;
}
export interface AuthoringAssertion {id:string;required:boolean;expected:string;actual:string|null;status:'PASS'|'FAIL'|'NOT_RUN'|'BLOCKED';evidenceRefs:FileEvidenceRef[]}
export interface PreviewViewportResult {
  id:string;contentWidthCssPx:number;heightCssPx:number;deviceScaleFactor:number;screenshot:FileEvidenceRef;
  pageErrors:string[];unhandledRejections:string[];failedRequests:string[];bridgeReady:boolean;assertionIds:string[];
  interactionCaseIds?:string[];
}
export interface PreviewReceipt {
  schemaVersion:1;receiptId:string;attemptId:string;buildReceiptId:string;buildId:string;protocol:'dsh.apps.component.v2';
  mode:'fixture'|'live_readonly';runnerVersion:string;startedAt:string;finishedAt:string;
  viewportResults:PreviewViewportResult[];assertionResults:AuthoringAssertion[];verdict:'PASS'|'FAIL'|'INCOMPLETE';
  /** Optional only for historical receipts; every new formal preview and publication validates it. */
  performance?:PerformanceEvidence;
}
/** An actual build runner must validate this report; a caller-authored exitCode JSON is insufficient. */
export interface BuildExecutionEvidence extends Omit<BuildReceipt,'receiptId'> {
  epoch:number;sourceInputDigestAfter:string;workspacePath:string;runnerVersion:string;executionId:string;
}
/** The runner freezes/validates archive bytes; viewport screenshots are actual browser captures. */
export interface PreviewValidationEvidence extends Omit<PreviewReceipt,'receiptId'> {
  epoch:number;
  validationProfile?:'draft'|'formal';
}
export interface ViewPublication {
  publicationId:string;viewId:string;ownerSessionId:string;attemptId:string;attemptEpoch:number;expectedViewRevision:number;
  candidateBuildId:string;priorActiveBuildId:string|null;state:'prepared'|'mounting'|'mounted'|'failed_mount'|'cancelled'|'superseded'|'interrupted';
  readyDeadlineAt:string|null;mountStartedAt?:string|null;evidenceRefs:FileEvidenceRef[];createdAt:string;updatedAt:string;
  buildReceiptId:string;previewReceiptId:string;source:SourceArtifact;frameInstanceId?:string;documentNonce?:string;
  committedViewRevision?:number;terminalReason?:string;
}
export interface AuthoringView extends AppsView {
  viewRevision:number;activeBuildId:string|null;lastGoodBuildId:string|null;previousGoodBuildId:string|null;
  pendingPublicationId:string|null;validationStatus:'draft_unpublished'|'legacy_unverified'|'verified';
}
export interface UiSelectionEvidence extends SelectionEnvelope {datasetId:string}
export interface UiStateSnapshot {
  sessionId:string;viewId:string;sourceBuildId:string;uiStateSchemaVersion:number;stateRevision:number;value:JsonValue;
  capturedAt:string;selectionEvidence:UiSelectionEvidence[];
}
export interface BeginAuthoringInput {
  mode:'new'|'edit'|'open_saved';viewId?:string;componentId?:string;revision?:number;workspacePath?:string;newCopy?:boolean;
  title?:string;bindings?:DatasetBinding[];sourceRefs?:Record<string,WorkbenchDataSourceRef>;context?:WorkbenchContext;invocationId?:string;attemptId?:string;
}
export interface AuthoringAttemptInput {attemptId:string;epoch:number}
export interface RecordBuildInput extends AuthoringAttemptInput {reportRef:FileEvidenceRef}
export interface RecordPreviewInput extends AuthoringAttemptInput {buildReceiptId:string;reportRef:FileEvidenceRef}
export interface PublishAuthoringInput extends AuthoringAttemptInput {viewId:string;expectedViewRevision:number;buildId:string;buildReceiptId:string;previewReceiptId:string;publicationId?:string}
/** Only an explicit UI open starts the readiness deadline for this fixed publication. */
export interface StartMountInput {viewId:string;publicationId:string;attemptId:string;attemptEpoch:number;buildId:string;expectedViewRevision:number}
/** UI display retries reuse a verified archive, independently of the authoring attempt. */
export interface OpenDisplayInput extends StartMountInput {displayId:string}
/** requestId/attempts/retryPolicy/cause describe the failing bridge request; they never change the failure classification by themselves. */
export interface DisplayError {phase:string;code:string;message:string;at?:string;requestId?:string;attempts?:number;retryPolicy?:string;cause?:string}
/** Wall-clock budget for one opened display to report ready; the same value stamps readyDeadlineAt and drives display_stalled. */
export const DISPLAY_READY_DEADLINE_MS=210_000;
/** await_display waits at most this long (kept under the 30s descriptor timeout). */
export const AWAIT_DISPLAY_DEFAULT_MS=20_000;
export const AWAIT_DISPLAY_MAX_MS=25_000;
export type AuthoringOutcome='in_progress'|'build_failed'|'preview_failed'|'build_passed'|'published_awaiting_display'|'awaiting_user_view'|'displaying'|'display_stalled'|'displayed'|'display_failed'|'superseded'|'cancelled'|'interrupted';
export interface AwaitDisplayInput {attemptId?:string;publicationId?:string;displayId?:string;waitMs?:number}
export interface ComponentDisplay extends OpenDisplayInput {
  ownerSessionId:string;generation:number;state:'opening'|'ready'|'failed'|'retired';view:AuthoringView;
  errors:DisplayError[];createdAt:string;updatedAt:string;readyAt?:string;frameInstanceId?:string;documentNonce?:string;
  /** Most recent confirmed document, retained as history when that document releases its slot. readyAt only describes the current document. */
  readyReceipt?:{frameInstanceId:string;documentNonce:string;readyAt:string};
  /** Server wall clock at open; absent on displays stored before the deadline existed (createdAt is then used). */
  openedAt?:string;readyDeadlineAt?:string;
}
export interface DisplayFrameAuthorizationInput extends FrameAuthorizationInput {viewId:string;displayId:string;displayGeneration:number}
export interface ReportDisplayErrorInput {viewId:string;publicationId:string;buildId:string;displayId:string;displayGeneration:number;error:DisplayError}
export interface FrameAuthorizationInput {
  publicationId:string;attemptId:string;attemptEpoch:number;buildId:string;frameInstanceId:string;documentNonce:string;
}
export interface RenderReadyInput extends FrameAuthorizationInput {
  viewId:string;checks:{rendered:boolean;bridgeReady:boolean;dataRead:boolean;unhandledErrors:string[];assertionResults:AuthoringAssertion[]};
}
export interface SaveAuthoringInput extends SaveAppsComponentOptions {viewId:string;expectedViewRevision:number;userRequest:string}
export interface UiStateExportInput {
  viewId:string;sourceBuildId:string;uiStateSchemaVersion:number;expectedStateRevision:number;value:JsonValue;
  selectionEvidence:UiSelectionEvidence[];
}
export interface UiStateRestoreInput {viewId:string;targetBuildId:string;uiStateSchemaVersion:number}
export interface ManageAuthoringComponentInput {componentId:string;expectedRevision:number;action:'rename'|'delete';title?:string}
export interface AuthoringPresentationPort {
  prepareViewData?(view:AppsView,publicationId?:string):void;
  ownedView(sessionId:string,viewId:string):AppsView;
  createView(sessionId:string,input:{title:string;design?:JsonValue;bindings?:DatasetBinding[];sourceRefs?:Record<string,WorkbenchDataSourceRef>;context?:WorkbenchContext;viewId?:string}):AppsView;
  openComponent(sessionId:string,componentId:string,options?:{revision?:number;directory?:string;context?:WorkbenchContext;newCopy?:boolean}):AppsView;
  canReuseSavedView?(view:AppsView):boolean;
  saveComponent(sessionId:string,viewId:string,userRequest:string,options:SaveAppsComponentOptions):AppsComponent;
  manageSaved?(input:Record<string,JsonValue>):JsonValue;
  validateSelection?(sessionId:string,viewId:string,selection:SelectionEnvelope):SelectionEnvelope;
  validateDisplaySelection?(sessionId:string,identity:CandidateFrameIdentity,selection:SelectionEnvelope):SelectionEnvelope;
}
export interface EvidenceValidationContext {draft:AuthoringDraft;attempt:AuthoringAttempt;sources:SourceComponentStore}
export interface AppsAuthoringOptions {
  store:PresentationStore;sources:SourceComponentStore;presentation:AuthoringPresentationPort;evidenceRoot?:string;
  validateBuildEvidence?:(reference:FileEvidenceRef,context:EvidenceValidationContext)=>Promise<BuildExecutionEvidence>|BuildExecutionEvidence;
  validatePreviewEvidence?:(reference:FileEvidenceRef,context:EvidenceValidationContext&{buildReceipt:BuildReceipt})=>Promise<PreviewValidationEvidence>|PreviewValidationEvidence;
  /** Notification follows the metadata commit; a runner cooperatively aborts this exact epoch. */
  onCancel?:(attemptId:string,epoch:number)=>void;
  /** Trusted offline restore aliases preserve immutable original receipt/report paths. */
  resolveEvidencePath?:(path:string)=>string;
  withEvidencePathScope?:(work:()=>void)=>void;
  clock?:()=>Date;readyTimeoutMs?:number;maxUiStateBytes?:number;
}
export type CandidateFrameIdentity=BridgeIdentity&{publicationId:string;attemptId:string;attemptEpoch:number;documentNonce:string;displayId?:string;displayGeneration?:number};
