import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const fixture=`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessSettings} from './packages/plugin-apps/client/business-settings.tsx';
import {BusinessPackagingRepository} from './packages/business-packaging/src/index.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let tree;const requests=[],data=new Map();
const repository=new BusinessPackagingRepository({get:(c,id)=>data.get(c+id),put:(c,id,v)=>{data.set(c+id,v);return v;},list:()=>[...data.values()],transaction:fn=>fn()});
const makeRow=(members,id)=>{const hydrated=members.map(member=>({...member,title:'测试商品 '+member.sourceSkuId,sourceRevision:'v1',commonPackage:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}}}));const result=repository.resolve({members:hydrated,...(id?{combinationId:id}:{})});const override=repository.readOverride(result.target);return {key:JSON.stringify(result.target.kind==='sku'?result.target:['combination',result.target.composition]),target:result.target,kind:result.target.kind,composition:hydrated,result,override:override??null,revision:override?.revision??0};};
const read=input=>{const rows=new Map();if(input.itemIds?.includes('p1'))for(const sku of ['red','blue']){const row=makeRow([{itemId:'p1',sourceSkuId:sku,quantity:1}]);rows.set(row.key,row);}for(const saved of repository.list())if(saved.target.kind==='combination'){const row=makeRow(saved.target.composition,saved.target.id);rows.set(row.key,row);}for(const composition of input.compositions??[]){const row=makeRow(composition.members,composition.id);rows.set(row.key,row);}return {rows:[...rows.values()],warnings:[],products:[{id:'p1',title:'测试商品',skuCount:2}]};};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=businessSettings'))return Response.json({connections:[{connectionId:'source',displayName:'采集来源'}],connectionId:'source',stores:[],store:null,pricing:null,packagingAvailable:true});
 const request=JSON.parse(options.body);requests.push(request);assert.equal(request.connectionId,'source');assert.equal(Object.hasOwn(request,'sessionId'),false);
 if(request.operation==='packaging.search')return Response.json({items:[{id:'p1',title:'测试商品',source:'淘宝',skuCount:2}],total:1});
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
async function scenario(source:string){
  const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'packaging-ui-'));
  try{
    const entry=resolve(directory,'ui.mjs');
    await build({stdin:{resolveDir:process.cwd(),sourcefile:'packaging-ui-test.tsx',loader:'tsx',contents:fixture+source+`\nconsole.log('PACKAGING_UI_PASS');}finally{if(tree)await act(async()=>tree.unmount());}`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/PACKAGING_UI_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep+'packaging-ui-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
}
test('packaging UI lazily reads selected products, edits one field, bulk applies and restores source values',async()=>scenario(`
 assert.equal(input('red weight').props.placeholder,'0.33');assert.equal(input('red weight').props.value,'');
 await change('red weight','0.5');assert.equal(field('采集来源连接').props.disabled,true,'source cannot change across an unsaved packaging draft');
 await click('保存包装修改');assert.equal(input('red weight').props.value,'0.5');assert.equal(field('采集来源连接').props.disabled,false);
 const saved=requests.find(row=>row.operation==='packaging.save').input.rows[0];assert.equal(saved.expectedRevision,0);assert.equal(saved.values.weightKg,.5);assert.equal(saved.values.dimensionsCm,null);
 await check('选择当前表格所有包装行');await changeField('批量重量（kg）','0.9');await click('填入表格草稿');await click('保存包装修改');
 assert.equal(input('red weight').props.value,'0.9');assert.equal(input('blue weight').props.value,'0.9');
 const batch=requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows;assert.equal(batch.length,2);assert.equal(batch[0].expectedRevision,1);assert.equal(batch[1].expectedRevision,0);
 await click('恢复自动');assert.equal(input('red weight').props.value,'');assert.equal(input('red weight').props.placeholder,'0.33');assert.equal(input('blue weight').props.value,'0.9');
`));
test('packaging UI edits multi-SKU quantities, persists automatic combinations and rejects partial dimensions locally',async()=>scenario(`
 await check('选择当前表格所有包装行');await click('用所选 SKU 建立组合');await change('red 组成数量','2');await click('计算组合并加入表格');
 assert.match(text(tree.toJSON()),/组合已加入表格草稿/);await click('保存包装修改');
 const combination=repository.list().find(row=>row.target.kind==='combination');assert.ok(combination);assert.deepEqual(combination.target.composition,[{itemId:'p1',sourceSkuId:'red',quantity:2},{itemId:'p1',sourceSkuId:'blue',quantity:1}]);assert.deepEqual(combination.values,{});assert.match(text(tree.toJSON()),/0.99 kg/);
 await change('red length','30');const writes=requests.filter(row=>row.operation==='packaging.save').length;await click('保存包装修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').length,writes);assert.match(text(tree.toJSON()),/尺寸请填写完整/);
 await change('red width','12');await change('red height','8');await click('保存包装修改');assert.deepEqual(repository.readOverride({kind:'sku',itemId:'p1',sourceSkuId:'red'}).values.dimensionsCm,{length:30,width:12,height:8});
`));
