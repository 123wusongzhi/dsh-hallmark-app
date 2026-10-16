import {uiProduct,uiProducts,uiOzonProduct,uiStore,uiListingPayload,uiFixturePrelude,uiText} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('business full-content text avoids discarded serialization and refreshes when the same row payload changes', async () => {
  const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true }); const directory = mkdtempSync(resolve(root, 'business-content-lazy-'));
  try {
    const entry = resolve(directory, 'ui.mjs');
    await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'business-content-lazy-test.tsx', loader: 'tsx', contents: `
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
const payload={offer_id:'SKU',name:uiProduct({},39).title,price:'20',currency_code:'CNY',attributes:[{id:4191,values:[{value:'完整说明'}]}],nullable:null};
let plan={planId:'plan',storeId:'shop',title:'经营草稿',revision:1,status:'draft',rows:[{rowId:'row',action:'listing',target:{offerId:'SKU'},payload,revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}}],createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'};
const originalFetch=globalThis.fetch,originalStringify=JSON.stringify;let calls=0,tree;const requests=[];
JSON.stringify=function(value,replacer,space){if(space===2&&value?.offer_id==='SKU')calls++;return originalStringify(value,replacer,space);};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'board'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 const body=JSON.parse(options.body);requests.push(body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:[plan]}});
 if(body.operation==='revise'){assert.equal(body.input.expectedRevision,plan.revision);plan={...plan,revision:plan.revision+1,rows:plan.rows.map(row=>({...row,...body.input.rows[0]}))};return Response.json({status:'ok',data:plan});}
 throw Error('unexpected '+body.operation);
};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const change=async(label,value)=>act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:typeof value==='boolean'?{checked:value}:{value}});await settle();});
const click=async(name)=>act(async()=>{const node=tree.root.findAllByType('button').find(n=>text(n)===name);assert.ok(node,name);assert.equal(!!node.props.disabled,false,name);node.props.onClick();await settle();});
const field=()=>tree.root.findByProps({'aria-label':'SKU 完整字段'});
try{
 await act(async()=>{tree=create(<BusinessOperations sessionId="s" storeId="shop"/>);await settle();});
 assert.deepEqual(JSON.parse(field().props.value),payload);calls=0;
 await change('选择 SKU',true);await change('选择 SKU',false);await change('筛选商品',payload.name.slice(0,4));await change('筛选商品','');
 await change('SKU 完整字段','{ local text');
 assert.equal(calls,0,'unchanged payload is not serialized on selection/search/typing');
 await click('应用字段修改');assert.match(JSON.stringify(tree.toJSON()),/字段格式有误/);assert.equal(calls,0);
 const edited={...payload,name:'新标题',attributes:[{id:4191,values:[{value:'新完整说明'}]}]};
 await change('SKU 完整字段',originalStringify(edited));await click('应用字段修改');
 assert.equal(field().props.value,originalStringify(edited,null,2),'changed payload runs existing effect');assert.equal(calls,1);
 await click('保存草稿');assert.deepEqual(plan.rows[0].payload,edited);assert.equal(requests.some(r=>r.operation==='submit'),false);
 await change('SKU 完整字段','local unsaved text');
 plan={...plan,rows:plan.rows.map(row=>({...row,payload:{...row.payload,name:'后台替换'}}))};
 assert.equal(tree.root.findAllByType('button').find(n=>text(n)==='刷新批次').props.disabled,true,'unapplied JSON blocks destructive refresh');
 assert.equal(tree.root.findByProps({'aria-label':'SKU 商品标题'}).props.disabled,true,'structured editing cannot overwrite unapplied JSON');
 assert.equal(tree.root.findByProps({'aria-label':'筛选商品'}).props.disabled,true,'filtering cannot unmount unapplied JSON');
 assert.equal(tree.root.findAllByType('button').find(n=>text(n)==='保存草稿').props.disabled,true);
 assert.equal(field().props.value,'local unsaved text');
 await click('放弃字段修改');
 await click('刷新批次');assert.equal(JSON.parse(field().props.value).name,'后台替换','same row identity still accepts replacement payload');
 await change('筛选商品','absent');assert.equal(tree.root.findAllByProps({'aria-label':'SKU 完整字段'}).length,0);
 await change('筛选商品','');assert.equal(JSON.parse(field().props.value).name,'后台替换','remount initializes latest payload');
 console.log('BUSINESS_CONTENT_LAZY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;JSON.stringify=originalStringify;}
` }, banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" }, outfile: entry, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-test-renderer'] });
    const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr); assert.match(result.stdout, /BUSINESS_CONTENT_LAZY_PASS/);
  } finally { assert.ok(resolve(directory).startsWith(root + sep + 'business-content-lazy-')); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
});
