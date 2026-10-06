import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('source product selection settles, survives filtering and pagination, and attaches exact keys',async()=>{
  mkdirSync('artifacts',{recursive:true});
  const directory=mkdtempSync(resolve('artifacts/selection-regression-'));
  const entry=join(directory,'test.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import Component from './component-workspace/collected-products/src/Component.tsx';
      import {attached} from 'selection-fixture';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      globalThis.document={documentElement:{dataset:{}}};
      globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      let renders=0,tree;
      await act(async()=>{tree=create(<React.Profiler id="selection" onRender={()=>{if(++renders>80)throw new Error('Selection entered a table render loop');}}><Component/></React.Profiler>,{unstable_isConcurrent:true});});
      const box=(label)=>tree.root.findAllByProps({'aria-label':label}).find(node=>node.type==='input');
      await act(async()=>box('选择商品 0').props.onChange());
      assert.equal(box('选择商品 0').props.checked,true);
      await act(async()=>tree.root.findAllByProps({'aria-label':'搜索商品'}).find(node=>node.type==='input').props.onChange({target:{value:'商品 1'}}));
      await act(async()=>tree.root.findAllByProps({'aria-label':'搜索商品'}).find(node=>node.type==='input').props.onChange({target:{value:''}}));
      assert.equal(box('选择商品 0').props.checked,true);
      await act(async()=>tree.root.findAllByProps({'aria-label':'下一页'}).find(node=>node.type==='button').props.onClick());
      await act(async()=>box('选择商品 20').props.onChange());
      await act(async()=>tree.root.findAllByProps({'aria-label':'上一页'}).find(node=>node.type==='button').props.onClick());
      assert.equal(box('选择商品 0').props.checked,true);
      await act(async()=>tree.root.findAll(node=>node.type==='button'&&node.props.className?.includes('attach-button'))[0].props.onClick());
      assert.deepEqual(attached[0].keys,['key-0','key-20']);
      await act(async()=>box('选择本页商品').props.onChange());
      assert.equal(box('选择商品 19').props.checked,true);
      await act(async()=>box('选择本页商品').props.onChange());
      assert.equal(box('选择商品 0').props.checked,false);
      await act(async()=>tree.unmount());
      console.log(JSON.stringify({renders,attachedKeys:attached[0].keys}));
    `},banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer'],plugins:[{
      name:'source-host-fixture',setup(builder){
        builder.onResolve({filter:/(?:\/lib\/runtime\/react$|^selection-fixture$)/},()=>({path:'selection-fixture',namespace:'fixture'}));
        builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
          export const attached=[];
          const rows=Array.from({length:25},(_,i)=>({key:'key-'+i,row:{id:'item-'+i,title:'商品 '+i}}));
          const data={bindings:[{bindingId:'collected',payload:{items:rows.map(x=>x.row)}}],selection:[{bindingId:'collected',eligible:true,rows}]};
          const context={theme:'light',attachment:{available:true}};
          export function useHallmark(){return {data,context,loading:false,refresh:async()=>data,attachSelection:async(request)=>{attached.push(request);return {ok:true,message:'已附加'};}};}
        `}));
      }
    }]});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    assert.match(result.stdout,/attachedKeys/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
