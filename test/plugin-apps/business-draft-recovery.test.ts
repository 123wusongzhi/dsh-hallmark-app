import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude,uiListingPayload} from '../real-data/ui-scenarios.ts';

test('workspace business drafts recover only under reverified original owners and revisions',async t=>{
const stub:Record<string,string>={
'directory.tsx':`export function AppsDirectory(p){return <div>{p.navigation}<button onClick={()=>p.onAppChange('other')}>Other app</button><button onClick={()=>p.onAppChange('hallmark')}>Hallmark app</button><button onClick={()=>p.onReturn(p.currentSessionId)}>Return chat</button>{p.children}</div>}`,
'workbench-board.tsx':`export function WorkbenchBoard(){return null}`,
'library.tsx':`export function AppsLibrary(){return null}`,
'view.tsx':`export function AppsNativeView(){return null}`,
'save-controls.tsx':`export function AppsSaveControls(){return null}`,
'material-library.tsx':`export function MaterialLibrary(){return null}`,
'workbench-component-actions.tsx':`export function CurrentComponentWorkbenchAction(){return null}`,
'association-overview.tsx':`export function AssociationOverviewPage(){return null}`,
'connection-status.tsx':`export function ConnectionStatusPanel(){return null}`,
'business-settings.tsx':`export function BusinessSettings(){return null}`,
};
const output=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
const originalFetch=globalThis.fetch,originalWindow=globalThis.window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
const realNow=Date.now,realInterval=globalThis.setInterval,realClearInterval=globalThis.clearInterval;let now=realNow();Date.now=()=>now;const intervals=new Set();globalThis.setInterval=callback=>{intervals.add(callback);return callback;};globalThis.clearInterval=callback=>intervals.delete(callback);
// Recorded product/store base; aliases, revisions, failure status, prices and draft text are explicit local UX controls.
const listingBase=${JSON.stringify(uiListingPayload({images: [], primary_image: undefined}, 1))},stamp='2026-10-16T00:00:00Z';
const stores=Array.from({length:7},(_,i)=>uiStore({id:'shop-'+i,connectionId:'connection-'+i}));
const owners=new Map(),requests=[],denied=new Set(),gates=new Map();let failSave=false,tree,session='chat-a',shop='shop-0',revision=0,capture=false,commits=[];
const key=(s,c)=>JSON.stringify([s,c]);
const currentKey=()=>key(session,stores.find(s=>s.id===shop).connectionId);
const makePlan=storeId=>({planId:'shared-plan-id',storeId,title:'Recorded draft recovery scenario',revision:1,status:'draft',createdAt:stamp,updatedAt:stamp,rows:[
{rowId:'price',action:'price',target:{offerId:'PRICE'},payload:{price:'20',currency_code:listingBase.currency_code},pricing:{mode:'manual'},revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}},
{rowId:'listing',action:'listing',target:{offerId:'LISTING'},payload:{...listingBase,offer_id:'LISTING'},revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}}
]});
const getPlan=(s,c)=>{const owner=key(s,c);if(!owners.has(owner))owners.set(owner,makePlan(stores.find(store=>store.connectionId===c).id));return owners.get(owner);};
const hold=(operation,owner)=>{let release;const promise=new Promise(resolve=>release=resolve);gates.set(operation+owner,{promise,release});return release;};
globalThis.fetch=async(url,options)=>{
 const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;
 if(resource==='views')return Response.json({views:[]});if(resource==='stores')return Response.json({stores});if(resource==='businessSettings')return Response.json({pricing:null});
 assert.equal(body?.action,'businessOperations');assert.ok(['list','revise'].includes(body.operation),'No platform submission is allowed');requests.push(body);
 const owner=key(body.sessionId,body.connectionId),gate=gates.get(body.operation+owner),plan=getPlan(body.sessionId,body.connectionId);
 if(body.operation==='list'){
  const result=structuredClone(plan);if(gate){await gate.promise;gates.delete(body.operation+owner);}if(denied.has(owner))return Response.json({status:'failed',error:{code:'ACCESS_DENIED',message:'无权读取批次。'}},{status:403});
  return Response.json({status:'ok',data:{plans:[result]}});
 }
 if(failSave){failSave=false;return Response.json({status:'failed',error:{code:'DRAFT_REJECTED',message:'保存未生效，请重试。'}},{status:409});}
 assert.equal(body.input.expectedRevision,plan.revision);if(gate){await gate.promise;gates.delete(body.operation+owner);}
 const next={...plan,revision:plan.revision+1,rows:plan.rows.map(row=>{const change=body.input.rows.find(item=>item.rowId===row.rowId);return change?{...row,...change}:row;})};owners.set(owner,next);return Response.json({status:'ok',data:next});
};
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name),field=label=>tree.root.findByProps({'aria-label':label});
const click=async name=>act(async()=>{assert.ok(button(name),name);assert.equal(!!button(name).props.disabled,false,name);button(name).props.onClick();await flush();});
const change=async(label,value)=>act(async()=>{assert.equal(!!field(label).props.disabled,false,label);field(label).props.onChange({target:{value}});await flush();});
const draw=()=> <React.Profiler id='drafts' onRender={()=>{if(capture&&tree)commits.push(JSON.stringify(tree.toJSON()));}}><AppsWorkspace currentSessionId={session}/></React.Profiler>;
const render=async()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});
const store=async id=>act(async()=>{shop=id;const event=new Event('apps-workbench-changed');event.detail={appId:'hallmark',board:{kind:'workbench',appId:'hallmark',workbenchId:'board',revision:++revision,context:{storeId:id},instances:[],savedComponents:[]}};window.dispatchEvent(event);await flush();});
const switchChat=async id=>{session=id;await render();};
const statusText=()=>tree.root.findAll(n=>n.props.role==='status').map(text).join(' ');
const noRecovery=()=>assert.equal(button('恢复修改'),undefined);
try{
 await render();await store('shop-0');await click('经营操作');
 await change('PRICE 售价','77');await change('LISTING 商品标题','PRIVATE UNSAVED TITLE');await change('LISTING 商品说明','PRIVATE UNSAVED DESCRIPTION');
 await click('工作台');await click('经营操作');assert.equal(field('PRICE 售价').props.value,'77');
 capture=true;commits=[];await store('shop-1');capture=false;
 assert.ok(commits.length);assert.ok(commits.every(commit=>!commit.includes('PRIVATE UNSAVED TITLE')&&!commit.includes('PRIVATE UNSAVED DESCRIPTION')),'No committed new-owner frame may display the old draft');
 assert.equal(field('PRICE 售价').props.value,'20');noRecovery();assert.match(statusText(),/暂存不等于保存/);assert.ok(!statusText().includes('PRIVATE UNSAVED TITLE'));
 const a=key('chat-a','connection-0');const releaseRead=hold('list',a);await store('shop-0');noRecovery();assert.equal(tree.root.findAllByProps({'aria-label':'PRICE 售价'}).length,0,'No cached fields while authority is being checked');
 await act(async()=>{releaseRead();await flush();});assert.ok(button('恢复修改'));assert.equal(field('PRICE 售价').props.value,'20','Do not restore automatically');
 await click('恢复修改');assert.equal(field('PRICE 售价').props.value,'77');assert.equal(field('LISTING 商品标题').props.value,'PRIVATE UNSAVED TITLE');assert.equal(field('操作批次').props.disabled,true);
 failSave=true;await click('保存草稿');assert.equal(field('PRICE 售价').props.value,'77');assert.match(statusText(),/保存未生效/);await click('保存草稿');assert.equal(getPlan('chat-a','connection-0').rows[0].payload.price,'77');assert.equal(field('操作批次').props.disabled,false);
 await store('shop-1');await store('shop-0');noRecovery();
 // Unparsed invalid JSON and already-applied structure are both retained across chat identity changes.
 await change('LISTING 商品说明','CHAT PRIVATE DESCRIPTION');await change('LISTING 完整字段','{ invalid private JSON');
 capture=true;commits=[];await switchChat('chat-b');capture=false;assert.ok(commits.every(commit=>!commit.includes('invalid private JSON')&&!commit.includes('CHAT PRIVATE DESCRIPTION')));noRecovery();
 await switchChat('chat-a');await click('恢复修改');assert.equal(field('LISTING 完整字段').props.value,'{ invalid private JSON');assert.equal(button('保存草稿').props.disabled,true);
 await click('放弃字段修改');assert.equal(field('LISTING 商品说明').props.value,'CHAT PRIVATE DESCRIPTION');await click('保存草稿');
 // A failed permission read reveals neither cached content nor a restoration entry; an explicit successful retry can recover.
 await change('PRICE 售价','91');await store('shop-1');denied.add(a);await store('shop-0');noRecovery();assert.equal(tree.root.findAllByProps({'aria-label':'PRICE 售价'}).length,0);assert.match(JSON.stringify(tree.toJSON()),/无权读取批次/);
 denied.delete(a);await click('刷新批次');assert.ok(button('恢复修改'));await click('恢复修改');assert.equal(field('PRICE 售价').props.value,'91');await click('保存改价草稿');
 // Revisions and plan identities must match exactly, even though every owner uses equal plan/row IDs.
 await change('PRICE 售价','92');await store('shop-1');getPlan('chat-a','connection-0').revision++;await store('shop-0');noRecovery();assert.match(JSON.stringify(tree.toJSON()),/不能直接恢复旧修改/);await click('放弃暂存');assert.notEqual(field('PRICE 售价').props.value,'92');
 await change('PRICE 售价','93');await store('shop-1');getPlan('chat-a','connection-0').planId='replacement-plan';await store('shop-0');noRecovery();await click('放弃暂存');
 // A late save receipt must not mutate or focus the new owner; the old revision is not blindly reapplied on return.
 await change('PRICE 售价','94');const releaseSave=hold('revise',a);await click('保存改价草稿');assert.ok(button('保存改价草稿').props.disabled);await store('shop-1');
 await act(async()=>{releaseSave();await flush();});assert.equal(field('PRICE 售价').props.value,'20');noRecovery();await store('shop-0');assert.equal(field('PRICE 售价').props.value,'94');noRecovery();await click('放弃暂存');
 // A stale list response cannot hydrate another owner.
 const releaseOldRead=hold('list',a);await click('刷新批次');await store('shop-2');await act(async()=>{releaseOldRead();await flush();});assert.equal(field('PRICE 售价').props.value,'20');noRecovery();
 // Owner-count eviction is visible and never contains discarded field text; surviving owners remain restorable.
 await store('shop-0');await change('PRICE 售价','101');for(let i=1;i<=4;i++){await store('shop-'+i);await change('PRICE 售价',String(101+i));}await store('shop-5');assert.match(statusText(),/容量上限清除/);await store('shop-0');noRecovery();await store('shop-4');await click('恢复修改');assert.equal(field('PRICE 售价').props.value,'105');await click('保存改价草稿');
 // Oversize invalid raw text is not falsely advertised as retained.
 await change('LISTING 完整字段','x'.repeat(300*1024));await store('shop-6');assert.match(statusText(),/超过暂存容量，未能保留/);await store('shop-4');noRecovery();assert.ok(field('LISTING 完整字段').props.value.length<300*1024);
 await change('PRICE 售价','106');await store('shop-6');now+=30*60*1000;await act(async()=>{for(const tick of intervals)tick();await flush();});assert.match(statusText(),/超过 30 分钟/);await store('shop-4');noRecovery();
 // Staggered expirations must re-render even when the prior expiry notice remains undismissed.
 await store('shop-0');await change('PRICE 售价','111');await store('shop-1');now+=60*1000;await change('PRICE 售价','112');await store('shop-2');await store('shop-1');assert.ok(button('恢复修改'));
 now+=29*60*1000;await act(async()=>{for(const tick of intervals)tick();await flush();});assert.ok(button('恢复修改'),'later snapshot survives first sweep');assert.match(statusText(),/超过 30 分钟/);
 now+=60*1000;await act(async()=>{for(const tick of intervals)tick();await flush();});noRecovery();assert.equal(field('PRICE 售价').props.disabled,false,'second expiry unblocks editor even with unchanged notice text');
 assert.ok(requests.every(request=>['list','revise'].includes(request.operation)));console.log('DRAFT_RECOVERY_OWNER_REVISION_PERMISSION_RACE_CAPACITY_PASS');
}finally{for(const gate of gates.values())gate.release();if(tree)await act(async()=>tree.unmount());assert.equal(intervals.size,0,'unmount cleans all recovery timers');Date.now=realNow;globalThis.setInterval=realInterval;globalThis.clearInterval=realClearInterval;globalThis.fetch=originalFetch;globalThis.window=originalWindow;}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolate-unrelated-children',setup(plugin){plugin.onLoad({filter:/plugin-apps[\\/]client[\\/].*\.tsx$/},args=>{const name=args.path.split(/[\\/]/).at(-1)!;if(stub[name])return {contents:stub[name],loader:'tsx'};});}}]});
const result=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/DRAFT_RECOVERY_OWNER_REVISION_PERMISSION_RACE_CAPACITY_PASS/);t.diagnostic(result.stdout.trim());
});
