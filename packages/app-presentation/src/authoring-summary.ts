import type {AuthoringAttempt,BuildReceipt,PreviewReceipt,ViewPublication,ComponentDisplay} from './authoring-types.ts';

/** Advice derived only from the inspected attempt and its existing evidence. */
export function authoringSummary(input:{attempt:AuthoringAttempt;publication:ViewPublication|null;build?:BuildReceipt;preview?:PreviewReceipt;displays:ComponentDisplay[];currentDisplay:ComponentDisplay|null}) {
 const {attempt,publication,build,preview,currentDisplay}=input;
 const confirmed=input.displays.filter(item=>item.readyAt).sort((a,b)=>a.readyAt!.localeCompare(b.readyAt!)).at(-1);
 const identity=(item:ComponentDisplay)=>({buildId:item.buildId,publicationId:item.publicationId,displayId:item.displayId,displayGeneration:item.generation,state:item.state,readyAt:item.readyAt??null});
 const target={attemptId:attempt.attemptId,epoch:attempt.epoch,buildId:publication?.candidateBuildId??build?.archiveBuildId??null,publicationId:publication?.publicationId??null,displayId:currentDisplay?.displayId??null};
 let blockedStage='unknown',action='inspect_evidence',reason='现有证据不足，先查看对应日志或做一次受控复现。',requiresRebuild:boolean|null=null;
 const errors=currentDisplay?.state==='failed'?currentDisplay.errors:[];
 const codes=errors.map(error=>error.code);
 const sourceError=codes.some(code=>['COMPONENT_SCRIPT_ERROR','COMPONENT_UNHANDLED_REJECTION'].includes(code));
 const bindingError=codes.some(code=>['CAPABILITY_UNAVAILABLE','INCOMPATIBLE_CAPABILITY','CONNECTION_NOT_BOUND','INVALID_BINDING'].includes(code));
 const pageError=codes.includes('SELECTION_STALE');
 const transportOnly=codes.length>0&&codes.every(code=>['BRIDGE_IDENTITY_STALE','BRIDGE_TIMEOUT','BRIDGE_UNAVAILABLE','DISPLAY_HANDLER_UNAVAILABLE','FRAME_LOAD_FAILED','FRAME_LOAD_TIMEOUT'].includes(code));
 if(['cancelled','superseded','interrupted'].includes(attempt.state)||publication&&['cancelled','superseded','interrupted'].includes(publication.state)){
  action='inspect_current_attempt';reason='当前尝试已终止或被替代，先检查现有产物和当前尝试，不重复旧操作。';
 }else if(bindingError){blockedStage='binding';action='repair_binding';reason='核实绑定能力、精确版本和连接配置，不默认修改组件源码。';requiresRebuild=false;
 }else if(pageError){blockedStage='query';action='inspect_binding_page';reason='检查当前页快照、资源引用和版本，不能通过放宽附加验证绕过。';requiresRebuild=false;
 }else if(sourceError){blockedStage='display';action='fix_source';reason='显示记录包含组件脚本异常；定位相应源码后重新构建和预览。';requiresRebuild=true;
 }else if(currentDisplay?.state==='failed'){
  blockedStage='display';if(transportOnly&&build?.verdict==='PASS'&&preview?.verdict==='PASS'){action='reopen_same_build';reason='已验证构建的显示连接失败；重开同一构建，无需重复构建和预览。';requiresRebuild=false;}
 }else if(currentDisplay?.state==='ready'){blockedStage='none';action='none';reason='本次显示已确认，无需重复构建、预览或等待挂载；保存仍是单独动作。';requiresRebuild=false;
 }else if(currentDisplay?.state==='opening'){blockedStage='display';action='await_display';reason='本次显示正在打开，等待宿主确认；没有证据要求重建。';requiresRebuild=false;
 }else if(preview?.verdict==='PASS'&&build?.verdict==='PASS'){
  blockedStage='none';action=publication?'open_prepared_build':'publish';reason=publication?'构建和预览已通过，等待宿主展示同一发布；不要重新构建。':'构建和预览已通过，可发布这一构建。';requiresRebuild=false;
 }else if(attempt.state==='build_failed'){blockedStage='build';action='inspect_build_log';reason='先看构建日志区分源码与环境错误，未定位前不反复构建。';
 }else if(preview&&preview.verdict!=='PASS'||attempt.state==='preview_failed'){
  blockedStage='preview';const missing=preview?.assertionResults.filter(item=>item.required&&item.status!=='PASS')??[];
  if(missing.length>0&&missing.every(item=>['BLOCKED','NOT_RUN'].includes(item.status))&&!preview?.viewportResults.some(item=>item.pageErrors.length||item.unhandledRejections.length)){
   action='repair_preview_environment';reason='必需预览能力或步骤缺失；补齐预览环境并重跑预览，保留已成功构建。';requiresRebuild=false;
  }else{action='inspect_preview_report';reason='查看失败断言、截图和运行错误，先定位原因再决定是否修改源码。';}
 }else if(build?.verdict==='PASS'){blockedStage='preview';action='run_preview';reason='已有成功构建，继续该构建的预览，不重复 build。';requiresRebuild=false;
 }else if(attempt.state==='editing'){blockedStage='build';action='build';reason='当前尝试还没有构建回执，完成源码后执行构建。';requiresRebuild=false;
 }else if(attempt.state==='building'){blockedStage='build';action='await_build';reason='构建正在执行，读取当前结果而不是重复启动。';requiresRebuild=false;}
 return {lastConfirmedDisplay:confirmed?identity(confirmed):null,preparedBuild:preview?.verdict==='PASS'&&build?.archiveBuildId&&!input.displays.some(item=>item.publicationId===publication?.publicationId&&item.buildId===build.archiveBuildId&&item.readyAt)?{buildId:build.archiveBuildId,buildReceiptId:build.receiptId,previewReceiptId:preview.receiptId,publicationId:publication?.publicationId??null}:null,currentDisplay:currentDisplay?identity(currentDisplay):null,blockedStage,nextAction:{action,reason,target,errorCodes:codes},requiresRebuild};
}
