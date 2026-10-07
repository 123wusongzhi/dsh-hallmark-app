/** TST-023: actual isolated HTTP, registered gateway rendering and SQLite spill failure. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {connect} from 'node:net';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {RuntimeWriterLease} from '../../packages/app-runtime/src/lease.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {HttpAppsHostTransport} from '../../packages/plugin-apps/src/transport.ts';
import {AppsHost} from '../../packages/plugin-apps/src/index.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const runId=`a2-model-budget-${randomUUID()}`,root=join(repository,'evidence/apps-a2-20261007/formal-model-budget',runId);
const candidate='1.0.0-candidate.11',frozenRoot=join(repository,'evidence/apps-a2-20261007/candidates',candidate);
const frozen=JSON.parse(readFileSync(join(frozenRoot,'build-manifest.json'),'utf8'));
const packageManifest=JSON.parse(readFileSync(join(frozenRoot,'package-manifest.json'),'utf8'));
const startedAt=new Date().toISOString(),assertions=[],http=[],providerCalls=[],runtimeLogs=[],tools=new Map(),routes=new Map();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hash=path=>sha(readFileSync(path));
const json=(path,value)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return evidenceFile(path);};
function check(id,expected,actual,condition){const row={id,required:true,expected,actual,result:condition?'PASS':'FAIL',observedAt:new Date().toISOString()};assertions.push(row);assert.ok(condition,JSON.stringify(row));}
function inventory(directory,current=directory){return readdirSync(current,{withFileTypes:true}).flatMap(entry=>{if(entry.name==='node_modules')return[];const path=join(current,entry.name);assert.equal(entry.isSymbolicLink(),false);return entry.isDirectory()?inventory(directory,path):entry.isFile()?[{path:relative(directory,path).split(sep).join('/'),sha256:hash(path),bytes:statSync(path).size}]:[];}).sort((a,b)=>a.path.localeCompare(b.path));}
function inputs(){return Object.entries(frozen.sourceInputs).map(([path,expected])=>({path,expected,actual:hash(join(repository,path)),matches:hash(join(repository,path))===expected}));}
function artifacts(){return Object.entries(frozen.artifacts).map(([path,expected])=>({path,expected,actual:hash(join(repository,'bundles/apps',path)),matches:hash(join(repository,'bundles/apps',path))===expected}));}
const snapshot=(label)=>json(join(root,'states',label+'.json'),{at:new Date().toISOString(),tables:Object.fromEntries(store.collections.map(table=>[table,store.db.prepare(`SELECT id,value_json,created_at,updated_at FROM ${table} ORDER BY id`).all()]))});
const stoppedPort=port=>new Promise(done=>{const socket=connect({host:'127.0.0.1',port});socket.setTimeout(1500);socket.once('connect',()=>{socket.destroy();done('UNEXPECTED_CONNECTION');});socket.once('error',error=>{socket.destroy();done(error.code);});socket.once('timeout',()=>{socket.destroy();done('PROBE_TIMEOUT');});});
mkdirSync(root,{recursive:true});
let store,runtime,lease,server,host,port,identityRef,fatal=null,status='NOT_RUN',readOnlySpill=false,activeProviderCalls=0;
try{
  const executedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
  const gitStatus=execFileSync('git',['status','--porcelain'],{cwd:repository,encoding:'utf8'});
  const productionDiff=execFileSync('git',['diff','HEAD','--','packages','scripts','bundles/apps/server','bundles/apps/client'],{cwd:repository,encoding:'utf8'});
  writeFileSync(join(root,'executed-production-source-diff.patch'),productionDiff,{flag:'wx'});
  const paths=[...new Set([...Object.keys(frozen.sourceInputs),...execFileSync('git',['ls-files','--','packages'],{cwd:repository,encoding:'utf8'}).trim().split('\n').filter(path=>/\.(?:ts|tsx|json)$/.test(path))])];
  for(const path of paths){const destination=join(root,'executed-source',path);mkdirSync(dirname(destination),{recursive:true});copyFileSync(join(repository,path),destination);}
  copyFileSync(fileURLToPath(import.meta.url),join(root,'executed-harness.mjs'));
  const sourceRef=json(join(root,'executed-source-manifest.json'),{executedCommit,files:inventory(join(root,'executed-source'))});
  const beforeInputs=inputs(),beforeArtifacts=artifacts();json(join(root,'candidate-inputs-before.json'),beforeInputs);json(join(root,'candidate-artifacts-before.json'),beforeArtifacts);
  check('023.frozenInputs','143 matching source inputs',{count:beforeInputs.length,mismatches:beforeInputs.filter(row=>!row.matches)},beforeInputs.length===143&&beforeInputs.every(row=>row.matches));
  check('023.frozenArtifacts','33 matching package artifacts',{count:beforeArtifacts.length,mismatches:beforeArtifacts.filter(row=>!row.matches)},beforeArtifacts.length===33&&beforeArtifacts.every(row=>row.matches));
  const archive=evidenceFile(resolve(repository,packageManifest.archive));assert.equal(archive.sha256,packageManifest.sha256);
  identityRef=json(join(root,'identity.json'),{executedCommit,sourceIdentity:productionDiff?'WORKTREE_SNAPSHOT_AT_BASE_COMMIT':'CLEAN_PRODUCTION_SOURCE_AT_COMMIT',gitStatus,productionSourceDiff:evidenceFile(join(root,'executed-production-source-diff.patch')),harness:evidenceFile(join(root,'executed-harness.mjs')),sourceManifest:sourceRef,candidate,archive,buildManifest:evidenceFile(join(frozenRoot,'build-manifest.json')),packageManifest:evidenceFile(join(frozenRoot,'package-manifest.json')),acceptanceCards:evidenceFile(join(repository,'docs/requirements/A2/docs/03_ACCEPTANCE.md')),command:[process.execPath,...process.argv.slice(1)],node:process.version,os:process.platform,architecture:process.arch,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,scope:['FIXTURE'],modelClass:'NONE',nativeMemoryAcceptance:'NOT_RUN',sourceScope:'Actual source Runtime/HTTP/registered Apps gateway output.render; isolated synthetic data and actual SQLite query_only spill fault. No original DSH/UI/model/business access.'});
  const runtimeRoot=join(root,'runtime');lease=new RuntimeWriterLease(runtimeRoot);store=new RuntimeStore(join(runtimeRoot,'apps.db'));runtime=new AppsRuntime(store,{log:row=>runtimeLogs.push(structuredClone(row))});
  const rows=Array.from({length:1024},(_,index)=>({id:index,title:`合成商品${index}`,detail:'中文预算边界'.repeat(90)}));
  const dataBytes=Buffer.byteLength(JSON.stringify(rows),'utf8'),rowsRef=json(join(root,'fixtures','one-mib-chinese-rows.json'),rows);
  check('023.fixtureOneMiB','real array JSON >= 1 MiB UTF-8',{bytes:dataBytes,length:rows.length,stringLength:JSON.stringify(rows).length},dataBytes>=1024*1024&&dataBytes>JSON.stringify(rows).length);
  const descriptor={capabilityId:'budgetfixture.rows.query',version:'1.0.0',title:'Synthetic UTF-8 budget fixture',description:'Isolated one-MiB Chinese result, not a real shop',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'array',items:{type:'object',properties:{id:{type:'integer'},title:{type:'string'},detail:{type:'string'}},required:['id','title','detail'],additionalProperties:false}},execution:{mode:'sync',timeoutMs:10000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:['synthetic']},aliases:[]};
  runtime.register({manifest:{manifestVersion:1,appId:'budgetfixture',displayName:'Synthetic UTF-8 budget fixture',providerPackage:'a2-budget-fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor],async execute(context){activeProviderCalls++;try{providerCalls.push({at:new Date().toISOString(),request:structuredClone(context.request),resultDataSha256:sha(JSON.stringify(rows)),rowCount:rows.length});return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:rows};}finally{activeProviderCalls--; }},async dispose(){}});
  const sessionId=`fixture-${runId}`,agent={id:sessionId};runtime.addConnection({appId:'budgetfixture',connectionId:'C1',displayName:'Synthetic only C1',config:{},configRevision:1,enabled:true});runtime.bind({sessionId,appId:'budgetfixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const presentation=new AppsPresentationService({store,runtime}),token=randomUUID()+randomUUID();
  server=createAppsServer({runtime,presentation,token});await new Promise(done=>server.listen(0,'127.0.0.1',done));port=server.address().port;
  assert.ok(![36994,4180,4280].includes(port));const url=`http://127.0.0.1:${port}`;
  const observedFetch=async(input,init={})=>{const address=new URL(String(input));assert.equal(address.origin,url);const request={at:new Date().toISOString(),method:init.method??'GET',path:address.pathname+address.search,...(init.body?{body:JSON.parse(String(init.body))}:{})};http.push(request);const response=await fetch(input,init);request.status=response.status;request.response=await response.clone().json();request.finishedAt=new Date().toISOString();return response;};
  const transport=new HttpAppsHostTransport(url,token,observedFetch),actualProjection=transport.projectModelResult.bind(transport);
  transport.projectModelResult=async(id,signal)=>{if(readOnlySpill){store.db.exec('PRAGMA query_only = ON');json(join(root,'spill-fault.json'),{at:new Date().toISOString(),injection:'Actual isolated SQLite PRAGMA query_only=ON; no production-method stub or fabricated result',queryOnly:store.db.prepare('PRAGMA query_only').get(),invocationId:id});}return actualProjection(id,signal);};
  host=new AppsHost({agents:{get:id=>id===sessionId?agent:undefined},tools:{register:tool=>{assert.equal(tools.has(tool.name),false);tools.set(tool.name,tool);return()=>tools.delete(tool.name);}},connection:{fetch:{register:route=>{routes.set(route.path,route);return()=>routes.delete(route.path);}}}},transport);await host.start();host.attachApp('budgetfixture');
  const tool=tools.get('apps_invoke'),args={appId:'budgetfixture',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{}};
  snapshot('before-normal');
  const value=await tool.execute(args,{agent,signal:new AbortController().signal,callId:`native-fixture-${randomUUID()}`});
  const modelText=tool.output.render(args,value)[0].text,model=JSON.parse(modelText),rawRef=json(join(root,'normal-gateway-result.json'),{args,value,modelText,modelTextBytes:Buffer.byteLength(modelText,'utf8')});
  const normalAfter=snapshot('after-normal');
  check('023.realHttpDispatch','one actual POST /v1/invocations with one Provider execution',{posts:http.filter(row=>row.path==='/v1/invocations').length,providerCalls:providerCalls.length},http.filter(row=>row.path==='/v1/invocations').length===1&&providerCalls.length===1);
  check('023.actualModelBudget','registered output.render UTF-8 <=16384; not a token estimate',{bytes:Buffer.byteLength(modelText,'utf8'),model},Buffer.byteLength(modelText,'utf8')<=16384&&model.status==='ok'&&typeof model.fullResultRef==='string'&&model.bytes===Buffer.byteLength(JSON.stringify(value.result),'utf8')&&model.completeness==='partial');
  const full=store.get('datasets',model.fullResultRef);json(join(root,'spilled-full-result.json'),full);
  check('023.completeHandle','stored full result exactly preserves original array',{storedSha256:sha(JSON.stringify(full.result.data)),fixtureSha256:sha(JSON.stringify(rows)),rows:full.result.data.length},canonicalJson(full.result.data)===canonicalJson(rows));
  const getPage=async(cursor)=>{const response=await observedFetch(`${url}/v1/results/${encodeURIComponent(model.fullResultRef)}?cursor=${cursor}&limit=100`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);return response.json();};
  const first=await getPage('0'),second=await getPage('100');json(join(root,'first-page.json'),first);json(join(root,'second-page.json'),second);
  for(const [label,page,offset]of[['first',first,0],['second',second,100]])check(`023.${label}Page`,'actual HTTP page: total1024/returned100/cursor/partial and exact original rows',{total:page.total,returned:page.returned,nextCursor:page.nextCursor,completeness:page.completeness,itemsSha256:sha(JSON.stringify(page.items))},page.total===1024&&page.returned===100&&page.nextCursor===String(offset+100)&&page.completeness==='partial'&&canonicalJson(page.items)===canonicalJson(rows.slice(offset,offset+100)));
  const reconstructed=[];for(let offset=0;offset<rows.length;offset+=200){const response=await observedFetch(`${url}/v1/results/${encodeURIComponent(model.fullResultRef)}?cursor=${offset}&limit=200`,{headers:{Authorization:`Bearer ${token}`}});const page=await response.json();assert.equal(response.status,200);reconstructed.push(...page.items);if(offset===1000)check('023.finalPage','last24 rows, returned24,total1024,nextCursor null',{returned:page.returned,total:page.total,nextCursor:page.nextCursor},page.returned===24&&page.total===1024&&page.nextCursor===null);}
  check('023.fullPagination','all rows available through handle with no loss',{rows:reconstructed.length,sha256:sha(JSON.stringify(reconstructed)),fixture:rowsRef},canonicalJson(reconstructed)===canonicalJson(rows));
  readOnlySpill=true;const datasetCount=store.list('datasets').length;
  const failedValue=await tool.execute(args,{agent,signal:new AbortController().signal,callId:`native-fixture-${randomUUID()}`});
  const failedText=tool.output.render(args,failedValue)[0].text,failed=JSON.parse(failedText);json(join(root,'failed-spill-gateway-result.json'),{args,value:failedValue,modelText:failedText,modelTextBytes:Buffer.byteLength(failedText,'utf8')});
  snapshot('after-spill-failure');
  check('023.realSpillFailure','actual model-result endpoint reports bounded error, smaller-page recovery, no full text',{failed,bytes:Buffer.byteLength(failedText,'utf8'),datasetsBefore:datasetCount,datasetsAfter:store.list('datasets').length},failed.status==='failed'&&failed.error?.code==='RESULT_SPILL_FAILED'&&failed.error.retryPolicy==='never'&&/smaller page|projection/i.test(failed.error.message)&&Buffer.byteLength(failedText,'utf8')<=16384&&!Object.hasOwn(failed,'data')&&store.list('datasets').length===datasetCount);
  check('023.noRetry','two independent query invocations each dispatched exactly once; no mutation',{providers:providerCalls.length,invocationIds:providerCalls.map(row=>row.request.invocationId),operations:store.list('operations').length},providerCalls.length===2&&new Set(providerCalls.map(row=>row.request.invocationId)).size===2&&store.list('operations').length===0);
  check('023.rawHttpProjection','both projections were actual successful HTTP responses, including failed spill envelope',http.filter(row=>row.path==='/v1/model-result').map(row=>({status:row.status,response:row.response})),http.filter(row=>row.path==='/v1/model-result').length===2&&http.filter(row=>row.path==='/v1/model-result').every(row=>row.status===200));
  status='PASS';
}catch(error){fatal={name:error.name,message:error.message,stack:error.stack};status='FAIL';json(join(root,'failure.json'),fatal);}
finally{
  try{if(store)store.db.exec('PRAGMA query_only = OFF');if(host)await host.dispose();if(server){const closed=new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server.closeAllConnections();await closed;}if(runtime)await runtime.dispose();if(store)store.close();if(lease)lease.release();
    const probe=port?await stoppedPort(port):'NOT_STARTED';json(join(root,'cleanup.json'),{at:new Date().toISOString(),port,probe,toolsRemaining:tools.size,routesRemaining:routes.size,providerCallsPending:activeProviderCalls,leaseExists:lease?existsSync(lease.path):false,originalDesktopRuntimeTouched:false});
    check('023.cleanup','mock socket closed, tools/routes/Provider pending/lease zero',{probe,tools:tools.size,routes:routes.size,pending:activeProviderCalls,leaseExists:lease?existsSync(lease.path):false},(!port||probe==='ECONNREFUSED')&&tools.size===0&&routes.size===0&&activeProviderCalls===0&&(!lease||!existsSync(lease.path)));
    const afterInputs=inputs(),afterArtifacts=artifacts();json(join(root,'candidate-inputs-after.json'),afterInputs);json(join(root,'candidate-artifacts-after.json'),afterArtifacts);
    check('023.immutableCandidate','143 source inputs and 33 artifacts still match candidate11',{sourceMismatches:afterInputs.filter(row=>!row.matches),artifactMismatches:afterArtifacts.filter(row=>!row.matches)},afterInputs.every(row=>row.matches)&&afterArtifacts.every(row=>row.matches));
  }catch(error){status='FAIL';json(join(root,'cleanup-failure.json'),{message:error.message,stack:error.stack});}
  json(join(root,'http.json'),http);json(join(root,'provider-events.json'),providerCalls);json(join(root,'runtime-log.json'),runtimeLogs);json(join(root,'assertions.json'),assertions);
  const refs=inventory(root).filter(item=>!item.path.startsWith('runtime/')).map(item=>({...evidenceFile(join(root,item.path)),path:join(root,item.path)}));
  const executedCommit=identityRef?JSON.parse(readFileSync(identityRef.path,'utf8')).executedCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
  const result={schemaVersion:1,recordKind:'ACCEPTANCE_EXECUTION',testId:'TST-023',runId,candidate,executedCommit,scope:['FIXTURE'],modelClass:'NONE',executionKind:'FIXTURE_EXECUTION',status,assertions:assertions.map(row=>({id:row.id,expected:row.expected,actual:row.actual,status:row.result})),artifacts:refs.map(ref=>({...ref,kind:ref.path.includes('executed-source')||ref.path.endsWith('executed-harness.mjs')?'input':'trace'})),metrics:[{name:'elapsed',value:Date.now()-Date.parse(startedAt),unit:'ms'},{name:'assertions',value:assertions.length,unit:'count'},{name:'providerCalls',value:providerCalls.length,unit:'count'}]};
  const resultRef=json(join(root,'TST-023','FIXTURE','result.json'),result);
  const summaryRef=json(join(root,'result.json'),{status,testId:'TST-023',runId,candidate,executedCommit,startedAt,finishedAt:new Date().toISOString(),scope:['FIXTURE'],modelClass:'NONE',assertionCount:assertions.length,passed:assertions.filter(row=>row.result==='PASS').length,failed:assertions.filter(row=>row.result==='FAIL').length,identity:identityRef,result:resultRef,artifacts:refs,fatal,nativeAcceptance:'NOT_RUN',releaseApproved:false});
  json(join(root,'artifact-index.json'),{at:new Date().toISOString(),files:inventory(root)});
  console.log(JSON.stringify({status,output:root,result:summaryRef,assertionCount:assertions.length,passed:assertions.filter(row=>row.result==='PASS').length,failed:assertions.filter(row=>row.result==='FAIL').length}));if(status!=='PASS')process.exitCode=1;
}
