import type {BridgeIdentity,CapabilityDescriptor,CapabilityResult,DataProvenance,DatasetBinding,FailureInfo,Freshness,InvocationRequest,JsonValue,ResourceRef,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {SourceArtifact} from '../../presentation/src/types.ts';
import type {SourceComponentStore} from '../../source-components/src/index.ts';

/** The Runtime owns this port; neither a browser nor a Host plugin opens SQLite. */
export interface PresentationStore {
  get<T>(collection:string,id:string):T|undefined;
  put<T>(collection:string,id:string,value:T):T;
  list<T>(collection:string):T[];
  delete(collection:string,id:string):boolean;
  transaction<T>(action:()=>T):T;
}
export interface PresentationRuntime {
  invoke(request:InvocationRequest,signal?:AbortSignal):Promise<CapabilityResult>;
  describe(capabilityId:string,version?:string):CapabilityDescriptor|undefined;
}
export interface AppsView {
  viewId:string;
  ownerSessionId:string|null;
  title:string;
  design:JsonValue;
  bindings:DatasetBinding[];
  source?:SourceArtifact;
  createdAt:string;
  updatedAt:string;
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
}
