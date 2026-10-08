export interface AppsAuthoringGuidance {
  cliPath:string|null;
  nodeExecutable:string;
  nodeArgs:string[];
  nodeEnvironment:Record<string,string>;
  starterPath:string;
  sdkDirectory:string;
  buildRunnerPath:string;
  previewRunnerPath:string;
  runtime:{url:string;keyFile:string;archiveRoot:string;evidenceRoot:string};
}
/** Paths are local references, never key contents; the original Agent uses ordinary file/command tools. */
export function authoringInstructions(guidance:AppsAuthoringGuidance,sessionId:string){
  return {
    kind:'dsh-apps-authoring-guidance',guidanceVersion:5,sessionId,...guidance,
    developerDocs:{index:guidance.starterPath.replace(/source-starter[\\/]create-apps-source\.mjs$/,'authoring-docs/index.md'),template:'product-list',initializeArgs:['--directory','<begin.draft.workspacePath>','--sdk',guidance.sdkDirectory,'--template','product-list']},
    checkRunner:{prepareRequest:{prepare:true,build:{sessionId,attemptId:'<begin.attempt.attemptId>',sdkDirectory:guidance.sdkDirectory,command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}}},windowsCommand:['pwsh','-NoProfile','-File',guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-authoring-check.ps1'),'<check-request.json>'],command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-authoring-check.js'),'<check-request.json>'],request:{build:'<automatically prepared from inspect>',preview:{planPath:'<workspacePath>/.preview/plan.json'}}},
    resultReader:{command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-read-result.js'),'<request.json>'],request:{runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},resultRef:'<fullResultRef>',cursor:'0',limit:100,outputPath:'<absolute local output JSON path>'}},
    flow:[
      '先读developerDocs.index，按需读数据、分页、检查文档；本版替代旧交接指引。apps_describe只传capabilityId/version，业务数据先读少量样本；大结果用resultReader，不查旧临时数据或SQLite，不遍历全店推测接口。',
      '通过apps.authoring.begin（appId=apps、connectionId=presentation）创建真实bindings，保留返回身份与workspacePath。普通文件工具编辑源码；starter的--template product-list提供首次加载、刷新、分页示例。业务字段以descriptor和样本为准，input.fields精简响应，projection不裁剪。',
      'getData.binding.query提供精确调用配置；payload是结果。useApps.readBindingPage(bindingId,cursor)更新当前页payload/resources/revision；独立invokeCapability结果不会更新分页绑定。附加到聊天暂未开放，不生成附加按钮或勾选功能；分页仅更新当前组件，不自动同步Agent上下文。',
      '安装依赖并保留lockfile，useApps提供required assertionResults。只维护.preview/plan.json；用checkRunner.prepareRequest填attemptId运行同一命令，得到requestPath再检查，不手填epoch/sourceRevision；Windows用windowsCommand等待进程退出，读取exitCode/result/日志。runner先markBuilding，再build→record_build→preview→record_preview，不发布或保存，不手工编报告。',
      '优先live_readonly，requiredMethods按功能声明getData/refresh/readBindingPage并写真实动作。直接读摘要和必要截图；assertion.screenshot={}或{selector:"#pager"}指定交互后截图位置，不另写Host/CDP。图片慢不触发重建。耗时同步用viewports:[420]和requiredMethodsOnce只验证一次，runner等待真实完成；不得用测试开关替代生产调用。',
      '同源码和明确输入恢复原成功报告；verifiedAt是原验证时间，实时数据变化不触发恢复重建。登记失败只补登记；新数据验证或已登记条件改变用新attempt。错误写独立.error.json，不覆盖成功摘要。仅为明确缺陷修改源码。',
      'publish引用同attempt/epoch/build和两份回执及expectedViewRevision；成功仅表示组件已准备好。当前聊天自动在右侧加载展示，无需要求用户再点击打开；Agent不自行调用 UI startMount、openDisplay。UI自动为同publication/build开启独立显示尝试，实际读取数据、React commit和断言通过才可称已展示，onLoad不算成功。',
      '展示问题先读inspect.summary的lastConfirmedDisplay/preparedBuild/currentDisplay/nextAction；requiresRebuild为null不能默认重建。需要时再读latestDisplay/displays。用户可重新打开同一构建，新frame使用新授权，旧frame不得恢复权限。只有用户明确保存才调用save_component。'],
    buildRequest:{sessionId,sdkDirectory:guidance.sdkDirectory,viewId:'<begin.view.viewId>',autoRecord:true,attemptId:'<begin.attempt.attemptId>',epoch:'<begin.attempt.epoch>',sourceRevision:'<begin.draft.sourceRevision>',workspacePath:'<begin.draft.workspacePath>',command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}},
    previewRequest:{sessionId,autoRecord:true,viewId:'<begin.view.viewId>',attemptId:'<same attemptId>',epoch:'<same epoch>',buildReceiptId:'<record_build.receiptId>',buildReportRef:'<build runner reportRef>',archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},mode:'live_readonly',requiredMethods:['getData'],assertions:'<real click/fill + observable checks; add readBindingPage/refresh to requiredMethods when used>'},
  };
}
