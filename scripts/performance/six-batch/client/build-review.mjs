import {build} from 'esbuild';
import {readFileSync,writeFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node build-review.mjs /baseline-root /combined-root');
const roots={baseline:resolve(process.argv[2]),combined:resolve(process.argv[3])};
const harnessRoot=dirname(fileURLToPath(import.meta.url));process.chdir(harnessRoot);
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const replaceOnce=(source,find,replacement)=>{assert.equal(source.split(find).length,2,`Instrumentation anchor must occur once: ${find}`);return source.replace(find,replacement);};
// A failed build must never leave an old manifest that authorizes stale bundles.
rmSync('source-identity.json',{force:true});
const identities={};
for(const [arm,root] of Object.entries(roots)){
 const checkoutRequire=createRequire(resolve(root,'package.json'));
 const runtimePaths=Object.fromEntries(['react','react/jsx-runtime','react-test-renderer'].map(name=>[name,checkoutRequire.resolve(name)]));
 const plugins=[{name:'whole-checkout',setup(context){
  context.onResolve({filter:/^@checkout\//},args=>({path:resolve(root,args.path.slice('@checkout/'.length))}));
  context.onResolve({filter:/^(react|react\/jsx-runtime|react-test-renderer)$/},args=>({path:runtimePaths[args.path],external:true}));
 }}];
 const inputs=new Set([resolve(root,'pnpm-lock.yaml'),resolve(root,'package.json'),...['build-review.mjs','verify-review.mjs','E-worker.cjs','run-parity.py','run-coupled.py','summarize-cycles.py'].map(file=>resolve(file))]),outputs={};
 const record=(result,output)=>{outputs[output]=hash(output);for(const input of Object.keys(result.metafile.inputs)){if(input==='<stdin>')continue;inputs.add(isAbsolute(input)?input:resolve(input));}};
 const file=resolve(root,'packages/dsh-plugin/client/widgets/product-list.tsx');inputs.add(file);
 let contents=replaceOnce(readFileSync(file,'utf8'),'  const pages=','  __auditTable=table;\n  const pages=');
 contents+='\nlet __auditTable;let __evaluations=0;export const auditTable=()=>__auditTable;export const auditCounts=()=>({evaluations:__evaluations});export const resetAuditCounts=()=>{__evaluations=0;};';
 contents+='\nexport {createMaterialView} from "../../../app-presentation/src/materials/catalog.ts";';
 contents=replaceOnce(contents,'globalFilterFn:(row,columnId,value)=>(','globalFilterFn:(row,columnId,value)=>(__evaluations++,(');
 contents=replaceOnce(contents,'.trim()),getCoreRowModel:','.trim())),getCoreRowModel:');
 const eOutput=`E-${arm}.cjs`;
 record(await build({absWorkingDir:harnessRoot,stdin:{contents,resolveDir:dirname(file),loader:'tsx'},outfile:eOutput,bundle:true,platform:'node',format:'cjs',plugins,metafile:true,define:{'process.env.NODE_ENV':'"production"'}}),eOutput);
 for(const [input,output] of [['O-harness-source.tsx','O'],['combined-harness-source.tsx','coupled']]){
  inputs.add(resolve(input));
  const source=readFileSync(input,'utf8').replaceAll("'../packages/",`'${root}/packages/`),outfile=`${output}-${arm}.mjs`;
  record(await build({absWorkingDir:harnessRoot,stdin:{contents:source,resolveDir:harnessRoot,loader:'tsx'},banner:{js:`import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(resolve(root,'package.json'))});`},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',plugins,metafile:true,define:{'process.env.NODE_ENV':'"production"'}}),outfile);
 }
 // External renderer/React execute from each checkout's own frozen dependency tree.
 const rendererRequire=createRequire(runtimePaths['react-test-renderer']);
 for(const name of ['react','react-test-renderer','scheduler']){
  const packageFile=(name==='scheduler'?rendererRequire:checkoutRequire).resolve(`${name}/package.json`);inputs.add(packageFile);
  const packageRoot=dirname(packageFile);
  for(const directory of [packageRoot,resolve(packageRoot,'cjs')])if(existsSync(directory))for(const file of readdirSync(directory,{withFileTypes:true}))if(file.isFile()&&/\.(js|json)$/.test(file.name))inputs.add(resolve(directory,file.name));
 }
 for(const path of Object.values(runtimePaths))inputs.add(path);
 for(const input of inputs){if(input.includes('/packages/')&&!input.startsWith(root+'/packages/'))throw Error(`Cross-checkout production input in ${arm}: ${input}`);}
 identities[arm]={root,node:process.version,runtimePaths,builtAt:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),diff:execFileSync('git',['diff','HEAD'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}),status:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),lockHash:hash(resolve(root,'pnpm-lock.yaml')),inputHashes:Object.fromEntries([...inputs].sort().map(file=>[file,hash(file)])),outputHashes:outputs};
}
writeFileSync('source-identity.json',JSON.stringify(identities,null,2));
console.log(JSON.stringify({roots,bundlesPerCheckout:3,inputCounts:Object.fromEntries(Object.entries(identities).map(([arm,value])=>[arm,Object.keys(value.inputHashes).length]))}));
