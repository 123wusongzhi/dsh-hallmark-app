import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';

test('connection panel checks on open, disables duplicate restart and displays failed recheck honestly',async()=>{
  const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';
    import {create,act} from 'react-test-renderer';
    import assert from 'node:assert/strict';
    import {ConnectionStatusPanel} from './packages/plugin-apps/client/connection-status.tsx';
    let tree,release,posts=0;
    const status={state:'degraded',checkedAt:new Date().toISOString(),node:{state:'healthy'},data:{state:'unavailable',message:'接口未连接'},canRestart:true};
    globalThis.fetch=async(url,options)=>{
      if(options?.method==='POST'){posts++;await new Promise(r=>{release=r;});return Response.json({...status,state:'connected',data:{state:'available',message:'可用'}});}
      return Response.json(status);
    };
    await act(async()=>{tree=create(<ConnectionStatusPanel active/>);});
    assert.match(JSON.stringify(tree.toJSON()),/连接异常/);
    const repair=()=>tree.root.findAllByType('button')[1];
    await act(async()=>{repair().props.onClick();repair().props.onClick();});
    assert.equal(posts,1);assert.equal(repair().props.disabled,true);
    await act(async()=>{release();});assert.match(JSON.stringify(tree.toJSON()),/已连接/);
    globalThis.fetch=async()=>{throw Error('offline');};
    await act(async()=>{tree.root.findAllByType('button')[0].props.onClick();});
    assert.doesNotMatch(JSON.stringify(tree.toJSON()),/已连接/);
    assert.match(JSON.stringify(tree.toJSON()),/状态未确认/);
    assert.equal(repair().props.disabled,false);
    await act(async()=>{tree.unmount();});
  `},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
  const run=spawnSync(process.execPath,['--input-type=module'],{input:result.outputFiles[0].text,encoding:'utf8',cwd:process.cwd()});
  assert.equal(run.status,0,run.stdout+run.stderr);
});
