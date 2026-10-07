# 制作、验证和保存源码组件

A.2 使用原 DSH 会话、原文件/命令工具和 Apps 网关。用户在任意原输入框 `@` 选择应用后手动发送要求；Agent 编辑普通 React/TSX/CSS，完成真实构建、双视口反馈、候选就绪和明确保存。只更新应用/组件区域，不建立另一套聊天。当前包内路径与运行身份必须来自正在处理该原会话的 Host，不能照抄旧开发机路径。

TST-023完整最低FIXTURE已由I15/15和独立V17/17验证真实UTF-8字节预算、handle完整分页及query_only spill拒绝；017–020完整FIXTURE由I25/25/V38/38验证幂等、unknown只读恢复、取消与严格CAS。两组都是candidate11隔离执行，原DSH/真实模型原话与桌面创作另验；013–015完整最低FIXTURE/actual-command已独立V通过；所有新执行证据均冻结于11修复后续开始前。

当前candidate.12已于11:37:55 UTC通过官方管理器覆盖原同名插件；冷备恢复、33项安装产物/143冻结输入与9774核心文件字节不变已核对。首次启动超时并出现EACCES19387，原日志保留；11:44:02 UTC仅重试桌面后启动，11:45:55 UTC核实Runtime12/schema4、四只读HTTP200及Hallmark健康。Host插件内存身份、原生GUI/@/组件挂载仍NOT_RUN，22张正式PASS仍绑定原10/11，不迁移12。 前轮candidate.10通过官方插件管理器覆盖原同名插件并正常重开桌面的历史：安装五hash/143冻结源输入、实际Runtime7/schema4/健康/唯一writer核对通过。冻结706/706、类型检查、26视觉fixture、实际包内build/双视口10断言和只读smoke范围保留；独立备份工具另验22+1并完成1754文件备份，旧10包未重打。Host/Client原生内存身份、GUI和新挂载仍待人工验收。candidate.9原Agent源码/build/preview/read_image/反馈历史未改，旧挂载失败、最后旧pub重启后interrupted；用户本轮暂不保存。进度以 [A.2执行记录](apps-a2-execution.md)为准。

本轮TST-054 FIXTURE（I52/52、实际公开Runtime invocation/A-B独立目录和两次edit）、055 FIXTURE+SOURCE_EXEC、056 FIXTURE、057 SOURCE_EXEC已按完整最低断言独立V通过；这些卡不代签原Agent/桌面全流程。057使用正常安装依赖的React/TSX/CSS与真实包内CLI，v2四方法/v1/major拒绝、资源字节核对以及同一冻结build的fixture/本地Bill200行live_readonly快照分别验证。快照源时间2026-10-06 16:01:20.856 UTC、取得时间次日07:50:12.932 UTC、freshness unknown，不代表新live API读数。旧HTML/JS只是子范围；058完整LIVE_MODEL/双视口视觉反馈仍NOT_RUN，420图价格/库存窄列逐字换行不能标视觉PASS。

1754文件备份已实际恢复新根并核验6归档/8构建签名/6预览签名/12PNG/2草稿/44引用，普通npm ci和已安装CLI/SDK真实重建得到原Bill buildId，六原归档不改。该SOURCE_EXEC未切换桌面库或执行原Agent编辑；依赖安装通过仅适用于本次Bill归档和本地React夹具，不保证通用starter/file锁在所有机器可恢复。

a635ec4已推送5份验收/审查文件及7份说明；前轮16文件已推送0824a4a；其后新增API/SDK、Runtime写入边界和模型预算独立harness，提交与推送以Git历史和最终交付为准，10manifest所录143输入摘要与10归档不改，11冻结输入比10有5项差异；11全部I/V冻结后已补profit公共Provider→UI provenance/行展开（2新增/33相关/type通过）及Host/SDK/Bridge错误边界，局部回归/有限review通过；另定位同view重开Pane缓存error/legacy未按nav.revision重验的源码路径，最小修复6项React局部回归、29项相关与类型检查通过，不能作为现场挂载失败因果证明。12已冻结包检查774/774并实际覆盖安装/桌面retry启动，Native原输入/组件挂载仍待用户测试；当前工作树不再作为11相同输入的证明。054的历史I、首V补充FAIL及SQLite侧文件更正均保留，主DB/307原I字节不变；新增侧文件不等于业务写，详情见执行记录。059/060完整FIXTURE独立V通过；candidate.11（Bundle/Host/Runtime11、schema4）归档已冻结，最终包检查727/727、类型/实际SDK/CLI/只读smoke及包内诊断通过，包独立V有限复核通过、003/004/011/012新11完整FIXTURE已独立V通过且未部署；当前二十二张PASS分别绑定新11十二卡（核心四卡、013–015、017–020与023）和旧10其他十卡，003/004/012旧10 PASS及011旧10 FAIL保留，旧10卡不得自动搬到新候选。

## A.2：先发现能力和工程定位

先用 `apps_list`、`apps_describe` 核实正在运行的目录与 `apps.authoring.*@1.0.0`，再经 `apps_invoke` 调用。创作由共享 `appId=apps`、`connectionId=presentation` 执行，原 sessionId 来自可信 Host；真实业务的数据绑定另外保持明确 appId/connectionId。不要从店铺展示名、当前 focus 或最近会话猜身份。

Host 的 `authoringGuidance` 提供以下字段，内容是本机路径/参数而非密钥值：

| 字段 | 用途 |
|---|---|
| `nodeExecutable`、`nodeArgs`、`nodeEnvironment` | 实际安装的 Node 执行方式；桌面 Electron 路径可能需要返回的 `ELECTRON_RUN_AS_NODE` 和参数，不能只换成裸 node |
| `starterPath`、`sdkDirectory` | 包内 starter 和 SDK；新工程初始化到 begin 返回的空工作副本 |
| `buildRunnerPath`、`previewRunnerPath` | 包内独立 Node ESM CLI，不要求原仓库 TS 源码 |
| `runtime.url`、`runtime.keyFile` | 明确本机 Runtime 和密钥文件路径，CLI 自行读 key，密钥字节不写聊天/命令行 |
| `runtime.archiveRoot`、`runtime.evidenceRoot` | 不可变源码-dist 存档、签名报告/日志/截图目录 |

安装包中的入口是 `source-starter/create-apps-source.mjs`、`lib/apps-authoring-build.js`、`lib/apps-authoring-preview.js`。使用实际 guidance 的绝对路径并检查版本/文件；没有新能力时明确报告旧 Host，而不是用旧 open_source 工具假称新回执验证成功。

## A.2：begin、普通源码和真实构建

`apps.authoring.begin` 的 params 可用以下三类入口：

```json
{"mode":"new","title":"商品筛选"}
```

编辑当前组件用 `{"mode":"edit","viewId":"原返回的 viewId"}`；打开库中版本用 `{"mode":"open_saved","componentId":"原返回的 componentId","revision":1}`，revision 应换成明确选择的历史版本。读取返回 `draft.workspacePath/sourceRevision`、`attempt.attemptId/epoch/expectedViewRevision` 和 `view.viewId`。同一 begin 的重试保留相同 attemptId；修改后进入下一轮须明确创建新 attempt。不要让别的 view 工作目录覆盖当前工作副本。

begin 已创建空目录。starter 可初始化不存在或空目录，非空目录拒绝覆盖。复制既有模板时只复制源码、资源、package.json 和真实锁文件，不复制 node_modules。首次 npm install 生成真实锁；恢复后原锁/依赖路径仍适用时用 npm ci。file SDK 的相对锁路径在新根可能失效：保留原 source/lock 及旧证据，在显式新 attempt 中核实当前 SDK 路径、npm install 生成新锁/输入 digest，再真实重建，不修改旧回执。保持唯一受支持锁文件。

新页面使用 v2 子路径：

```tsx
import {createAppsClient} from '@dsh/apps-component-runtime/apps';
import {useApps} from '@dsh/apps-component-runtime/apps/react';
```

旧根入口和 `/react` 保留旧 v1 协议。普通 React 状态、条件/循环、CSS、图表和依赖均可修改，旧 ViewSpec 词表不限制源码设计。新 useApps 的 required readiness assertions 必须检查 React commit 后的真实 DOM/数据；不能返回固定 PASS。

以下 PowerShell 辅助函数示范如何**按 guidance**执行包内入口；它不是另一个产品命令。`$appsGuidance` 为从当前 Host 保存并读取的实际 JSON 对象，`$appsDraft` 为 begin 返回的 draft。

```powershell
function Invoke-AppsInstalledNode([string]$entry, [string[]]$entryArguments) {
  $appsPreviousEnvironment = @{}
  try {
    foreach ($appsEnvironment in $appsGuidance.nodeEnvironment.PSObject.Properties) {
      $appsPreviousEnvironment[$appsEnvironment.Name] = [Environment]::GetEnvironmentVariable($appsEnvironment.Name, 'Process')
      [Environment]::SetEnvironmentVariable($appsEnvironment.Name, [string]$appsEnvironment.Value, 'Process')
    }
    $appsNodeArguments = @($appsGuidance.nodeArgs)
    & $appsGuidance.nodeExecutable @appsNodeArguments $entry @entryArguments
    if ($LASTEXITCODE -ne 0) { throw 'Installed Apps command failed; inspect its retained report/log.' }
  } finally {
    foreach ($appsEnvironmentName in $appsPreviousEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable($appsEnvironmentName, $appsPreviousEnvironment[$appsEnvironmentName], 'Process')
    }
  }
}
Invoke-AppsInstalledNode $appsGuidance.starterPath @('--directory', $appsDraft.workspacePath, '--sdk', $appsGuidance.sdkDirectory)
```

先编辑并安装依赖。随后把实际值写入私有构建请求 JSON；下例的所有占位值须替换，数字需来自同一 attempt，不是自行填成功记录：

```json
{
  "sessionId":"原会话 ID",
  "attemptId":"begin 返回的 attemptId",
  "epoch":1,
  "sourceRevision":1,
  "workspacePath":"begin 返回的绝对工作目录",
  "command":["guidance.nodeExecutable","guidance.nodeArgs 的各元素","build.mjs"],
  "archiveRoot":"guidance.runtime.archiveRoot",
  "evidenceRoot":"guidance.runtime.evidenceRoot",
  "runtime":{"url":"guidance.runtime.url","keyFile":"guidance.runtime.keyFile"}
}
```

`command` 是实际可执行程序和参数数组，不能保留上例的占位字符串。若采用其他正常构建工具，也填写真实 command，避免依赖 shell 字符串拼接。CLI 继承本次命令的环境；工作目录为该 workspace。

```powershell
Invoke-AppsInstalledNode $appsGuidance.buildRunnerPath @('<实际构建请求 JSON 的绝对路径>')
```

runner 在 spawn 前登记 Runtime building，执行真实命令，保存输入摘要、锁文件、command/cwd/toolchain/exit/log，并冻结源码/dist/逐文件 manifest。仅退出 0、输入未变和归档证据完整时 PASS。CLI 返回 `reportRef:{path,sha256,bytes}`；将原 ref 连同 attemptId/epoch 交给 `apps.authoring.record_build`。后端核查 runner 签名、hash 和存档，不接受手造 PASS、旧 dist 或自行填写 BuildReceipt。

## A.2：双视口交互与视觉反馈

预览请求使用 record_build 返回的 receiptId、构建 CLI 原 reportRef、同一 attemptId/epoch，以及 guidance 的 archiveRoot/evidenceRoot。明确 `mode:fixture` 或 `live_readonly`；data/context 是符合当前 DatasetBinding/ResourceRef 结构的固定测试数据或真实只读绑定，二者不得改标签混用。预览不执行真实调价/库存/上品。

`assertions` 必须描述实际 UI 操作和可观察结果。starter 的两个控件可用：

```json
[
  {"id":"counter.click","required":true,"action":"click","selector":"[data-testid='counter']","check":"contains","expected":"1"},
  {"id":"filter.fill","required":true,"action":"fill","selector":"[data-testid='filter']","value":"示例","check":"value","expected":"示例"}
]
```

A.2 计划的 action 为 click/fill，check 支持 count/checked/value/visible/contains/text，结果在可选 checkSelector 上检查。与下方历史 source-capture 的步骤格式不同，不能互相照搬。每个交互控件需合适的断言；缺计划、缺 required 交互、重复 ID 或不支持动作无法 PASS。真正无交互页面可声明 noninteractiveReason，仍须 required 可见断言；存在交互控件不能借此跳过测试。

```powershell
Invoke-AppsInstalledNode $appsGuidance.previewRunnerPath @('<实际预览请求 JSON 的绝对路径>')
```

runner 从同一冻结 build 使用 v2 Host 载入，实际执行 420/1040 CSS 像素内容宽度，记录 height/deviceScaleFactor、PNG、pageErrors/unhandledRejections/failedRequests、bridge 和交互结果。使用独立浏览器/profile，不附着用户桌面。需要时在请求中提供已核实的 browserExecutable。

Agent 必须实际打开两张 PNG，检查长标题、缺图/空数据、层级、窄栏溢出和宽页布局，再读报告。如果反馈有问题，编辑源码并创建下一 attempt，重建/重测；不能只看“无错误”就宣称视觉合格。将预览 CLI 返回的 reportRef、同一 attemptId/epoch 和 buildReceiptId 交给 `apps.authoring.record_preview`，不自行拼预览回执或缩略图。

## A.2：候选确认和明确保存

record_preview PASS 后调用 `apps.authoring.publish`，带同一 attemptId/epoch、viewId、expectedViewRevision、buildId、buildReceiptId、previewReceiptId。publish 返回 mounting，不等于已经显示成功。

同一draft显式开启下一attempt时，保留viewId/draftId与可编辑workspace，sourceRevision/epoch递增；不同A/B草稿/会话保持独立目录。同expectedViewRevision并发提交候选，由同一P2事务检查最新epoch、owner、未取消、receipt/build和viewRevision；当前代际最多提交一次，旧attempt以ATTEMPT_SUPERSEDED或VIEW_CONFLICT拒绝，不自动追新revision重试。无需让两个attempt同时保持当前合法，也无需给同draft每个attempt另建目录；工作副本与已冻结候选/历史保留。

实际 frame 完成授权、features 协商、数据读取、UI 状态恢复和 React commit 后，才以准确 frame/document nonce/attempt 身份回传 renderReady。Host/Runtime 校验通过才提升 active/last-good 并产生 committedViewRevision；onLoad 不能替代就绪。运行错、超时、取消或过期候选保留旧可用界面；无旧构建则显示真实空态。通过 `apps.authoring.inspect` 只读查询原 attempt/publication；不猜新的请求身份重试覆盖。

### candidate.10：原会话候选发现与唯一文档

该实现修复candidate.9真实创作已完成构建/预览却未出现正式候选frame的断点，不另建聊天或Agent循环。客户端root常驻 [NativePublicationObserver](../packages/plugin-apps/client/native-publication.tsx)，只订阅官方 `sidebarRight.mounted` 的实际会话；每次只执行一个所属views读取，完成后约1秒再读。读取新的pendingPublicationId时，使用固定publicationId GET检查session/view/publication身份、mounting状态和未过期deadline；切会话/卸载会中止读取，A的晚回执不能打开B的右栏。发现过程不publish、不自动创建新attempt或执行业务写。

原右侧 [AppsSidebarPane](../packages/plugin-apps/client/sidebar.tsx) 在tab可见、owner与当前会话相同、signal有效时使用正式SDK的AppsNativeView。成功读取新目录且目标ID不存在时，才交给历史组件Pane；目录权限/归属错误显示错误，不降级绕过检查。Apps主区在自己的所属会话独立发现并选中工作区，不依赖聊天工具行挂载。聊天 [ToolView](../packages/plugin-apps/client/view.tsx) 是固定session/view/build/publication/revision身份卡；“打开组件”明确打开同view当前工作版本，原消息标识保留，不偷偷随focus变更历史身份。

CandidateFrameLease以session/view/publication/attempt/epoch/build完整键限制一个候选只授权一个iframe文档。没有ToolView挂载时，独立发现仍能驱动正式右栏；主区/右栏同时存在也不能竞争授权。重复hello共享同一授权过程并保留各requestId；卸载、旧handler或晚到授权返回使用原handler退役原grant。错误/超时先只读对账原publication，ready已提交时保留成功；failMount与ready竞争再对账，P1晚结果不得覆盖同view的新P2。13项最终专项及独立源码复核通过，范围为React/契约夹具；实现现已覆盖安装，candidate.10原生GUI仍待直接验收。

**首次授权后、候选确认前离开原展示面会退役原grant；同一publication不跨面重新授权。** 此时先在原会话只读检查原publication/attempt；未成功则保留旧失败事实，再明确进入新attempt重新构建/预览/发布。不能承诺候选无损搬迁，不能为这个边界自动创建Agent重试循环。

显示与保存分开。用户明确说“保存”或点击保存时，调用 `apps.authoring.save_component`：save_as 使用已确认 viewRevision、userRequest/title 和稳定幂等键；update 还带 componentId 与打开时 baseRevisionAtOpen 对应的 expectedRevision。历史选中的 selectedSourceRevision 不是最新元数据 CAS 基线。冲突保留副本，提供查看最新/另存，不自动提高 revision。恢复历史保存为新版本，重命名生成元数据版本，删除库项保留历史/已打开副本。

搜索/排序/分页/勾选为本地交互，不新增模型步。附加选择使用当前 ResourceRef 与 datasetRevision，保留原输入正文/旧附件，等待手动发送。validated、attached、submitted、consumed 分段记录；默认手动路径不依赖可选 requestAgent，正式排队回执也不代替原模型实际消费。

旧源码/v1、旧工具与历史组件继续兼容；其原始用法保留在下面。备份/恢复和恢复后依赖安装见 [迁移手册](apps-migration-runbook.md)，技能入口见 [技能记录](design-skills-install.md)。

## 0.3.0 历史：旧 v1 源码组件流程

下面是 0.3.0 已交付工程和旧 hallmark.source.v1 的记录。它不提供 A.2 签名构建/预览回执、候选就绪或新保存门禁；使用旧流程时保留其兼容/legacy_unverified 语义，不能代签本轮 authoring。

Agent 使用普通文件和命令工具编辑 React、CSS、依赖与资源。界面不受旧 ViewSpec 的 widget、布局、字段和样式词表限制。`component.json` 是工程信息，不是页面 DSL。第一份工程位于 `component-workspace/collected-products`。

## 0.3.0 历史：先建真实页面

在工程目录运行：

```powershell
npm ci --registry=https://registry.npmjs.org
npm run build
```

工程采用 React 18、Vite、Tailwind 4、TanStack Table；`src/components/ui` 含可直接修改的 shadcn/ui Button 与 Table primitive，附 MIT 许可证。`src/Component.tsx` 实现商品列表；`src/styles.css` 控制完整配色、响应式和深浅主题。这些依赖与源码都可按实际设计需要修改。

`src/lib/runtime` 是薄 SDK 的源码副本。采用这种方式，是为了保存、恢复到其他目录后仍能独立 `npm ci && npm run build`。更新 SDK 时，从 `packages/component-runtime/src/client.ts` 和 `react.tsx` 同步该目录；不用把工程绑定到原 monorepo 的相对文件路径。

## 0.3.0 历史：绑定真实数据并打开

先调用 `hallmark_search_collected_items`。使用它返回的真实 `datasetKey`，不猜数据集名称。然后调用：

```json
{
  "directory": "E:/project/deepseek_h/dsh-hallmark-app/component-workspace/collected-products",
  "bindings": [{
    "id": "collected",
    "datasetKey": "替换为查询返回的 datasetKey",
    "query": {"tool": "hallmark_search_collected_items", "params": {"limit": 100}},
    "fieldMap": {}
  }]
}
```

工具是 `hallmark_open_source_component`。它打开已构建 `dist/index.html` 并登记当前会话草稿，不会发布到组件库。再次构建后可带同一个 `viewId` 更新草稿。

模板显示本次查询范围，依据实际 `collectedAt / importedAt / createdAt` 排序，并标注时间类型。旧数据接口本身不保证全库最近排序，不能把首 100 条说成全库最近 100 条。真实图片由源 `mainImage` 等字段读取，缺失时显示“暂无图片”；不补造报价、销量或利润。

## 0.3.0 历史：看同一份 dist，而后修改

以下命令从应用服务读取当前会话组件数据，凭据留在本机服务客户端；浏览器收到的是业务数据：

```powershell
node scripts/source-preview.mjs --directory component-workspace/collected-products --session "<当前会话ID>" --view "<工具返回的viewId>" --port 4318
```

打开终端输出的 `http://127.0.0.1:4318`。预览宿主使用同一份 dist 文件，不生成替代 HTML 组件。预览中的“附加”只演练选择协议并显示明确提示；在 DSH 内才会创建真实原生附件，等待用户手动发送。

也可从已有数据文件预览：

```powershell
node scripts/source-preview.mjs --directory component-workspace/collected-products --data artifacts/collected-source-data.json --port 4318
```

支持 `BindingData[]`、`{bindings:[...]}`、服务返回 `{status:"ok",data:{bindings:[...]}}`，或者完整 SDK `SourceData`。缺少数据时显示真实空状态，绝不默认塞入演示商品。数据文件放在工程外部或 `.preview` 中；正式模板无需携带固定店铺数据。

`/__manifest.json` 给出 dist 每个文件的哈希以及与 DSH 同算法的 `buildId`。修改源码后重新构建并重启预览；运行中的预览保持启动时的文件快照，避免一半新资源一半旧资源。

## 0.3.0 历史：截图、操作、读取反馈

工程 devDependencies 已包含 Playwright。首次使用时安装 Playwright 浏览器，或传已有浏览器渠道：

```powershell
# 在组件工程内，仅在缺少可用浏览器时运行
npx playwright install chromium
```

在应用项目根目录：

```powershell
node scripts/source-capture.mjs --directory component-workspace/collected-products --session "<会话ID>" --view "<viewId>" --width 380 --height 850 --ready '[data-ready="ready"]'
node scripts/source-capture.mjs --directory component-workspace/collected-products --session "<会话ID>" --view "<viewId>" --width 1100 --height 850 --ready '[data-ready="ready"]'
```

可用 `--channel chrome` 指定已安装 Chrome，或 `--executable <绝对路径>`；`--color-scheme dark` 检查深色。普通源码页面不需要 `data-ready` 属性，省略 `--ready` 后按常规页面加载进行截图。

截图与反馈写入 `.preview/screenshot-380x850.png` 和同名 `.json`，并更新 `.preview/latest.png/latest.json`。报告包括 `buildId`、窗口尺寸、控制台错误、页面错误、失败网络请求、逐项交互结果和预览附件事件。Agent 必须用图像工具查看 PNG，检查视觉之后再改源码；“没有报错”不能代替“设计已经好看”。`latest.json` 的 buildId 与当前源码一致时，后端才能把截图认作当前构建的缩略图。

交互步骤通过 `--steps <JSON路径>` 提供，例如：

```json
[
  {"action":"fill","selector":"input[aria-label='搜索商品']","value":"端子"},
  {"action":"check","selector":".desktop-table thead input[type='checkbox']"},
  {"action":"assertText","selector":".selection-status","text":"已选"},
  {"action":"click","selector":".attach-button"},
  {"action":"waitFor","selector":".feedback"},
  {"action":"assertText","selector":".feedback","text":"预览已收到"}
]
```

支持 `click / fill / check / uncheck / select / press / waitFor / scrollIntoView / assertText`。选择器针对 iframe 内普通 DOM；这只是便捷交互脚本，组件源码本身不受这些动作词限制。窄屏选框使用 `.mobile-select-all input`，避免选中隐藏的宽屏控件。交互失败仍输出具体失败步骤和可获得的截图。

## 0.3.0 历史：实际检查后再保存

首模板检查 380px 和 1100px、真实长标题、缺图、搜索无结果、选择跨页、附加后的状态和键盘焦点。视觉沿用 `skills/hallmark-component-design/references/visual-direction.md`：有颜色和层级，主操作突出，减少重复框线，数据缺失与错误状态明确。

用户要求保存时调用 `hallmark_save_component`。保存源码、CSS、资源、包锁与实际构建；正式更新保留旧版本。编辑已有版本先打开工作副本；回退也从历史版本打开，再保存为新的版本。普通依赖冲突、溢出或性能问题出现后，针对实际问题修改工程，不提前收紧 Agent 的表达能力。
