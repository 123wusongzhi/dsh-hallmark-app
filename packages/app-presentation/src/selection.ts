import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {AppsViewData} from './types.ts';
/** Shared by the real host and preview; validation never sends a chat message. */
export function validateDataSelection(data:AppsViewData,envelope:SelectionEnvelope):SelectionEnvelope {
 const fail=(code:string,message:string):never=>{throw Object.assign(new Error(message),{code});};
 const binding=data.bindings.find(item=>item.bindingId===envelope?.bindingId);
 if(!binding)return fail('BINDING_NOT_FOUND','Selection binding is not part of this view.');
 if(typeof envelope.datasetRevision!=='string'||binding.revision!==envelope.datasetRevision||binding.state!=='ready')fail('SELECTION_STALE','Refresh and select resources from the current ready dataset.');
 if(!Array.isArray(envelope.resources)||!envelope.resources.length)fail('INVALID_SELECTION','At least one ResourceRef is required.');
 const seen=new Set<string>(),available=new Set(binding.resources.map(resource=>canonicalJson(resource)));
 for(const resource of envelope.resources){
  if(resource.appId!==binding.appId||resource.connectionId!==binding.connectionId||!resource.resourceType||!resource.resourceId)fail('INVALID_RESOURCE_REFERENCE','Resource identity must match its explicit binding.');
  const key=canonicalJson(resource);if(seen.has(key))fail('AMBIGUOUS_RESOURCES','Dataset contains duplicate resource identities.');seen.add(key);
  if(!available.has(key))fail('SELECTION_STALE','Selected resource is not present in the current dataset.');
 }
 return structuredClone(envelope);
}
