import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';

// Transport/lifecycle fixtures only: opaque routing IDs and empty result envelopes,
// not product facts or assertions about real merchant data.
for(const scenario of ['empty connection','failed connection and explicit retry','late success while replacement pending','late failure while replacement pending','normal refresh','inactive and resume']){
  test(`association loading lifecycle: ${scenario}`,async()=>{
    const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {AssociationOverviewPage} from './packages/plugin-apps/client/association-overview.tsx';
      const scenario=${JSON.stringify(scenario)},requests=[];
      let tree;
      globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({query:Object.fromEntries(new URL(url,'http://isolated').searchParams),signal:options.signal,resolve,reject}));
      const settings=(connectionId,hasStore=true)=>({connectionId,connections:['a','b'].map(id=>({connectionId:id,displayName:id})),store:hasStore?{id:'store-'+connectionId}:null,stores:hasStore?[{id:'store-'+connectionId,name:'Routing fixture'}]:[]});
      const data=(marker)=>({direction:'sales',rows:[],total:0,page:1,pageSize:30,counts:{linked:0,none:0,unknown:0},warnings:[marker],checkedAt:'2026-10-16T00:00:00Z'});
      const finish=async(request,value)=>act(async()=>{request.resolve(Response.json(value));});
      const fail=async(request,message)=>act(async()=>{request.reject(Error(message));});
      const button=(label)=>tree.root.findAllByType('button').find(node=>node.children.join('')===label);
      const loading=()=>tree.root.findAll(node=>node.props.role==='status').some(node=>node.children.join('').includes('正在读取关联关系'));
      const rendered=()=>JSON.stringify(tree.toJSON());
      await act(async()=>{tree=create(<AssociationOverviewPage/>);});
      await finish(requests[0],settings('a'));
      const old=requests[1];assert.equal(old.query.resource,'associations');assert.equal(loading(),true);
      if(scenario==='normal refresh'){
        await finish(old,data('initial-result'));
        assert.equal(loading(),false);assert.equal(button('刷新关联与状态').props.disabled,false);
        await act(async()=>{button('刷新关联与状态').props.onClick();});
        assert.equal(requests.at(-1).query.refresh,'true');assert.equal(loading(),true);assert.equal(button('刷新关联与状态').props.disabled,true);
        await finish(requests.at(-1),data('fresh-result'));
        assert.equal(loading(),false);assert.match(rendered(),/fresh-result/);assert.doesNotMatch(rendered(),/initial-result/);
      }else if(scenario==='inactive and resume'){
        await act(async()=>{tree.update(<AssociationOverviewPage active={false}/>);});
        assert.equal(old.signal.aborted,true);assert.equal(loading(),false);
        await finish(old,data('obsolete-result'));assert.doesNotMatch(rendered(),/obsolete-result/);
        await act(async()=>{tree.update(<AssociationOverviewPage active={true}/>);});
        const picker=requests.findLast(r=>r.query.resource==='businessSettings');await finish(picker,settings('b',false));
        assert.equal(loading(),false);assert.match(rendered(),/请先在经营设置中配置店铺/);
      }else{
        await act(async()=>{tree.root.findByProps({'aria-label':'经营连接'}).props.onChange({target:{value:'b'}});});
        assert.equal(old.signal.aborted,true);assert.equal(loading(),true);
        const picker=requests.at(-1);assert.equal(picker.query.connectionId,'b');
        if(scenario==='empty connection'){
          await finish(picker,settings('b',false));
          assert.equal(loading(),false,'empty connection must end loading');
          assert.match(rendered(),/请先在经营设置中配置店铺/);
          assert.equal(button('刷新关联与状态').props.disabled,true,'no store still correctly disables refresh');
          await finish(old,data('obsolete-result'));assert.doesNotMatch(rendered(),/obsolete-result/);assert.equal(loading(),false);
          assert.equal(requests.filter(r=>r.query.resource==='associations').length,1);
        }else if(scenario==='failed connection and explicit retry'){
          await fail(picker,'settings outage');
          assert.equal(loading(),false,'failed picker must end loading');assert.match(rendered(),/settings outage/);
          assert.ok(button('重试'));await act(async()=>{button('重试').props.onClick();});
          assert.equal(loading(),true);assert.equal(requests.at(-1).query.resource,'businessSettings');assert.equal(requests.at(-1).query.connectionId,'b');
          await finish(requests.at(-1),settings('b'));
          const replacement=requests.at(-1);assert.equal(replacement.query.connectionId,'b');
          await finish(old,data('obsolete-result'));assert.equal(loading(),true);assert.doesNotMatch(rendered(),/obsolete-result/);
          await finish(replacement,data('recovered-result'));assert.equal(loading(),false);assert.match(rendered(),/recovered-result/);assert.doesNotMatch(rendered(),/settings outage/);
        }else{
          await finish(picker,settings('b'));
          const replacement=requests.at(-1);assert.equal(replacement.query.connectionId,'b');assert.equal(loading(),true);
          if(scenario.startsWith('late success'))await finish(old,data('obsolete-result'));else await fail(old,'obsolete-error');
          assert.equal(loading(),true,'obsolete finally must not unlock the new request');assert.equal(button('刷新关联与状态').props.disabled,true);
          assert.doesNotMatch(rendered(),/obsolete-result|obsolete-error/);
          await finish(replacement,data('replacement-result'));assert.equal(loading(),false);assert.equal(button('刷新关联与状态').props.disabled,false);assert.match(rendered(),/replacement-result/);
        }
      }
      await act(async()=>{tree.unmount();});
    `},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
    const run=spawnSync(process.execPath,['--input-type=module'],{input:bundle.outputFiles[0].text,encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
  });
}
