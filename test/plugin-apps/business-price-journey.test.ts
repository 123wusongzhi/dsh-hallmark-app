import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('price journey scopes batch edits and explicitly reviews the complete submission through the production business engine',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'price-journey-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  // Explicit historical replay only. Normal CI always compiles the current production component.
  const baseline=process.env.DSH_PRICE_JOURNEY_BASELINE==='1';
  const original=baseline?spawnSync('git',['show','fd95bc22929bfbfa850e0312357322578287a10c:packages/plugin-apps/client/business-operations.tsx'],{encoding:'utf8'}):undefined;
  if(original)assert.equal(original.status,0,original.stderr);

  await build({plugins:original?[{name:'historical-price-ui',setup(builder){builder.onLoad({filter:/[\\/]packages[\\/]plugin-apps[\\/]client[\\/]business-operations\.tsx$/},args=>({contents:original.stdout,loader:'tsx',resolveDir:dirname(args.path)}));}}]:[],stdin:{resolveDir:process.cwd(),sourcefile:'price-journey.tsx',loader:'tsx',contents:uiFixturePrelude()+readFileSync('test/plugin-apps/fixtures/business-price-journey.tsx','utf8')},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.error?.message??result.stderr);console.log(result.stdout.trim());
  assert.match(result.stdout,process.env.DSH_PRICE_JOURNEY_BASELINE==='1'?/PRICE_JOURNEY_BASELINE_REPRODUCED/:/PRICE_JOURNEY_PASS/);
 }finally{assert.ok(directory.startsWith(root+sep+'price-journey-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
