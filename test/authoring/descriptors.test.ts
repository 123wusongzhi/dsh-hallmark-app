import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_AUTHORING_DESCRIPTORS,AUTHORING_BUILD_RECEIPT_SCHEMA,AUTHORING_PREVIEW_RECEIPT_SCHEMA,AUTHORING_PUBLICATION_SCHEMA} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import {compileSchema,validateDescriptor} from '../../packages/app-contracts/src/index.ts';
import type {JsonSchema} from '../../packages/app-contracts/src/index.ts';
import {performanceEvidence} from './performance-fixture.ts';

test('six authoring metadata capabilities and explicit save expose compilable strict versioned contracts',()=>{
  assert.deepEqual(APP_AUTHORING_DESCRIPTORS.map(item=>item.capabilityId),['apps.authoring.begin','apps.authoring.record_build','apps.authoring.record_preview','apps.authoring.publish','apps.authoring.inspect','apps.authoring.await_display','apps.authoring.cancel','apps.authoring.save_component']);
  for(const descriptor of APP_AUTHORING_DESCRIPTORS){assert.deepEqual(validateDescriptor(descriptor),[],descriptor.capabilityId);assert.equal(descriptor.version,'1.0.0');assert.equal(descriptor.effect==='mutation',descriptor.capabilityId==='apps.authoring.save_component');assert.equal(descriptor.execution.idempotency,descriptor.effect==='mutation'?'runtime_dedup':'not_applicable');compileSchema(descriptor.inputSchema);compileSchema(descriptor.outputSchema);}
  const begin=compileSchema(APP_AUTHORING_DESCRIPTORS[0].inputSchema);assert.deepEqual(begin({mode:'new'}),[]);assert.ok(begin({mode:'edit'}).length);assert.ok(begin({mode:'open_saved'}).length);assert.deepEqual(begin({mode:'edit',viewId:'v'}),[]);
  const save=compileSchema(APP_AUTHORING_DESCRIPTORS[7].inputSchema);assert.deepEqual(save({viewId:'v',expectedViewRevision:2,userRequest:'Save as Profit',mode:'save_as'}),[]);assert.ok(save({viewId:'v',expectedViewRevision:2,userRequest:'Save',mode:'save_as',componentId:'component',expectedRevision:1}).length);assert.ok(save({viewId:'v',expectedViewRevision:2,userRequest:'Update',mode:'update',componentId:'component'}).length);
});

test('publication contracts expose waiting state and nullable deadline while retaining legacy mounting rows',()=>{
  const at='2026-10-07T00:00:00.000Z',buildId='a'.repeat(64),validate=compileSchema(AUTHORING_PUBLICATION_SCHEMA),base={publicationId:'p',viewId:'v',ownerSessionId:'s',attemptId:'a',attemptEpoch:1,expectedViewRevision:1,candidateBuildId:buildId,priorActiveBuildId:null,evidenceRefs:[],createdAt:at,updatedAt:at,buildReceiptId:'b',previewReceiptId:'pr',source:{buildId,directory:'E:/workspace',entry:'index.html',files:['index.html']}};
  assert.deepEqual(validate({...base,state:'prepared',readyDeadlineAt:null,mountStartedAt:null}),[]);
  assert.deepEqual(validate({...base,state:'mounting',readyDeadlineAt:at,mountStartedAt:at}),[]);
  assert.deepEqual(validate({...base,state:'mounting',readyDeadlineAt:at}),[]);
  assert.ok(validate({...base,state:'prepared'}).length);assert.ok(validate({...base,state:'waiting',readyDeadlineAt:null}).length);
  assert.equal(APP_AUTHORING_DESCRIPTORS.some(value=>value.capabilityId==='apps.authoring.startMount'),false);
});

test('receipt required/base fields retain A.2 compatibility with explicit optional execution and performance evidence',()=>{
  const templateRoot=new URL('../../docs/requirements/A2/templates/',import.meta.url);
  for(const [name,actual] of [['build-receipt.schema.json',AUTHORING_BUILD_RECEIPT_SCHEMA],['preview-receipt.schema.json',AUTHORING_PREVIEW_RECEIPT_SCHEMA]] as const){
    const template=JSON.parse(readFileSync(new URL(name,templateRoot),'utf8')) as JsonSchema;
    const additions=name==='build-receipt.schema.json'?['executionKind','executionId','reusedFrom','reuseVerifiedAt']:['performance'];
    for(const branch of actual.oneOf as JsonSchema[]){const keys=Object.keys(branch.properties as object);assert.deepEqual(keys.filter(key=>!additions.includes(key)).sort(),Object.keys(template.properties as object).sort());assert.deepEqual(keys.filter(key=>additions.includes(key)).sort(),[...additions].sort());assert.deepEqual([...branch.required as string[]].sort(),[...template.required as string[]].sort());assert.equal(branch.additionalProperties,false);}
  }
  const file={path:'E:/managed/proof.json',sha256:'a'.repeat(64),bytes:1},at='2026-10-07T00:00:00.000Z',base={schemaVersion:1,receiptId:'r',attemptId:'a',sourceRevision:1,sourceInputDigest:'b'.repeat(64),lockfileDigest:'c'.repeat(64),command:['node','build.mjs'],cwd:'E:/workspace',toolchain:{node:'v24'},exitCode:0,startedAt:at,finishedAt:at,logRef:file,distDigest:'d'.repeat(64),archiveBuildId:'e'.repeat(64),fileManifestRef:file,inputUnchanged:true,verdict:'PASS'};
  const build=compileSchema(AUTHORING_BUILD_RECEIPT_SCHEMA);assert.deepEqual(build(base),[]);assert.ok(build({...base,command:'node build.mjs'}).length);assert.ok(build({...base,inputUnchanged:false}).length);assert.ok(build({...base,exitCode:1}).length);assert.ok(build({...base,receiptType:'BuildReceipt'}).length);
  assert.deepEqual(build({...base,executionKind:'reuse',executionId:'original-execution',reusedFrom:file,reuseVerifiedAt:at}),[]);assert.ok(build({...base,executionKind:'fabricated'}).length);assert.ok(build({...base,reusedFrom:{path:'invalid'}}).length);
  const viewport={id:'narrow',contentWidthCssPx:420,heightCssPx:800,deviceScaleFactor:1,screenshot:file,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['filter']},assertion={id:'filter',required:true,expected:'3 rows',actual:'3 rows',status:'PASS',evidenceRefs:[file]},value={schemaVersion:1,receiptId:'pr',attemptId:'a',buildReceiptId:'r',buildId:'e'.repeat(64),protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'fixture',startedAt:at,finishedAt:at,viewportResults:[viewport,{...viewport,id:'wide',contentWidthCssPx:1040}],assertionResults:[assertion],verdict:'PASS'};
  const preview=compileSchema(AUTHORING_PREVIEW_RECEIPT_SCHEMA);assert.deepEqual(preview(value),[]);assert.ok(preview({...value,viewportResults:[viewport]}).length);assert.ok(preview({...value,assertionResults:[{...assertion,status:'NOT_RUN'}]}).length);assert.ok(preview({...value,viewportResults:[{...viewport,pageErrors:['white screen']},value.viewportResults[1]]}).length);
  const measured={...value,performance:performanceEvidence(['filter']),viewportResults:value.viewportResults.map(view=>({...view,interactionCaseIds:['filter']}))};
  const providerOutput=compileSchema(APP_AUTHORING_DESCRIPTORS.find(item=>item.capabilityId==='apps.authoring.record_preview')!.outputSchema);
  assert.deepEqual(providerOutput(measured),[]);
  for(const verdict of ['FAIL','INCOMPLETE'])assert.deepEqual(providerOutput({...measured,verdict,performance:{...measured.performance,verdict}}),[]);
  // Older signed receipts remain readable after the active policy changes.
  assert.deepEqual(providerOutput({...measured,performance:{...measured.performance,policyVersion:'component-first-screen/0'}}),[]);
  assert.ok(providerOutput({...measured,performance:{...measured.performance,unexpected:true}}).length);
  assert.ok(providerOutput({...measured,viewportResults:[{...measured.viewportResults[0],interactionCaseIds:[1]},measured.viewportResults[1]]}).length);
  for(const replacement of [{domElements:-1},{renderedRows:0.5},{readyMs:-1},{feedbackMs:'fast'},{loadedScriptBytes:undefined}]){
    const performance=structuredClone(measured.performance);Object.assign(performance.viewports[0].initial,replacement);
    assert.ok(providerOutput({...measured,performance}).length,JSON.stringify(replacement));
  }
});
