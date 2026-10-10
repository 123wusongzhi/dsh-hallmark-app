import {pathToFileURL} from 'node:url';
const {build}=await import(pathToFileURL(process.env.C72_BASELINE+'/node_modules/esbuild/lib/main.js').href);
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const base=resolve(process.env.C72_BASELINE),patched=resolve(process.env.C72_CANDIDATE);
const results=[];
for(const [arm,root]of [['baseline',base],['lazy',patched]]){
 const component=resolve(root,'packages/plugin-apps/client/business-operations.tsx');
 const source=readFileSync('harness.tsx','utf8').replace('BUSINESS_COMPONENT',component).replace('BUNDLE_IDENTITY',JSON.stringify({arm,root,baseCommit:'4e1cd98082a432e2ca89f606927da29eb26ddb67',componentSha256:createHash('sha256').update(readFileSync(component)).digest('hex')}));
 const outfile=resolve(arm+'.mjs');
 const result=await build({stdin:{contents:source,sourcefile:'business-lazy-harness.tsx',resolveDir:root,loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile,metafile:true});
 results.push({arm,root,outfile,sha256:createHash('sha256').update(readFileSync(outfile)).digest('hex'),inputs:Object.entries(result.metafile.inputs).map(([file,data])=>({path:file,bytes:data.bytes,sha256:createHash('sha256').update((file.endsWith('business-lazy-harness.tsx')?Buffer.from(source):readFileSync(resolve(file)))).digest('hex')}))});
}
writeFileSync('build-manifest.json',JSON.stringify(results,null,2));
console.log(results.map(x=>({arm:x.arm,inputs:x.inputs.length,sha256:x.sha256})));
