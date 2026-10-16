import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('business confirmation revalidates resumed plans without silently accepting changed revisions', async t => {
  const output = await build({stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// Recorded product/store labels; revision, price and delayed/failed reads are explicit local controls.
let reverseKeys=false,rowStatus='draft',extraRow=false,issues=[],retryAt;let tree,active=true,revision=1,mode='ready',hold=false,release,requests=[],allRequests=[];
const plan=()=>({planId:'plan',storeId:'shop',title:uiProduct().title,revision,status:'draft',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',rows:[{rowId:'row',action:'price',target:{offerId:'PRICE'},payload:{price:revision===1?'20':'25',currency_code:uiProduct().currency},pricing:{mode:'manual'},revision,status:rowStatus,issues,retryAt,corrections:[],repairHistory:{}},...(extraRow?[{rowId:'second',action:'price',target:{offerId:'SECOND'},payload:{price:'20',currency_code:uiProduct().currency},revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}}]:[])]});
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);requests.push(body);allRequests.push(body);assert.equal(body.operation,'list','Read-only fixture rejects every mutation');
 const snapshot=plan();if(reverseKeys){snapshot.rows[0].payload=Object.fromEntries(Object.entries(snapshot.rows[0].payload).reverse());snapshot.rows[0].target=Object.fromEntries(Object.entries(snapshot.rows[0].target).reverse());snapshot.rows[0].issues=snapshot.rows[0].issues.map(issue=>Object.fromEntries(Object.entries(issue).reverse()));}
 const response=mode==='denied'?Response.json({status:'failed',error:{code:'ACCESS_DENIED',message:'批次无法读取'}},{status:403}):Response.json({status:'ok',data:{plans:mode==='missing'?[]:[snapshot]}});
 if(hold)await new Promise(resolve=>release=resolve);return response;
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const confirmation=()=>tree.root.findAllByProps({'aria-label':'提交范围确认'})[0];
const render=async()=>act(async()=>{const element=<BusinessOperations sessionId='chat' storeId='shop' active={active}/>;if(tree)tree.update(element);else tree=create(element);await flush();});
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.equal(!!b.props.disabled,false,name);b.props.onClick();await flush();});
const resume=async()=>{active=false;await render();hold=true;active=true;await render();};
const finish=async()=>act(async()=>{hold=false;release();await flush();});
const reset=async()=>{if(tree)await act(async()=>tree.unmount());tree=undefined;active=true;revision=1;rowStatus='draft';reverseKeys=false;extraRow=false;issues=[];retryAt=undefined;mode='ready';hold=false;requests=[];await render();await click('确认整批范围后提交');};
try{
 await reset();await resume();
 const checking=button('正在核对最新批次…');assert.ok(checking);assert.equal(checking.props.disabled,true);assert.doesNotMatch(text(confirmation()),/正在提交/);
 // Even invoking the current disabled handler cannot submit during revalidation.
 const before=requests.length;await act(async()=>{checking.props.onClick();await flush();});assert.equal(requests.length,before);
 await finish();assert.ok(confirmation());assert.match(text(confirmation()),/版本 1/);assert.equal(button('确认提交整批 1 个动作').props.disabled,false);
 await click('返回检查');assert.equal(confirmation(),undefined);
 await click('确认整批范围后提交');active=false;await render();revision=2;hold=true;active=true;await render();await finish();
 assert.equal(confirmation(),undefined);assert.match(text(tree.root),/批次已变化.*重新检查/);assert.equal(tree.root.findByProps({'aria-label':'PRICE 售价'}).props.value,'25');
 await click('确认整批范围后提交');assert.match(text(confirmation()),/版本 2/);await click('返回检查');
 // Explicit cancellation while a read is pending never resurrects the confirmation.
 await click('确认整批范围后提交');await resume();await click('返回检查');await finish();assert.equal(confirmation(),undefined);
 for(const outcome of ['missing','denied']){await reset();active=false;await render();mode=outcome;active=true;await render();assert.equal(confirmation(),undefined);assert.match(text(tree.root),outcome==='missing'?/批次已变化.*重新检查/:/无法核对.*重新检查/);}
 // Server execution changes row states without incrementing plan revision.
 for(const state of ['rejected','unknown','succeeded']){await reset();active=false;await render();rowStatus=state;active=true;await render();assert.equal(confirmation(),undefined);assert.match(text(tree.root),/批次已变化.*重新检查/);}
 await reset();active=false;await render();extraRow=true;active=true;await render();assert.equal(confirmation(),undefined);await click('确认整批范围后提交');active=false;await render();rowStatus='succeeded';active=true;await render();assert.equal(confirmation(),undefined);assert.equal(button('确认整批范围后提交').props.disabled,false,'Remaining draft can be newly confirmed');
 for(const change of [()=>issues=[{code:'NEW_FIELD',message:'请核实字段'}],()=>retryAt='2026-10-16T12:00:00Z']){await reset();active=false;await render();change();active=true;await render();assert.equal(confirmation(),undefined);assert.match(text(tree.root),/批次已变化.*重新检查/);}
 await reset();active=false;await render();active=true;await render();assert.ok(confirmation(),'Same state and decision retains confirmation');
 await click('返回检查');issues=[{code:'A',message:'提示 A'},{code:'B',message:'提示 B'}];active=false;await render();active=true;await render();await click('确认整批范围后提交');active=false;await render();issues=issues.slice().reverse();reverseKeys=true;active=true;await render();assert.ok(confirmation(),'Equivalent nested key and issue ordering retains confirmation');active=false;await render();issues=[{code:'A',message:'提示内容已变化'},{code:'B',message:'提示 B'}];active=true;await render();assert.equal(confirmation(),undefined,'Same issue code with changed guidance invalidates confirmation');
 assert.ok(allRequests.every(r=>r.operation==='list'));console.log('CONFIRMATION_REVALIDATION_SAME_CHANGED_MISSING_DENIED_CANCEL_PASS');
}finally{if(release&&hold)release();if(tree)await act(async()=>tree.unmount());}
`}, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external'});
  const result = spawnSync(process.execPath, ['--input-type=module'], {input: output.outputFiles[0].text, encoding: 'utf8', timeout: 20_000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /CONFIRMATION_REVALIDATION_SAME_CHANGED_MISSING_DENIED_CANCEL_PASS/);t.diagnostic(result.stdout.trim());
});
