import React,{useState} from 'react';
import {useApps} from '../../../packages/component-runtime/src/apps-react.tsx';
import type {ResourceRef} from '../../../packages/app-contracts/src/index.ts';

/** Ordinary TSX fixture: UI state remains local; explicit buttons are the only RPC actions. */
export default function Component(){
  const apps=useApps(),[descending,setDescending]=useState(false),[selected,setSelected]=useState(false),[receipt,setReceipt]=useState('');
  const packet=apps.data as unknown as {bindingId:string;revision:string;resources:ResourceRef[];bindings?:{bindingId:string;revision:string;resources:ResourceRef[]}[]}|undefined;
  const data=packet?.bindings?.[0]??packet;
  return <article>
    <button data-action="sort" onClick={()=>setDescending(value=>!value)}>{descending?'Descending':'Ascending'}</button>
    <button data-action="select" aria-pressed={selected} onClick={()=>setSelected(value=>!value)}>Select Note</button>
    <button data-action="invoke" disabled={apps.loading||!data?.resources.length} onClick={async()=>{const resource=data!.resources[0];const result=await apps.invokeCapability({appId:resource.appId,connectionId:resource.connectionId,capabilityId:'notes.notes.get',capabilityVersion:'1.0.0',input:{id:resource.resourceId},deadlineAt:new Date(Date.now()+10000).toISOString()});setReceipt(result.status);}}>Read selected Note</button>
    <button data-action="attach" disabled={!selected||!data} onClick={async()=>{const result=await apps.attachSelection({bindingId:data!.bindingId,datasetRevision:data!.revision,resources:data!.resources});setReceipt(result.status);}}>Attach selection for manual sending</button>
    <output>{receipt}</output>
  </article>;
}
