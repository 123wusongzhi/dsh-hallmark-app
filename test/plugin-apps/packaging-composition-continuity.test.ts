import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realCollections} from '../real-data/corpus.ts';

for(const scenario of ['dirty','clean','changed','cancel','failure','conflict','reordered','late-edit'])test(`packaging composition continuity: ${scenario}`,async()=>{
 const product=realCollections().find(p=>p.package.weightGrams!==null&&p.package.dimensionsMm&&p.skus.length>=2&&p.skus.every(s=>!s.package));assert.ok(product);
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'packaging-input-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`const recorded=${JSON.stringify(product)};const scenario=${JSON.stringify(scenario)};\n`+readFileSync('test/plugin-apps/fixtures/packaging-composition-continuity.tsx','utf8')},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);console.log(result.stdout.trim());assert.match(result.stdout,/PACKAGING_COMPOSITION_CONTINUITY_PASS/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
