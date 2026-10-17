import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import {realCollection} from '../real-data/corpus.ts';

for (const scenario of ['snapshot', 'failure', 'newer-read', 'read-first', 'owner-change']) test('batch receipt ordering after tab resume: ' + scenario, async t => {
 const output=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'recovery-actions');
const source=uiProduct({},1),purchase=${JSON.stringify(realCollection(1).skus[0].purchaseCost)};
const scenario=${JSON.stringify(scenario)};
let releaseSend,releaseList,holdSend=true,holdList=false,lists=0;let tree,plan,now=Date.parse('2026-10-16T06:00:00Z'),submits=0;const sends=[];
const engine=new Engine({store:port,now:()=>new Date(now).toISOString(),source:{async load({storeId,row}){return {identity:{storeId,...row.target},current:{},source,procurement:[{itemId:source.id,sourceSkuId:source.sku,unitPrice:purchase.amount,currency:purchase.currency,unit:purchase.unit??'来源 SKU 销售单位'}],assets:[{url:source.image,contentHash:'recorded-image'}]};}},reviewer:{async review(request){return {status:'passed',questions:request.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'fixture',reasonCode:'passed'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}},transport:{async execute(input){sends.push(input.row.target.offerId);if(holdSend){holdSend=false;await new Promise(r=>releaseSend=r);}return {status:input.row.target.offerId==='DONE'?'succeeded':input.row.target.offerId==='FAIL'?'rejected':'pending',issues:input.row.target.offerId==='FAIL'?[{code:'PLATFORM_FIELD',message:'本地退回控制'}]:[]};},async inspect(){return {status:'unknown'};}}});
const row=(status,code='PLATFORM_FIELD',offer='AUDIT-'+status)=>({rowId:offer,action:'listing',target:{offerId:offer},procurement:[{itemId:source.id,sourceSkuId:source.sku,quantity:1}],payload:{name:source.title,description:source.title,price:'20',currency_code:purchase.currency,images:[source.image]},revision:1,status,issues:['succeeded','draft'].includes(status)?[]:[{code,message:'本地故障控制：需处理商品字段',field:'name'}],corrections:[],repairHistory:{},...(code==='OZON_RATE_LIMIT'?{retryAt:'2026-10-16T06:01:00Z'}:{})});
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);
 if(body.operation==='list'){lists++;const plans=engine.list('shop');if(holdList){holdList=false;await new Promise(r=>releaseList=r);if(scenario==='failure')throw Error('本地迟到读取失败');}return Response.json({status:'ok',data:{plans}});}
 if(body.operation==='submit'){submits++;plan=await engine.submit(body.input);return Response.json({status:'ok',data:plan});}
 if(body.operation==='revise'){plan=await engine.revise(body.input);return Response.json({status:'ok',data:plan});}
 throw Error('Unexpected local operation '+body.operation);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.equal(!!b.props.disabled,false,name);b.props.onClick();await flush();});
const mount=async rows=>{if(tree)await act(async()=>tree.unmount());plan={planId:'plan',storeId:'shop',title:source.title,revision:1,status:'blocked',rows:JSON.parse(JSON.stringify(rows)),createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};port.put('business_plans','plan',plan);await act(async()=>{tree=create(<BusinessOperations sessionId='chat' storeId='shop'/>);await flush();});};
const states=()=>tree.root.findAll(n=>typeof n.props.className==='string'&&n.props.className.startsWith('apps-business-status is-')).map(n=>n.props.className.replace('apps-business-status is-',''));
const render=async(active=true,sessionId='chat')=>act(async()=>{tree.update(<BusinessOperations sessionId={sessionId} storeId='shop' active={active}/>);await flush();});
try{
 await mount([row('draft','','DONE'),row('draft','','FAIL'),row('draft','','WAIT')]);
 await click('确认整批范围后提交');await click('返回检查');assert.equal(submits,0,'Cancelling scope confirmation does not submit');
 await click('确认整批范围后提交');const confirm=button('确认提交整批 3 个动作').props.onClick;
 await act(async()=>{confirm();confirm();await flush();});assert.equal(submits,1,'Repeated confirmation is single-flight');
 assert.equal(sends.length,1);assert.equal(engine.get('plan').rows[0].status,'dispatching');
 assert.equal(button('刷新批次').props.disabled,true,'In-flight toolbar refresh is unavailable');
 await render(false);holdList=true;await render();assert.ok(releaseList);
 if(scenario==='read-first')await act(async()=>{releaseList();await flush();});
 await act(async()=>{releaseSend();await flush();});
 assert.equal(engine.get('plan').revision,1,'Execution status changes do not increment plan revision');
 assert.deepEqual(engine.get('plan').rows.map(r=>r.status),['succeeded','rejected','pending']);
 assert.deepEqual(states(),['succeeded','rejected','pending']);assert.match(text(tree.toJSON()),/已完成 1 行/);assert.match(text(tree.toJSON()),/平台处理中 1 行/);
 if(scenario==='newer-read'){
  const latest=engine.get('plan');latest.rows[2].status='rejected';latest.rows[2].issues=[{code:'PLATFORM_FIELD',message:'更新的本地核查结果'}];port.put('business_plans','plan',latest);
 }
 if(scenario==='owner-change')await render(true,'other-chat');
 if(scenario!=='read-first')await act(async()=>{releaseList();await flush();});
 const expected=scenario==='newer-read'?['succeeded','rejected','rejected']:['succeeded','rejected','pending'];
 assert.deepEqual(states(),expected,'Late pre-completion list must not replace settled rows; newer re-read remains authoritative');
 assert.equal(lists,scenario==='read-first'?2:3,'Only a superseded read requires one new read; owner navigation reads its own list');
 assert.equal(button('刷新批次').props.disabled,false,'Recovery does not strand loading state');
 assert.deepEqual(sends,['DONE','FAIL','WAIT']);assert.equal(submits,1,'Reading again never resends any row');
 if(scenario==='owner-change')assert.doesNotMatch(text(tree.toJSON()),/已取得本次提交结果/,'Old-owner receipt notice cannot enter new editor');
 console.log('BULK_RECEIPT_RESUME_PASS '+scenario);
}finally{if(tree)await act(async()=>tree.unmount());db.close();}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:process.env.DSH_BULK_BASELINE==='1'||process.env.DSH_BULK_REMOVE_GUARD==='1'?[{name:'remove-receipt-order-guard',setup(build){build.onLoad({filter:/business-operations\.tsx$/},args=>({loader:'tsx',contents:process.env.DSH_BULK_BASELINE==='1'?readFileSync('artifacts/bulk-feedback/baseline-business-operations.tsx','utf8'):readFileSync(args.path,'utf8').replaceAll('resultVersion !== acceptedResult.current','false')}));}}]:[]});
 const run=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(run.status,0,JSON.stringify({status:run.status,signal:run.signal,error:run.error?.message,stdout:run.stdout,stderr:run.stderr}));t.diagnostic(run.stdout.trim());
});
