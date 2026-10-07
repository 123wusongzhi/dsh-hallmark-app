import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {BridgeIdentity,ComponentAgentIntent,ComponentAgentRequest,ComponentContextReceipt,ComponentContextSnapshot,ComponentContextUpdate,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {AppsBindingData,AppsView,AppsViewData,PresentationStore} from './types.ts';

interface ContextPort {
  store:PresentationStore;
  ownedView(sessionId:string,viewId:string):AppsView;
  getData(sessionId:string,viewId:string):AppsViewData;
  validateSelection(sessionId:string,viewId:string,value:SelectionEnvelope):SelectionEnvelope;
}
interface ContextRecord {kind:'snapshot';requestId:string;requestHash:string;snapshot:ComponentContextSnapshot;evidence:AppsBindingData[]}
interface ContextPointer {kind:'pointer';snapshotId:string}
const clone=<T>(value:T):T=>structuredClone(value);
const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const json=(value:unknown)=>JSON.parse(canonicalJson(value)) as JsonValue;
function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
function strict(value:unknown,allowed:string[],required:string[]):Record<string,unknown> {
  canonicalJson(value);
  if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_INPUT','A plain context request is required.');
  const input=value as Record<string,unknown>;
  if(Object.keys(input).some(key=>!allowed.includes(key))||required.some(key=>!Object.hasOwn(input,key)))fail('INVALID_INPUT','Context request fields do not match the contract.');
  return input;
}
const revision=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0)fail('INVALID_INPUT','A non-negative expectedContextRevision is required.');return Number(value);};
const identityKey=(sessionId:string,requestId:string)=>{
  if(!/^[-a-zA-Z0-9_.:]{1,160}$/.test(sessionId)||!/^[-a-zA-Z0-9_.:]{1,160}$/.test(requestId))fail('INVALID_INPUT','Explicit session and request identities are required.');
  return `${sessionId}:${requestId}`;
};

/** Runtime-owned immutable context evidence and one-shot native input intents. No Host or model calls. */
export class ComponentContexts {
  readonly port:ContextPort;
  constructor(port:ContextPort){this.port=port;}
  private current(identity:BridgeIdentity):AppsView {
    const view=this.port.ownedView(identity.sessionId,identity.viewId);
    if(!view.source||view.source.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component build changed.');
    return view;
  }
  private pointer(key:string):ContextRecord|undefined {
    const pointer=this.port.store.get<ContextPointer>('component_contexts',key);
    if(!pointer)return;
    const record=this.port.store.get<ContextRecord>('component_contexts',`snapshot:${pointer.snapshotId}`);
    if(!record||record.kind!=='snapshot')fail('CONTEXT_EVIDENCE_MISSING','The immutable context snapshot is unavailable.');
    return record;
  }
  active(sessionId:string):{sessionId:string;snapshot:ComponentContextSnapshot|null} {
    identityKey(sessionId,'context');
    const record=this.pointer(`active:${sessionId}`);
    if(record&&record.snapshot.sessionId!==sessionId)fail('CONTEXT_NOT_OWNED','Context belongs to another session.');
    return {sessionId,snapshot:record?clone(record.snapshot):null};
  }
  history(sessionId:string,snapshotId:string):{snapshot:ComponentContextSnapshot;evidence:AppsBindingData[]}|undefined {
    identityKey(sessionId,'context');
    const record=this.port.store.get<ContextRecord>('component_contexts',`snapshot:${snapshotId}`);
    if(!record||record.kind!=='snapshot')return;
    if(record.snapshot.sessionId!==sessionId)fail('CONTEXT_NOT_OWNED','Context belongs to another session.');
    return clone({snapshot:record.snapshot,evidence:record.evidence});
  }
  get(identity:BridgeIdentity):{sessionId:string;viewId:string;buildId:string;contextRevision:number;snapshotId:string|null} {
    const view=this.port.ownedView(identity.sessionId,identity.viewId);
    if(view.source&&view.source.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component build changed.');
    const record=this.pointer(`view:${identity.sessionId}:${identity.viewId}`);
    return {...identity,contextRevision:record?.snapshot.contextRevision??0,snapshotId:record?.snapshot.snapshotId??null};
  }
  update(identity:BridgeIdentity,requestId:string,value:ComponentContextUpdate):ComponentContextReceipt {
    this.current(identity);const key=identityKey(identity.sessionId,requestId);
    const input=strict(value,['expectedContextRevision','selections','summary'],['expectedContextRevision','selections']);
    const expected=revision(input.expectedContextRevision);
    if(!Array.isArray(input.selections)||input.selections.length>20)fail('INVALID_INPUT','Context selections must be a bounded array.');
    if(input.summary!==undefined&&(typeof input.summary!=='string'||Buffer.byteLength(input.summary)>2048))fail('INVALID_INPUT','Context summary exceeds its UTF8 budget.');
    const requestHash=digest({identity,params:value}),previous=this.port.store.get<{snapshotId:string;requestHash:string}>('component_contexts',`update:${key}`);
    if(previous){if(previous.requestHash!==requestHash)fail('IDEMPOTENCY_CONFLICT','The context request ID already has different input.');const record=this.history(identity.sessionId,previous.snapshotId);if(!record)fail('CONTEXT_EVIDENCE_MISSING','The original context snapshot is unavailable.');return {status:'updated',snapshotId:record.snapshot.snapshotId,contextRevision:record.snapshot.contextRevision,snapshot:record.snapshot};}
    const selections=(input.selections as SelectionEnvelope[]).map(selection=>this.port.validateSelection(identity.sessionId,identity.viewId,selection));
    if(new Set(selections.map(selection=>selection.bindingId)).size!==selections.length)fail('INVALID_INPUT','A binding can appear only once in a context update.');
    if(selections.reduce((count,selection)=>count+selection.resources.length,0)>20)fail('CONTEXT_BUDGET_EXCEEDED','Select at most twenty resources.');
    const data=this.port.getData(identity.sessionId,identity.viewId),evidence=selections.map(selection=>{
      const binding=data.bindings.find(binding=>binding.bindingId===selection.bindingId);
      if(!binding||binding.revision!==selection.datasetRevision)fail('DATASET_REVISION_STALE','The selected dataset revision changed.');
      return clone(binding);
    });
    return this.port.store.transaction(()=>{
      const current=this.pointer(`view:${identity.sessionId}:${identity.viewId}`);
      if((current?.snapshot.contextRevision??0)!==expected)fail('CONTEXT_REVISION_CONFLICT','The context revision changed. Read the current context first.');
      const snapshotId=randomUUID(),snapshot:ComponentContextSnapshot={snapshotId,sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,contextRevision:expected+1,selections:clone(selections),summary:typeof input.summary==='string'?input.summary:'',createdAt:new Date().toISOString(),bindingEvidence:evidence.map((binding,index)=>({bindingId:binding.bindingId,datasetId:binding.datasetId,datasetRevision:binding.revision!,evidenceRef:`${snapshotId}:${index}`,sourceDataTime:binding.sourceDataTime,freshness:binding.freshness}))};
      if(Buffer.byteLength(canonicalJson({kind:'dsh-apps-component-context',sessionId:identity.sessionId,snapshot}))>8192)fail('CONTEXT_BUDGET_EXCEEDED','Context projection exceeds 8192 UTF8 bytes. Reduce the selection or summary.');
      this.port.store.put('component_contexts',`snapshot:${snapshotId}`,{kind:'snapshot',requestId,requestHash,snapshot,evidence} satisfies ContextRecord);
      this.port.store.put('component_contexts',`view:${identity.sessionId}:${identity.viewId}`,{kind:'pointer',snapshotId});
      this.port.store.put('component_contexts',`active:${identity.sessionId}`,{kind:'pointer',snapshotId});
      this.port.store.put('component_contexts',`update:${key}`,{snapshotId,requestHash});
      this.port.store.put('artifact_refs',`context:${snapshotId}:build`,{ownerKind:'context',ownerId:snapshotId,targetKind:'build',targetId:identity.buildId});
      for(const binding of evidence)this.port.store.put('artifact_refs',`context:${snapshotId}:${binding.datasetId}`,{ownerKind:'context',ownerId:snapshotId,targetKind:'dataset',targetId:binding.datasetId});
      return clone({status:'updated',contextRevision:snapshot.contextRevision,snapshotId,snapshot});
    });
  }
  prepare(identity:BridgeIdentity,requestId:string,value:ComponentAgentRequest):ComponentAgentIntent {
    this.current(identity);const key=identityKey(identity.sessionId,requestId);
    const input=strict(value,['text','expectedContextRevision'],['text','expectedContextRevision']),expected=revision(input.expectedContextRevision);
    if(typeof input.text!=='string'||!input.text.trim()||Buffer.byteLength(input.text)>4096)fail('INVALID_INPUT','An explicit Agent request text of at most 4096 UTF8 bytes is required.');
    const requestHash=digest({identity,params:value}),previous=this.port.store.get<ComponentAgentIntent>('component_contexts',`agent:${key}`);
    if(previous){if(previous.requestHash!==requestHash)fail('IDEMPOTENCY_CONFLICT','The native request ID already has different input.');return clone(previous);}
    return this.port.store.transaction(()=>{
      const active=this.active(identity.sessionId).snapshot;
      if(expected===0?!!active:!active||active.contextRevision!==expected||active.viewId!==identity.viewId||active.buildId!==identity.buildId)fail('CONTEXT_REVISION_CONFLICT','Request the Agent only after publishing the current component context.');
      const content:{type:'text';text:string}[]=[{type:'text',text:input.text as string},...(active?[{type:'text' as const,text:canonicalJson({kind:'dsh-apps-component-request-context',requestId,snapshot:active})}]:[])];
      const now=new Date().toISOString(),intent:ComponentAgentIntent={status:'prepared',requestId,sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,frameInstanceId:identity.frameInstanceId,requestHash,text:input.text as string,content,contentHash:digest(content),contextSnapshotId:active?.snapshotId??null,contextRevision:active?.contextRevision??0,createdAt:now,updatedAt:now};
      return clone(this.port.store.put('component_contexts',`agent:${key}`,intent));
    });
  }
  intent(sessionId:string,requestId:string):ComponentAgentIntent|undefined {return clone(this.port.store.get<ComponentAgentIntent>('component_contexts',`agent:${identityKey(sessionId,requestId)}`));}
  dispatch(sessionId:string,requestId:string,requestHash:string):{dispatchGranted:boolean;intent:ComponentAgentIntent} {
    return this.port.store.transaction(()=>{
      const intent=this.intent(sessionId,requestId);if(!intent)fail('AGENT_REQUEST_NOT_FOUND','The prepared native request does not exist.');
      if(intent.requestHash!==requestHash)fail('IDEMPOTENCY_CONFLICT','The native request input hash differs.');
      if(intent.status!=='prepared')return {dispatchGranted:false,intent};
      // Recheck the context at the irreversible dispatch boundary.
      const active=this.active(sessionId).snapshot;
      if((active?.snapshotId??null)!==intent.contextSnapshotId)fail('CONTEXT_REVISION_CONFLICT','Context changed before native submission. Publish and request explicitly again.');
      intent.status='dispatching';intent.updatedAt=new Date().toISOString();
      return {dispatchGranted:true,intent:clone(this.port.store.put('component_contexts',`agent:${identityKey(sessionId,requestId)}`,intent))};
    });
  }
  receipt(sessionId:string,requestId:string,requestHash:string,state:'accepted'|'unknown'|'failed',receipt?:JsonValue,error?:JsonValue):ComponentAgentIntent {
    if(!['accepted','unknown','failed'].includes(state))fail('INVALID_INPUT','Invalid native request receipt state.');
    if(receipt!==undefined)json(receipt);if(error!==undefined)json(error);
    return this.port.store.transaction(()=>{
      const intent=this.intent(sessionId,requestId);if(!intent)fail('AGENT_REQUEST_NOT_FOUND','The prepared native request does not exist.');
      if(intent.requestHash!==requestHash)fail('IDEMPOTENCY_CONFLICT','The native request input hash differs.');
      if(['accepted','failed'].includes(intent.status)){if(intent.status!==state)fail('INVALID_AGENT_REQUEST_TRANSITION','A terminal native receipt cannot regress.');return intent;}
      if(!['dispatching','unknown'].includes(intent.status))fail('INVALID_AGENT_REQUEST_TRANSITION','A native receipt requires a persisted dispatch attempt.');
      if(state==='accepted'){
        if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))fail('INVALID_INPUT','A durable native receipt is required.');
        const proof=receipt as Record<string,JsonValue>;
        if(proof.accepted!==true||proof.durable!==true||proof.requestId!==requestId||proof.sessionId!==sessionId||!['agent/inbox/spliced','user/message'].includes(String(proof.eventType))||!Number.isSafeInteger(proof.eventSeq)||Number(proof.eventSeq)<0||proof.contentHash!==intent.contentHash)fail('INVALID_NATIVE_RECEIPT','The receipt must identify the original durable native input and content.');
      }
      intent.status=state;intent.updatedAt=new Date().toISOString();if(receipt!==undefined)intent.receipt=clone(receipt);if(error!==undefined)intent.error=clone(error);
      return clone(this.port.store.put('component_contexts',`agent:${identityKey(sessionId,requestId)}`,intent));
    });
  }
}
