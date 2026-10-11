import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const [rootArg,outputArg]=process.argv.slice(2);
assert.ok(rootArg&&outputArg,'Usage: node check.mjs CHECKOUT OUTPUT');
const root=resolve(rootArg),output=resolve(outputArg);mkdirSync(output,{recursive:true});
const selected=[
 'test/app-hallmark/listing-prepare.test.ts','test/app-hallmark/listing-state-index.test.ts',
 'test/apps-runtime/result-reader.test.ts','test/apps-runtime/result-reader-string-equivalence.test.ts',
 'test/apps-runtime/business-model-projection.test.ts','test/apps-runtime/business-continuation.test.ts',
 'test/apps-host/business-inspect-projection.test.ts','test/authoring/result-reader.test.ts',
 'test/performance/data-transfer.test.ts','test/performance/data-transfer-byte-copy.test.ts','test/performance/transfer-guard-regressions.test.ts',
 'test/plugin-apps/business-operations.test.ts','test/plugin-apps/business-content-lazy.test.ts',
 'test/source-preview/preview.test.ts','test/source-preview/selection-interaction.test.ts',
 'test/source-preview/formatter-sharing.test.ts','test/source-preview/formatter-sharing-compatibility.test.ts',
 ...readdirSync(join(root,'test/collection')).filter(name=>name.endsWith('.test.ts')).map(name=>'test/collection/'+name)
];
const steps=[
 ['tests',['--test','--test-concurrency=1',...selected]],
 ['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],
 ['component-typecheck',['node_modules/typescript/bin/tsc','--noEmit','-p','component-workspace/collected-products/tsconfig.json']],
 ['component-build',['component-workspace/collected-products/node_modules/vite/bin/vite.js','build','component-workspace/collected-products']],
 ['apps-build',['scripts/build-apps-bundle.mjs']],
 ['plugin-build',['scripts/build-plugin.mjs']],
 ['packaged-runtime',['--test','test/performance/runtime-artifact-isolation.test.ts']],
];
const results=[];
for(const [name,args] of steps){
 const cleanTemp=join(output,'isolated-temp');mkdirSync(cleanTemp,{recursive:true});
 const start=Date.now();const child=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:24*1024*1024,windowsHide:true,env:name==='packaged-runtime'?{...process.env,TEMP:cleanTemp,TMP:cleanTemp}:process.env});
 writeFileSync(join(output,name+'.stdout.log'),child.stdout??'');writeFileSync(join(output,name+'.stderr.log'),child.stderr??'');
 const row={name,args,exitCode:child.status,signal:child.signal,error:child.error?.message,elapsedMs:Date.now()-start};
 if(name==='tests')for(const key of ['tests','pass','fail','cancelled','skipped'])row[key]=Number(child.stdout?.match(new RegExp('(?:# |ℹ )'+key+' (\\d+)'))?.[1]??NaN);
 results.push(row);writeFileSync(join(output,'summary.json'),JSON.stringify({root,node:process.version,selected,results},null,2));
 console.log(JSON.stringify(row));if(child.status!==0)throw new Error(`${name} failed; see ${output}`);
}
