import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync,rmSync} from 'node:fs';
import {AppsClient,generateArtifacts,type RuntimeTransport} from '../../packages/app-sdk/src/index.ts';
import type {CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

// Explicit non-business transport controls. These are not marketplace records.
const descriptor:CapabilityDescriptor={capabilityId:'control.echo',version:'1.0.0',title:'Echo control',description:'Local generated-wrapper contract',effect:'query',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false},outputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};

test('freshly generated SDK wrapper forwards call options and honors cancellation',async t=>{
  const file=new URL(`../../packages/app-sdk/src/.generated-contract-${randomUUID()}.ts`,import.meta.url);
  writeFileSync(file,generateArtifacts([descriptor]).source);
  t.after(()=>rmSync(file,{force:true}));
  const generated=await import(file.href);
  const requests:InvocationRequest[]=[];let handshakes=0;
  const transport:RuntimeTransport={
    async identity(){handshakes++;return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'local-control'};},
    async describe(){return descriptor;},
    async invoke(request){requests.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:request.input};},
    async inspect(){throw Error('No operation inspection expected');},
  };
  const source={kind:'agent',sessionId:'local-control',nativeCallId:'wrapper-call'} as const;
  const deadlineAt=new Date(Date.now()+5000).toISOString(),client=new AppsClient(transport,source,{traceId:'control-trace',deadlineAt});
  const ref={appId:'control',connectionId:'local'},input={text:'echo fixture'};
  const options={invocationId:'supplied-invocation',idempotencyKey:'supplied-key',expectedResourceRevision:'supplied-revision'};
  const result=await generated.call0(client,ref,input,options);
  assert.equal(result.status,'ok');assert.deepEqual(result.data,input);
  assert.deepEqual(requests,[{protocolVersion:'1.0',...ref,invocationId:options.invocationId,traceId:'control-trace',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input,source,deadlineAt,idempotencyKey:options.idempotencyKey,expectedResourceRevision:options.expectedResourceRevision}]);
  const controller=new AbortController();controller.abort();
  const cancelled=await generated.call0(client,ref,input,{...options,invocationId:'cancelled-invocation',signal:controller.signal});
  assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.invocationId,'cancelled-invocation');assert.equal(cancelled.error.code,'CANCELLED_BEFORE_DISPATCH');
  assert.equal(handshakes,1);assert.equal(requests.length,1);
});
