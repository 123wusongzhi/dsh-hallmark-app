import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, canonicalBinding, datasetId, compileSchema, validateInvocation, validateResult, validateDescriptor, validateManifest, requestHash } from '../../packages/app-contracts/src/index.ts';
import type { InvocationRequest, CapabilityDescriptor } from '../../packages/app-contracts/src/index.ts';

const descriptor:CapabilityDescriptor={capabilityId:'notes.notes.create',version:'1.0.0',title:'create',description:'Create note',effect:'mutation',inputSchema:{type:'object',properties:{title:{type:'string'}},required:['title'],additionalProperties:false},outputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},execution:{mode:'sync',timeoutMs:1000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:['notes']},aliases:[]};
const request:InvocationRequest={protocolVersion:'1.0',invocationId:'i',traceId:'t',appId:'notes',connectionId:'c',capabilityId:descriptor.capabilityId,capabilityVersion:'1.0.0',input:{title:'A'},source:{kind:'agent',sessionId:'s',nativeCallId:'n'},deadlineAt:'2026-10-07T01:00:00Z',idempotencyKey:'k'};
test('canonical JSON sorts every object including numeric keys and preserves Unicode/arrays/null',()=>{
 assert.equal(canonicalJson({'2':'two','10':'ten',z:{b:1,a:' A\u0301 '},a:[3,1,null]}),'{'+'"10":"ten","2":"two","a":[3,1,null],"z":{"a":" Á ","b":1}}');
 assert.notEqual(canonicalJson({value:null}),canonicalJson({}));
 for(const value of [undefined,NaN,Infinity,{value:undefined},new Date(),Array(1),[1n]])assert.throws(()=>canonicalJson(value));
 const cyclic:Record<string,unknown>={};cyclic.self=cyclic;assert.throws(()=>canonicalJson(cyclic),/cyclic/);
});
test('dataset identity implements SPEC 10.3 with app/connection/major/projection scope',()=>{
 const binding={appId:'notes',connectionId:'c',capabilityId:'notes.notes.list',capabilityMajor:1,input:{b:1,a:' X '},projection:['title','content']};
 assert.deepEqual(canonicalBinding(binding),{protocolMajor:1,...binding});
 assert.match(datasetId(binding),/^dataset:v1:[a-f0-9]{64}$/);
 assert.equal(datasetId(binding),datasetId({...binding,input:{a:' X ',b:1},capabilityVersion:'1.5.0'}));
 for(const changed of [{connectionId:'d'},{appId:'hallmark'},{capabilityMajor:2},{projection:['content','title']},{input:{a:'X',b:1}}])assert.notEqual(datasetId(binding),datasetId({...binding,...changed}));
});
test('schema compilation rejects unsupported or malformed schemas before dispatch',()=>{
 for(const schema of [{type:'not-a-type'},{type:'object',required:['x','x']},{type:'number',minimum:2,maximum:1},{type:'string',pattern:'['},{type:'object',properties:{x:42}},{unknownKeyword:true},{oneOf:[]}])assert.throws(()=>compileSchema(schema as any));
 assert.ok(validateDescriptor({...descriptor,outputSchema:undefined as any}).some(error=>error.includes('outputSchema')));
});
test('compiled schema gives exact nested paths and validates unions/open source fields',()=>{
 const check=compileSchema({type:'object',properties:{products:{type:'array',items:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:true}}},required:['products'],additionalProperties:false});
 assert.deepEqual(check({products:[{id:'1',unknownOriginal:{value:'preserved'}}]}),[]);
 assert.ok(check({products:[{id:1}]}).some(error=>error.includes('$.products[0].id')));
 assert.ok(check({products:[],invented:true}).some(error=>error.includes('$.invented')));
 const unicode=compileSchema({type:'string',minLength:1,maxLength:1});assert.deepEqual(unicode('😀'),[]);
 const union=compileSchema({oneOf:[{type:'string'},{type:'integer'}]});assert.deepEqual(union('id'),[]);assert.ok(union(1.5).length);
});
test('registration metadata rejects invalid execution declarations, discovery and public manifest fields',()=>{
 assert.deepEqual(validateDescriptor(descriptor),[]);
 for(const [key,value] of Object.entries({mode:'stream',concurrency:'parallel_forever',lockScope:'unlocked',completionEvidence:'guess',idempotency:'exactly_once'}))assert.ok(validateDescriptor({...descriptor,execution:{...descriptor.execution,[key]:value}}).length,key);
 assert.ok(validateDescriptor({...descriptor,execution:{...descriptor.execution,invented:true}}).length);
 assert.ok(validateDescriptor({...descriptor,discovery:{defaultVisible:'yes',keywords:['notes']}}).length);
 assert.ok(validateDescriptor({...descriptor,aliases:['same','same']}).length);
 const manifest={manifestVersion:1,appId:'notes',displayName:'Notes',providerPackage:'@dsh/notes',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['note']};
 assert.deepEqual(validateManifest(manifest),[]);
 const {providerPackage,...missing}=manifest;assert.ok(validateManifest(missing).length);
 for(const changed of [{providerVersion:'latest'},{runtimeProtocolMajor:2},{resourceTypes:['note','note']},{internalConnectionGuess:'default'}])assert.ok(validateManifest({...manifest,...changed}).length);
});
test('invocation rejects unknown public fields, backend pseudo sessions and loose versions',()=>{
 assert.deepEqual(validateInvocation(request,descriptor),[]);
 assert.ok(validateInvocation({...request,undeclared:true}).length);
 assert.ok(validateInvocation({...request,source:{kind:'scheduler',scheduleId:'schedule',runId:'run',sessionId:'fake'}}).length);
 assert.ok(validateInvocation({...request,capabilityVersion:'latest'}).length);
 const {idempotencyKey,...missing}=request;assert.ok(validateInvocation(missing,descriptor).some(error=>error.includes('idempotencyKey')));
 assert.notEqual(requestHash(request),requestHash({...request,capabilityVersion:'2.0.0'}));
 const retryRequest={...request,invocationId:'retry',traceId:'new'};assert.equal(requestHash(request),requestHash(retryRequest));
});
test('result union requires completion evidence and validates concrete successful output',()=>{
 assert.deepEqual(validateResult({invocationId:'i',traceId:'t',status:'ok',data:{id:'n'}},descriptor),[]);
 assert.ok(validateResult({invocationId:'i',traceId:'t',status:'ok',data:{id:1}},descriptor).some(error=>error.includes('$.data.id')));
 assert.ok(validateResult({invocationId:'i',traceId:'t',status:'unknown',error:{code:'TIMEOUT',message:'unknown',retryPolicy:'read_retry'}}).length);
 assert.deepEqual(validateResult({invocationId:'i',traceId:'t',status:'unknown',operation:{operationId:'op',state:'unknown'},error:{code:'TIMEOUT',message:'unknown',retryPolicy:'inspect_only'}}),[]);
 assert.ok(validateResult({invocationId:'i',traceId:'t',status:'pending',operation:{operationId:'op',state:'pending'}}).length);
 assert.ok(validateResult({invocationId:'i',traceId:'t',status:'partial',data:{id:'n'},errors:[]}).length);
});
