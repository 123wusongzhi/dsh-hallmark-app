import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS } from '../../packages/contracts/src/index.ts';
import { assertJsonCompatible } from '../../packages/contracts/src/json.ts';
import { OUTPUT_SCHEMA, presentationMeta } from '../../packages/dsh-plugin/server/render.ts';

test('every tool schema survives lossless JSON serialization in a DSH request header', () => {
  for (const {name, description, parameters} of TOOL_DEFINITIONS) {
    const event = {
      header: {
        config: {provider: 'deepseek-official', model: 'deepseek-flash'},
        tools: [{name, description, parameters}],
      },
      reason: 'initial',
    };
    assertJsonCompatible(event);
    assert.deepEqual(JSON.parse(JSON.stringify(event)), event, `${name} must contain only JSON values`);
  }
});

test('whole ordinary-chat header, output schemas and presentation metadata are strict JSON',()=>{
  assertJsonCompatible({reason:'initial',header:{config:{provider:'test',model:'test'},tools:TOOL_DEFINITIONS.map(({name,description,parameters})=>({name,description,parameters}))}});
  assertJsonCompatible(OUTPUT_SCHEMA);
  assertJsonCompatible(presentationMeta({status:'ok',data:{viewId:'preview-only'}}));
  assertJsonCompatible(presentationMeta({status:'failed'}));
});

test('reject undefined before stringify can silently erase it and reject other lossy values',()=>{
  const invalid={properties:{query:{type:'string',description:undefined}}};
  assert.doesNotThrow(()=>JSON.stringify(invalid));
  assert.throws(()=>assertJsonCompatible(invalid),/description: undefined/);
  for(const value of [NaN,Infinity,-0,1n,()=>{},Symbol('x'),new Date(),[undefined],new Array(1),Object.defineProperty({},'hidden',{value:1}),{[Symbol('hidden')]:1}])assert.throws(()=>assertJsonCompatible(value));
  const cyclic:any={};cyclic.self=cyclic;assert.throws(()=>assertJsonCompatible(cyclic),/cyclic/);
  const shared={id:'allowed-shared-schema'};assert.doesNotThrow(()=>assertJsonCompatible([shared,shared]));
});

test('malformed schemas fail plugin startup before registering tools or touching the service',async()=>{
  const {HallmarkPlugin}=await import('../../packages/dsh-plugin/server/index.ts');
  const query=TOOL_DEFINITIONS.find(tool=>tool.name==='hallmark_resolve_store')!.parameters.properties!.query;
  const before=Object.getOwnPropertyDescriptor(query,'description');
  query.description=undefined;
  try{
    const plugin=new HallmarkPlugin({} as any,{dataDirectory:process.cwd()});
    await assert.rejects(plugin.start(),/description: undefined/);
    await plugin.dispose();
  }finally{if(before)Object.defineProperty(query,'description',before);else delete query.description;}
});
