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
    kind:'dsh-apps-authoring-guidance',guidanceVersion:9,sessionId,...guidance,
    userPreferences:{policy:'component-experience-v1',cacheTtlMs:900000,rules:[
      '蓝白、简洁、视觉层次优先；少文字少堆字段，细节渐进展开。',
      '字段用易懂中文及单位/币种/口径；缺失不填0，参考利润不冒充结算。',
      '数据源按能力和字段共用；Bill、Helen仅在店铺选择出现。跨接口按稳定身份和粒度组合。',
      '工作台预览、调整显示、添加信息三个入口衔接；添加信息可跨接口选字段。',
      '优先全量逻辑数据，本地分页、搜索和排序；接口批次由后端组合，不能声称一次网络全量。',
      '每次先显示上次成功完整快照；15分钟有效期覆盖旧3分钟，到期或手动刷新都在后台，保留可操作内容。',
      '完整新快照成功后再替换；限流或临时失败保留旧快照和原时间，不以半成品覆盖。',
      '首次无快照轻量准备，不虚构数据；能力不足明确范围并补后端，不能冒充全量。',
      '缓存隔离连接、店铺、查询和授权；切店或权限撤销不能沿用旧店数据。按钮反馈清楚，试算不写平台业务。'
    ]},
    developerDocs:{index:guidance.starterPath.replace(/source-starter[\\/]create-apps-source\.mjs$/,'authoring-docs/index.md'),userPreferences:guidance.starterPath.replace(/source-starter[\\/]create-apps-source\.mjs$/,'authoring-docs/user-preferences.md'),template:'product-list',initializeArgs:['--directory','<begin.draft.workspacePath>','--sdk',guidance.sdkDirectory,'--template','product-list']},
    checkRunner:{prepareRequest:{prepare:true,build:{sessionId,attemptId:'<begin.attempt.attemptId>',sdkDirectory:guidance.sdkDirectory,command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}}},windowsCommand:['pwsh','-NoProfile','-File',guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-authoring-check.ps1'),'<check-request.json>'],command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-authoring-check.js'),'<check-request.json>'],request:{build:'<automatically prepared from inspect>',preview:{planPath:'<workspacePath>/.preview/plan.json'}}},
    resultReader:{command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-read-result.js'),'<request.json>'],request:{runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},resultRef:'<fullResultRef>',cursor:'0',limit:100,outputPath:'<absolute local output JSON path>'}},
    flow:[
      "先读developerDocs.index并发现已有素材/源/模板复用；apps.presentation.*用appId=apps/connectionId=presentation，复杂交互才写源码。",
      "缺源apps_describe读少量样本，按cross-source.md真实验证登记；新接口扩展Provider。未知空样本不能确认字段。",
      "已有组件open_component复用；未改构建/设计/源版本可保存不重建。大结果用resultReader，不查旧临时库或SQLite推断接口。",
      "useApps读bindings[].payload；refresh/readBindingPage更新绑定，invokeCapability不更新分页/上下文。不自建HTTP或未开放按钮。",
      "维护.preview/plan.json和真实assertionResults。checkRunner.prepareRequest填attemptId→执行requestPath；Windows用windowsCommand。runner执行markBuilding→build→record_build→preview→record_preview；不伪造epoch/回执。",
      "live_readonly声明真实requiredMethods；screenshot:{}或{selector}，不另建Host/CDP。同输入恢复回执，条件改变新attempt；错误不覆盖成功摘要。",
      "显式重试通过check请求retryStage=build或preview及非空retryId开启新attempt；同retryId恢复，新retryId再次运行。preview重试仅复用签名验证的未变构建，保留原执行身份。build.environmentKeys可声明实际环境依赖；自定义命令未声明时保守比较全部环境。draft预览仅供诊断，恒INCOMPLETE，不能正式登记或发布；正式双视口门槛不变，详见performance-cli.md。",
      "publish同attempt/epoch/build/两回执/expectedViewRevision；成功仅表示组件已准备好。自动在右侧加载展示，无需要求用户再点击打开；不自行调用 UI startMount、openDisplay。UI自动为同publication/build开启独立显示尝试，读取/React commit/断言通过才可称已展示，onLoad不算。",
      "展示失败读inspect.summary及latestDisplay/displays；requiresRebuild=null不能默认重建。可重新打开同一构建，旧frame不得恢复权限。明确保存才save_component；用成功回执view.sourceComponentId/baseRevision作更新基线。"
],
    buildRequest:{sessionId,sdkDirectory:guidance.sdkDirectory,viewId:'<begin.view.viewId>',autoRecord:true,attemptId:'<begin.attempt.attemptId>',epoch:'<begin.attempt.epoch>',sourceRevision:'<begin.draft.sourceRevision>',workspacePath:'<begin.draft.workspacePath>',command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}},
    previewRequest:{sessionId,autoRecord:true,viewId:'<begin.view.viewId>',attemptId:'<same attemptId>',epoch:'<same epoch>',buildReceiptId:'<record_build.receiptId>',buildReportRef:'<build runner reportRef>',archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},mode:'live_readonly',requiredMethods:['getData'],assertions:'<real click/fill + observable checks; add readBindingPage/refresh to requiredMethods when used>'},
  };
}
