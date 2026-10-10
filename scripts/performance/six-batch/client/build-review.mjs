import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const roots={baseline:resolve(process.argv[2]),combined:resolve(process.argv[3])};
for(const [arm,root] of Object.entries(roots)){
 const file=resolve(root,'packages/dsh-plugin/client/widgets/product-list.tsx');
 let contents=readFileSync(file,'utf8').replace('  const pages=', '  __auditTable=table;\n  const pages=');
 contents+='\nlet __auditTable;let __evaluations=0;export const auditTable=()=>__auditTable;export const auditCounts=()=>({evaluations:__evaluations});export const resetAuditCounts=()=>{__evaluations=0;};';
 contents+='\nexport {createMaterialView} from "../../../app-presentation/src/materials/catalog.ts";';
 contents=contents.replace('globalFilterFn:(row,columnId,value)=>(', 'globalFilterFn:(row,columnId,value)=>(__evaluations++,(').replace(".trim()),getCoreRowModel:",".trim())),getCoreRowModel:");
 await build({stdin:{contents,resolveDir:dirname(file),loader:'tsx'},outfile:`E-${arm}.cjs`,bundle:true,platform:'node',format:'cjs',external:['react'],define:{'process.env.NODE_ENV':'"production"'}});
 for(const [input,output] of [['O-harness-source.tsx','O'],['combined-harness-source.tsx','coupled']]){
  const source=readFileSync(input,'utf8').replaceAll("'../packages/",`'${root}/packages/`);
  await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:`${output}-${arm}.mjs`,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 }
}
writeFileSync('source-identity.json',JSON.stringify(Object.fromEntries(Object.entries(roots).map(([arm,root])=>[arm,{root,node:process.version,clientSourceHashes:Object.fromEntries(['product-list.tsx','material-format.ts','procurement-cells.tsx',...(arm==='combined'?['number-format.ts']:[])].map(file=>[file,createHash('sha256').update(readFileSync(resolve(root,'packages/dsh-plugin/client/widgets',file))).digest('hex')])),lockHash:createHash('sha256').update(readFileSync(resolve(root,'pnpm-lock.yaml'))).digest('hex'),sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),diff:execFileSync('git',['diff'],{cwd:root,encoding:'utf8'})}])),null,2));
