import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {recordedProduct} from '../adapter/real-scenarios.ts';

test('overview switches directions, locates sources, sends filters and discards stale store responses',async()=>{
  const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
    import {AssociationOverviewPage} from './packages/plugin-apps/client/association-overview.tsx';
    const title=${JSON.stringify(recordedProduct().title)},requests=[];let tree,release,hold=false;
    const result=(query)=>({direction:query.direction,storeId:query.storeId,rows:[{id:'offer',title,association:'linked',sales:[{offerId:'offer',productId:'100',title,saleState:'on_sale',observedAt:new Date().toISOString(),freshness:'fresh',association:'linked',sources:[{itemId:'source',title:'来源商品',available:true,skuVerified:true,parts:[{sourceSkuId:'sku',quantity:2}]}]}]}],total:1,page:1,pageSize:30,counts:{linked:1,none:0,unknown:0},checkedAt:new Date().toISOString(),warnings:[]});
    globalThis.fetch=async(url)=>{
      const query=Object.fromEntries(new URL(url,'http://local').searchParams);
      if(query.resource==='businessSettings')return Response.json({connectionId:'c',connections:[{connectionId:'c',displayName:'来源连接'}],store:{id:'bill'},stores:[{id:'bill',name:'Bill'},{id:'helen',name:'Helen'}]});
      requests.push(query);if(hold){hold=false;await new Promise(r=>release=r);}
      return Response.json(result(query));
    };
    await act(async()=>{tree=create(<AssociationOverviewPage/>);});
    const button=(text)=>tree.root.findAllByType('button').find(node=>node.children.join('')===text);
    const select=(label)=>tree.root.findAllByType('select').find(node=>node.props['aria-label']===label);
    assert.match(JSON.stringify(tree.toJSON()),/在售/);assert.equal(requests.at(-1).direction,'sales');
    await act(async()=>{button('来源商品').props.onClick();});
    assert.equal(requests.at(-1).direction,'collection');assert.equal(requests.at(-1).focus,'source');
    await act(async()=>{button('返回全部商品').props.onClick();select('关联状态').props.onChange({target:{value:'none'}});});
    assert.equal(requests.at(-1).association,'none');assert.equal(requests.at(-1).focus,'');
    hold=true;await act(async()=>{button('刷新关联与状态').props.onClick();});
    assert.equal(requests.at(-1).refresh,'true');
    await act(async()=>{select('店铺').props.onChange({target:{value:'helen'}});});
    assert.equal(requests.at(-1).storeId,'helen');assert.equal(requests.at(-1).refresh,'false');
    await act(async()=>{release();});assert.equal(select('店铺').props.value,'helen');
    globalThis.fetch=async()=>{throw Error('接口未连接');};
    await act(async()=>{button('刷新关联与状态').props.onClick();});
    assert.match(JSON.stringify(tree.toJSON()),/接口未连接/);assert.equal(tree.root.findAllByType('table').length,0);
    await act(async()=>{tree.unmount();});
  `},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
  const run=spawnSync(process.execPath,['--input-type=module'],{input:result.outputFiles[0].text,encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
});
