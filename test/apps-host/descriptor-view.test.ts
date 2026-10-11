import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppsHost} from '../../packages/plugin-apps/src/index.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {canonicalJson,compileSchema} from '../../packages/app-contracts/src/index.ts';
import {descriptorView} from '../../packages/plugin-apps/src/descriptor-view.ts';
import {NOTES_DESCRIPTORS} from '../../packages/app-notes/src/index.ts';
const base=NOTES_DESCRIPTORS[0];
test('descriptors within the original rendering budget keep the complete inline contract',()=>{
 const withDescription=(description:string)=>({...base,outputSchema:{type:'object',properties:{value:{type:'string',description}}}});
 for(const descriptor of [base,withDescription('Exact output semantics. '.repeat(200))]){
  const full={status:'ok',descriptor};assert.ok(Buffer.byteLength(canonicalJson(full))<=16384);
  assert.deepEqual(descriptorView(descriptor,undefined,{}),full);
 }
 const empty=withDescription(''),padding=16384-Buffer.byteLength(canonicalJson({status:'ok',descriptor:empty}));
 const atBudget=withDescription('x'.repeat(padding));
 assert.equal(Buffer.byteLength(canonicalJson({status:'ok',descriptor:atBudget})),16384);
 assert.deepEqual(descriptorView(atBudget,undefined,{}),{status:'ok',descriptor:atBudget});
 const aboveBudget=withDescription('x'.repeat(padding+1)),deferred=descriptorView(aboveBudget,undefined,{}) as any;
 assert.equal(deferred.inputSchemaComplete,true);assert.ok(deferred.outputSchemaDeferred);
 let next=deferred.outputSchemaDeferred,restored='';
 while(next){const page=descriptorView(aboveBudget,undefined,next.arguments) as any;assert.ok(Buffer.byteLength(canonicalJson(page))<=16384);restored+=page.text;next=page.next;}
 assert.equal(restored,canonicalJson(aboveBudget.outputSchema));
});
test('registered gateway reconstructs exact schema, rejects missing/wrong/section-switched identity and invalid Unicode offset',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map(),agent={id:'A'};
 const descriptor={...base,capabilityId:'fixture.rows.list',inputSchema:{type:'object',properties:{['键😀'.repeat(300)]:{type:'string',enum:['a','b']}},additionalProperties:false},outputSchema:{type:'object',properties:{['键😀'.repeat(300)]:{type:'string',description:'\\\"😀中文字'.repeat(9000)}}}};
 runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],execute:async()=>{throw Error('Never invoke');},dispose:async()=>{}} as any);
 let catalogRevision='initial';const transport={identity:async()=>({...runtime.identity(),catalogDigest:catalogRevision}),listApps:async()=>runtime.listApps(),describe:async(...a:any[])=>runtime.describe(a[0],a[1])};
 const host=new AppsHost({agents:{get:id=>id==='A'?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>{};}}},transport as any);
 await host.start();const tool=tools.get('apps_describe');
 const call=async(args:any)=>{assert.deepEqual(compileSchema(tool.parameters)(args),[]);const value=await tool.execute(args,{agent,signal:new AbortController().signal});const text=tool.output.render(args,value)[0].text;assert.ok(Buffer.byteLength(text)<=16384);return JSON.parse(text);};
 try {const initial=await call({capabilityId:descriptor.capabilityId});assert.deepEqual(initial.descriptor.inputSchema,descriptor.inputSchema);assert.equal(initial.inputSchemaComplete,true);let next=initial.outputSchemaDeferred,args=next.arguments,joined='',pages=0;
 while(next){const page=await call(next.arguments);assert.equal(page.status,'ok');joined+=page.text;pages++;next=page.next;}
 assert.ok(pages>1);assert.equal(joined,canonicalJson(descriptor.outputSchema));catalogRevision='unrelated-catalog-change';assert.equal((await call(args)).status,'ok');assert.deepEqual(JSON.parse(joined),descriptor.outputSchema);
 assert.equal((await call(Object.fromEntries(Object.entries(args).filter(([k])=>k!=='representationId')))).status,'failed');
 assert.equal((await call({...args,representationId:'0'.repeat(64)})).error.code,'DESCRIPTOR_CHANGED');
 assert.equal((await call({...args,section:'full'})).error.code,'DESCRIPTOR_CHANGED');
 assert.equal((await call({...args,cursor:'99999999'})).error.code,'INVALID_CURSOR');
 const unicodeOffset=joined.indexOf('😀')+1;assert.equal((await call({...args,cursor:String(unicodeOffset)})).error.code,'INVALID_CURSOR');
 } finally {await host.dispose();await runtime.dispose();store.close();}
});
test('oversized input and scoped guidance remain fully recoverable; actual content binds identity; tiny full stays inline',()=>{
 const descriptor={...base,inputSchema:{type:'string',enum:['中文😀'.repeat(10000)]}};
 const guidance={path:'/session/A','b':'second',a:'first',text:'指导😀'.repeat(12000)};
 const initial=descriptorView(descriptor,guidance,{}) as any;assert.equal(initial.inputSchemaComplete,false);let next=initial.descriptorDeferred,joined='';
 while(next){const page=descriptorView(descriptor,guidance,next.arguments) as any;assert.ok(Buffer.byteLength(canonicalJson(page))<=16384);joined+=page.text;next=page.next;}
 assert.deepEqual(JSON.parse(joined),{status:'ok',descriptor,authoringGuidance:guidance});
 assert.equal((descriptorView(descriptor,{...guidance,path:'/session/B'},initial.descriptorDeferred.arguments) as any).error.code,'DESCRIPTOR_CHANGED');
 // Key insertion order changes are intentionally harmless: returned bytes are canonical too.
 assert.equal((descriptorView(descriptor,{text:guidance.text,a:'first',b:'second',path:'/session/A'},initial.descriptorDeferred.arguments) as any).status,'ok');
 const small={...base,inputSchema:{type:'object'},outputSchema:{type:'object'}};assert.deepEqual((descriptorView(small,undefined,{}) as any).descriptor,small);
});

test('registered Host scopes oversized authoring guidance to the requesting session',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map(),agents=[{id:'A'},{id:'B'}];
 const descriptor={...base,capabilityId:'apps.authoring.begin'};
 runtime.register({manifest:{manifestVersion:1,appId:'apps',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],execute:async()=>{throw Error('Never invoke');},dispose:async()=>{}} as any);
 const host=new AppsHost({agents:{get:id=>agents.find(a=>a.id===id)},tools:{register:t=>{tools.set(t.name,t);return()=>{};}}},{identity:async()=>runtime.identity(),listApps:async()=>runtime.listApps(),describe:async(id:string,version?:string)=>runtime.describe(id,version)} as any,undefined,{authoringGuidance:{cliPath:null,nodeExecutable:'node',nodeArgs:[],nodeEnvironment:{},starterPath:'/指导😀'.repeat(4000),sdkDirectory:'/sdk',buildRunnerPath:'/build',previewRunnerPath:'/preview',runtime:{url:'http://127.0.0.1',keyFile:'/key',archiveRoot:'/archive',evidenceRoot:'/evidence'}}});
 await host.start();const tool=tools.get('apps_describe');
 const call=async(args:any,agent=agents[0])=>{assert.deepEqual(compileSchema(tool.parameters)(args),[]);const value=await tool.execute(args,{agent,signal:new AbortController().signal});const rendered=tool.output.render(args,value)[0].text;assert.ok(Buffer.byteLength(rendered)<=16384);return JSON.parse(rendered);};
 try {const first=await call({capabilityId:descriptor.capabilityId});assert.equal(first.inputSchemaComplete,false);let next=first.descriptorDeferred,joined='';while(next){const page=await call(next.arguments);assert.equal(page.status,'ok');joined+=page.text;next=page.next;}assert.equal(JSON.parse(joined).authoringGuidance.sessionId,'A');assert.deepEqual(JSON.parse(joined).descriptor.inputSchema,descriptor.inputSchema);assert.equal((await call(first.descriptorDeferred.arguments,agents[1])).error.code,'DESCRIPTOR_CHANGED');}finally{await host.dispose();await runtime.dispose();store.close();}
});
