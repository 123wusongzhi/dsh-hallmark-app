/**
 * Usage: node scripts/verify-cross-source-reuse-live.mjs <options.json>
 * options: runtimeUrl, keyFile, pluginDirectory, runtimeDirectory, evidenceDirectory,
 *          connectionId, storeIds:[Bill,Helen], optional npmCli.
 * Runs only against the independent 36995 Runtime. Creates uniquely named local
 * acceptance sources/views/assets; never saves or changes the user's workbench.
 * Uses the installed starter, SDK and build/preview CLI. Does not publish or mount.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {createOzonCompositionDraft} from '../packages/app-hallmark/src/ozon-composition.ts';
import {createMaterialView} from '../packages/app-presentation/src/materials/catalog.ts';

const options=JSON.parse(readFileSync(process.argv[2],'utf8')),url=new URL(options.runtimeUrl);
assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'36995','Only the dedicated acceptance Runtime is allowed');
assert.ok(Array.isArray(options.storeIds)&&options.storeIds.length===2&&options.storeIds[0]!==options.storeIds[1]);
const prior=options.resumeEvidence?resolve(options.resumeEvidence):null;
const priorArtifact=suffix=>{const name=readdirSync(prior).find(name=>name.endsWith(suffix));assert.ok(name,`Missing prior ${suffix}`);return JSON.parse(readFileSync(join(prior,name),'utf8'));};
const priorBegin=prior?priorArtifact('-begin.json').result.data:null;
const token=readFileSync(options.keyFile,'utf8').trim(),runId=randomUUID(),sessionId=priorBegin?.view.ownerSessionId??`cross-source-reuse:${runId}`,evidence=resolve(options.evidenceDirectory,runId);
mkdirSync(evidence,{recursive:true});
const summary={runId,sessionId,startedAt:new Date().toISOString(),runtimeUrl:url.origin,checks:[],artifacts:[],published:false,mounted:false};
const write=(name,value)=>{const path=join(evidence,name);writeFileSync(path,JSON.stringify(value,null,2)+'\n');summary.artifacts.push(path);return path;};
const check=(name,condition)=>{assert.ok(condition,name);summary.checks.push({name,passed:true});};
const api=async(path,body)=>{
  const response=await fetch(new URL(path,url),{method:body===undefined?'GET':'POST',redirect:'error',headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(180000)});
  const result=await response.json();if(!response.ok)throw Error(`${path}: ${response.status}: ${JSON.stringify(result)}`);return result;
};
const invoke=async(capabilityId,input,appId='apps',connectionId='presentation')=>{
  const descriptor=await api(`/v1/capabilities/${encodeURIComponent(capabilityId)}`),id=randomUUID();
  const result=await api('/v1/invocations',{protocolVersion:'1.0',appId,connectionId,capabilityId,capabilityVersion:descriptor.version,input,invocationId:id,traceId:id,source:{kind:'agent',sessionId,nativeCallId:id},deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString(),...(descriptor.effect==='mutation'?{idempotencyKey:id}:{})});
  write(`${summary.artifacts.length}-${capabilityId.split('.').at(-1)}.json`,{input,result});assert.equal(result.status,'ok',JSON.stringify(result));return result.data;
};
const action=(name,input)=>invoke(`apps.presentation.${name}`,input);
const run=async(entry,args,cwd,label)=>{
  const child=spawn(process.execPath,[entry,...args],{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);
  const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  write(`${label}-process.json`,{entry,args,cwd,pid:child.pid,exitCode,stdout,stderr});assert.equal(exitCode,0,`${label}: ${stderr.slice(-1500)} ${stdout.slice(-1500)}`);return stdout.trim();
};
try{
  const before=await api('/v1/workbench?resource=workbench&appId=hallmark');write('board-before.json',before);
  for(const [appId,connectionId] of [['apps','presentation'],['hallmark',options.connectionId]])await api('/v1/session-bindings',{sessionId,appId,connectionId,enabled:true,boundAt:new Date().toISOString()});
  let saved,a,component,template,begun;
  if(prior){saved=priorArtifact('-register_data_source.json').result.data;a=priorArtifact('-resolve_data_source.json').result.data;component=priorArtifact('-save_component.json').result.data;template=priorArtifact('-save_template.json').result.data;begun=priorBegin;summary.resumedFrom=prior;summary.checks.push(...JSON.parse(readFileSync(join(prior,'summary.json'),'utf8')).checks);}
  else{
  const recipe={version:1,grain:'product',fields:['products.title','prices.price']},definition=createOzonCompositionDraft(options.connectionId,recipe,`acceptance:cross-source:${runId}`);
  definition.title=`验收 · 跨接口源码 ${runId.slice(0,8)}`;
  const contextA={storeId:options.storeIds[0]},contextB={storeId:options.storeIds[1]},params={limit:1};
  saved=await action('register_data_source',{definition,context:contextA,params});check('Agent真实验证后保存可复用定义',saved.validation.status==='verified'&&!Object.hasOwn(saved.input,'storeId'));
  a=await action('resolve_data_source',{id:saved.id,revision:saved.revision,bindingId:'main',context:contextA,params});
  const b=await action('resolve_data_source',{id:saved.id,revision:saved.revision,bindingId:'main',context:contextB,params});
  check('共享定义在两店解析为不同数据身份',a.sourceRef.id===b.sourceRef.id&&a.binding.datasetId!==b.binding.datasetId);
  const direct=await invoke(a.binding.capabilityId,a.binding.input,a.binding.appId,a.binding.connectionId);check('源码演示使用真实商品价格与可翻页数据',direct.items.length===1&&typeof direct.cursor==='string'&&typeof direct.items[0]?.products?.title==='string');
  const design=createMaterialView('data-table');design.widgets[0].columns=[{field:'products.title',label:'商品名称'},{field:'prices.price',label:'当前卖家价'}];design.widgets[0].fields=a.fieldMap;design.widgets[0].options={...design.widgets[0].options,fieldMeta:a.fieldMeta,rowsPath:a.rowsPath};design.bindings[0].fieldMap=a.fieldMap;
  const native=await action('render_view',{title:definition.title,sourceRefs:{main:a.sourceRef},context:contextA,design});
  component=await action('save_component',{viewId:native.viewId,mode:'save_as',userRequest:'在独立验收环境验证组合组件复用'});
  template=await action('save_template',{viewId:native.viewId,name:definition.title+' 模板',userRequest:'在独立验收环境验证跨店模板复用'});
  for(const [name,opened] of [['component',await action('open_component',{componentId:component.componentId,context:contextB})],['template',await action('render_view',{title:definition.title,templateId:template.assetId,context:contextB})]]){
    check(`${name}锁定源版本并切换目标店铺`,opened.sourceRefs.main.revision===saved.revision&&opened.bindings[0].input.storeId===contextB.storeId&&opened.bindings[0].datasetId===b.binding.datasetId);
    const read=await api('/v1/authoring/preview',{sessionId,params:{viewId:opened.viewId,scopeId:runId,action:'refresh'}});write(`${name}-Helen-data.json`,read);
    check(`${name}在目标店铺真实读取`,read.bindings[0].state==='ready'&&read.bindings[0].payload.items.length>0&&read.bindings[0].query.input.storeId===contextB.storeId);
  }
  begun=await invoke('apps.authoring.begin',{mode:'new',title:definition.title+' 源码',sourceRefs:{main:a.sourceRef},context:contextA});
  }
  const data=await api('/v1/authoring/preview',{sessionId,params:{viewId:begun.view.viewId,scopeId:runId,action:'refresh'}});write('source-Bill-data.json',data);
  check('源码绑定与Agent使用完全相同的封装查询',JSON.stringify(begun.view.bindings[0].input)===JSON.stringify(a.binding.input)&&data.bindings[0].state==='ready');
  const cursor=data.bindings[0].payload.cursor;assert.equal(typeof cursor,'string');
  const expected=await invoke(a.binding.capabilityId,{...a.binding.input,cursor},a.binding.appId,a.binding.connectionId),sourcePage=await api('/v1/authoring/preview',{sessionId,params:{viewId:begun.view.viewId,scopeId:runId,action:'page',bindingId:'main',cursor}});write('source-shared-cursor-page.json',sourcePage);
  assert.deepEqual(sourcePage.bindings[0].payload.items,expected.items);check('Agent与源码从同一真实组合快照读取一致结果',true);
  await api('/v1/authoring/preview',{sessionId,params:{viewId:begun.view.viewId,scopeId:runId,action:'close'}});
  const plugin=resolve(options.pluginDirectory),workspace=begun.draft.workspacePath,sdk=join(plugin,'sdk','component-runtime'),entry=join(plugin,'lib','apps-authoring-check.js');
  const npm=options.npmCli??join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');assert.ok(existsSync(npm),'npm CLI path must exist');
  if(!existsSync(join(workspace,'package.json')))await run(join(plugin,'source-starter','create-apps-source.mjs'),['--directory',workspace,'--sdk',sdk,'--template','composed-table'],process.cwd(),'starter');
  if(!existsSync(join(workspace,'package-lock.json')))await run(npm,['install','--ignore-scripts','--no-audit','--no-fund'],workspace,'npm-install');
  const runtime={url:url.origin,keyFile:resolve(options.keyFile)},build={sessionId,attemptId:begun.attempt.attemptId,sdkDirectory:sdk,command:[process.execPath,'build.mjs'],archiveRoot:join(resolve(options.runtimeDirectory),'source-components'),evidenceRoot:join(resolve(options.runtimeDirectory),'authoring-evidence'),runtime};
  const preparePath=write('prepare-request.json',{prepare:true,build,preview:{planPath:join(workspace,'.preview','plan.json')}});
  const prepared=JSON.parse((await run(entry,[preparePath],process.cwd(),'prepare')).split(/\r?\n/).at(-1));
  const checked=JSON.parse((await run(entry,[prepared.requestPath],process.cwd(),'check')).split(/\r?\n/).at(-1));summary.check=checked;
  check('已安装SDK源码构建与真实读取翻页刷新预览通过',checked.verdict==='PASS'&&!!checked.buildReceiptId&&!!checked.previewReceiptId);
  const after=await api('/v1/workbench?resource=workbench&appId=hallmark');write('board-after.json',after);check('用户工作台保持原样',JSON.stringify(before)===JSON.stringify(after));
  Object.assign(summary,{verdict:'PASS',finishedAt:new Date().toISOString(),sourceId:saved.id,sourceRevision:saved.revision,componentId:component.componentId,templateId:template.assetId,viewId:begun.view.viewId,attemptId:begun.attempt.attemptId,workspacePath:workspace});
}catch(error){Object.assign(summary,{verdict:'FAIL',finishedAt:new Date().toISOString(),error:{message:error.message,stack:error.stack}});process.exitCode=1;}
const summaryPath=join(evidence,'summary.json');writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({verdict:summary.verdict,summaryPath,checks:summary.checks.length,...(summary.error?{error:summary.error.message}:{})}));
