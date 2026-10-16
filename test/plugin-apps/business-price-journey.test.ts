import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('price journey scopes batch edits and explicitly reviews the complete submission through the production business engine',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'price-journey-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  await build({stdin:{resolveDir:process.cwd(),sourcefile:'price-journey.tsx',loader:'tsx',contents:uiFixturePrelude()+readFileSync('test/plugin-apps/fixtures/business-price-journey.tsx','utf8')},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);assert.match(result.stdout,/PRICE_JOURNEY_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'price-journey-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
