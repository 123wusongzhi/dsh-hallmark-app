import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';

async function run(kind:string,respond:(input:any,index:number)=>any,input:any={}){
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'C1'),tools=new Map<string,NativeGatewayTool>(),agent={id:'ozon-audit'},token='fixture-token-'.repeat(5),calls:any[]=[];
 const client={storeDataRead:async(storeId:string,input:any)=>{
  calls.push(structuredClone(input));const response=respond(input,calls.length);
  return {status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response}};
 }} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:port,client,broker:{} as CoreBroker}));
 runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
 try{
  await host.start();host.attachApp('hallmark');const invoke=tools.get('apps_invoke')!;
  const result:any=await invoke.execute({appId:'hallmark',connectionId:'C1',capabilityId:`hallmark.ozon.${kind}`,capabilityVersion:'1.0.0',input:{storeId:'shop',loadAll:true,...input}},{agent,signal:new AbortController().signal});
  const rendered=invoke.output.render({},result) as any[];
  return {result,rendered,calls,snapshots:port.list('complete_snapshots')};
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
}

const rows=[{product_id:1,price:{price:'10',currency_code:'RUB'}}];
const cases:any[]=[
 ['empty-has-next','prices',()=>({items:[],has_next:true,cursor:'next'}),{},'failed'],
 ['empty-unmet-total','prices',()=>({items:[],total:2,cursor:'next'}),{},'failed'],
 ['total-contradicts-has-next','prices',()=>({items:rows,total:1,has_next:true,cursor:'next'}),{},'failed'],
 ['empty-finance-nonterminal','finance',()=>({accruals:[],has_next:true,last_id:'next'}),{dateFrom:'2026-09-01',dateTo:'2026-09-01'},'failed'],
 ['empty-promotions-unmet-total','promotions',()=>({products:[],total:2,last_id:'next'}),{actionId:'7'},'failed'],
 ['empty-products-nonterminal','products',()=>({result:{items:[],has_next:true,last_id:'next'}}),{},'failed'],
 ['nested-empty-nonterminal','prices',()=>({result:{items:[],has_next:true,cursor:'next'}}),{},'failed'],
 ['late-empty-nonterminal','prices',(q:any)=>q.body.cursor?({items:[],has_next:true,cursor:'third'}):({items:rows,has_next:true,cursor:'second'}),{},'failed'],
 ['normal-full-final','prices',()=>({items:Array.from({length:100},(_,i)=>({product_id:i+1,price:{}})),has_next:false,cursor:''}),{},'ok'],
 ['normal-short-has-next','prices',(q:any)=>q.body.cursor?({items:[{product_id:2,price:{}}],has_next:false,cursor:''}):({items:rows,has_next:true,cursor:'next'}),{},'ok'],
 ['normal-empty-unknown-total','prices',()=>({items:[],cursor:''}),{},'ok'],
 ['empty-stock-list-has-next','stocks',()=>({result:{items:[],has_next:true,last_id:'next'}}),{},'failed'],
 ['empty-stock-list-unmet-total','stocks',()=>({result:{items:[],total:2,last_id:'next'}}),{},'failed'],
 ['normal-empty-stock-list','stocks',()=>({result:{items:[],total:0,last_id:''}}),{},'ok'],
 ['terminal-unmet-total','prices',()=>({items:rows,total:2,has_next:false,cursor:''}),{},'failed'],
 ['normal-terminal-total','prices',()=>({items:rows,total:1,has_next:false,cursor:''}),{},'ok'],
 ['normal-stock-list-empty-after-counted-page','stocks',(q:any)=>q.path==='/v3/product/list'?(q.body.last_id?{result:{items:[],total:1,last_id:''}}:{result:{items:[{product_id:1}],last_id:'next'}}):q.path==='/v3/product/info/list'?{items:[{id:1,sku:11}]}:{products:[{sku:11,warehouse_id:1,present:3}],has_next:false}, {},'ok'],
 ['normal-empty-final','prices',()=>({items:[],has_next:false,cursor:''}),{},'ok'],
 ['normal-short-unknown-total','prices',()=>({items:rows,cursor:''}),{},'ok'],
 ['normal-two-pages','prices',(q:any)=>q.body.cursor?({items:[{product_id:2,price:{}}],cursor:'',total:2}):({items:rows,cursor:'next',total:2}),{},'ok'],
 ['stalled-token','prices',()=>({items:rows,cursor:'same'}),{},'failed'],
 ['empty-order-nonterminal','orders',(_:any,index:number)=> index<=3?({postings:[],has_next:true}):({postings:[],has_next:false}),{dateFrom:'2026-09-01',dateTo:'2026-09-01'},'failed'],
 ['normal-empty-orders','orders',()=>({postings:[],has_next:false}),{dateFrom:'2026-09-01',dateTo:'2026-09-01'},'ok'],
];
for(const [name,kind,respond,input,expected] of cases)test(name,async()=>{
 const evidence=await run(kind,respond,input),view=JSON.parse(evidence.rendered[0].text);
 const reportDir=process.env.OZON_PAGINATION_REPORT_DIR;
 if(reportDir){mkdirSync(reportDir,{recursive:true});writeFileSync(join(reportDir,`${name}.json`),JSON.stringify(evidence,null,2));}
 assert.equal(view.status,expected);if(expected==='failed'){assert.equal(evidence.snapshots.length,0);assert.equal(view.data,undefined);assert.ok(['OZON_PAGINATION_INCONSISTENT','OZON_PAGINATION_STALLED'].includes(view.error.code));if(!['late-empty-nonterminal','stalled-token'].includes(name))assert.equal(evidence.calls.length,1);}
 if(name==='normal-stock-list-empty-after-counted-page'){assert.equal(view.data.total,1);assert.equal(evidence.calls.length,4);}
 if(name==='normal-two-pages'){assert.equal(view.data.total,2);assert.equal(evidence.calls.length,2);}
});
