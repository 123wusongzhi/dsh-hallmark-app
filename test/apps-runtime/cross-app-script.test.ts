import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {InvocationRecord} from '../../packages/app-runtime/src/store.ts';
import {ScriptRun} from '../../packages/app-runtime/src/runs.ts';
import {HallmarkProvider,HallmarkStorePort,resolveHallmarkResources} from '../../packages/app-hallmark/src/index.ts';
import {NotesProvider,resolveNotesResources} from '../../packages/app-notes/src/index.ts';
import {HallmarkClient,TaskBroker} from '../../packages/hallmark-adapter/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import type {AppProvider,CapabilityResult,ExecutionContext,JsonValue} from '../../packages/app-contracts/src/index.ts';

async function listening(server:ReturnType<typeof createServer>):Promise<string> {
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('PORT_REQUIRED');
  return `http://127.0.0.1:${address.port}`;
}

/** Real application implementations against an isolated mock business HTTP server. */
async function setup(t:{after:(callback:()=>unknown)=>void}) {
  const directory=mkdtempSync(join(tmpdir(),'apps-cross-script-'));
  const upstreamCalls={health:0,stores:0,products:0,other:0},providerCalls={hallmark:0,notesCreate:0,notesRead:0};
  const upstream=createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'&&req.url==='/api/health'){
      upstreamCalls.health++;res.end(JSON.stringify({service:'hallmark-control'}));
    }else if(req.method==='GET'&&req.url==='/api/stores'){
      upstreamCalls.stores++;res.end(JSON.stringify([{id:'store-a',shopName:'Mock business store'}]));
    }else if(req.method==='GET'&&req.url==='/api/store-products'){
      upstreamCalls.products++;res.end(JSON.stringify({products:[{storeId:'store-a',productId:'product-a',offerId:'offer-a',title:'Mock business product',price:100}],stores:[{id:'store-a',lastSuccessAt:'2026-10-01T00:00:00.000Z'}]}));
    }else{upstreamCalls.other++;res.statusCode=404;res.end('{}');}
  });
  const baseUrl=await listening(upstream),store=new RuntimeStore(join(directory,'apps.db')),runtime=new AppsRuntime(store);
  const port=new HallmarkStorePort(store,'h'),client=new HallmarkClient({baseUrl,spillDirectory:join(directory,'spill')}),hallmark=new HallmarkProvider({store:port,client,broker:new TaskBroker(client,port)}),notes=new NotesProvider({store});
  const counted=(provider:AppProvider):AppProvider=>({
    manifest:provider.manifest,descriptors:provider.descriptors,
    execute:async(context:ExecutionContext)=>{
      if(context.request.appId==='hallmark')providerCalls.hallmark++;
      else if(context.request.capabilityId==='notes.notes.create')providerCalls.notesCreate++;
      else providerCalls.notesRead++;
      return provider.execute(context);
    },
    ...(provider.inspect?{inspect:(operationId:string,context:ExecutionContext)=>provider.inspect!(operationId,context)}:{}),
    dispose:()=>provider.dispose(),
  });
  runtime.register(counted(hallmark));runtime.register(counted(notes));
  const sources=new SourceComponentStore(join(directory,'builds'),join(directory,'workspace'));
  const presentation=new AppsPresentationService({store,runtime,sources,resources:(binding,result)=>binding.appId==='hallmark'?resolveHallmarkResources(binding,result):resolveNotesResources(binding,result)});
  runtime.register(presentation.provider());
  for(const [appId,connectionId,config] of [['hallmark','h',{baseUrl}],['notes','n',{backend:'local:notes-fixture'}],['apps','presentation',{backend:'runtime'}]] as const){
    runtime.addConnection({appId,connectionId,displayName:`${appId} fixture`,config,configRevision:1,enabled:true});
    runtime.bind({sessionId:'s',appId,connectionId,enabled:true,boundAt:new Date().toISOString()});
  }
  t.after(async()=>{
    await runtime.dispose();store.close();upstream.closeAllConnections();
    await new Promise<void>(resolve=>upstream.close(()=>resolve()));
    rmSync(directory,{recursive:true,force:true});
  });
  return {directory,runtime,store,presentation,upstreamCalls,providerCalls};
}

function completed(result:CapabilityResult):JsonValue {
  assert.equal(result.status,'ok','error' in result?`${result.error.code}: ${result.error.message}`:result.status);
  if(result.status!=='ok')throw new Error('STEP_NOT_COMPLETED');return result.data;
}

test('real Hallmark Provider with mock business HTTP and real Notes keeps a completed write after a presentation failure and resumes without replay',async t=>{
  const f=await setup(t),project=join(f.directory,'source');mkdirSync(project,{recursive:true});
  writeFileSync(join(project,'package-lock.json'),'{}');
  const input={id:'product-evidence',title:'Mock product evidence',content:'product-a / offer-a from the mock business server'};
  const productRef={appId:'hallmark',connectionId:'h'},noteRef={appId:'notes',connectionId:'n'},presentationRef={appId:'apps',connectionId:'presentation'};
  const first=new ScriptRun(f.runtime,'s');
  const incomplete=await first.execute(async run=>{
    const products=completed(await run.call('products',productRef,'hallmark.products.list',{storeId:'store-a'})) as {products:JsonValue[]};assert.equal(products.products.length,1);
    completed(await run.call('note',noteRef,'notes.notes.create',input,{idempotencyKey:'product-evidence-intent'}));
    completed(await run.call('source',presentationRef,'apps.presentation.open_source_component',{directory:project,title:'Product evidence source',bindings:[]}));
    assert.fail('A missing dist/index.html must stop dependent presentation work.');
  });
  assert.equal(incomplete.run.state,'partial',JSON.stringify({error:incomplete.run.error,steps:incomplete.steps.map(step=>step.result)}));assert.deepEqual(incomplete.steps.map(step=>[step.stepKey,step.result?.status]),[['products','ok'],['note','ok'],['source','failed']]);
  const buildFailure=incomplete.steps[2].result!;assert.equal('error' in buildFailure?buildFailure.error.code:undefined,'SOURCE_BUILD_REQUIRED');
  assert.equal(f.providerCalls.notesCreate,1);assert.equal(f.providerCalls.hallmark,1);assert.deepEqual(f.upstreamCalls,{health:1,stores:1,products:1,other:0});
  const notesBefore=f.store.list<{namespace:string;value:{id?:string;revision?:string}}>('provider_records').filter(row=>row.namespace==='notes');
  assert.equal(notesBefore.length,1);assert.equal(notesBefore[0].value.id,'product-evidence');assert.equal(notesBefore[0].value.revision,'1');
  mkdirSync(join(project,'dist'));writeFileSync(join(project,'dist','index.html'),'<button>Local mock product evidence</button>');
  const resumed=new ScriptRun(f.runtime,'s',{runId:first.record.runId});
  const restored=await resumed.execute(async run=>{
    completed(await run.call('products',productRef,'hallmark.products.list',{storeId:'store-a'}));
    completed(await run.call('note',noteRef,'notes.notes.create',input,{idempotencyKey:'product-evidence-intent'}));
    const source=completed(await run.call('source',presentationRef,'apps.presentation.open_source_component',{directory:project,title:'Product evidence source',bindings:[]})) as {viewId:string};assert.ok(source.viewId);
    const note=completed(await run.call('verify-note',noteRef,'notes.notes.get',{id:'product-evidence'})) as {note:{revision:string}};assert.equal(note.note.revision,'1');
    return completed(await run.call('summary',presentationRef,'apps.presentation.render_view',{title:'Product and Notes summary',design:{layout:{type:'column',children:[]},widgets:[]},bindings:[{bindingId:'products',...productRef,capabilityId:'hallmark.products.list',capabilityMajor:1,input:{storeId:'store-a'},projection:[],refresh:{mode:'manual'}},{bindingId:'notes',...noteRef,capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]}));
  });
  assert.equal(restored.run.state,'succeeded');assert.equal(restored.run.error,undefined);assert.equal(f.store.get<{error?:string}>('runs',first.record.runId)?.error,undefined);
  assert.equal(restored.steps.length,5);assert.ok(restored.steps.every(step=>step.state==='done'&&step.result?.status==='ok'));
  assert.equal(f.providerCalls.notesCreate,1);assert.equal(f.providerCalls.notesRead,1);assert.equal(f.providerCalls.hallmark,1);assert.deepEqual(f.upstreamCalls,{health:1,stores:1,products:1,other:0});
  const invocations=f.store.list<InvocationRecord>('invocations');assert.equal(invocations.filter(row=>row.request.capabilityId==='notes.notes.create').length,1);
  const noteOperation=incomplete.steps.find(step=>step.stepKey==='note')!.result!.operation!.operationId;
  assert.equal(restored.steps.find(step=>step.stepKey==='note')!.result!.operation!.operationId,noteOperation);
  assert.equal(invocations.filter(row=>row.request.source.kind==='script').length,6);
  const summary=restored.value as {viewId:string};assert.equal(f.presentation.getView(summary.viewId)?.bindings.length,2);
});

test('successful resume clears the previous script error and reuses a completed Notes step while its Provider is stopped',async t=>{
  const f=await setup(t),ref={appId:'notes',connectionId:'n'},input={id:'offline-evidence',title:'Retained Notes',content:'Completed before a later failure'},options={idempotencyKey:'offline-evidence-intent'};
  const first=new ScriptRun(f.runtime,'s');
  const failed=await first.execute(async run=>{completed(await run.call('write',ref,'notes.notes.create',input,options));throw new Error('later presentation failure');});
  assert.equal(failed.run.state,'partial');assert.equal(failed.run.error,'later presentation failure');
  await f.runtime.stopProvider('notes');assert.equal(f.runtime.describe('notes.notes.create'),undefined);
  const resumed=new ScriptRun(f.runtime,'s',{runId:first.record.runId}),complete=await resumed.execute(run=>run.call('write',ref,'notes.notes.create',input,options));
  assert.equal(complete.run.state,'succeeded');assert.equal(complete.run.error,undefined);assert.equal(f.store.get<{error?:string}>('runs',first.record.runId)?.error,undefined);
  assert.equal(complete.steps[0].result?.status,'ok');assert.equal(f.providerCalls.notesCreate,1);assert.equal(f.store.list('invocations').length,1);
  const conflict=new ScriptRun(f.runtime,'s',{runId:first.record.runId}),changed=await conflict.execute(run=>run.call('write',ref,'notes.notes.create',{...input,content:'Changed intent'},options));
  assert.equal(changed.run.state,'partial');assert.equal(changed.run.error,'RUN_STEP_CONFLICT');assert.equal(f.providerCalls.notesCreate,1);
});
