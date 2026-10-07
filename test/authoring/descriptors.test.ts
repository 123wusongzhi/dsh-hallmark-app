import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {APP_AUTHORING_DESCRIPTORS,AUTHORING_BUILD_RECEIPT_SCHEMA,AUTHORING_PREVIEW_RECEIPT_SCHEMA} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import {compileSchema,validateDescriptor} from '../../packages/app-contracts/src/index.ts';
import type {JsonSchema} from '../../packages/app-contracts/src/index.ts';

test('six authoring metadata capabilities and explicit save expose compilable strict versioned contracts',()=>{
  assert.deepEqual(APP_AUTHORING_DESCRIPTORS.map(item=>item.capabilityId),['apps.authoring.begin','apps.authoring.record_build','apps.authoring.record_preview','apps.authoring.publish','apps.authoring.inspect','apps.authoring.cancel','apps.authoring.save_component']);
  for(const descriptor of APP_AUTHORING_DESCRIPTORS){assert.deepEqual(validateDescriptor(descriptor),[],descriptor.capabilityId);assert.equal(descriptor.version,'1.0.0');assert.equal(descriptor.effect==='mutation',descriptor.capabilityId==='apps.authoring.save_component');assert.equal(descriptor.execution.idempotency,descriptor.effect==='mutation'?'runtime_dedup':'not_applicable');compileSchema(descriptor.inputSchema);compileSchema(descriptor.outputSchema);}
  const begin=compileSchema(APP_AUTHORING_DESCRIPTORS[0].inputSchema);assert.deepEqual(begin({mode:'new'}),[]);assert.ok(begin({mode:'edit'}).length);assert.ok(begin({mode:'open_saved'}).length);assert.deepEqual(begin({mode:'edit',viewId:'v'}),[]);
  const save=compileSchema(APP_AUTHORING_DESCRIPTORS[6].inputSchema);assert.deepEqual(save({viewId:'v',expectedViewRevision:2,userRequest:'Save as Profit',mode:'save_as'}),[]);assert.ok(save({viewId:'v',expectedViewRevision:2,userRequest:'Save',mode:'save_as',componentId:'component',expectedRevision:1}).length);assert.ok(save({viewId:'v',expectedViewRevision:2,userRequest:'Update',mode:'update',componentId:'component'}).length);
});

test('receipt field/required sets match the approved A.2 templates rather than parallel formats',()=>{
  const templateRoot=resolve('../audit-inputs/A2-30f8a9809dd4/dsh_apps_A2/templates');
  for(const [name,actual] of [['build-receipt.schema.json',AUTHORING_BUILD_RECEIPT_SCHEMA],['preview-receipt.schema.json',AUTHORING_PREVIEW_RECEIPT_SCHEMA]] as const){
    const template=JSON.parse(readFileSync(resolve(templateRoot,name),'utf8')) as JsonSchema;
    for(const branch of actual.oneOf as JsonSchema[]){assert.deepEqual(Object.keys(branch.properties as object).sort(),Object.keys(template.properties as object).sort());assert.deepEqual([...branch.required as string[]].sort(),[...template.required as string[]].sort());assert.equal(branch.additionalProperties,false);}
  }
  const file={path:'E:/managed/proof.json',sha256:'a'.repeat(64),bytes:1},at='2026-10-07T00:00:00.000Z',base={schemaVersion:1,receiptId:'r',attemptId:'a',sourceRevision:1,sourceInputDigest:'b'.repeat(64),lockfileDigest:'c'.repeat(64),command:['node','build.mjs'],cwd:'E:/workspace',toolchain:{node:'v24'},exitCode:0,startedAt:at,finishedAt:at,logRef:file,distDigest:'d'.repeat(64),archiveBuildId:'e'.repeat(64),fileManifestRef:file,inputUnchanged:true,verdict:'PASS'};
  const build=compileSchema(AUTHORING_BUILD_RECEIPT_SCHEMA);assert.deepEqual(build(base),[]);assert.ok(build({...base,command:'node build.mjs'}).length);assert.ok(build({...base,inputUnchanged:false}).length);assert.ok(build({...base,exitCode:1}).length);assert.ok(build({...base,receiptType:'BuildReceipt'}).length);
  const viewport={id:'narrow',contentWidthCssPx:420,heightCssPx:800,deviceScaleFactor:1,screenshot:file,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['filter']},assertion={id:'filter',required:true,expected:'3 rows',actual:'3 rows',status:'PASS',evidenceRefs:[file]},value={schemaVersion:1,receiptId:'pr',attemptId:'a',buildReceiptId:'r',buildId:'e'.repeat(64),protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'fixture',startedAt:at,finishedAt:at,viewportResults:[viewport,{...viewport,id:'wide',contentWidthCssPx:1040}],assertionResults:[assertion],verdict:'PASS'};
  const preview=compileSchema(AUTHORING_PREVIEW_RECEIPT_SCHEMA);assert.deepEqual(preview(value),[]);assert.ok(preview({...value,viewportResults:[viewport]}).length);assert.ok(preview({...value,assertionResults:[{...assertion,status:'NOT_RUN'}]}).length);assert.ok(preview({...value,viewportResults:[{...viewport,pageErrors:['white screen']},value.viewportResults[1]]}).length);
});
