/** Start only the generated candidate Runtime, with a fresh isolated directory and no Hallmark backend mapping. */
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
const repository = resolve('.'), directory = await mkdtemp(join(tmpdir(),'apps-bundle-smoke-'));
const packageEvidence=JSON.parse(await readFile('evidence/apps-v1-20261007/P5/TODO-026/package-manifest.json','utf8')),archive=resolve(packageEvidence.archive),archiveHash=createHash('sha256').update(await readFile(archive)).digest('hex');
if(archiveHash!==packageEvidence.sha256)throw new Error('CANDIDATE_ARCHIVE_HASH_MISMATCH');
const entries=execFileSync('tar',['-tf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);if(entries.some(path=>!path.startsWith('package/')||path.split('/').includes('..')||path.includes('\\')))throw new Error('UNSAFE_CANDIDATE_ARCHIVE_PATH');
const candidateDirectory=join(directory,'candidate');await mkdir(candidateDirectory);execFileSync('tar',['-xf',archive,'-C',candidateDirectory]);
const configuration = join(directory,'connections.json');
await writeFile(configuration,JSON.stringify({connections:[{appId:'notes',connectionId:'notes-local',displayName:'Isolated Notes',enabled:true,config:{backend:'local-notes'},configRevision:1}]}));
const reserve = createServer();await new Promise(resolve => reserve.listen(0,'127.0.0.1',resolve));const port = reserve.address().port;await new Promise(resolve => reserve.close(resolve));
const entry = join(candidateDirectory,'package/lib/runtime.js'), hash = createHash('sha256').update(await readFile(entry)).digest('hex');
const buildEvidence=JSON.parse(await readFile('evidence/apps-v1-20261007/P5/TODO-026/build-manifest.json','utf8'));if(hash!==buildEvidence.artifacts['lib/runtime.js'])throw new Error('PACKED_RUNTIME_HASH_MISMATCH');
const processHandle = spawn(process.execPath,[entry],{cwd:repository,env:{...process.env,APPS_DATA_DIR:directory,APPS_CONNECTIONS_FILE:configuration,APPS_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';processHandle.stdout.on('data',chunk=>{stdout+=chunk;});processHandle.stderr.on('data',chunk=>{stderr+=chunk;});
const sleep = duration => new Promise(resolve => setTimeout(resolve,duration));
let closed = false;processHandle.once('exit',()=>{closed=true;});
const output = 'evidence/apps-v1-20261007/P5/TODO-026';await mkdir(output,{recursive:true});
const requests=[];let failure;
try {
  let token;
  for(let attempt=0;attempt<100;attempt++) {if(closed)throw new Error('GENERATED_RUNTIME_EXITED');try{token=(await readFile(join(directory,'service-key'),'utf8')).trim();if(stdout.includes('apps-runtime-start'))break;}catch{}await sleep(100);}
  if(!token||!stdout.includes('apps-runtime-start'))throw new Error('GENERATED_RUNTIME_NOT_READY');
  const get = async path => {const response=await fetch(`http://127.0.0.1:${port}${path}`,{headers:{authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(5000)});const value=await response.json();requests.push({method:'GET',path,httpStatus:response.status});if(!response.ok)throw new Error(`HTTP_${response.status}`);return value;};
  const health=await get('/health'),identity=await get('/v1/runtime'),apps=await get('/v1/apps'),tools=await get('/tools'),connections=await get('/v1/connections');
  if(health.status!=='ok'||identity.transportMajor!==1||identity.catalogSchemaVersion!==1||tools.tools.length!==26||!apps.apps.some(app=>app.appId==='hallmark')||!apps.apps.some(app=>app.appId==='notes'))throw new Error('GENERATED_RUNTIME_IDENTITY_FAILED');
  await writeFile(`${output}/generated-runtime-smoke.json`,JSON.stringify({status:'PASS',evidenceLevel:'live_isolated_candidate',command:'node scripts/smoke-apps-bundle.mjs',nodeVersion:process.version,entry,sha256:hash,archive,archiveSha256:archiveHash,extractedFromCandidateArchive:true,isolated:true,originalServicesModified:false,installedIntoDSH:false,frameworkRuntimeProcessCount:1,mutations:0,requests,identity,apps:apps.apps.map(app=>({appId:app.appId,providerVersion:app.providerVersion,providerState:app.providerState})),connectionCount:connections.connections.length,legacyToolCount:tools.tools.length,hallmarkStatus:health.hallmark?.status,limitation:'Runtime process startup/HTTP read only; no live DSH native registration, Client interaction or real Hallmark business acceptance.'},null,2)+'\n');
} catch(error) {failure=error;await writeFile(`${output}/generated-runtime-smoke.json`,JSON.stringify({status:'FAIL',command:'node scripts/smoke-apps-bundle.mjs',error:error.message,stdout,stderr,requests,isolated:true,installedIntoDSH:false},null,2)+'\n');}
finally {
  if(!closed){processHandle.kill('SIGTERM');await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),sleep(3000)]);}
  if(!closed)throw new Error('ISOLATED_CANDIDATE_PROCESS_DID_NOT_EXIT');
  const absolute=resolve(directory),temporaryRoot=resolve(tmpdir());if(!absolute.startsWith(temporaryRoot+'\\')&&!absolute.startsWith(temporaryRoot+'/'))throw new Error('INVALID_TEMP_DIRECTORY');if(!/^apps-bundle-smoke-[^\\/]+$/.test(absolute.split(/[\\/]/).at(-1)))throw new Error('INVALID_SMOKE_DIRECTORY');
  await rm(absolute,{recursive:true,force:true});
}
if(failure)throw failure;
console.log(JSON.stringify({status:'PASS',entry,sha256:hash,isolated:true,installedIntoDSH:false,requests:requests.length,mutations:0}));
