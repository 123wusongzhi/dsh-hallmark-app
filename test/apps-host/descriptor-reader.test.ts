import test from 'node:test';
import assert from 'node:assert/strict';
import {describeForModel} from '../../packages/plugin-apps/src/descriptor-reader.ts';
import {APP_AUTHORING_DESCRIPTORS} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import {compileSchema,canonicalJson} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonValue} from '../../packages/app-contracts/src/index.ts';
const descriptor=APP_AUTHORING_DESCRIPTORS.find(row=>row.capabilityId==='apps.authoring.inspect')!;
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
const read=(options:Parameters<typeof describeForModel>[2],schema=descriptor)=>describeForModel(schema,'fixed-catalog',options);

test('authoring inspect input stays exact and legal; complete output is explicitly deferred',()=>{
  const result=read({});assert.equal(result.status,'ok');assert.ok(bytes(result)<=14000);
  assert.equal(result.view,'input');assert.equal((result.schemaCompleteness as any).output,'deferred');
  assert.deepEqual((result.descriptor as any).inputSchema,descriptor.inputSchema);
  const validate=compileSchema((result.descriptor as any).inputSchema);
  assert.deepEqual(validate({attemptId:'original'}),[]);
  assert.ok(validate({attemptId:'original',publicationId:'conflicting'}).length);
  assert.ok(validate({}).length);assert.ok(validate({attemptId:'original',extra:true}).length);
  assert.deepEqual((result.outputSchemaRead as any).arguments,{capabilityId:descriptor.capabilityId,version:descriptor.version,descriptorDigest:result.descriptorDigest,view:'full',path:'/descriptor/outputSchema',cursor:'0',limit:20});
});

test('full schema recursively reassembles without dropping any nested validation constraint',()=>{
  let calls=0;
  function restore(path:string):JsonValue{
    const result=read({view:'full',path});calls++;assert.ok(bytes(result)<=14000);
    if('value'in result)return result.value;
    assert.equal(result.kind,'directory');const value:Record<string,JsonValue>={};let page=result;
    while(true){for(const entry of page.entries as any[]){value[entry.key]=restore(entry.read.arguments.path);}
      if(page.nextCursor===null)break;page=read((page.continuation as any).arguments);calls++;assert.ok(bytes(page)<=14000);}
    return result.containerKind==='array'?Object.keys(value).map(key=>value[key]):value;
  }
  assert.equal(canonicalJson(restore('/descriptor/outputSchema')),canonicalJson(descriptor.outputSchema));assert.ok(calls>1);
});

test('small exact descriptors remain inline without continuation overhead',()=>{
  const small={...descriptor,inputSchema:{type:'object'},outputSchema:{type:'boolean'}};
  assert.deepEqual(read({},small),{status:'ok',descriptor:small});
});

test('long string leaves use lossless Unicode continuation and escaped own-property pointers',()=>{
  const text='中😀𝄞\\"\n'.repeat(9000),large={...descriptor,outputSchema:{type:'object',description:text,properties:{'a/b~c':{const:false}}}} as CapabilityDescriptor;
  let restored='',options:any={view:'full',path:'/descriptor/outputSchema/description'};
  do{const page=read(options,large);assert.ok(bytes(page)<=14000);restored+=page.text;options=(page.continuation as any)?.arguments;}while(options);
  assert.equal(restored,text);
  assert.deepEqual(read({view:'full',path:'/descriptor/outputSchema/properties/a~1b~0c'},large).value,{const:false});
  assert.throws(()=>read({view:'full',path:'/descriptor/outputSchema/properties/a~2b'},large),/INVALID_DESCRIPTOR_PATH/);
  assert.throws(()=>read({view:'full',path:'/descriptor/toString'},large),/DESCRIPTOR_PATH_NOT_FOUND/);
  assert.throws(()=>read({view:'full',path:'/descriptor/aliases/01'},large),/DESCRIPTOR_PATH_NOT_FOUND/);
  assert.throws(()=>read({view:'full',path:'/descriptor',cursor:'-1'},large),/INVALID_DESCRIPTOR_PAGE/);
});

test('legal oversized property names stay readable through serialized JSON on the current short path',()=>{
  for(const key of ['x'.repeat(4100),'中'.repeat(3900)]){
    const schema={...descriptor,outputSchema:{type:'object',properties:{[key]:{enum:['x'.repeat(16000)]}}}} as CapabilityDescriptor;
    let text='',options:any={view:'full',path:'/descriptor/outputSchema/properties'};
    do{const page=read(options,schema);assert.equal(page.kind,'serialized-json');assert.ok(bytes(page)<=14000);text+=page.text;options=(page.continuation as any)?.arguments;assert.ok(!options||options.path.length<=4000);}while(options);
    assert.deepEqual(JSON.parse(text),(schema.outputSchema as any).properties);
  }
});

test('continuations bind actual descriptor and guidance contents, not an unrelated catalogue generation',()=>{
  const result=read({}),continuation=(result.outputSchemaRead as any).arguments;
  assert.doesNotThrow(()=>describeForModel(descriptor,'another-catalog',continuation));
  assert.throws(()=>read(continuation,{...descriptor,description:'changed'}),/DESCRIPTOR_CHANGED/);
  assert.throws(()=>describeForModel(descriptor,'fixed-catalog',continuation,{sessionId:'other'}),/DESCRIPTOR_CHANGED/);
});
