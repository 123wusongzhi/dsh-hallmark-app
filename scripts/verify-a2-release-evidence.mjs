// Offline integrity/scope review aid. This does not execute acceptance tests or grant a release.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scopes=new Set(['DOC','STATIC','FIXTURE','CLOCK_CONTROL','SOURCE_EXEC','LIVE_HOST','LOCAL_MODEL','LIVE_MODEL','REAL_BUSINESS','DATA_CUTOVER']);
const kinds={DOC_CHECK:['DOC'],STATIC_CHECK:['DOC','STATIC'],FIXTURE_EXECUTION:['DOC','FIXTURE','CLOCK_CONTROL'],SOURCE_EXECUTION:['DOC','SOURCE_EXEC','FIXTURE'],HOST_EXECUTION:['DOC','LIVE_HOST','SOURCE_EXEC','FIXTURE'],MODEL_EXECUTION:['DOC','LIVE_HOST','SOURCE_EXEC','LOCAL_MODEL','LIVE_MODEL'],REAL_BUSINESS_EXECUTION:['DOC','REAL_BUSINESS'],CUTOVER_EXECUTION:['DOC','FIXTURE','DATA_CUTOVER']};
const statuses=new Set(['PASS','FAIL','BLOCKED','NOT_RUN','N/A']);
const artifactKinds=new Set(['log','screenshot','input','trace','manifest','result','archive']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const text=value=>typeof value==='string'&&value.trim().length>0;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const testId=value=>typeof value==='string'&&/^TST-(00[1-9]|0[1-7][0-9]|080)$/.test(value);
const candidate=value=>typeof value==='string'&&/^\d+\.\d+\.\d+-candidate\.\d+$/.test(value);
const exact=(value,allowed,required=allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key));
const listScopes=value=>Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(scope=>scopes.has(scope));
const models=new Set(['NONE','LOCAL_MODEL','LIVE_MODEL']);
const releaseScopes=new Set(['CORE','AUTHORING','BUSINESS-WRITE','DATA-CUTOVER','DECLARED_TEST_SET']);
const policyPath=fileURLToPath(new URL('../docs/requirements/A2/docs/03_ACCEPTANCE.md',import.meta.url));
const policySha256='3f267d033d0108fd69302ec220cfcd82d09282378b95a93633ac4031c8a9ee79';
const legacyPath=fileURLToPath(new URL('../docs/requirements/traceability.csv',import.meta.url));
// Both are audited original serializations, not a general line-ending normalization rule.
const legacySerializations={
  b5b0a728fe4e7d42ed15e7122432ab7e4c6395aaf9a2042adcc61de90382eb92:'CRLF_windows_checkout',
  '5885e2375bc5711a36d90a635647966b27b850ebfe8b7ff0e95a7a342575c779':'LF_git_blob',
};
const derivedBaselinePath=fileURLToPath(new URL('../docs/requirements/A2/validation/baseline_48.csv',import.meta.url));
const derivedBaselineSha256='f05edf24340f5c9fd904f33ae99dc98f1a0fd31c1ad4d760c95003391e073ceb';
/** The caller's plan cannot shrink named release scopes. All minimum scopes come from frozen A.2. */
export function loadA2ReleasePolicy(){
  const bytes=readFileSync(policyPath);if(sha(bytes)!==policySha256)throw Error('RELEASE_POLICY_BYTES_CHANGED');
  const cards=bytes.toString('utf8').split(/^### (?=TST-)/m).slice(1),minimum={};
  for(const section of cards){const id=section.match(/^(TST-\d{3})/)[1],declaration=section.match(/\*\*(?:最小范围|范围)：\*\*\s*([^。\r\n]*)/);if(!declaration)throw Error('RELEASE_POLICY_CARD_SCOPE_MISSING');
    const names=declaration[1].match(/[A-Z][A-Z_]+/g)??[];if(!names.length||names.some(name=>!scopes.has(name)))throw Error('RELEASE_POLICY_SCOPE_INVALID');
    minimum[id]={testId:id,scope:[...new Set(names)],modelClass:names.includes('LIVE_MODEL')?'LIVE_MODEL':'NONE'};
  }
  if(Object.keys(minimum).length!==80)throw Error('RELEASE_POLICY_CARD_COUNT_INVALID');
  const core=[...Array.from({length:48},(_,index)=>`TST-${String(index+1).padStart(3,'0')}`),'TST-076','TST-077','TST-080'];
  const ids={CORE:core,AUTHORING:[...core,...Array.from({length:27},(_,index)=>`TST-${String(index+49).padStart(3,'0')}`)],'BUSINESS-WRITE':[...core,'TST-078'],'DATA-CUTOVER':[...core,'TST-073','TST-079']};
  return {source:{path:policyPath,sha256:policySha256,bytes:bytes.length},minimum,requiredByRelease:Object.fromEntries(Object.entries(ids).map(([name,list])=>[name,list.map(id=>minimum[id])]))};
}

/** CSV fields are parsed for reporting; preservation is established by exact bytes and the frozen SHA. */
export function parseEvidenceCsv(source){
  if(typeof source!=='string')throw Error('LEGACY_CSV_INVALID');
  // UTF-8 BOM affects byte identity (checked separately), not the first CSV column's name.
  if(source.startsWith('\ufeff'))source=source.slice(1);
  const rows=[],row=[];let field='',quoted=false,closed=false;
  for(let index=0;index<source.length;index++){
    const char=source[index];
    if(quoted){if(char==='"'){if(source[index+1]==='"'){field+='"';index++;}else{quoted=false;closed=true;}}else field+=char;continue;}
    if(closed&&!['\r','\n',','].includes(char))throw Error('LEGACY_CSV_INVALID');
    if(char==='"'){if(field||closed)throw Error('LEGACY_CSV_INVALID');quoted=true;}
    else if(char===','){row.push(field);field='';closed=false;}
    else if(char==='\r'||char==='\n'){if(char==='\r'&&source[index+1]==='\n')index++;row.push(field);rows.push([...row]);row.length=0;field='';closed=false;}
    else field+=char;
  }
  if(quoted)throw Error('LEGACY_CSV_INVALID');if(field||row.length||closed){row.push(field);rows.push([...row]);}
  if(!rows.length||new Set(rows[0]).size!==rows[0].length||rows[0].some(name=>!name)||rows.slice(1).some(value=>value.length!==rows[0].length))throw Error('LEGACY_CSV_INVALID');
  return {columns:rows[0],rows:rows.slice(1).map(value=>Object.fromEntries(rows[0].map((name,index)=>[name,value[index]])))};
}

/** Original 48-row history and the A.2 derived observation table are distinct frozen inputs. */
export function loadFrozenBaseline(originalFile=legacyPath){
  const path=resolve(originalFile),original=readFileSync(path),derived=readFileSync(derivedBaselinePath),originalSha256=sha(original),serialization=legacySerializations[originalSha256];if(!serialization||sha(derived)!==derivedBaselineSha256)throw Error('FROZEN_BASELINE_BYTES_CHANGED');
  const originalCsv=parseEvidenceCsv(original.toString('utf8')),derivedCsv=parseEvidenceCsv(derived.toString('utf8'));
  const originalColumns=['requirementId','group','title','taskIds','testId','implementationStatus','testStatus','fixtureStatus','remainingRealStatus','evidencePath'];
  const derivedColumns=['requirementId','title','reportedImplementation','reportedTest','reportedFixture','reportedRemainingReal','sourceObservation','currentRunStatus','evidenceAccess','sourceIds'];
  if(JSON.stringify(originalCsv.columns)!==JSON.stringify(originalColumns)||JSON.stringify(derivedCsv.columns)!==JSON.stringify(derivedColumns)||originalCsv.rows.length!==48||derivedCsv.rows.length!==48)throw Error('FROZEN_BASELINE_SCHEMA_INVALID');
  for(const [index,row]of originalCsv.rows.entries()){
    const id=`REQ-${String(index+1).padStart(3,'0')}`,observation=derivedCsv.rows[index];
    if(row.requirementId!==id||row.testId!==id.replace('REQ','TST')||observation.requirementId!==id||row.title!==observation.title||row.implementationStatus!==observation.reportedImplementation||row.testStatus!==observation.reportedTest||row.fixtureStatus!==observation.reportedFixture||row.remainingRealStatus!==observation.reportedRemainingReal||observation.currentRunStatus!=='NOT_RUN')throw Error('FROZEN_BASELINE_VALUES_INVALID');
  }
  return {original:{path,sha256:originalSha256,bytes:original.length},serialization,acceptedOriginalSerializations:legacySerializations,derived:{path:derivedBaselinePath,sha256:derivedBaselineSha256,bytes:derived.length},originalColumns,originalRows:48,remainingRealNotRun:originalCsv.rows.filter(row=>row.remainingRealStatus==='NOT_RUN').length,derivedCurrentNotRun:derivedCsv.rows.filter(row=>row.currentRunStatus==='NOT_RUN').length};
}

export function verifyA2ReleaseEvidence(manifest,{baseDirectory=process.cwd()}={}){
  const issues=[],verifiedFiles=[],records=[],recordResults=[];let legacy=null,releasePolicy=null;
  const issue=(code,detail)=>issues.push({code,detail});
  function readRef(ref,label,allowed=['path','sha256','bytes']){
    if(!exact(ref,allowed,['path','sha256','bytes'])||!text(ref.path)||!hash(ref.sha256)||!Number.isSafeInteger(ref.bytes)||ref.bytes<0){issue('EVIDENCE_REFERENCE_INVALID',label);return;}
    const path=resolve(baseDirectory,ref.path);
    try{if(!existsSync(path)){issue('EVIDENCE_GAP',label);return;}if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile()){issue('EVIDENCE_REFERENCE_INVALID',label);return;}
      const bytes=readFileSync(path);if(bytes.length!==ref.bytes||sha(bytes)!==ref.sha256){issue('EVIDENCE_INVALID',label);return;}
      verifiedFiles.push({label,path,sha256:ref.sha256,bytes:ref.bytes});return bytes;
    }catch{issue('EVIDENCE_GAP',label);}
  }
  if(!exact(manifest,['schemaVersion','target','required','records','legacyCsv'],['schemaVersion','target','required','records'])||manifest.schemaVersion!==1){issue('MANIFEST_SCHEMA_INVALID','Only schemaVersion 1 with known fields is accepted.');return finish();}
  if(!exact(manifest.target,['candidate','executedCommit','releaseScope'])||!candidate(manifest.target.candidate)||!commit(manifest.target.executedCommit)||!releaseScopes.has(manifest.target.releaseScope)){issue('TARGET_INVALID','Explicit candidate, commit and known releaseScope are required.');return finish();}
  const declared=Array.isArray(manifest.required)?manifest.required:[];
  if(!declared.length||declared.some(item=>!exact(item,['testId','scope','modelClass'])||!testId(item.testId)||!listScopes(item.scope)||!models.has(item.modelClass)||(item.modelClass==='NONE'?item.scope.some(scope=>['LIVE_MODEL','LOCAL_MODEL'].includes(scope)):!item.scope.includes(item.modelClass)||item.scope.some(scope=>['LIVE_MODEL','LOCAL_MODEL'].includes(scope)&&scope!==item.modelClass)))){issue('REQUIRED_SET_INVALID','Required items need a known testId, exact scope set and consistent modelClass.');return finish();}
  if(new Set(declared.map(item=>JSON.stringify(item))).size!==declared.length)issue('REQUIRED_SET_INVALID','Duplicate required identities.');
  let mandatory=[];
  if(manifest.target.releaseScope!=='DECLARED_TEST_SET'){try{releasePolicy=loadA2ReleasePolicy();mandatory=releasePolicy.requiredByRelease[manifest.target.releaseScope];}catch(error){issue('RELEASE_POLICY_INVALID',error.message);return finish();}}
  const required=[...new Map([...mandatory,...declared].map(item=>[JSON.stringify({...item,scope:[...item.scope].sort()}),item])).values()];
  if(!Array.isArray(manifest.records))issue('RECORD_SET_INVALID','records must be original referenced files.');
  for(const [index,ref]of (Array.isArray(manifest.records)?manifest.records:[]).entries()){
    const bytes=readRef(ref,`record:${index}`);if(!bytes)continue;let row;
    try{row=JSON.parse(bytes.toString('utf8'));}catch{issue('RECORD_SCHEMA_INVALID',`record:${index}`);continue;}
    const fields=['schemaVersion','recordKind','testId','runId','candidate','executedCommit','scope','modelClass','executionKind','status','assertions','artifacts','metrics'];
    const valid=exact(row,fields)&&row.schemaVersion===1&&row.recordKind==='ACCEPTANCE_EXECUTION'&&testId(row.testId)&&text(row.runId)&&candidate(row.candidate)&&commit(row.executedCommit)&&listScopes(row.scope)&&models.has(row.modelClass)&&Object.hasOwn(kinds,row.executionKind)&&statuses.has(row.status)&&Array.isArray(row.assertions)&&Array.isArray(row.artifacts)&&Array.isArray(row.metrics);
    if(!valid){issue('RECORD_SCHEMA_INVALID',`record:${index}`);continue;}
    const identity={testId:row.testId,runId:row.runId,candidate:row.candidate,executedCommit:row.executedCommit,scope:row.scope,modelClass:row.modelClass};
    const errors=[],flag=code=>{errors.push(code);issue(code,identity);};
    if(row.scope.some(scope=>!kinds[row.executionKind].includes(scope)))flag('EXECUTION_SCOPE_MISMATCH');
    if(row.modelClass==='NONE'&&row.scope.some(scope=>['LIVE_MODEL','LOCAL_MODEL'].includes(scope))||row.modelClass!=='NONE'&&(row.executionKind!=='MODEL_EXECUTION'||!row.scope.includes(row.modelClass)||row.scope.some(scope=>['LOCAL_MODEL','LIVE_MODEL'].includes(scope)&&scope!==row.modelClass)))flag('MODEL_SCOPE_MISMATCH');
    if(row.status==='PASS'&&(!row.assertions.length||!row.artifacts.length))flag('PASS_EVIDENCE_INCOMPLETE');
    if(row.assertions.some(item=>!exact(item,['id','expected','actual','status'])||!text(item.id)||!statuses.has(item.status)))flag('ASSERTION_SCHEMA_INVALID');
    else if(row.status==='PASS'&&row.assertions.some(item=>item.status!=='PASS'||item.actual===null))flag('ASSERTION_NOT_PASS');
    for(const [artifactIndex,artifact]of row.artifacts.entries()){
      if(!artifactKinds.has(artifact?.kind)){flag('ARTIFACT_KIND_INVALID');continue;}
      if(!readRef(artifact,`record:${index}:artifact:${artifactIndex}`,['path','sha256','bytes','kind']))errors.push('ARTIFACT_INTEGRITY_FAILED');
    }
    for(const metric of row.metrics){
      if(!exact(metric,['name','value','unit'])||!text(metric.name)||!Number.isFinite(metric.value)||metric.value<0||!['bytes','token','ms','count'].includes(metric.unit)){flag('METRIC_SCHEMA_INVALID');continue;}
      if(/token/i.test(metric.name)&&metric.unit!=='token')flag('TOKEN_UNIT_MISMATCH');
    }
    const prior=records.find(record=>record.testId===row.testId&&record.runId===row.runId&&record.candidate===row.candidate&&record.executedCommit===row.executedCommit&&JSON.stringify([...record.scope].sort())===JSON.stringify([...row.scope].sort())&&record.modelClass===row.modelClass);
    if(prior){prior.integrityValid=false;flag('RECORD_IDENTITY_CONFLICT');}
    records.push({...row,integrityValid:errors.length===0});recordResults.push({...identity,status:row.status,executionKind:row.executionKind,errors});
  }
  if(manifest.legacyCsv!==undefined){
    if(!exact(manifest.legacyCsv,['original','imported','expectedRows'])||manifest.legacyCsv.expectedRows!==48)issue('LEGACY_CSV_INVALID','A.2 legacy import requires the frozen original 48-row CSV, not an arbitrary replacement.');
    else{const original=readRef(manifest.legacyCsv.original,'legacy:original'),imported=readRef(manifest.legacyCsv.imported,'legacy:imported');
      if(original&&imported){if(!original.equals(imported))issue('LEGACY_CSV_CHANGED','Imported records must preserve all original bytes and values.');
        else try{if(!Object.hasOwn(legacySerializations,sha(original))){issue('LEGACY_BASELINE_MISMATCH','Caller cannot replace both original/imported history and recompute their references.');const parsed=parseEvidenceCsv(original.toString('utf8'));if(parsed.rows.length!==48||!parsed.columns.includes('remainingRealStatus'))issue('LEGACY_CSV_INVALID','Frozen original row count/columns are required.');}
          else{const baseline=loadFrozenBaseline(resolve(baseDirectory,manifest.legacyCsv.original.path)),parsed=parseEvidenceCsv(original.toString('utf8'));if(parsed.rows.length!==48||JSON.stringify(parsed.columns)!==JSON.stringify(baseline.originalColumns))issue('LEGACY_CSV_INVALID','Frozen original row count/columns are required.');
          legacy={preservedExactBytes:true,originalSha256:sha(original),serialization:baseline.serialization,rows:parsed.rows.length,columns:parsed.columns,historicalTestStatuses:Object.fromEntries([...new Set(parsed.rows.map(row=>row.testStatus))].map(status=>[status,parsed.rows.filter(row=>row.testStatus===status).length])),remainingRealNotRun:parsed.rows.filter(row=>row.remainingRealStatus==='NOT_RUN').length,frozenOriginal:baseline.original,frozenDerivedObservation:baseline.derived,derivedCurrentNotRun:baseline.derivedCurrentNotRun,countsAsCurrentAcceptance:false};}
        }catch{issue('LEGACY_CSV_INVALID','CSV rows/columns are not valid.');}}
    }
  }else if(manifest.target.releaseScope!=='DECLARED_TEST_SET')issue('FROZEN_LEGACY_IMPORT_REQUIRED','Named scopes require the original 48-row historical import as well as current records.');
  const requiredResults=required.map(item=>{
    const sameTest=records.filter(row=>row.testId===item.testId),targetRows=sameTest.filter(row=>row.candidate===manifest.target?.candidate&&row.executedCommit===manifest.target?.executedCommit);
    const compatible=(row,scope)=>row.scope.includes(scope)&&(scope==='LIVE_MODEL'||scope==='LOCAL_MODEL'?row.modelClass===scope:row.modelClass==='NONE'||row.modelClass===item.modelClass);
    const qualified=targetRows.filter(row=>item.scope.some(scope=>compatible(row,scope))),passing=qualified.filter(row=>row.status==='PASS'&&row.integrityValid),missingScopes=item.scope.filter(scope=>!passing.some(row=>compatible(row,scope)));
    const reason=!sameTest.length?'RECORD_MISSING':!targetRows.length?'VERSION_OR_COMMIT_MISMATCH':!qualified.length?'REQUIRED_SCOPE_MISMATCH':qualified.some(row=>row.status!=='PASS')?'REQUIRED_RECORD_NOT_PASS':qualified.some(row=>!row.integrityValid)?'REQUIRED_EVIDENCE_INVALID':missingScopes.length?'REQUIRED_SCOPE_MISMATCH':'PASS';
    if(reason!=='PASS')issue(reason,item);return {...item,status:reason==='PASS'?'PASS':'BLOCKED',reason,missingScopes,matchingRunIds:passing.map(row=>row.runId)};
  });
  return finish(requiredResults);
  function finish(requiredResults=[]){const intact=issues.length===0&&requiredResults.length>0&&requiredResults.every(item=>item.status==='PASS'),named=manifest?.target?.releaseScope!=='DECLARED_TEST_SET';return {schemaVersion:1,kind:'EVIDENCE_INTEGRITY_AND_SCOPE_REVIEW',classification:named?'RELEASE_SET_ELIGIBILITY_ONLY':'NOT_A_RELEASE_GATE',scope:manifest?.target?.releaseScope??null,target:manifest?.target??null,releasePolicy:releasePolicy?{source:releasePolicy.source,mandatoryTestCount:releasePolicy.requiredByRelease[manifest.target.releaseScope].length}:null,requiredResults,recordResults,legacy,verifiedFiles,issues,declaredCardSetIntegrity:intact,eligibleForCardReview:intact,eligibleForReleaseReview:Boolean(named&&intact&&releasePolicy),namedReleaseScopeEvaluated:releasePolicy?manifest.target.releaseScope:null,fullReleaseGatesEvaluated:false,releaseApproved:false,limitations:['Verifies declared identity, minimum scopes and referenced bytes only; does not execute or independently prove assertions.','Named release scopes force all mandatory cards and minimum scopes from the frozen A.2 hand册. DECLARED_TEST_SET is card review only, never release eligibility.','One named scope does not sign the other three; no overall release or human approval is produced.','Does not change original records or turn historical PASS into current acceptance.']};}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node scripts/verify-a2-release-evidence.mjs --manifest <offline JSON manifest> [--output <new result.json>]\nRead-only evidence verification; output is created exclusively. Named scopes force frozen A.2 mandatory cards/minimum scopes. DECLARED_TEST_SET checks local cards only. No automatic release approval.');
  else{
    const options={};for(let index=0;index<args.length;index++){const key=args[index];if(!['--manifest','--output'].includes(key)||options[key]||!args[index+1]||args[index+1].startsWith('--'))throw Error('INVALID_ARGUMENT');options[key]=args[++index];}
    if(!options['--manifest'])throw Error('MANIFEST_REQUIRED');const path=resolve(options['--manifest']);
    const result=verifyA2ReleaseEvidence(JSON.parse(readFileSync(path,'utf8')),{baseDirectory:dirname(path)});
    if(options['--output'])writeFileSync(resolve(options['--output']),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify(result,null,2));if(!result.eligibleForCardReview)process.exitCode=2;
  }
}
