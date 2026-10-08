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
      '组件需要业务数据时，先发现真实查询能力；新建时把DatasetBinding传给begin的bindings，已有视图用apps.presentation.update_view设置。读取或刷新该view的数据，再使用其中实际bindingId、datasetRevision和ResourceRef实现选择附加；预览夹具不能替代实际视图绑定。',
      '用原Agent普通文件工具编辑该workspace。新空项目用starterPath及sdkDirectory生成普通React/TSX/CSS工程，安装依赖并保留唯一真实lockfile；SDK useApps声明required assertionResults，必要时声明数字uiStateSchemaVersion及export/import/migrate。',
      '把buildRequest实际值写为JSON文件，用nodeExecutable+nodeArgs执行buildRunnerPath和JSON路径；runner先向明确Runtime markBuilding，再执行command，保存真实源码/lock/退出码/dist/archive证据。不得手造PASS报告。',
      '用runner返回reportRef调用apps.authoring.record_build。成功后把previewRequest实际值写为JSON，用同Node执行previewRunnerPath，真实运行宽/窄视口与已声明互动断言，返回reportRef再调用record_preview。',
      '验证循环：源码和构建输入未改变时复用同一attempt的成功build回执，直接重跑preview，不重复build。一次preview已生成420/1040截图和交互报告，直接读取这两张图，不额外运行截图脚本或固定等待12秒。外网图片默认使用预览缓存/占位；diagnostics单独记录最多6张、总预算5秒的图片抽样，图片慢不触发源码修复循环。仅对明确的布局或交互缺陷修改后重建。',
      'starter提供src/Image.tsx可直接复用。商品图片默认固定尺寸，列表使用loading=lazy、decoding=async，提供加载中和加载失败占位；有真实缩略图字段时优先使用，不猜测图片URL参数。',
      'publish必须引用同attempt/epoch/buildId/buildReceiptId/previewReceiptId和expectedViewRevision；成功仅表示组件已准备好；当前聊天会自动在右侧加载展示，无需要求用户再点击打开。Agent 不自行调用 UI startMount、openDisplay 或 frame 授权。',
      '组件准备好后，UI自动为同publication/build开启独立显示尝试，加载实际预览通过的同一归档；仍检查所属会话和数据权限。frame真正读取数据、React commit和required assertions PASS后才可称已展示，onLoad不算发布成功。',
      '加载失败可由用户重新打开同一构建；无需只为展示失败重建或发布新候选。用apps.authoring.inspect读取原publication的latestDisplay/displays及实际phase/code/message后修复；重新打开使用新的frame授权，旧frame不得恢复权限。不要自行操作UI或反复等待原生挂载。',
      '展示与保存分开；只有用户明确保存时调用apps.authoring.save_component，带mode、expectedViewRevision以及update的componentId/expectedRevision。业务写入未知结果仍只回查原操作，不因重新打开重发。'],
    buildRequest:{sessionId,attemptId:'<begin.attempt.attemptId>',epoch:'<begin.attempt.epoch>',sourceRevision:'<begin.draft.sourceRevision>',workspacePath:'<begin.draft.workspacePath>',command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}},
    previewRequest:{attemptId:'<same attemptId>',epoch:'<same epoch>',buildReceiptId:'<record_build.receiptId>',buildReportRef:'<build runner reportRef>',archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,mode:'fixture',data:'<readonly viewData or explicit fixture>',context:'<readonly owned context>',assertions:'<required real click/fill + check cases; or declared noninteractiveReason>'},
  };
}
