import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ownedPublication,openOwnedPublicationDisplay,readOwnedDisplay} from '../../packages/plugin-apps/client/native-display.ts';
import type {AuthoringView,ComponentDisplay,ViewPublication} from '../../packages/app-presentation/src/authoring-types.ts';
const source={buildId:'P1-build',directory:'/verified/P1',entry:'index.html',files:['index.html'],protocol:'dsh.apps.component.v2' as const};
const publication={publicationId:'P1',viewId:'V',ownerSessionId:'A',attemptId:'attempt',attemptEpoch:1,expectedViewRevision:2,candidateBuildId:source.buildId,source,state:'prepared',readyDeadlineAt:null,priorActiveBuildId:null,evidenceRefs:[],createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',buildReceiptId:'build-receipt',previewReceiptId:'preview-receipt'} satisfies ViewPublication;
const view={viewId:'V',ownerSessionId:'A',viewRevision:2,title:'Original snapshot',bindings:[],source} as unknown as AuthoringView;
const display=(id:string,generation=1)=>({...publication,buildId:source.buildId,displayId:id,generation,state:'opening',view,errors:[]} as unknown as ComponentDisplay);
async function httpFixture(action:(state:{origin:string;calls:any[];records:ComponentDisplay[];setLoseResponse:()=>void;setOwner:(owner:string)=>void})=>Promise<void>){
 const actualFetch=fetch,calls:any[]=[],records:ComponentDisplay[]=[];let loseResponse=false,owner='A';
 const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);calls.push(body);let value:any,status=200;
  if(body.operation==='openDisplay'){records.push({...display(body.params.displayId,records.length+1),ownerSessionId:owner});value=loseResponse?{error:{code:'RESPONSE_LOST',message:'response lost'}}:{publication,display:records.at(-1),source,view};if(loseResponse)status=503;}
  else if(body.operation==='inspect')value={publication,latestDisplay:records.at(-1)??null,displays:records};else{status=404;value={error:{message:'unexpected route'}};}
  res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));
 });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+((server.address() as any).port);globalThis.fetch=(input,init)=>actualFetch(new URL(String(input),origin),init);
 try{await action({origin,calls,records,setLoseResponse:()=>{loseResponse=true;},setOwner:value=>{owner=value;}});}finally{globalThis.fetch=actualFetch;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));assert.equal(server.listening,false);}
}
test('every explicit click creates its fixed P1 display generation without using the latest P2 candidate',()=>httpFixture(async f=>{
 const target={sessionId:'A',viewId:'V',publicationId:'P1',buildId:'P1-build'};const pinned=ownedPublication(target,{...view,pendingPublicationId:'P2',source:{...source,buildId:'P2-build'},publication});
 await openOwnedPublicationDisplay({...target,displayId:'first'},pinned,()=>true,new AbortController().signal);await openOwnedPublicationDisplay({...target,displayId:'second'},pinned,()=>true,new AbortController().signal);
 assert.equal(f.calls.length,2);assert.ok(f.calls.every(row=>row.operation==='openDisplay'&&row.params.publicationId==='P1'&&row.params.buildId==='P1-build'&&row.params.expectedViewRevision===2));assert.deepEqual(f.records.map(row=>row.displayId),['first','second']);assert.deepEqual(f.records.map(row=>row.generation),[1,2]);
}));
test('response loss inspects only the original click id and never repeats openDisplay',()=>httpFixture(async f=>{
 f.setLoseResponse();const target={sessionId:'A',viewId:'V',publicationId:'P1',buildId:'P1-build',displayId:'original-click'};
 const value=await openOwnedPublicationDisplay(target,publication,()=>true,new AbortController().signal);assert.equal(value.display.displayId,'original-click');assert.equal(f.calls.filter(row=>row.operation==='openDisplay').length,1);assert.equal(f.calls.filter(row=>row.operation==='inspect').length,1);assert.equal(f.calls.at(-1).params.publicationId,'P1');
}));
test('read-only display recovery rejects a stale generation or another session without reviving it',()=>httpFixture(async f=>{
 f.records.push(display('old'),display('new',2));await assert.rejects(readOwnedDisplay({sessionId:'A',viewId:'V',publicationId:'P1',displayId:'old'},publication,new AbortController().signal),/新的打开操作/);
 f.records[1].ownerSessionId='B';await assert.rejects(readOwnedDisplay({sessionId:'A',viewId:'V',publicationId:'P1',displayId:'new'},publication,new AbortController().signal),/展示身份不一致/);assert.ok(f.calls.every(row=>row.operation==='inspect'));
}));
test('ended authoring candidates remain unavailable but old failed display attempts can be explicitly reopened',()=>{
 for(const state of ['failed_mount','interrupted','prepared','mounted'] as const)assert.equal(ownedPublication({sessionId:'A',viewId:'V',publicationId:'P1'},{...view,publication:{...publication,state}}).state,state);
 for(const state of ['cancelled','superseded'] as const)assert.throws(()=>ownedPublication({sessionId:'A',viewId:'V',publicationId:'P1'},{...view,publication:{...publication,state}}),/原发布已结束/);
});