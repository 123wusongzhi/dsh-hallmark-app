import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('pricing validation identifies invalid fields and preserves editable rules through correction and retry',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'pricing-validation-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  // Historical baseline is opt-in; normal tests always compile current production.
  const original=process.env.DSH_PRICING_VALIDATION_BASELINE==='1'?spawnSync('git',['show','cc075fb:packages/business-pricing/src/index.ts'],{encoding:'utf8'}):undefined;
  if(original)assert.equal(original.status,0,original.stderr);
  await build({plugins:original?[{name:'historical-pricing-validation',setup(builder){builder.onLoad({filter:/[\\/]packages[\\/]business-pricing[\\/]src[\\/]index\.ts$/},args=>({contents:original.stdout,loader:'ts',resolveDir:dirname(args.path)}));}}]:[],stdin:{resolveDir:process.cwd(),loader:'tsx',contents:uiFixturePrelude()+readFileSync('test/plugin-apps/fixtures/pricing-validation-recovery.tsx','utf8')},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stdout+result.stderr);console.log(result.stdout.trim());
  assert.match(result.stdout,/PRICING_VALIDATION_RECOVERY_PASS/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
