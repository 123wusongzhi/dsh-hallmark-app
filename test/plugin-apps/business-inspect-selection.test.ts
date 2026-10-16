import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('platform inspection retains checked rows, batch inputs and filters for continued editing or restoration', async t => {
 const output = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'inspect-selection');
const source=uiProduct({},1),now='2026-10-16T06:00:00Z';
let tree,fail=false,release,hold=false,inspections=0;const calls=[];
const forbidden=async()=>{throw Error('No source, review or merchant write allowed');};
const engine=new Engine({store:port,source:{load:forbidden},reviewer:{review:forbidden},transport:{execute:forbidden,inspect:forbidden},now:()=>now});
const row=(id,status)=>({rowId:id,action:'price',target:{offerId:id},payload:{name:source.title,price:'20',currency_code:'USD'},pricing:{mode:'manual'},revision:1,status,issues:[],corrections:[],repairHistory:{}});
const plan={planId:'plan',storeId:'shop',title:source.title,revision:1,status:'partial',rows:[row('EDIT','draft'),row('RESTORE','succeeded'),{...row('PENDING','pending'),executionId:'missing-receipt'}],createdAt:now,updatedAt:now};port.put('business_plans','plan',plan);
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);calls.push(body.operation);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list('shop')}});
 if(body.operation==='inspect'){inspections++;if(hold)await new Promise(r=>release=r);if(fail)return Response.json({status:'failed',error:{code:'READ_FAILED',message:'本地核查读取失败'}},{status:400});return Response.json({status:'ok',data:await engine.inspect(body.input.planId)});}
 throw Error('Unexpected operation '+body.operation);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const change=async(label,value)=>act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:{value,checked:value}});await flush();});
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.equal(!!b.props.disabled,false,name);b.props.onClick();await flush();});
try{
 await act(async()=>{tree=create(<BusinessOperations sessionId='chat' storeId='shop'/>);await flush();});
 await change('选择 EDIT',true);await change('选择 RESTORE',true);await change('批量填写售价','37');await change('批量售价币种','USD');await change('筛选商品','EDIT');
 assert.match(text(tree.toJSON()),/已选 2 行，当前可见 1 行，隐藏 1 行/);
 // A failed status read must preserve the user's selection and unapplied batch input.
 fail=true;await click('核查平台状态');assert.equal(tree.root.findByProps({'aria-label':'选择 EDIT'}).props.checked,true);assert.equal(tree.root.findByProps({'aria-label':'批量填写售价'}).props.value,'37');assert.equal(button('恢复所选已完成项').props.disabled,false);
 // A successful inspection can update pending status, but must not discard unrelated local work.
 fail=false;hold=true;await click('核查平台状态');assert.equal(button('核查平台状态').props.disabled,true);assert.equal(tree.root.findByProps({'aria-label':'选择 EDIT'}).props.checked,true);
 await act(async()=>{release();await flush();});
 assert.equal(engine.get('plan').rows[2].status,'unknown','Production engine resolves missing original receipt without resending');
 assert.equal(tree.root.findByProps({'aria-label':'选择 EDIT'}).props.checked,true,'Inspection must retain checked editing row');
 assert.equal(tree.root.findByProps({'aria-label':'批量填写售价'}).props.value,'37','Inspection must retain unapplied batch price');
 assert.equal(tree.root.findByProps({'aria-label':'批量售价币种'}).props.value,'USD');assert.equal(tree.root.findByProps({'aria-label':'筛选商品'}).props.value,'EDIT');assert.match(text(tree.toJSON()),/已选 2 行，当前可见 1 行，隐藏 1 行/);assert.equal(button('恢复所选已完成项').props.disabled,false,'Hidden completed selection remains restorable');
 hold=false;await click('核查平台状态');assert.equal(tree.root.findByProps({'aria-label':'批量填写售价'}).props.value,'37','Repeated inspection is equally non-destructive');
 await click('查看隐藏选择');assert.equal(tree.root.findByProps({'aria-label':'选择 RESTORE'}).props.checked,true);assert.equal(tree.root.findByProps({'aria-label':'选择 PENDING'}).props.checked,false);
 await click('填入可见所选 1 行草稿');assert.equal(tree.root.findByProps({'aria-label':'EDIT 售价'}).props.value,'37');assert.equal(engine.get('plan').rows[0].payload.price,'20','Batch input remains unsaved');
 assert.equal(inspections,3);assert.ok(calls.every(operation=>['list','inspect'].includes(operation)),'No submit, revise, restore or platform write');
 console.log('INSPECT_SELECTION_REACT_ENGINE_PASS');
}finally{if(tree)await act(async()=>tree.unmount());db.close();}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const run=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);t.diagnostic(run.stdout.trim());
});
