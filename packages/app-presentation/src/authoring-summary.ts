import type {AuthoringAttempt,AuthoringOutcome,BuildReceipt,PreviewReceipt,ViewPublication,ComponentDisplay} from './authoring-types.ts';
import {DISPLAY_READY_DEADLINE_MS} from './authoring-types.ts';
import {evaluatePerformance} from '../../source-components/src/authoring-performance.ts';

/** Display failures raised by the connection/handshake itself, not by the component source or its bindings. */
export const TRANSPORT_ONLY_DISPLAY_CODES=['BRIDGE_IDENTITY_STALE','BRIDGE_TIMEOUT','BRIDGE_UNAVAILABLE','DISPLAY_HANDLER_UNAVAILABLE','FRAME_LOAD_FAILED','FRAME_LOAD_TIMEOUT','RUNTIME_UNAVAILABLE','RUNTIME_REQUEST_TIMEOUT','RUNTIME_CONNECTION_LOST','RUNTIME_INVALID_RESPONSE','BRIDGE_PROXY_UNAVAILABLE','DISPLAY_READY_TIMEOUT','DISPLAY_BRIDGE_TIMEOUT'];
/** Outcomes where waiting for the host can still change the result. */
export const AWAITABLE_OUTCOMES:readonly AuthoringOutcome[]=['awaiting_user_view','displaying','published_awaiting_display'];
const seconds=(ms:number)=>Math.max(0,Math.round(ms/1000));

/** Advice derived only from the inspected attempt and its existing evidence. `now` is injectable so display deadlines are testable. */
export function authoringSummary(input:{attempt:AuthoringAttempt;publication:ViewPublication|null;build?:BuildReceipt;preview?:PreviewReceipt;displays:ComponentDisplay[];currentDisplay:ComponentDisplay|null;now?:Date}) {
 const {attempt,publication,build,preview,currentDisplay}=input,nowMs=(input.now??new Date()).getTime();
 const confirmedAt=(item:ComponentDisplay)=>item.readyReceipt?.readyAt??item.readyAt;
 const confirmed=input.displays.filter(item=>confirmedAt(item)).sort((a,b)=>confirmedAt(a)!.localeCompare(confirmedAt(b)!)).at(-1);
 const currentBuildId=publication?.candidateBuildId??build?.archiveBuildId??null;
 const identity=(item:ComponentDisplay)=>({buildId:item.buildId,publicationId:item.publicationId,displayId:item.displayId,displayGeneration:item.generation,state:item.state,readyAt:item.readyAt??null,frameInstanceId:item.frameInstanceId??null,documentNonce:item.documentNonce??null});
 const matchesPublication=!!currentDisplay&&!!publication&&currentDisplay.publicationId===publication.publicationId&&currentDisplay.buildId===publication.candidateBuildId&&currentDisplay.viewId===publication.viewId&&currentDisplay.ownerSessionId===publication.ownerSessionId&&currentDisplay.attemptId===publication.attemptId&&currentDisplay.attemptId===attempt.attemptId&&currentDisplay.attemptEpoch===publication.attemptEpoch&&currentDisplay.attemptEpoch===attempt.epoch;
 const readyForCurrentDocument=!!currentDisplay?.readyAt&&!!currentDisplay.frameInstanceId&&!!currentDisplay.documentNonce&&(!currentDisplay.readyReceipt||currentDisplay.readyReceipt.frameInstanceId===currentDisplay.frameInstanceId&&currentDisplay.readyReceipt.documentNonce===currentDisplay.documentNonce&&currentDisplay.readyReceipt.readyAt===currentDisplay.readyAt);
 const target={attemptId:attempt.attemptId,epoch:attempt.epoch,buildId:currentBuildId,publicationId:publication?.publicationId??null,displayId:currentDisplay?.displayId??null};
 let blockedStage='unknown',action='inspect_evidence',reason='现有证据不足，先查看对应日志或做一次受控复现。',requiresRebuild:boolean|null=null;
 const errors=currentDisplay?.state==='failed'?currentDisplay.errors:[];
 const codes=errors.map(error=>error.code);
 const sourceError=codes.some(code=>['COMPONENT_SCRIPT_ERROR','COMPONENT_UNHANDLED_REJECTION'].includes(code));
 const bindingError=codes.some(code=>['CAPABILITY_UNAVAILABLE','INCOMPATIBLE_CAPABILITY','CONNECTION_NOT_BOUND','INVALID_BINDING'].includes(code));
 const pageError=codes.includes('SELECTION_STALE');
 const transportOnly=codes.length>0&&codes.every(code=>TRANSPORT_ONLY_DISPLAY_CODES.includes(code));
 // Existing publications retain their historical display path; only a new publication needs current evidence.
 const performance=!publication&&preview?evaluatePerformance(preview.performance):undefined;
 const performanceCode=!publication?attempt.terminalReason?.match(/^(PREVIEW_PERFORMANCE_(?:FAILED|INCOMPLETE|REQUIRED|POLICY_MISMATCH|INVALID)):/)?.[1]:undefined;
 const performanceFailed=performance?.verdict==='FAIL'||performanceCode==='PREVIEW_PERFORMANCE_FAILED';
 const performanceIncomplete=!publication&&(performance?.verdict==='INCOMPLETE'||preview?.performance?.verdict==='INCOMPLETE'||performanceCode!==undefined&&!performanceFailed);
 const evidencePassed=build?.verdict==='PASS'&&preview?.verdict==='PASS';
 // Display clock: wall time since the display opened against its server-side deadline. Computed at read time, never stored.
 const openedMs=currentDisplay?Date.parse(currentDisplay.openedAt??currentDisplay.createdAt):NaN;
 const displayDeadlineMs=currentDisplay?Date.parse(currentDisplay.readyDeadlineAt??'')||openedMs+DISPLAY_READY_DEADLINE_MS:NaN;
 const mountStartMs=publication?.state==='mounting'&&publication.mountStartedAt?Date.parse(publication.mountStartedAt):NaN;
 const mountDeadlineMs=publication?.state==='mounting'&&publication.readyDeadlineAt?Date.parse(publication.readyDeadlineAt):NaN;
 const startMs=currentDisplay?openedMs:mountStartMs,deadlineMs=currentDisplay?displayDeadlineMs:mountDeadlineMs;
 const waitedMs=Number.isFinite(startMs)?Math.max(0,nowMs-startMs):null;
 const stalled=(currentDisplay?currentDisplay.state==='opening':publication?.state==='mounting')&&Number.isFinite(deadlineMs)&&nowMs>=deadlineMs;
 const waitText=waitedMs===null?'':`已等待 ${seconds(waitedMs)} 秒`;
 const stateTerminal=(['cancelled','superseded','interrupted'] as const).find(state=>attempt.state===state||publication?.state===state);
 // The single completion fact. 'displayed' requires the current publication's current display to hold a ready receipt for its candidate build.
 let outcome:AuthoringOutcome;
 if(stateTerminal)outcome=stateTerminal;
 else if(publication){
  if(publication.state==='failed_mount')outcome='display_failed';
  else if(currentDisplay?.state==='ready')outcome=publication.state==='mounted'&&matchesPublication&&readyForCurrentDocument?'displayed':'published_awaiting_display';
  else if(currentDisplay?.state==='failed')outcome='display_failed';
  else if(currentDisplay?.state==='opening')outcome=stalled?'display_stalled':'displaying';
  else if(currentDisplay?.state==='retired')outcome='superseded';
  else if(publication.state==='mounting')outcome=stalled?'display_stalled':'displaying';
  else outcome=publication.state==='mounted'?'published_awaiting_display':'awaiting_user_view';
 }
 else if(attempt.state==='build_failed'||build?.verdict==='FAIL')outcome='build_failed';
 else if(performanceFailed||performanceIncomplete||attempt.state==='preview_failed'||preview&&preview.verdict!=='PASS')outcome='preview_failed';
 else outcome=evidencePassed?'build_passed':'in_progress';
 if(outcome==='cancelled'||outcome==='superseded'||outcome==='interrupted'){
  action='inspect_current_attempt';reason=currentDisplay?.state==='retired'&&!stateTerminal?'此发布的展示已被同一视图上更新的展示取代；以更新的发布和展示结果为准，先检查现有产物和当前尝试，不重复旧操作。':'当前尝试已终止或被替代，先检查现有产物和当前尝试，不重复旧操作。';
 }else if(bindingError){blockedStage='binding';action='repair_binding';reason='核实绑定能力、精确版本和连接配置，不默认修改组件源码。';requiresRebuild=false;
 }else if(pageError){blockedStage='query';action='inspect_binding_page';reason='检查当前页快照、资源引用和版本，不能通过放宽附加验证绕过。';requiresRebuild=false;
 }else if(sourceError){blockedStage='display';action='fix_source';reason='显示记录包含组件脚本异常；定位相应源码后重新构建和预览。';requiresRebuild=true;
 }else if(currentDisplay?.state==='failed'||publication?.state==='failed_mount'){
  blockedStage='display';if(transportOnly&&evidencePassed){action='reopen_same_build';reason='已验证构建的显示连接失败；重开同一构建，无需重复构建和预览。';requiresRebuild=false;}
 }else if(outcome==='displayed'){blockedStage='none';action='none';reason='本次显示已确认，无需重复构建、预览或等待挂载；保存仍是单独动作。';requiresRebuild=false;
 }else if(outcome==='display_stalled'){
  blockedStage='display';requiresRebuild=false;
  if(evidencePassed){action='reopen_same_build';reason=`展示${waitText}仍未确认（期限 ${seconds(deadlineMs-startMs)} 秒）；重开同一构建，无需重复构建和预览，在确认前不要说已展示。`;}
  else{action='await_display';reason=`展示${waitText}仍未确认；没有证据要求重建。`;}
 }else if(outcome==='displaying'){blockedStage='display';action='await_display';reason=`本次显示正在打开，${waitText}；调用 apps.authoring.await_display 获取结果，没有证据要求重建。`;requiresRebuild=false;
 }else if(performanceFailed){
  blockedStage='preview';action='fix_source';const failure=performance?.failures[0];reason=failure?`性能验收未通过：${failure.id}（实际 ${failure.actual}，预算 ${failure.limit}）。${failure.repair} 修改源码后重新构建并运行正式预览。`:'性能验收未通过；按报告中的超标指标修复组件源码，重新构建并运行正式预览。';requiresRebuild=true;codes.push('PREVIEW_PERFORMANCE_FAILED');
 }else if(performanceIncomplete){
  blockedStage='preview';action='run_preview';reason='缺少当前策略的完整性能观测；保留成功构建，补齐观测并重新运行正式预览。';requiresRebuild=false;codes.push(performanceCode??'PREVIEW_PERFORMANCE_INCOMPLETE');
 }else if(evidencePassed){
  requiresRebuild=false;
  if(publication){blockedStage='display';action='ask_user_open_view';reason='构建、预览和发布均已完成，但宿主尚未展示该构建（用户可能没有打开右侧面板，或页面不可见）。请告知用户打开右侧面板，组件会自动加载；随后调用 apps.authoring.await_display 获取结果。不要重新构建，也不要说已展示。';}
  else{blockedStage='none';action='publish';reason='构建和预览已通过，可发布这一构建；发布只表示已接受，展示结果以 completionStatement 为准。';}
 }else if(attempt.state==='build_failed'){blockedStage='build';action='inspect_build_log';reason='先看构建日志区分源码与环境错误，未定位前不反复构建。';
 }else if(preview&&preview.verdict!=='PASS'||attempt.state==='preview_failed'){
  blockedStage='preview';const missing=preview?.assertionResults.filter(item=>item.required&&item.status!=='PASS')??[];
  if(missing.length>0&&missing.every(item=>['BLOCKED','NOT_RUN'].includes(item.status))&&!preview?.viewportResults.some(item=>item.pageErrors.length||item.unhandledRejections.length)){
   action='repair_preview_environment';reason='必需预览能力或步骤缺失；补齐预览环境并重跑预览，保留已成功构建。';requiresRebuild=false;
  }else{action='inspect_preview_report';reason='查看失败断言、截图和运行错误，先定位原因再决定是否修改源码。';}
 }else if(build?.verdict==='PASS'){blockedStage='preview';action='run_preview';reason='已有成功构建，继续该构建的预览，不重复 build。';requiresRebuild=false;
 }else if(attempt.state==='editing'){blockedStage='build';action='build';reason='当前尝试还没有构建回执，完成源码后执行构建。';requiresRebuild=false;
 }else if(attempt.state==='building'){blockedStage='build';action='await_build';reason='构建正在执行，读取当前结果而不是重复启动。';requiresRebuild=false;}
 // Program-generated and safe to quote verbatim: build/preview, publication and display are stated separately; only 'displayed' says 已在 DSH 展示.
 const built=attempt.state==='build_failed'||build?.verdict==='FAIL'?'构建失败':evidencePassed?'构建与预览已通过':performanceFailed||performanceIncomplete||attempt.state==='preview_failed'||preview&&preview.verdict!=='PASS'?'构建已通过，预览未通过':build?.verdict==='PASS'?'构建已通过，预览尚未完成':'构建尚未完成';
 const published=publication?{prepared:'发布已接受',mounting:'发布已接受',mounted:'发布已接受',failed_mount:'发布已接受，但挂载失败',cancelled:'发布已取消',superseded:'发布已被新的尝试取代',interrupted:'发布被中断'}[publication.state]:evidencePassed?'尚未发布':'';
 const lastCode=errors.at(-1)?.code??publication?.terminalReason;
 const shown:Record<AuthoringOutcome,string>={
  displayed:'已在 DSH 展示（当前发布的当前构建）',
  awaiting_user_view:'尚未在 DSH 展示（等待用户打开右侧面板）',
  published_awaiting_display:'尚未确认在 DSH 展示（没有当前构建的展示回执）',
  displaying:`正在 DSH 打开，尚未确认展示（${waitText}）`,
  display_stalled:`展示超时，尚未在 DSH 展示（${waitText}，超过期限）`,
  display_failed:`展示失败，未在 DSH 展示${lastCode?`（${lastCode}）`:''}`,
  build_passed:'尚未在 DSH 展示',
  superseded:stateTerminal?'':'该发布的展示已被同一视图上更新的展示取代',
  cancelled:'',interrupted:'',build_failed:'',preview_failed:'',in_progress:'',
 };
 const ended=stateTerminal?`当前尝试${{cancelled:'已取消',interrupted:'被中断',superseded:'已被新的尝试取代'}[stateTerminal]}，未确认展示`:'';
 const completionStatement=[built,stateTerminal?ended:published,shown[outcome]].filter(Boolean).join('；')+'。';
 return {outcome,completionStatement,waitedMs:outcome==='displaying'||outcome==='display_stalled'?waitedMs:null,displayDeadlineAt:currentDisplay?.state==='opening'&&Number.isFinite(displayDeadlineMs)?new Date(displayDeadlineMs).toISOString():null,
  lastConfirmedDisplay:confirmed?{...identity(confirmed),readyAt:confirmedAt(confirmed)!,frameInstanceId:confirmed.readyReceipt?.frameInstanceId??confirmed.frameInstanceId??null,documentNonce:confirmed.readyReceipt?.documentNonce??confirmed.documentNonce??null,isCurrentBuild:currentBuildId!==null&&confirmed.buildId===currentBuildId,isCurrentPublication:publication!==null&&confirmed.publicationId===publication.publicationId,isCurrentDocument:confirmed.displayId===currentDisplay?.displayId&&readyForCurrentDocument}:null,preparedBuild:!performanceFailed&&!performanceIncomplete&&preview?.verdict==='PASS'&&build?.archiveBuildId&&!input.displays.some(item=>item.publicationId===publication?.publicationId&&item.buildId===build.archiveBuildId&&item.readyAt)?{buildId:build.archiveBuildId,buildReceiptId:build.receiptId,previewReceiptId:preview.receiptId,publicationId:publication?.publicationId??null}:null,currentDisplay:currentDisplay?identity(currentDisplay):null,blockedStage,nextAction:{action,reason,target,errorCodes:codes},requiresRebuild};
}
