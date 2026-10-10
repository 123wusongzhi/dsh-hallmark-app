import type {BridgeIdentity,CapabilityDescriptor,CapabilityResult,DataProvenance,DatasetBinding,FailureInfo,Freshness,InvocationRequest,JsonValue,ResourceRef,SelectionEnvelope,SessionAppBinding} from '../../app-contracts/src/index.ts';
import type {SourceArtifact} from '../../presentation/src/types.ts';
import type {SourceComponentStore} from '../../source-components/src/index.ts';
import type {AuthoringDraft} from './authoring-types.ts';

/** The Runtime owns this port; neither a browser nor a Host plugin opens SQLite. */
export interface PresentationStore {
  get<T>(collection:string,id:string):T|undefined;
  put<T>(collection:string,id:string,value:T):T;
  list<T>(collection:string):T[];
  /** Indexed exact matches supplied by RuntimeStore; simple fixture stores may omit it. */
  query?<T>(collection:string,filters:Record<string,string|number|boolean|null>):T[];
  collectionVersion?(collection:string):string;
  delete(collection:string,id:string):boolean;
  transaction<T>(action:()=>T):T;
}
export interface PresentationRuntime {
  invoke(request:InvocationRequest,signal?:AbortSignal):Promise<CapabilityResult>;
  describe(capabilityId:string,version?:string):CapabilityDescriptor|undefined;
  /** Saved content reuses existing connections in the explicit destination session. */
  getConnection?(appId:string,connectionId:string):{enabled:boolean;configRevision?:number}|undefined;
  bind?(binding:SessionAppBinding):SessionAppBinding;
  sessionBindings?(sessionId:string):SessionAppBinding[];
}
export interface AppsView {
  viewId:string;
  ownerSessionId:string|null;
  title:string;
  design:JsonValue;
  bindings:DatasetBinding[];
  /** Versioned library references; concrete bindings are rebuilt for the selected shop. */
  sourceRefs?:Record<string,WorkbenchDataSourceRef>;
  context?:WorkbenchContext;
  source?:SourceArtifact;
  createdAt:string;
  updatedAt:string;
  /** Closing a panel preserves its draft, immutable history and saved assets. */
  panelState?:'open'|'closed';
  closedAt?:string;
  sourceComponentId?:string;
  baseRevision?:number;
  /** Metadata revision at open is independent of the selected historical source revision. */
  baseRevisionAtOpen?:number;
  selectedSourceRevision?:number;
  viewRevision?:number;
  activeBuildId?:string|null;
  lastGoodBuildId?:string|null;
  previousGoodBuildId?:string|null;
  pendingPublicationId?:string|null;
  validationStatus?:'draft_unpublished'|'legacy_unverified'|'verified'|'failed';
  /** Read-only directory projection of the current draft; not part of persisted view/build evidence. */
  readonly authoringState?:AuthoringDraft['status'];
  readonly authoringUpdatedAt?:string;
  readonly authoringEpoch?:number;
}
export interface AppsComponent {
  componentId:string;
  revision:number;
  title:string;
  view:AppsView;
  userRequest:string;
  savedAt:string;
  legacyTemplate?:JsonValue;
  revisions?:{revision:number;title:string;savedAt:string;buildId?:string}[];
}
export interface DatasetSnapshot {
  datasetId:string;
  canonicalBinding:JsonValue;
  revision:string;
  payload:JsonValue;
  resources:ResourceRef[];
  fetchedAt:string;
  sourceDataTime:string|null;
  lastSuccessAt:string;
  freshness:Freshness;
  state:'ready'|'failed'|'unavailable';
  provenance:DataProvenance[];
  error?:FailureInfo;
}
export interface AppsBindingData {
  query?:import('../../app-contracts/src/index.ts').BindingQuery;
  bindingId:string;
  appId:string;
  connectionId:string;
  datasetId:string;
  revision:string|null;
  payload:JsonValue|null;
  resources:ResourceRef[];
  freshness:Freshness;
  state:'ready'|'failed'|'unavailable'|'empty';
  lastSuccessAt:string|null;
  sourceDataTime:string|null;
  provenance:DataProvenance[];
  error?:FailureInfo;
}
export interface AppsViewData {viewId:string;bindings:AppsBindingData[]}
export interface SaveAppsComponentOptions {mode:'save_as'|'update';componentId?:string;expectedRevision?:number;title?:string;legacyComponentId?:string;legacyTemplate?:JsonValue}
export interface AppsPresentationOptions {
  store:PresentationStore;
  runtime:PresentationRuntime;
  sources?:SourceComponentStore;
  /** Provider-owned resolver; no domain field assumptions are made by the shared service. */
  resources?:(binding:DatasetBinding,result:CapabilityResult)=>ResourceRef[];
  attachSelection?:(identity:BridgeIdentity,selection:SelectionEnvelope)=>Promise<JsonValue>|JsonValue;
  scheduledBinding?:(binding:DatasetBinding)=>void;
  /** Provider-owned suggestions. Each definition must pass a real read before registration. */
  dataSources?:()=>DataSourceDraft[];
}

export type FieldFormat='text'|'currency'|'percent'|'integer'|'datetime'|'image';
export interface FieldRole {key:string;label:string;description:string;format:FieldFormat;unit?:string}
export interface DataSourceField {
  /** Stable column identity; semantic roles may repeat across different sources. */
  key?:string;origin?:{source:string;label:string};
  path:string;role:string;confirmed:boolean;label?:string;description?:string;unit?:string;
  currency?:string;currencyPath?:string;percentScale?:'fraction'|'whole';numericScale?:number;
}
export interface DataSourceParameter {name:string;label:string;type:'string'|'number'|'integer'|'boolean';required?:boolean;default?:JsonValue;linked?:boolean;editable?:boolean;choices?:{label:string;value:string|number|boolean}[]}
export interface DataSourceOperations {
  pagination?:{cursorParam:string;limitParam?:string;nextCursorPath?:string;totalPath?:string};
  search:{scope:'server'|'loaded';param?:string};
  sort:{scope:'server'|'loaded';param?:string;directionParam?:string};
}
export interface DataSourceDraft {
  id:string;title:string;description?:string;appId:string;connectionId:string;capabilityId:string;capabilityMajor:number;
  /** Store is supplied by the workbench, never embedded in a reusable source. */
  storeScoped?:boolean;
  input:Record<string,JsonValue>;parameters:DataSourceParameter[];fields:DataSourceField[];rowsPath:string;operations:DataSourceOperations;
}
export interface DataSourceValidation {status:'verified'|'failed'|'unverified';checkedAt:string;invocationId?:string;sampleCount:number;issues:string[];empty?:boolean;storeId?:string}
export interface DataSourceDefinition extends DataSourceDraft {kind:'data_source';revision:number;validation:DataSourceValidation}
export interface WorkbenchContext {storeId:string}
export interface RegisterDataSourceInput {definition:DataSourceDraft;expectedRevision?:number;context?:WorkbenchContext;params?:Record<string,JsonValue>}
export interface ResolveDataSourceInput {id:string;revision:number;bindingId:string;context?:WorkbenchContext;params?:Record<string,JsonValue>}
export interface WorkbenchInstance {
  instanceId:string;title:string;materialId:string;materialVersion:number;design:JsonValue;
  dataSource?:WorkbenchDataSourceRef;
  dataSources?:Record<string,WorkbenchDataSourceRef>;
  /** Resolved on save, never accepted from the caller as authorization. */
  bindings?:DatasetBinding[];
  position:{order:number;span?:number};
}
/** A pinned library revision is a launcher, not another source checkout or data binding. */
export interface WorkbenchSavedComponent {componentId:string;revision:number;title:string;buildId?:string;hasPreview?:boolean;position?:{order:number}}
export interface Workbench {kind:'workbench';workbenchId:string;appId:string;revision:number;instances:WorkbenchInstance[];savedComponents?:WorkbenchSavedComponent[];updatedAt:string;context?:WorkbenchContext}
export interface SaveWorkbenchInput {expectedRevision:number;instances:WorkbenchInstance[];context?:WorkbenchContext}
export interface WorkbenchDataSourceRef {id:string;revision:number;params:Record<string,JsonValue>;/** Unsaved definition, accepted for preview and explicitly verified on save. */draft?:DataSourceDraft}
export interface ReadWorkbenchInstanceInput {refresh?:boolean;forceRefresh?:boolean;bindingId?:string;cursor?:string|null;params?:Record<string,JsonValue>;scope?:string;context?:WorkbenchContext}
export interface WorkbenchPage {cursor:string|null;nextCursor:string|null;hasMore:boolean;total?:number;loadedCount:number}
export interface WorkbenchInstanceData {instanceId:string;view:AppsView;data:AppsViewData;dataSource:DataSourceDefinition;dataSources:Record<string,DataSourceDefinition>;pages:Record<string,WorkbenchPage>}
