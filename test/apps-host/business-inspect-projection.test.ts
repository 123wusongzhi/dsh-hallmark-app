import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BUSINESS_DESCRIPTORS} from '../../packages/app-hallmark/src/operations-provider.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityResult,JsonValue} from '../../packages/app-contracts/src/index.ts';

test('native operation inspection over real HTTP renders a compact plan and retains exact evidence through resultRef',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>(),agent={id:'inspect-session'},token='fixture-token-'.repeat(5);
  let writes=0,inspections=0;
  const attributes=[{id:4191,values:[{value:'Полное описание\nБез потери текста'}]}];
  const plan={planId:'plan-11',revision:2,storeId:'bill',status:'done',rows:Array.from({length:11},(_,index)=>({rowId:`row-${index}`,revision:1,action:'listing',target:{offerId:`offer-${index}`,productId:100+index,sku:200+index},status:'succeeded',issues:[],payload:{name:'Source content '.repeat(3000),attributes},review:[{evidence:'Full review evidence '.repeat(2000)}],receipt:{importTaskId:300+index,completion:'imported; moderation and sellability are separate'}}))};
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:BUSINESS_DESCRIPTORS,
    async execute(context){writes++;return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'pending',operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:5000};},
    async inspect(_id,context){inspections++;return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'ok',data:plan};},async dispose(){}});
  runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
  try{
    await host.start();host.attachApp('hallmark');
    const invoke=tools.get('apps_invoke')!,inspect=tools.get('apps_inspect')!,execution={agent,signal:new AbortController().signal};
    const submitted=await invoke.execute({appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:plan.planId,expectedRevision:2}},execution) as {result:CapabilityResult};
    assert.equal(submitted.result.status,'pending');const operationId=submitted.result.operation!.operationId;
    const inspected=await inspect.execute({operationId},execution) as {result:CapabilityResult;modelProjection:{content:string;fullResultRef:string}};
    const rendered=inspect.output.render({},inspected) as Array<{type:string;text:string}>;
    assert.equal(rendered[0].text,inspected.modelProjection.content);assert.ok(Buffer.byteLength(rendered[0].text)<=16384);
    const view=JSON.parse(rendered[0].text);assert.equal(view.data.modelView,'business-operation-summary');assert.equal(view.data.rows.length,11);
    assert.equal(view.operation.operationId,operationId);assert.equal(view.data.rows[0].receipt.importTaskId,300);
    assert.ok(view.data.rows.every((row:Record<string,unknown>)=>!row.payload&&!row.review&&!row.context));assert.doesNotMatch(rendered[0].text,/Source content|Full review evidence|RESULT_SPILL_FAILED/);
    assert.equal(view.fullResultRef,inspected.modelProjection.fullResultRef);assert.equal(view.read.tool,'apps_inspect');
    assert.deepEqual((inspected.result as {data:JsonValue}).data,plan,'UI keeps the complete provider result');
    const exact=await inspect.execute({resultRef:view.fullResultRef,path:'/data/rows/3/payload/attributes'},execution) as {items:unknown[];completeness:string};
    assert.deepEqual(exact.items,attributes);assert.equal(exact.completeness,'complete');
    const stored=store.get<{result:CapabilityResult}>('datasets',view.fullResultRef)!;assert.deepEqual(stored.result,inspected.result);
    assert.equal(writes,1);assert.equal(inspections,1,'evidence reads do not inspect or submit again');
  }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
