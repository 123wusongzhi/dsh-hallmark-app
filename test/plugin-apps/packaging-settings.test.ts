import {uiProduct,uiProducts,uiFixturePrelude,uiText} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const fixture=`
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessSettings} from './packages/plugin-apps/client/business-settings.tsx';
import {BusinessPackagingRepository} from './packages/business-packaging/src/index.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let tree;const requests=[],data=new Map();
const repository=new BusinessPackagingRepository({get:(c,id)=>data.get(c+id),put:(c,id,v)=>{data.set(c+id,v);return v;},list:()=>[...data.values()],transaction:fn=>fn()});
const makeRow=(members,id)=>{const hydrated=members.map(member=>({...member,title:uiProduct({},20).title,sourceRevision:'v1',commonPackage:uiProduct({},20).sourcePackage}));const result=repository.resolve({members:hydrated,...(id?{combinationId:id}:{})});const override=repository.readOverride(result.target);return {key:JSON.stringify(result.target.kind==='sku'?result.target:['combination',result.target.composition]),target:result.target,kind:result.target.kind,composition:hydrated,result,override:override??null,revision:override?.revision??0};};
const read=input=>{const rows=new Map();if(input.itemIds?.includes('p1'))for(const sku of ['red','blue']){const row=makeRow([{itemId:'p1',sourceSkuId:sku,quantity:1}]);rows.set(row.key,row);}for(const saved of repository.list())if(saved.target.kind==='combination'){const row=makeRow(saved.target.composition,saved.target.id);rows.set(row.key,row);}for(const composition of input.compositions??[]){const row=makeRow(composition.members,composition.id);rows.set(row.key,row);}return {rows:[...rows.values()],warnings:[],products:[{...uiProduct({id:'p1'},20),skuCount:2}]};};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=businessSettings'))return Response.json({connections:[{connectionId:'source',displayName:'采集来源'}],connectionId:'source',stores:[],store:null,pricing:null,packagingAvailable:true});
 const request=JSON.parse(options.body);requests.push(request);assert.equal(request.connectionId,'source');assert.equal(Object.hasOwn(request,'sessionId'),false);
 if(request.operation==='packaging.search')return Response.json({items:[{...uiProduct({id:'p1'},20),source:'alibaba_com',skuCount:2}],total:1});
 if(request.operation==='packaging.read')return Response.json(read(request.input));
 if(request.operation==='packaging.save')return Response.json({saved:repository.saveOverrides(request.input.rows)});
 if(request.operation==='packaging.remove')return Response.json({saved:repository.saveOverrides(request.input.rows.map(row=>({...row,values:{weightKg:null,dimensionsCm:null}})))});
 throw Error('unexpected '+request.operation);
};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async(name)=>{const found=button(name);assert.ok(found,name);assert.equal(!!found.props.disabled,false);await act(async()=>{found.props.onClick();await settle();});};
const input=label=>tree.root.findAllByType('input').find(node=>node.props['aria-label']===label);
const change=async(label,value)=>act(async()=>{const found=input(label);assert.ok(found,label);found.props.onChange({target:{value}});await settle();});
const check=async(label,checked=true)=>act(async()=>{const found=input(label);assert.ok(found,label);found.props.onChange({target:{checked}});await settle();});
const field=label=>{const node=tree.root.findAllByType('label').find(node=>text(node.children[0])===label);assert.ok(node,label);return node.findAll(node=>node.type==='input'||node.type==='select')[0];};
const changeField=async(label,value)=>act(async()=>{field(label).props.onChange({target:{value}});await settle();});
try{
 await act(async()=>{tree=create(<BusinessSettings/>);await settle();});assert.equal(requests.length,0,'opening settings must not read collection details');
 await changeField('查找采集商品','测试');await click('查找商品');
 await act(async()=>{tree.root.findByProps({className:'packaging-search-item'}).findByType('input').props.onChange({target:{checked:true}});await settle();});
 await click('读取所选商品的包装');assert.deepEqual(requests.map(row=>row.operation),['packaging.search','packaging.read']);
`;
async function scenario(source:string,setup=fixture){
  const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'packaging-ui-'));
  try{
    const entry=resolve(directory,'ui.mjs');
    await build({stdin:{resolveDir:process.cwd(),sourcefile:'packaging-ui-test.tsx',loader:'tsx',contents:setup+source+`\nconsole.log('PACKAGING_UI_PASS');}finally{if(tree)await act(async()=>tree.unmount());}`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/PACKAGING_UI_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep+'packaging-ui-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
}
test('packaging UI lazily reads selected products, edits one field, bulk applies and restores source values',async()=>scenario(`
 assert.equal(input('red weight').props.placeholder,'0.17');assert.equal(input('red weight').props.value,'');
 await change('red weight','0.5');assert.equal(field('采集来源连接').props.disabled,true,'source cannot change across an unsaved packaging draft');
 await click('保存包装修改');assert.equal(input('red weight').props.value,'0.5');assert.equal(field('采集来源连接').props.disabled,false);
 const saved=requests.find(row=>row.operation==='packaging.save').input.rows[0];assert.equal(saved.expectedRevision,0);assert.equal(saved.values.weightKg,.5);assert.equal(saved.values.dimensionsCm,null);
 await check('选择当前表格所有包装行');await changeField('批量重量（kg）','0.9');await click('填入表格草稿');await click('保存包装修改');
 assert.equal(input('red weight').props.value,'0.9');assert.equal(input('blue weight').props.value,'0.9');
 const batch=requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows;assert.equal(batch.length,2);assert.equal(batch[0].expectedRevision,1);assert.equal(batch[1].expectedRevision,0);
 await click('恢复自动');assert.equal(input('red weight').props.value,'');assert.equal(input('red weight').props.placeholder,'0.17');assert.equal(input('blue weight').props.value,'0.9');
`));
test('packaging UI edits multi-SKU quantities, persists automatic combinations and rejects partial dimensions locally',async()=>scenario(`
 await check('选择当前表格所有包装行');await click('用所选 SKU 建立组合');await change('red 组成数量','2');await click('计算组合并加入表格');
 assert.match(text(tree.toJSON()),/组合已加入表格草稿/);await click('保存包装修改');
 const combination=repository.list().find(row=>row.target.kind==='combination');assert.ok(combination);assert.deepEqual(combination.target.composition,[{itemId:'p1',sourceSkuId:'red',quantity:2},{itemId:'p1',sourceSkuId:'blue',quantity:1}]);assert.deepEqual(combination.values,{});assert.match(text(tree.toJSON()),/0.51 kg/);
 await change('red length','30');const writes=requests.filter(row=>row.operation==='packaging.save').length;await click('保存包装修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').length,writes);assert.match(text(tree.toJSON()),/尺寸请填写完整/);
 await change('red width','12');await change('red height','8');await click('保存包装修改');assert.deepEqual(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).values.dimensionsCm,{length:30,width:12,height:8});
`));

test('external cross-connection loading disables packaging edits while local cancellation retains rows',async()=>{
 const setup=fixture.replace('let tree;', 'let tree,holdSettingsRead=false,releaseSettingsRead;').replace(
  "if(String(url).includes('resource=businessSettings'))return Response.json({connections:[{connectionId:'source',displayName:'采集来源'}],connectionId:'source',stores:[],store:null,pricing:null,packagingAvailable:true});",
  "if(String(url).includes('resource=businessSettings')){const cross=new URL(String(url),'http://local.test').searchParams.get('storeId')==='cross';if(holdSettingsRead){holdSettingsRead=false;await new Promise(resolve=>releaseSettingsRead=resolve);}return Response.json({connections:[{connectionId:'source',displayName:'采集来源'},{connectionId:'other',displayName:'其他连接'}],connectionId:cross?'other':'source',stores:[],store:cross?{...uiStore(),id:'cross',name:'跨连接测试店铺',sourceConnectionId:'other',enabled:true}:null,pricing:null,packagingAvailable:true});}"
 );
 await scenario(`
 holdSettingsRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 let node=input('red weight'),blocked=false;while(node){if(node.type==='fieldset'&&node.props.disabled)blocked=true;node=node.parent;}assert.equal(blocked,true,'a real browser blocks edits to packaging while its connection may be replaced');
 await click('取消切换，继续原店铺');await act(async()=>{releaseSettingsRead();await settle();});
 assert.ok(input('red weight'));assert.equal(field('采集来源连接').props.value,'source');assert.equal(requests.filter(row=>row.operation==='packaging.save').length,0);
 `,setup);
});

const receiptFixture=fixture.replace('let tree;', 'let tree,failWrite=false,failRead=false,holdRead=false,releaseRead;').replace(
 "if(request.operation==='packaging.read')return Response.json(read(request.input));",
 "if(request.operation==='packaging.read'){if(failRead){failRead=false;return Response.json({error:{message:'刷新暂不可用'}},{status:503});}const snapshot=read(request.input);if(holdRead){holdRead=false;await new Promise(resolve=>releaseRead=resolve);}return Response.json(snapshot);}"
).replace(
 "if(request.operation==='packaging.save')return Response.json({saved:repository.saveOverrides(request.input.rows)});",
 "if(request.operation==='packaging.save'){if(failWrite)return Response.json({error:{message:'写入暂不可用'}},{status:503});try{return Response.json({saved:repository.saveOverrides(request.input.rows)});}catch(error){return Response.json({error:{message:error.message}},{status:409});}}"
);
test('packaging write receipt survives failed refresh and read-only recovery preserves newer edits',async()=>scenario(`
 await change('red weight','0.5');failWrite=true;await click('保存包装修改');
 assert.equal(input('red weight').props.value,'0.5');assert.equal(repository.list().length,0);assert.equal(button('保存包装修改').props.disabled,false);
 failWrite=false;failRead=true;await click('保存包装修改');
 assert.equal(repository.list()[0].revision,1);assert.equal(repository.list()[0].values.weightKg,0.5);
 assert.match(text(tree.root.findByProps({role:'alert'})),/包装已保存，结果刷新失败/);assert.equal(button('保存包装修改').props.disabled,true);
 await change('red weight','0.7');const writes=requests.filter(row=>row.operation==='packaging.save').length;
 await click('重新读取包装结果');assert.equal(requests.filter(row=>row.operation==='packaging.save').length,writes);assert.equal(input('red weight').props.value,'0.7');
 await click('保存包装修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows[0].expectedRevision,1);
 assert.equal(repository.list()[0].values.weightKg,0.7);assert.equal(repository.list()[0].revision,2);
`,receiptFixture));
test('packaging newer edits can save with receipt CAS before display recovery; genuine conflict stays unsaved',async()=>scenario(`
 await change('red weight','0.5');failRead=true;await click('保存包装修改');await change('red weight','0.7');await click('保存包装修改');
 assert.equal(repository.list()[0].revision,2);assert.equal(repository.list()[0].values.weightKg,0.7);
 repository.saveOverrides([{target:{kind:'sku',itemId:'p1',sourceSkuId:'red'},values:{weightKg:0.8},expectedRevision:2}]);
 await change('red weight','0.9');const count=requests.length;await click('保存包装修改');
 assert.match(text(tree.root.findByProps({role:'alert'})),/包装记录已更新/);assert.equal(input('red weight').props.value,'0.9');assert.equal(repository.list()[0].values.weightKg,0.8);
 assert.deepEqual(requests.slice(count).map(row=>row.operation),['packaging.save']);assert.equal(button('保存包装修改').props.disabled,false);
`,receiptFixture));
test('packaging in-flight display refresh retains edit ownership, newer edits, and ignores unmounted completion',async()=>scenario(`
 await change('red weight','0.5');holdRead=true;await click('保存包装修改');
 assert.equal(field('采集来源连接').props.disabled,true);assert.equal(input('red weight').props.disabled,true);
 // Adversarial delayed callback: even an edit delivered while disabled cannot be overwritten by the older snapshot.
 await change('red weight','0.7');await act(async()=>{releaseRead();await settle();});
 assert.equal(input('red weight').props.value,'0.7');await click('保存包装修改');assert.equal(repository.list()[0].values.weightKg,0.7);
 await change('red weight','0.9');holdRead=true;await click('保存包装修改');const oldRelease=releaseRead;
 await act(async()=>{tree.unmount();tree=create(<BusinessSettings/>);await settle();});
 await act(async()=>{oldRelease();await settle();});
 assert.equal(tree.root.findAllByProps({className:'packaging-table'}).length,0);assert.equal(tree.root.findAllByProps({role:'status'}).length,0);
 assert.equal(repository.list()[0].values.weightKg,0.9);
`,receiptFixture));

test('packaging display retry never silently rebases a newer draft over another writer',async()=>scenario(`
 await change('red weight','0.5');failRead=true;await click('保存包装修改');await change('red weight','0.7');
 repository.saveOverrides([{target:{kind:'sku',itemId:'p1',sourceSkuId:'red'},values:{weightKg:0.8},expectedRevision:1}]);
 await click('重新读取包装结果');assert.equal(input('red weight').props.value,'0.7');await click('保存包装修改');
 assert.equal(requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows[0].expectedRevision,1);
 assert.match(text(tree.root.findByProps({role:'alert'})),/包装记录已更新/);assert.equal(repository.list()[0].values.weightKg,0.8);
`,receiptFixture));
test('external store change waits for confirmed packaging refresh and does not receive the old connection result',async()=>{
 const setup=receiptFixture.replace(
  "if(String(url).includes('resource=businessSettings'))return Response.json({connections:[{connectionId:'source',displayName:'采集来源'}],connectionId:'source',stores:[],store:null,pricing:null,packagingAvailable:true});",
  "if(String(url).includes('resource=businessSettings')){const cross=new URL(String(url),'http://local.test').searchParams.get('storeId')==='cross';return Response.json({connections:[{connectionId:'source',displayName:'采集来源'},{connectionId:'other',displayName:'其他连接'}],connectionId:cross?'other':'source',stores:[],store:cross?{...uiStore(),id:'cross',name:'跨连接测试店铺',sourceConnectionId:'other',enabled:true}:null,pricing:null,packagingAvailable:true});}"
 );
 await scenario(`
 await change('red weight','0.5');holdRead=true;await click('保存包装修改');
 await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 assert.equal(field('采集来源连接').props.value,'source');assert.equal(input('red weight').props.value,'0.5');
 await act(async()=>{releaseRead();await settle();});
 assert.equal(field('采集来源连接').props.value,'other');assert.equal(tree.root.findAllByProps({className:'packaging-table'}).length,0);
 assert.equal(requests.filter(row=>row.operation==='packaging.save').length,1);assert.equal(repository.list()[0].values.weightKg,0.5);
 `,setup);
});
test('packaging acknowledgement clears only the submitted snapshot and keeps a later edit',async()=>{
 const setup=receiptFixture.replace('let tree,failWrite=', 'let releaseWrite;let tree,failWrite=').replace(
  "try{return Response.json({saved:repository.saveOverrides(request.input.rows)});}",
  "try{const saved=repository.saveOverrides(request.input.rows);await new Promise(resolve=>releaseWrite=resolve);return Response.json({saved});}"
 );
 await scenario(`
 await change('red weight','0.5');await click('保存包装修改');await change('red weight','0.7');
 await act(async()=>{releaseWrite();await settle();});
 assert.equal(repository.list()[0].values.weightKg,0.5);assert.equal(input('red weight').props.value,'0.7');assert.equal(button('保存包装修改').props.disabled,false);
 await click('保存包装修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows[0].expectedRevision,1);
 await act(async()=>{releaseWrite();await settle();});assert.equal(repository.list()[0].values.weightKg,0.7);assert.equal(button('保存包装修改').props.disabled,true);
 `,setup);
});
test('malformed write receipt does not claim success or allow blind replay',async()=>{
 const setup=receiptFixture.replace('let tree,failWrite=', 'let incomplete=true;let tree,failWrite=').replace(
  "try{return Response.json({saved:repository.saveOverrides(request.input.rows)});}",
  "try{const saved=repository.saveOverrides(request.input.rows);return Response.json({saved:incomplete?[]:saved});}"
 );
 await scenario(`
 await change('red weight','0.5');await click('保存包装修改');
 assert.equal(repository.list()[0].values.weightKg,0.5);assert.equal(input('red weight').props.value,'0.5');
 assert.match(text(tree.root.findByProps({role:'alert'})),/回执不完整/);assert.equal(tree.root.findAllByProps({role:'status'}).length,0);
 assert.equal(button('保存包装修改').props.disabled,true);assert.equal(button('恢复自动').props.disabled,true);
 const count=requests.filter(row=>row.operation==='packaging.save').length;
 failRead=true;await click('放弃未保存的修改');assert.equal(input('red weight').props.value,'0.5');assert.equal(button('保存包装修改').props.disabled,true);
 await click('放弃未保存的修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').length,count);
 incomplete=false;await change('red weight','0.7');await click('保存包装修改');assert.equal(repository.list()[0].values.weightKg,0.7);
 `,setup);
});

test('restore receipt survives failed display refresh and retains other dirty rows',async()=>scenario(`
 await change('red weight','0.5');await change('blue weight','0.6');await click('保存包装修改');
 await change('blue weight','0.8');failRead=true;await click('恢复自动');
 const restored=repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'});
 assert.equal(restored.revision,2);assert.deepEqual(restored.values,{});
 assert.equal(input('red weight').props.value,'');assert.equal(input('blue weight').props.value,'0.8');
 assert.match(text(tree.root.findByProps({role:'alert'})),/已恢复自动.*刷新失败/);
 await change('red weight','0.7');await click('保存包装修改');
 const rows=requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows;
 assert.equal(rows.find(row=>row.target.sourceSkuId==='red').expectedRevision,2);
 assert.equal(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).values.weightKg,0.7);
 assert.equal(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'blue'}).values.weightKg,0.8);
`,receiptFixture));
const restoreFixture=receiptFixture.replace('let tree,failWrite=', 'let holdRemove=false,releaseRemove,incompleteRemove=false;let tree,failWrite=').replace(
 "if(request.operation==='packaging.remove')return Response.json({saved:repository.saveOverrides(request.input.rows.map(row=>({...row,values:{weightKg:null,dimensionsCm:null}})))});",
 "if(request.operation==='packaging.remove'){if(failWrite)return Response.json({error:{message:'恢复暂不可用'}},{status:503});try{const saved=repository.saveOverrides(request.input.rows.map(row=>({...row,values:{weightKg:null,dimensionsCm:null}})));if(holdRemove){holdRemove=false;await new Promise(resolve=>releaseRemove=resolve);}return Response.json({saved:incompleteRemove?[]:saved});}catch(error){return Response.json({error:{message:error.message}},{status:409});}}"
);
test('delayed restore acknowledgement preserves same-row newer edits and unrelated rows',async()=>scenario(`
 await change('red weight','0.5');await click('保存包装修改');holdRemove=true;await click('恢复自动');
 await change('red weight','0.7');await change('blue weight','0.8');
 await act(async()=>{releaseRemove();await settle();});
 assert.equal(input('red weight').props.value,'0.7');assert.equal(input('blue weight').props.value,'0.8');
 assert.deepEqual(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).values,{});
 await click('保存包装修改');const updates=requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows;
 assert.equal(updates.find(row=>row.target.sourceSkuId==='red').expectedRevision,2);assert.equal(updates.find(row=>row.target.sourceSkuId==='blue').expectedRevision,0);
 assert.equal(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).values.weightKg,0.7);
 holdRead=true;await click('恢复自动');const oldRelease=releaseRead;
 await act(async()=>{tree.unmount();tree=create(<BusinessSettings/>);await settle();oldRelease();await settle();});
 assert.equal(tree.root.findAllByProps({className:'packaging-table'}).length,0);assert.equal(tree.root.findAllByProps({role:'status'}).length,0);
`,restoreFixture));
test('restore write failures and malformed acknowledgements never claim a completed reset',async()=>scenario(`
 await change('red weight','0.5');await click('保存包装修改');failWrite=true;await click('恢复自动');
 assert.equal(input('red weight').props.value,'0.5');assert.equal(repository.list()[0].revision,1);assert.match(text(tree.root.findByProps({role:'alert'})),/恢复暂不可用/);
 failWrite=false;repository.saveOverrides([{target:{kind:'sku',itemId:'p1',sourceSkuId:'red'},values:{weightKg:0.6},expectedRevision:1}]);
 await click('恢复自动');assert.match(text(tree.root.findByProps({role:'alert'})),/包装记录已更新/);assert.equal(repository.list()[0].values.weightKg,0.6);
 await change('red weight','0.7');await click('放弃未保存的修改');incompleteRemove=true;await click('恢复自动');
 assert.match(text(tree.root.findByProps({role:'alert'})),/回执不完整/);assert.equal(tree.root.findAllByProps({role:'status'}).length,0);assert.equal(button('恢复自动').props.disabled,true);
 assert.equal(input('red weight').props.value,'0.6');assert.deepEqual(repository.list()[0].values,{});
 // Verification remains accessible even when reset began without a table draft.
 assert.equal(button('放弃未保存的修改').props.disabled,false);failRead=true;await click('放弃未保存的修改');
 assert.equal(input('red weight').props.value,'0.6');assert.equal(button('恢复自动').props.disabled,true);
 await click('放弃未保存的修改');assert.equal(input('red weight').props.value,'');assert.equal(button('恢复自动').props.disabled,false);
`,restoreFixture));

test('authoritative receipts match SKU and composition identity regardless of JSON field order or combination alias',async()=>{
 const setup=receiptFixture.replace(
  "try{return Response.json({saved:repository.saveOverrides(request.input.rows)});}",
  "try{const saved=repository.saveOverrides(request.input.rows);return Response.json({saved:saved.map(record=>({...record,target:record.target.kind==='sku'?{sourceSkuId:record.target.sourceSkuId,itemId:record.target.itemId,kind:'sku'}:{kind:'combination',id:'receipt-alias',composition:[...record.target.composition].reverse().map(part=>({quantity:part.quantity,sourceSkuId:part.sourceSkuId,itemId:part.itemId}))}}))});}"
 );
 await scenario(`
 await change('red weight','0.5');failRead=true;await click('保存包装修改');assert.equal(button('保存包装修改').props.disabled,true);
 await change('red weight','0.7');await click('保存包装修改');assert.equal(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).revision,2);
 await check('选择当前表格所有包装行');await click('用所选 SKU 建立组合');await change('red 组成数量','2');await click('计算组合并加入表格');
 await click('保存包装修改');assert.ok(repository.list().some(record=>record.target.kind==='combination'&&record.revision===1));assert.equal(button('保存包装修改').props.disabled,true);assert.equal(tree.root.findAllByProps({role:'alert'}).length,0);
 `,setup);
});

for(const stage of ['composition','bulk'])test(`read-only receipt refresh preserves a newer ${stage} draft before following an external connection`,async()=>{
 const setup=receiptFixture.replace(
  "if(String(url).includes('resource=businessSettings'))return Response.json({connections:[{connectionId:'source',displayName:'采集来源'}],connectionId:'source',stores:[],store:null,pricing:null,packagingAvailable:true});",
  "if(String(url).includes('resource=businessSettings')){const cross=new URL(String(url),'http://local.test').searchParams.get('storeId')==='cross';return Response.json({connections:[{connectionId:'source',displayName:'采集来源'},{connectionId:'other',displayName:'其他连接'}],connectionId:cross?'other':'source',stores:[],store:cross?{...uiStore(),id:'cross',name:'跨连接测试店铺',sourceConnectionId:'other',enabled:true}:null,pricing:null,packagingAvailable:true});}"
 );
 await scenario(`
 await change('red weight','0.5');failRead=true;await click('保存包装修改');await check('选择当前表格所有包装行');
 ${stage==='composition'?"await click('用所选 SKU 建立组合');await change('red 组成数量','2');":"await changeField('批量重量（kg）','0.9');"}
 await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});assert.equal(field('采集来源连接').props.value,'source');
 const writes=requests.filter(request=>request.operation==='packaging.save').length;await click('重新读取包装结果');
 assert.equal(field('采集来源连接').props.value,'source','read-only refresh cannot release a newer packaging draft');assert.equal(requests.filter(request=>request.operation==='packaging.save').length,writes);
 ${stage==='composition'?"assert.equal(input('red 组成数量').props.value,2);await click('取消组合编辑');":"assert.equal(field('批量重量（kg）').props.value,'0.9');await changeField('批量重量（kg）','');"}
 assert.equal(field('采集来源连接').props.value,'other');assert.equal(tree.root.findAllByProps({className:'packaging-table'}).length,0);assert.equal(repository.list()[0].values.weightKg,0.5);
 `,setup);
});
