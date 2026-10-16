import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('restoring completed listing rows preserves unfinished new actions and never submits', async t => {
 const output = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const values=new Map(),clone=v=>v===undefined?v:structuredClone(v);
const store={get:(ns,key)=>clone(values.get(ns+':'+key)),put:(ns,key,value)=>values.set(ns+':'+key,clone(value)),list:ns=>[...values].filter(([key])=>key.startsWith(ns+':')).map(([,value])=>clone(value)),transaction:fn=>fn()};
const product=uiProduct();let forbidden=0,tree,release,hold=false,fail=false,session='restore-input',active=true;const calls=[];
const deny=async()=>{forbidden++;throw Error('No external operation permitted');};
const engine=new Engine({store,source:{load:async()=>{throw Error('Explicit local source unavailable');}},reviewer:{review:deny},transport:{execute:deny,inspect:deny}});
const row=(id,status)=>({rowId:id,action:'listing',target:{offerId:id},payload:{name:product.title,images:[product.image]},revision:1,status,issues:[],corrections:[],repairHistory:{}});
const plan={planId:'original',storeId:'shop',title:product.title,revision:1,status:'partial',rows:[row('DONE','succeeded'),{...row('FIX','needs_user'),issues:[{code:'TITLE_REQUIRED',field:'name',message:'请补充标题'}]}],createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z'};
store.put('business_plans',plan.planId,plan);
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);calls.push(body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list('shop')}});
 if(body.operation==='restore'){if(fail)return Response.json({status:'failed',error:{code:'LOCAL_FAILURE',message:'恢复草稿未生成'}},{status:409});if(hold)await new Promise(r=>release=r);return Response.json({status:'ok',data:await engine.restore(body.input)});}
 throw Error('Unexpected '+body.operation);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const field=label=>tree.root.findByProps({'aria-label':label});
const change=async(label,value)=>act(async()=>{assert.ok(!field(label).props.disabled,label);field(label).props.onChange({target:{value,checked:value}});await flush();});
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.ok(!b.props.disabled,name);b.props.onClick();await flush();});
const render=async()=>act(async()=>{const el=<BusinessOperations sessionId={session} storeId='shop' active={active}/>;if(tree)tree.update(el);else tree=create(el);await flush();});
const confirm=()=>button('放弃新增输入并生成恢复草稿');
const restores=()=>calls.filter(c=>c.operation==='restore').length;
try{
 await render();await change('选择 DONE',true);
 const cleanRestore=button('恢复所选已完成项').props.onClick;
 await change('新增销售货号','KEEP-UNSAVED');await change('新增目标售价','77');
 await click('恢复所选已完成项');
 assert.equal(field('操作批次').props.value,plan.planId,'Restore must not silently navigate away from unfinished new input');
 assert.equal(field('新增销售货号').props.value,'KEEP-UNSAVED');assert.equal(field('新增目标售价').props.value,'77');
 assert.equal(field('选择 DONE').props.checked,true);assert.equal(engine.list('shop').length,1);assert.equal(restores(),0);
 assert.match(text(tree.toJSON()),/生成恢复草稿会进入新批次/);assert.ok(confirm());
 const cancelled=confirm().props.onClick;await click('继续编辑');
 await act(async()=>{cancelled();cleanRestore();cleanRestore();await flush();});assert.equal(restores(),0);
 assert.equal(field('新增销售货号').props.value,'KEEP-UNSAVED');
 await click('恢复所选已完成项');const edited=confirm().props.onClick;await change('新增目标售价','78');
 await act(async()=>{edited();await flush();});assert.equal(confirm(),undefined);assert.equal(restores(),0);
 await click('恢复所选已完成项');const selected=confirm().props.onClick;await change('选择 DONE',false);
 await act(async()=>{selected();await flush();});assert.equal(restores(),0);await change('选择 DONE',true);
 // Refresh with a same-revision content change invalidates an earlier restore decision.
 await click('恢复所选已完成项');const changed=confirm().props.onClick;
 store.put('business_plans',plan.planId,{...plan,rows:plan.rows.map(row=>({...row,payload:{...row.payload,description:'new saved content'}}))});
 await click('刷新批次');await act(async()=>{changed();await flush();});assert.equal(confirm(),undefined);assert.equal(restores(),0);
 await click('恢复所选已完成项');const hidden=confirm().props.onClick;active=false;await render();active=true;await render();
 await act(async()=>{hidden();await flush();});assert.equal(restores(),0);
 // A known failed create keeps the original form and selection, allowing another explicit attempt.
 fail=true;await click('恢复所选已完成项');await click('放弃新增输入并生成恢复草稿');
 assert.equal(restores(),1);assert.equal(field('新增销售货号').props.value,'KEEP-UNSAVED');assert.equal(field('新增目标售价').props.value,'78');assert.equal(field('选择 DONE').props.checked,true);assert.equal(field('操作批次').props.value,plan.planId);
 fail=false;await click('恢复所选已完成项');const oldOwner=confirm().props.onClick;session='another-chat';await render();
 await act(async()=>{oldOwner();await flush();});assert.equal(restores(),1);
 // A clean form needs no extra confirmation; explicit restore is still one request under repeat clicks.
 await change('选择 DONE',true);assert.equal(field('新增销售货号').props.value,'');
 hold=true;const restore=button('恢复所选已完成项').props.onClick;
 await act(async()=>{restore();restore();await flush();});assert.equal(restores(),2);
 for(const label of ['新增销售货号','新增目标售价','新增动作','操作批次','选择 DONE'])assert.equal(field(label).props.disabled,true,'Pending restore locks '+label);
 assert.equal(button('添加到草稿').props.disabled,true);assert.equal(button('恢复所选已完成项').props.disabled,true);
 assert.equal(field('操作批次').props.value,plan.planId,'No navigation until restore result');
 session='third-chat';await render();const nextOwnerPlan=field('操作批次').props.value;
 await act(async()=>{release();await flush();});assert.equal(field('操作批次').props.value,nextOwnerPlan,'Late restore response cannot select a batch in another owner');
 hold=true;await change('操作批次',plan.planId);await change('选择 DONE',true);
 await change('新增动作','stock');await change('新增数量','8');await change('新增动作','price');
 await click('恢复所选已完成项');assert.ok(confirm(),'Hidden action input also requires confirmation');
 const approved=confirm().props.onClick;await act(async()=>{approved();approved();await flush();});assert.equal(restores(),3,'Double confirmation generates only one restore draft');
 assert.equal(field('新增销售货号').props.disabled,true);
 await act(async()=>{release();await flush();});
 const restored=engine.get(field('操作批次').props.value);
 assert.notEqual(restored.planId,plan.planId);assert.equal(restored.rows.length,1);assert.equal(restored.rows[0].action,'archive');assert.equal(restored.rows[0].payload.archived,true);
 assert.equal(engine.get(plan.planId).rows[0].status,'succeeded');assert.equal(engine.get(plan.planId).rows[1].status,'needs_user');assert.equal(engine.get(plan.planId).revision,1,'Restore does not revise original plan');
 assert.equal(forbidden,0);assert.ok(calls.every(c=>['list','restore'].includes(c.operation)));
 console.log('RESTORE_INPUT_RECOVERY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const run=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);t.diagnostic(run.stdout.trim());
});
