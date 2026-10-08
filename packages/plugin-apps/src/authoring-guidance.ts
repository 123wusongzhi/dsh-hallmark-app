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
    kind:'dsh-apps-authoring-guidance',guidanceVersion:2,sessionId,...guidance,
    checkRunner:{command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-authoring-check.js'),'<check-request.json>'],request:{build:'<fill the buildRequest below>',preview:{mode:'live_readonly',requiredMethods:['getData'],assertions:'<real interaction plan>'}}},
    resultReader:{command:[guidance.nodeExecutable,...guidance.nodeArgs,guidance.previewRunnerPath.replace(/apps-authoring-preview\.js$/,'apps-read-result.js'),'<request.json>'],request:{runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},resultRef:'<fullResultRef>',cursor:'0',limit:100,outputPath:'<absolute local output JSON path>'}},
    flow:['先apps_describe后apps_invoke apps.authoring.begin，appId=apps、connectionId=presentation，明确mode new/edit/open_saved和原session；读取返回draft.workspacePath、sourceRevision及attemptId/epoch/viewRevision。',
      '商品列表使用hallmark.products.list的input.fields精简返回字段（title/imageUrl/sku/status/currency/pricing/profit/stock），total/cursor和身份字段保留；省略fields才读取完整数据。绑定projection不负责裁剪响应。组件需要业务数据时，先发现真实查询能力；新建时把DatasetBinding传给begin的bindings，已有视图用apps.presentation.update_view设置。读取或刷新该view的数据，再使用其中实际bindingId、datasetRevision和ResourceRef实现选择附加；预览夹具不能替代实际视图绑定。',
      'getData的binding.query提供appId、connectionId、capabilityId、精确capabilityVersion、input和projection；payload是结果，不能从payload或binding顶层猜调用配置。分页使用useApps.readBindingPage(bindingId,cursor)，宿主以bindingPagesV1协商，返回并更新当前页payload/resources/revision。固定页大小来自binding.query.input.limit，不自行改limit或查询条件。query缺失表示当前能力不可解析，不要猜版本。直接invokeCapability返回的新页不自动成为绑定快照，附加选择仍须属于当前revision/resources。',
      '本版指引替代旧交接文档和旧示例的创作步骤。apps_describe只传capabilityId/version。大结果先看sample；需要全文按resultReader读取fullResultRef，不重复业务查询、不查SQLite或旧临时数据。',
      '用原Agent普通文件工具编辑该workspace。新空项目用starterPath及sdkDirectory生成普通React/TSX/CSS工程；复制旧组件时保留新版bindingRequest并把可附加的分页改为readBindingPage。安装依赖并保留真实lockfile；SDK useApps声明required assertionResults。',
      '把buildRequest实际值写为JSON文件，用nodeExecutable+nodeArgs执行buildRunnerPath和JSON路径；runner先向明确Runtime markBuilding，再执行command，保存真实源码/lock/退出码/dist/archive证据。不得手造PASS报告。',
      '交互计划已明确时优先checkRunner：一个JSON包含build与preview，依次build→record_build→preview→record_preview，只输出摘要，不发布、不打开、不保存。同输入重跑复用该attempt已验证报告；登记失败先inspect原回执，再登记同一报告。源码/命令/环境改变或已登记的预览条件改变，返回NEW_ATTEMPT_REQUIRED；不要继续重复旧请求。',
      '默认autoRecord:true：build通过后自动record_build并返回previewRequest；补齐交互断言后执行previewRunnerPath，通过后自动record_preview。直接读summaryPath中的回执、失败断言、截图和耗时，不再手动登记或编写报告解析脚本。登记失败按摘要stage修正，同一报告无需重建。',
      '需要分页、刷新或选择附加时在previewRequest.requiredMethods声明readBindingPage、refresh或attachSelection并写真实交互断言。优先live_readonly并提供sessionId/viewId/runtime，runner读取真实getData、调用只读能力和验证选择；fixture模式需提供精确capabilityFixtures/refreshData，不能给binding补真实宿主没有的字段。关键能力缺失应报告INCOMPLETE，不能用降级首屏宣称分页通过。',
      '验证循环：源码和构建输入未改变时复用同一attempt的成功build回执。尚未登记的预览条件改变时仅重跑preview；已登记的不可变预览不能被替换，须新attempt。相同预览输入和当前绑定快照可复用已验证报告。一次preview已生成420/1040截图和交互报告，直接读取这两张图，不额外运行截图脚本或固定等待12秒。外网图片默认使用预览缓存/占位；diagnostics单独记录最多6张、总预算5秒的图片抽样，图片慢不触发源码修复循环。仅对明确的布局或交互缺陷修改后重建。',
      'starter提供src/Image.tsx可直接复用。商品图片默认固定尺寸，列表使用loading=lazy、decoding=async，提供加载中和加载失败占位；有真实缩略图字段时优先使用，不猜测图片URL参数。',
      'publish必须引用同attempt/epoch/buildId/buildReceiptId/previewReceiptId和expectedViewRevision；成功仅表示组件已准备好；当前聊天会自动在右侧加载展示，无需要求用户再点击打开。Agent 不自行调用 UI startMount、openDisplay 或 frame 授权。',
      '组件准备好后，UI自动为同publication/build开启独立显示尝试，加载实际预览通过的同一归档；仍检查所属会话和数据权限。frame真正读取数据、React commit和required assertions PASS后才可称已展示，onLoad不算发布成功。',
      '加载失败可由用户重新打开同一构建；无需只为展示失败重建或发布新候选。用apps.authoring.inspect先读summary的lastConfirmedDisplay、preparedBuild、currentDisplay和nextAction；requiresRebuild为null表示尚未定位，不能默认重建。需要细节再读原publication的latestDisplay/displays及实际phase/code/message；重新打开使用新的frame授权，旧frame不得恢复权限。不要自行操作UI或反复等待原生挂载。',
      '展示与保存分开；只有用户明确保存时调用apps.authoring.save_component，带mode、expectedViewRevision以及update的componentId/expectedRevision。业务写入未知结果仍只回查原操作，不因重新打开重发。'],
    buildRequest:{sessionId,sdkDirectory:guidance.sdkDirectory,viewId:'<begin.view.viewId>',autoRecord:true,attemptId:'<begin.attempt.attemptId>',epoch:'<begin.attempt.epoch>',sourceRevision:'<begin.draft.sourceRevision>',workspacePath:'<begin.draft.workspacePath>',command:[guidance.nodeExecutable,...guidance.nodeArgs,'build.mjs'],archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile}},
    previewRequest:{sessionId,autoRecord:true,viewId:'<begin.view.viewId>',attemptId:'<same attemptId>',epoch:'<same epoch>',buildReceiptId:'<record_build.receiptId>',buildReportRef:'<build runner reportRef>',archiveRoot:guidance.runtime.archiveRoot,evidenceRoot:guidance.runtime.evidenceRoot,runtime:{url:guidance.runtime.url,keyFile:guidance.runtime.keyFile},mode:'live_readonly',requiredMethods:['getData'],assertions:'<real click/fill + observable checks; add readBindingPage/refresh/attachSelection to requiredMethods when used>'},
  };
}
