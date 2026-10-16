import {uiProduct,uiProducts,uiStore,uiListingPayload,uiText} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BUSINESS_DESCRIPTORS,executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema,type CapabilityResult,type JsonValue} from '../../packages/app-contracts/src/index.ts';


test('oversized create, revise and submit issue output supplies executable original-result recovery',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>(),agent={id:'error-session'},token='fixture-token-'.repeat(5);
  let creates=0,revises=0,submits=0,gets=0;
  const issues=[{code:'ATTRIBUTE_VALUE_INVALID',field:'attributes.85',message:'字段不匹配 🧩'.repeat(3500),suggestion:'使用字典中的精确值',requiresUser:false},{code:'SECOND',field:'name',message:'保持问题顺序',suggestion:'修正标题',requiresUser:false}];
  const row={rowId:'stable-row',revision:1,action:'listing',target:{offerId:'offer'},status:'blocked',issues,payload:uiListingPayload()};
  const plan={planId:'plan-error',revision:2,storeId:'bill',status:'blocked',rows:[row]};
  const operations={get(){gets++;return structuredClone(plan);},async submit(){submits++;return structuredClone(plan);},async create(){creates++;return structuredClone(plan);},async revise(){revises++;return structuredClone(plan);}};
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:BUSINESS_DESCRIPTORS,
    execute:context=>executeBusiness(operations as any,{put(){}} as any,context),async dispose(){}});
  runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
  try{
    await host.start();host.attachApp('hallmark');
    const invoke=tools.get('apps_invoke')!,inspect=tools.get('apps_inspect')!,execution={agent,signal:new AbortController().signal};
    const validate=compileSchema(inspect.parameters);
    const inspectExact=async(args:any):Promise<any>=>{assert.deepEqual(validate(args),[]);const page:any=await inspect.execute(args,execution);assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);return page;};
    for(const operation of ['create','revise','submit']){
      const input={...(operation==='create'?{storeId:'bill'}:{planId:plan.planId,expectedRevision:2}),...(operation==='submit'?{}:{rows:[{action:'listing',target:{offerId:'offer'},payload:uiListingPayload()}]})};
      const result=await invoke.execute({appId:'hallmark',connectionId:'C1',capabilityId:`hallmark.plan.${operation}`,capabilityVersion:'1.0.0',input},execution) as any;
      assert.equal(result.result.status,'ok');const getsBeforeRead=gets;
      const rendered=invoke.output.render({},result) as Array<{text:string}>,view=JSON.parse(rendered[0].text);
      assert.ok(Buffer.byteLength(rendered[0].text)<=16384);
      assert.equal(view.data.modelProjectionError.code,'ROW_MODEL_BUDGET_EXCEEDED');
      assert.equal(view.read?.tool,'apps_inspect','budget failure must supply a directly callable read');
      const root=await inspectExact(view.read.arguments) as any;assert.equal(root.kind,'array');
      assert.equal(root.completeness,'partial','scanning the last deferred row must not claim that its correction data was delivered');
      assert.equal(root.returned,0);assert.deepEqual(root.items,[]);
      assert.equal(root.nextCursor,null);assert.equal(root.deferred.length,1);
      const readExact=async(args:any):Promise<any>=>{
        let text='',array:any[]=[],object:Record<string,unknown>={};
        for(;;){
          const page=await inspectExact(args);assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);
          if(page.kind==='string')text+=page.text;
          else if(page.kind==='array'){
            page.items.forEach((item:any,index:number)=>{array[page.offset+index]=item;});
            for(const item of page.deferred??[])array[item.index]=await readExact(item.read.arguments);
          }else if(page.kind==='directory'){
            for(const entry of page.entries)object[entry.key]=await readExact(entry.read.arguments);
          }else return page.value;
          if(!page.continuation)return page.kind==='string'?text:page.kind==='array'?array:object;
          assert.ok(Number(page.continuation.arguments.cursor)>Number(args.cursor??0));args=page.continuation.arguments;
        }
      };
      // Discover the row and correction paths from real reader output, not fixture keys.
      const rowPage=await inspectExact(root.deferred[0].read.arguments) as any;
      assert.equal(rowPage.kind,'directory');
      const issueEntry=rowPage.entries.find((entry:any)=>entry.key==='issues');assert.ok(issueEntry);
      const recovered=await readExact(issueEntry.read.arguments);
      assert.deepEqual(recovered,issues);
      assert.deepEqual(await readExact({...view.read.arguments,path:''}),result.result,'entire retained original result reconstructs without loss');assert.equal(gets,getsBeforeRead,'inspection performs no implicit plan reread');
      assert.equal(creates,1);assert.equal(revises,operation==='create'?0:1);assert.equal(submits,operation==='submit'?1:0);assert.equal(store.list('datasets').length,creates+revises+submits,'one retained object per original result, none per continuation');
    }
  }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
