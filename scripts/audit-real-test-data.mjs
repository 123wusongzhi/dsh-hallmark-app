import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {realCorpus} from '../test/real-data/corpus.ts';
import {prepareBrowserData} from './prepare-real-test-data.mjs';
import {auditTestDataClassification} from './test-data-classification.mjs';
prepareBrowserData();
const {REAL_SOURCE_DETAILS,REAL_SOURCE_SUMMARIES,REAL_STORES,REAL_SALES_PRODUCTS,REAL_SOURCE_IMAGE_DATA}=await import('../test/real-data/browser-data.ts');
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scopesFile=resolve(root,'test/real-data/test-scope.json');
const scope=JSON.parse(readFileSync(scopesFile,'utf8'));
const files=[];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){if(entry.name==='artifacts'||entry.name.endsWith('-artifacts')||entry.name==='node_modules')continue;const path=resolve(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.name.endsWith('.test.ts'))files.push(path);}}
walk(resolve(root,'test'));
const imports=new Map();
function dependencies(path){
  if(imports.has(path))return imports.get(path);
  const source=readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),result=[];
  for(const statement of tree.statements){if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;const specifier=statement.moduleSpecifier;if(!specifier||!ts.isStringLiteral(specifier))continue;
    if(specifier.text==='REAL_SOURCE_DATA'){
      const configuration=readFileSync(resolve(root,'scripts/performance/candidate72-browser/run-browser.mjs'),'utf8');
      assert.ok(configuration.includes("REAL_SOURCE_DATA:resolve(here,'../../../test/real-data/browser-data.ts')"),'Recorded browser alias must resolve to generated corpus data');
      result.push(resolve(root,'test/real-data/browser-data.ts'));continue;
    }
    if(!specifier.text.startsWith('.'))continue;
    const target=resolve(dirname(path),specifier.text),candidate=[target,target+'.ts',target+'.mjs',target+'.tsx',resolve(target,'index.ts')].find(existsSync);
    const name=candidate&&relative(root,candidate).replaceAll('\\','/');
    if(name&&(name.startsWith('test/')||name.startsWith('scripts/performance/')))result.push(candidate);
  }
  imports.set(path,result);return result;
}
function recordingDependency(path,seen=new Set()){
  if(seen.has(path))return false;seen.add(path);
  const name=relative(root,path).replaceAll('\\','/');
  if(name==='test/real-data/corpus.ts'||name==='test/real-data/browser-data.ts')return true;
  if(name==='scripts/performance/six-batch/packaging/fixture.mjs')return /real-source-tests-20261013\/corpus\.json/.test(readFileSync(path,'utf8'));
  return dependencies(path).some(child=>recordingDependency(child,seen));
}
const data=realCorpus(); // Hash validation and mandatory counts run before any coverage claim.
assert.deepEqual(REAL_SOURCE_DETAILS,data.records.map(row=>row.detail),'Browser details must equal immutable captures');
assert.deepEqual(REAL_SOURCE_SUMMARIES,data.records.map(row=>row.summary),'Browser summaries must equal immutable captures');
assert.deepEqual(REAL_STORES,data.ancillary.stores.data,'Browser stores must equal immutable captures');
assert.deepEqual(REAL_SALES_PRODUCTS,data.ancillary.storeProducts.data.products,'Browser sales must equal immutable captures');
for(const asset of data.imageAssets??[]){if(asset.status!=='captured')continue;const encoded=REAL_SOURCE_IMAGE_DATA[asset.productId];assert.ok(encoded?.startsWith(`data:${asset.mimeType};base64,`),'Browser image MIME must match captured image');const bytes=Buffer.from(encoded.slice(encoded.indexOf(',')+1),'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Browser image pixels must match captured image');}
const all=new Set(files.map(path=>relative(root,path).replaceAll('\\','/')));
const {rows,failures}=auditTestDataClassification(scope,{testFiles:all,fileExists:file=>existsSync(resolve(root,file)),recordingDependency:file=>recordingDependency(resolve(root,file))});
const report={schemaVersion:1,checkedAt:new Date().toISOString(),status:failures.length?'FAIL':'PASS',testFiles:all.size,sourceCounts:Object.fromEntries(['taobao_tmall','alibaba_com','pinduoduo'].map(source=>[source,data.records.filter(row=>row.detail.source===source).length])),requiredFiles:rows.length,infrastructureFiles:scope.infrastructureFiles.length,coverage:rows,failures,
  limit:'Dependency and classification audit; business assertions are established by executing the suite. Pristine records, local aliases, faults and scale expansions are distinct.'};
const output=resolve(root,'artifacts/real-source-tests-20261013/test-data-coverage.json');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,testFiles:report.testFiles,requiredFiles:report.requiredFiles,infrastructureFiles:report.infrastructureFiles,sourceCounts:report.sourceCounts,failures,report:output}));
if(failures.length)process.exitCode=1;
