import {readFile,writeFile,mkdir,access,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const root=resolve('evidence/apps-v1-20261007'),parent=resolve('..'),now=new Date().toISOString();
const versions=JSON.parse(await readFile('bundles/apps/versions.json','utf8'));
const candidateVersion=versions.bundleVersion;
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const writeIfChanged=async(path,content)=>{if(await exists(path)&&await readFile(path,'utf8')===content)return;await writeFile(path,content);};
const archivedTestLog=join(root,'verification/full-test-output.txt');
const testLogPath=await exists('apps-test-output.txt')?'apps-test-output.txt':archivedTestLog;
const verificationPath=join(root,'verification/result.json');
const reuseVerification=testLogPath===archivedTestLog;
const priorVerification=reuseVerification?JSON.parse(await readFile(verificationPath,'utf8')):null;
const testExecutedAt=priorVerification?.executedAt??(await stat(testLogPath)).mtime.toISOString();
const desktopEvidence='../apps-live-bill-20261007/desktop-verification/result.json';
const desktop=await exists(join(root,desktopEvidence))?JSON.parse(await readFile(join(root,desktopEvidence),'utf8')):null;
const desktopRestorationPath='../apps-live-bill-20261007/desktop-verification/lifecycle-restored.json';
const desktopRestoration=await exists(join(root,desktopRestorationPath))?JSON.parse(await readFile(join(root,desktopRestorationPath),'utf8')):null;
const desktopSummary=desktop?`用户已授权在原项目覆盖更新并替换桌面原插件；候选安装 ${desktop.candidateDesktop.installation}，候选显示 ${desktop.candidateDesktop.display}，当前候选已安装 ${desktop.candidateDesktop.currentCandidateInstalled}。先前临时测试的恢复记录保留为历史证据；当前状态以桌面验收记录为准。Bill读取既有商品快照，源时间为2026-10-06T16:01:20.856Z；刷新成功时间不表示平台实时同步。模型消费/前缀重放证据属于历史candidate.5，candidate.6未重跑模型路径。`:'用户桌面候选验收尚未执行。';
const review=JSON.parse(await readFile(join(root,'requirements-review.json'),'utf8'));
if(review.requirements.some(row=>!['PASS','FAIL','BLOCKED','NOT_RUN'].includes(row.status)))throw new Error('INVALID_ACCEPTANCE_STATUS');
const taskReview=JSON.parse(await readFile(join(root,'audit/task-scope-review.json'),'utf8'));
if(taskReview.finalProductionFreezeConfirmed!==true||taskReview.tasks.length!==26||taskReview.tasks.some(task=>!['VERIFIED','BLOCKED'].includes(task.finalStatus)||task.finalStatus==='VERIFIED'&&task.taskScopeVerificationStatus!=='PASS'))throw new Error('TASK_SCOPE_REVIEW_INCOMPLETE');
const todoPath=join(parent,'01_TODO.md'),csvPath=join(parent,'traceability.csv');
await mkdir(join(root,'source-documents'),{recursive:true});
for(const [path,name] of [[todoPath,'01_TODO.A0.md'],[csvPath,'traceability.A0.csv']])if(!await exists(join(root,'source-documents',name)))await copyFile(path,join(root,'source-documents',name));
const original=await readFile(join(root,'source-documents','01_TODO.A0.md'),'utf8');
const cards=original.split(/(?=### TODO-\d{3} ·)/).slice(1);
const titles=[...original.matchAll(/- \[ \] \*\*(TODO-\d{3}) \/ (P\d) — (.+?)\*\*/g)];
const taskNotes={
  1:'基线、依赖锁、26工具与本地只读状态冻结；核心hash保持不变。',2:'独立DSH会话已取得真实Inspect签名、四工具执行与注销证据；未支持的会话方法明确降级。',3:'ADR-001..008、单进程与唯一状态所有权已固定；G0范围及真实Host证据由独立审计判定。',
  4:'完整类型、Schema编译/输入输出校验、规范JSON与数据集身份已实施。',5:'Hallmark纯领域Provider、真实HTTP适配与统一operationId；旧工具隔离回放通过，真实业务写入未执行。',6:'共享展示、ResourceRef与v1转换；源码资产保持不可变版本。',7:'显式模块目录、exact版本、统一invoke/inspect与远程Host投影已实施。',8:'原441项回归保留；全仓570项、类型/构建与原生桌面Host技术验收通过；真实业务写入未执行。',
  9:'复合连接、会话应用集合与焦点分离；歧义零分发。',10:'单Apps入口、1+N逻辑投影、单bundle；生命周期fixture通过。',11:'Notes独立命名空间、list/get/create/update、CAS与ResourceRef已实施。',12:'真实Bill读取与Notes异构流程、双会话/多绑定及实际双应用源码交互截图通过；图片明确为sourcefixture。',
  13:'46项共享descriptor生成SDK、文档和参数投影；三SDK跨项目JS/types/starter验证通过。',14:'固定4网关及catalogDigest/按需describe；candidate.5实际本地模型载荷的Apps4 Schema/name/hash/bytes与三应用摘要已核，旧Hallmark Schema为0；candidate.6桌面四网关另有实测。',15:'15项只读API及1项既有调价适配API登记；完整Schema与同一写入/核实链，unknown先拒绝再显式登记并经SDK验证。',16:'意图hash/派发屏障/单ledger/取消/unknown只读恢复/绝对deadline及持久inspect记录通过。',17:'run/step记录、跨应用partial、完成步骤复用和unknown核实后持久化通过。',18:'20应用1000能力、10000行、三入口各30次与UTF8预算/完整句柄通过；字节量明确不冒充token或真实模型耗时。',
  19:'v2身份、nonce/reload、字节限制与旧协议转换；跨会话和旧帧拒绝。',20:'candidate.5实际上下文更新零wake、固定Native请求落盘/消费、同RPC去重、跨会话隔离与重启后历史前缀重建通过；candidate.6未重跑模型消费。',21:'每绑定独立刷新/stale、CAS保存、不可变history、显式版本恢复通过。',22:'双应用React源码101本地动作无新增RPC及fixture附件/save/restore通过；candidate.5原生消费/重放与candidate.6原桌面显示、本地动作和只读刷新分别留证。',
  23:'离线schema2→独立schema3、一致DB+源码/dist/预览/spill/outbox备份、hash/隔离/reentry通过。',24:'复制环境停写/迁移/切换与两类回退按独立审计记录；successful+unknown增量保留，生产目录尚未切换。',25:'引用/保留驱动GC dry-run、旧计划拒绝、会话诊断IDs复制和故障关联通过；磁盘spill保守保留。',26:'单candidate.6 tgz、版本矩阵、打包Runtime/SDK smoke与48需求证据通过；原桌面替换、查询/显示、重启后卸载清理及最终保留新版均已验。'
};
const tasks=titles.map((match,index)=>{
  const card=cards[index]??'',taskId=match[1],number=Number(taskId.slice(5));
  const requirementIds=[...(card.match(/\*\*需求：\*\* ([^\n]+)/)?.[1]??'').matchAll(/REQ-\d{3}/g)].map(item=>item[0]);
  const requirements=review.requirements.filter(row=>requirementIds.includes(row.requirementId));
  const scope=taskReview.tasks.find(task=>task.taskId===taskId);if(!scope)throw new Error(`TASK_SCOPE_REVIEW_MISSING: ${taskId}`);
  return {taskId,phase:match[2],title:match[3],implementationStatus:'IMPLEMENTED',finalStatus:scope.finalStatus,taskScopeVerificationStatus:scope.taskScopeVerificationStatus,fixtureStatus:requirements.every(row=>row.fixtureStatus==='PASS')?'PASS':'PARTIAL',requirements:requirementIds,evidencePaths:requirements.map(row=>row.resultPath),remainingRealStatus:scope.remainingRealStatus??'NOT_RUN',notes:taskNotes[number],remainingScope:scope.remainingScope,verifier:scope.verifier??taskReview.verifier,taskReviewPath:'audit/task-scope-review.json',updatedAt:now};
});
if(tasks.length!==26||review.requirements.length!==48)throw new Error('TRACEABILITY_CARDINALITY_MISMATCH');
const verified=tasks.filter(task=>task.finalStatus==='VERIFIED').length,blocked=tasks.filter(task=>task.finalStatus==='BLOCKED').length;
for(const task of tasks){const directory=join(root,task.phase,task.taskId);await mkdir(directory,{recursive:true});await writeFile(join(directory,'execution.json'),JSON.stringify(task,null,2)+'\n');}
await writeFile(join(root,'tasks-status.json'),JSON.stringify({releaseId:'apps-v1-20261007',updatedAt:now,tasks},null,2)+'\n');
for(const [gate,phase,taskId] of [['G1','P1','TODO-008'],['G2','P2','TODO-012'],['G3','P3','TODO-018'],['G4','P4','TODO-022'],['G5','P5','TODO-026']]){
  const gateTask=tasks.find(task=>task.taskId===taskId);
  await writeFile(join(root,phase,taskId,`${gate}.json`),JSON.stringify({gate,releaseId:'apps-v1-20261007',reviewedAt:now,developmentEvidenceStatus:'PASS',completeAcceptanceStatus:gateTask.finalStatus==='VERIFIED'?'PASS':'BLOCKED',verifier:'Codex root evidence reconciliation',remaining:gateTask.remainingScope,scope:'task-card technical acceptance; isolated fixtures, historical candidate5 native model proofs, and current candidate6 official original desktop query/display/lifecycle',fieldApproval:false,evidence:['verification/result.json','requirements-review.json',`${phase}/${taskId}/execution.json`,gateTask.taskReviewPath]},null,2)+'\n');
}
let todo=original.replace('修订：A.0 / 1.0.0-draft',`修订：A.1 / ${candidateVersion}`);
todo=todo.replace('**状态：设计与实施评审稿。** 本文规定建议的目标系统，不表示这些能力已经在仓库实现、安装或验收。所有任务初始状态为 TODO，测试初始状态为 NOT_RUN。',`**状态：候选实施与验证记录。** 26项开发交付物已实施并有隔离证据；${verified}项本卡技术断言已独立验证，${blocked}项因现场或阶段前提保持BLOCKED。复选框按本卡完成判定，后续关联需求与正式安装/切换仍单独记录。`);
todo=todo.replace('所有任务当前均未实施；本交付只完成规划文件。','本轮开发交付物已实施；本卡技术验证完成的任务标 VERIFIED，缺外部或完整阶段门禁的任务保持 BLOCKED。');
todo=todo.replace('初始状态：以下复选框全部为空。',`当前状态：实施 IMPLEMENTED；${verified}项本卡已 VERIFIED、${blocked}项 BLOCKED。具体证据和后续范围见下面执行记录。`);
todo=todo.replace(/- \[ \] \*\*(TODO-\d{3}) \/ /g,(_all,id)=>`- [${tasks.find(task=>task.taskId===id).finalStatus==='VERIFIED'?'x':' '}] **${id} / `);
todo=todo.replace(/(### (TODO-\d{3}) ·[\s\S]*?\*\*阶段\/状态：\*\* P\d \/ )TODO/g,(_all,prefix,id)=>prefix+tasks.find(task=>task.taskId===id).finalStatus);
let record=0;todo=todo.replace(/\*\*执行记录：\*\* 开始 ______；提交 ______；验证 ______；差异\/阻塞 ______；最终状态 ______。/g,()=>{const task=tasks[record++];return `**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 ${task.taskScopeVerificationStatus}，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 ${task.fixtureStatus}；差异/阻塞 ${task.notes}；最终状态 ${task.finalStatus}（实现 IMPLEMENTED）。后续范围：${task.remainingScope.join('；')||'无本卡未验断言'}。证据：\`dsh-hallmark-app/evidence/apps-v1-20261007/${task.phase}/${task.taskId}/execution.json\`。`;});
const table=['## 00A 本轮实施状态（2026-10-07）','','工作目录：`E:/project/deepseek_h/dsh-hallmark-app`；基线提交保持 cb871b4，候选diff尚未提交到Git；候选包已在独立DSH实例测试。'+desktopSummary+' SPEC/ARCH需求内容保持不变，本文件只更新执行记录。','', '| 任务 | 开发实现 | 本卡验收 | 本轮证据/剩余范围 |','|---|---|---|---|',...tasks.map(task=>`| ${task.taskId} | IMPLEMENTED | ${task.finalStatus} | ${task.notes} |`),'','[完整证据索引](dsh-hallmark-app/evidence/apps-v1-20261007/README.md) · [桌面验收记录](dsh-hallmark-app/evidence/apps-live-bill-20261007/desktop-verification/result.json) · [候选包说明](dsh-hallmark-app/docs/apps-v1-candidate.md) · [迁移运行手册](dsh-hallmark-app/docs/apps-migration-runbook.md)','',`${blocked?'各门禁状态由逐卡独立审计与真实证据判定；未完成断言保持BLOCKED。':'本轮任务卡与需求技术验收均已通过；桌面安装保留新版，原业务数据库切换与外部发布未执行。'} 不冒填人工现场签字或Git提交。`,''].join('\n');
todo=todo.replace('## 00 执行规则',table+'\n## 00 执行规则');
todo=todo.replace('本文件未包含任何实施完成签字，也未自动写入 GitHub Issue、PR 或仓库文件。任务状态应在真实实施过程中更新。','本文件已回填本轮开发、独立DSH测试与桌面验收记录；未自动发布GitHub Issue/PR，正式业务部署另行记录。完整验收的剩余断言单独保留。');
await writeFile(todoPath,todo);
const oldCSV=(await readFile(join(root,'source-documents','traceability.A0.csv'),'utf8')).trim().split(/\r?\n/).filter(Boolean),csvHeader=oldCSV.shift();
const csv=[csvHeader+',fixtureStatus,remainingRealStatus,evidencePath',...oldCSV.map(line=>{const columns=line.split(','),row=review.requirements.find(item=>item.requirementId===columns[0]);columns[5]=row.status==='PASS'?'VERIFIED':'REVIEW';columns[6]=row.status;return [...columns,row.fixtureStatus,row.remainingRealStatus,`dsh-hallmark-app/${row.resultPath}`].join(',');})];
await writeIfChanged(csvPath,csv.join('\r\n')+'\r\n');await writeIfChanged(join(root,'traceability.csv'),csv.join('\r\n')+'\r\n');
const log=await readFile(testLogPath,'utf8'),tests=Number(log.match(/tests (\d+)/)?.[1]),passed=Number(log.match(/pass (\d+)/)?.[1]),failed=Number(log.match(/fail (\d+)/)?.[1]);
if(tests!==passed||failed||!tests)throw new Error('FINAL_TESTS_NOT_PASS');
if(priorVerification&&(priorVerification.status!=='PASS'||priorVerification.tests!==tests||priorVerification.passed!==passed||priorVerification.failed!==failed||!testExecutedAt))throw new Error('ARCHIVED_TEST_PROVENANCE_MISMATCH');
const typecheck=JSON.parse(await readFile(join(root,'verification/typecheck.json'),'utf8'));
if(typecheck.status!=='PASS'||typecheck.exitCode!==0)throw new Error('FINAL_TYPECHECK_NOT_PASS');
await mkdir(join(root,'verification'),{recursive:true});if(!reuseVerification)await copyFile(testLogPath,archivedTestLog);
const baselineLog='baseline-test-output.txt';if(await exists(baselineLog))await copyFile(baselineLog,join(root,'verification','baseline-test-output.txt'));
if(!reuseVerification)await writeFile(verificationPath,JSON.stringify({baselineCommit:'cb871b4086508988485dc4a0a5d6aa5440901267',candidateVersion,executedAt:testExecutedAt,environment:{node:process.version,platform:process.platform},testCommand:'node --test test/**/*.test.ts',tests,passed,failed,status:'PASS',testEvidenceLevel:'automated_and_isolated_http_provider_client_fixtures',typecheck:{command:'node node_modules/typescript/bin/tsc --noEmit',status:'PASS'},excludedClaims:['Installed DSH GUI','External real-model tokens/performance','External Hallmark business mutation','Personal data cutover/rollback'],sourceDocumentSha256:createHash('sha256').update(original).digest('hex')},null,2)+'\n');
const packaged=JSON.parse(await readFile(join(root,'P5/TODO-026/package-manifest.json'),'utf8'));
const archiveHash=createHash('sha256').update(await readFile(resolve(packaged.archive))).digest('hex');if(archiveHash!==packaged.sha256)throw new Error('FINAL_ARCHIVE_HASH_MISMATCH');
const liveIndex='../apps-live-bill-20261007/host-session/host-live-index.json';
const temporaryDesktopValidation=desktop?{
  evidencePath:desktopEvidence,restorationEvidencePath:desktopRestorationPath,
  installation:desktop.candidateDesktop.installation,display:desktop.candidateDesktop.display,
  candidateVersion:desktop.candidateDesktop.version,
  candidateCurrentlyInstalled:desktop.candidateDesktop.currentCandidateInstalled,
  desktopRestartPerformedByValidation:desktop.candidateDesktop.desktopRestarted,
  historicalFirstCycleLegacyRestore:desktopRestoration?.status??'NOT_RUN',
  registrationCleanup:desktop.candidateDesktop.liveRegistrationCleanup??'NOT_RUN',
  finalCandidateRetentionRequested:desktop.cycle2?.finalCandidateRetentionRequested===true,
  manualHandoff:desktop.manualHandoff??null
}:null;
const release={releaseId:'apps-v1-20261007',candidateVersion,baselineCommit:'cb871b4086508988485dc4a0a5d6aa5440901267',preparedAt:now,sourceState:'uncommitted reviewable workspace diff',implementationStatus:'IMPLEMENTED',fullAcceptance:blocked||review.requirements.some(row=>row.status!=='PASS')?'BLOCKED':'PASS',formalDeploymentPerformed:false,desktopPluginReplacementPerformed:desktop?.candidateDesktop.currentCandidateInstalled===true,desktopValidation:temporaryDesktopValidation,originalHallmarkServicesRestarted:false,externalHallmarkBusinessWrites:0,personalDatabaseMigrated:false,isolatedDSHTestEvidence:await exists(join(root,liveIndex))?liveIndex:null,package:{path:packaged.archive,sha256:archiveHash},validation:{tests,passed,failed,typecheck:'PASS',tasksVerified:verified,tasksBlocked:blocked,requirements:48,fixturePassed:review.summaries.fixturePassed,fixturePartial:review.summaries.fixturePartial},taskStates:tasks.map(task=>({taskId:task.taskId,status:task.finalStatus,implementationStatus:task.implementationStatus})),remainingScope:tasks.filter(task=>task.finalStatus==='BLOCKED').map(task=>({taskId:task.taskId,assertions:task.remainingScope})),evidence:{tasks:'tasks-status.json',requirements:'requirements-review.json',tests:'verification/result.json',benchmark:'P3/TODO-018/benchmark/report.json',browser:'P4/TODO-022/browser/result.json',isolatedHost:liveIndex,desktop:desktop?desktopEvidence:null,runtimeSmoke:'P5/TODO-026/generated-runtime-smoke.json',sdkSmoke:'P5/TODO-026/sdk-package-fixture.json'}};
await writeFile(join(root,'release-manifest.json'),JSON.stringify(release,null,2)+'\n');
const index=`# Apps V1 候选证据索引\n\n本轮26项开发交付物已实施；${verified}项本卡技术验证为VERIFIED，${blocked}项为BLOCKED。候选包已在新建独立DSH会话中测试。${desktopSummary} Hallmark后台服务保持运行，未执行真实Hallmark调价/库存写入或生产数据切换。\n\n- [26项任务执行记录](tasks-status.json)、[逐卡独立技术核对](audit/task-scope-review.json)、[48项独立需求核对](requirements-review.json)、[追踪CSV](traceability.csv)。\n- [最终全仓验证](verification/result.json)：${passed}/${tests}通过，类型检查通过；原441项已验回归继续通过。测试时间和环境保留原始执行记录。\n- [实际独立DSH与bill验证](${liveIndex})：以各项原始记录的版本、时间与支持范围为准。\n- [官方桌面候选验收](${desktopEvidence})与[原插件恢复](${desktopRestorationPath})：当前替换安装、查询/显示、所需重启和注销清理分别记录；原插件恢复链接属于第一轮历史记录。\n- [P0基线](P0/TODO-001/baseline.json)、[Host能力矩阵](P0/TODO-002/host-capabilities.json)、[开发门禁](P0/TODO-003/G0.json)。\n- [20应用/1000能力/10000行基准](P3/TODO-018/benchmark/report.json)：直接工具、SDK脚本、混合方式各30次；UTF8字节量与夹具耗时明确不冒充token或真实模型耗时。\n- [浏览器源码交互](P4/TODO-022/browser/result.json)与[截图](P4/TODO-022/browser/verified.png)：100本地动作零RPC；明确读取/附件/保存/恢复。这是源码夹具。独立Web Host的Chrome阻断属于历史记录，官方桌面验收单独记录。\n- [P5迁移/回退/GC](P5/README.md)、[实际打包Runtime启动](P5/TODO-026/generated-runtime-smoke.json)、[SDK跨项目验证](P5/TODO-026/sdk-package-fixture.json)。\n- [发布清单](release-manifest.json)、[包hash及文件表](P5/TODO-026/package-manifest.json)。\n\n代码、自动化夹具、浏览器交互和实际Host状态分别记录。未完成断言使用BLOCKED/NOT_RUN，fixtureStatus说明已验证子范围；不冒填人工现场签字、正式发布或operationId。\n\n回退与限制见[候选说明](../../docs/apps-v1-candidate.md)、[离线迁移手册](../../docs/apps-migration-runbook.md)。Bill真实写入还需指定商品和价格/库存等参数；生产切换还需明确可停写目标目录。已保存的操作证据不得丢弃，恢复入口不能撤销真实业务。\n`;
await writeFile(join(root,'README.md'),index);
console.log(JSON.stringify({tasks:tasks.length,verified,blocked,requirements:review.requirements.length,tests,passed,fullAcceptance:release.fullAcceptance,candidateImplementation:'IMPLEMENTED'}));
