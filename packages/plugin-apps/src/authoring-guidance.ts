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
    kind:'dsh-apps-authoring-guidance',sessionId,...guidance,
    flow:['先apps_describe后apps_invoke apps.authoring.begin，appId=apps、connectionId=presentation，明确mode new/edit/open_saved和原session；读取返回draft.workspacePath、sourceRevision及attemptId/epoch/viewRevision。',
      '用原Agent普通文件工具编辑该workspace。新空项目用starterPath及sdkDirectory生成普通React/TSX/CSS工程，安装依赖并保留唯一真实lockfile；SDK useApps声明required assertionResults，必要时声明数字uiStateSchemaVersion及export/import/migrate。',
      '把buildRequest实际值写为JSON文件，用nodeExecutable+nodeArgs执行buildRunnerPath和JSON路径；runner先向明确Runtime markBuilding，再执行command，保存真实源码/lock/退出码/dist/archive证据。不得手造PASS报告。',
      '用runner返回reportRef调用apps.authoring.record_build。成功后把previewRequest实际值写为JSON，用同Node执行previewRunnerPath，真实运行宽/窄视口与已声明互动断言，返回reportRef再调用record_preview。',
      'publish必须引用同attempt/epoch/buildId/buildReceiptId/previewReceiptId和expectedViewRevision；成功仅表示组件已准备好，原聊天工具卡提供打开组件入口。等待用户点击时不计挂载超时，不自动展开右侧，也不自行调用UI startMount。',
      '用户点击原聊天卡片打开组件后，UI以同publication/attempt/epoch/build/viewRevision启动挂载检查；原生frame先授权、协商、读取数据和状态，React真正commit与required assertions PASS后renderReady才提升active/lastGood，才可称已展示。onLoad不算发布成功。',
      '展示与保存分开；只有用户明确保存时调用apps.authoring.save_component，带mode、expectedViewRevision以及update的componentId/expectedRevision。超时或取消检查原attempt/publication，不猜新ID重放。'],
    buildRequest:{sessionId,attemptId:'<begin.attempt.attemptId>',epoch:'<begin.attempt.epoch>',sourceRevision:'<begin.draft.sourceRevision>',workspacePath:'<begin.draft.workspacePath>',command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}},
    previewRequest:{attemptId:'<same attemptId>',epoch:'<same epoch>',buildReceiptId:'<record_build.receiptId>',buildReportRef:'<build runner reportRef>',archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,mode:'fixture',data:'<readonly viewData or explicit fixture>',context:'<readonly owned context>',assertions:'<required real click/fill + check cases; or declared noninteractiveReason>'},
  };
}
