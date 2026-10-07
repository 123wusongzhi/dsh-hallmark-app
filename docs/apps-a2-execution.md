# Apps A.2 实施与验收记录

本页记录2026-10-07的A.2实施与现场执行。**candidate.10（Host candidate.10 / Runtime candidate.7 / schema4）已于08:52:03 UTC通过官方插件管理器覆盖原同名插件，08:52:34 UTC正常重开桌面；五项安装文件hash、143个冻结源输入零差异、实际Runtime/三个Provider/Hallmark健康及唯一writer已核对。** Host/Client内存身份、实际GUI视觉与新authoring仍待用户在原会话手动发送后验收。包冻结前706/706、类型检查、视觉fixture26条、实际包内CLI双视口10断言和只读smoke通过；独立备份工具另有22回归/加强碰撞单项/typecheck，最终备份1754文件/25集合apply/verify通过。candidate.9真实Agent创作到源码/build/preview/读图迭代但原生挂载失败，旧最后publication重启后interrupted；价格54.80→54.79/库存201→200四个授权写入恢复历史保留，本轮无新业务写或保存。四个范围未整体放行。

逐项进度见 [24项任务](apps-a2-tasks.md)和 [80项对照CSV](apps-a2-progress.csv)。CSV将相关检查与正式TST分开：TST-003/004/011/012/054/055/056/057/059/060/073/075/076/077十四卡完整最低scope已独立V复核，当前为14 PASS/0 FAIL/66 NOT_RUN；`formalAcceptanceStatus=PASS`仅指该卡范围。四张核心卡003/004/011/012绑定新candidate.11归档与执行源码，另外十张PASS保留candidate.10身份，不拼成candidate.11全套十四卡验收。旧10的TST-011 FAIL与所有历史证据原样保留。实际安装仍candidate.10（Host10/Runtime7/schema4），原生GUI/内存与9/7历史各按范围记录；24任务尚未整体VERIFIED，四门禁NOT_ACCEPTED。

## 固定输入与版本

用户交付的审计包按原字节保存在 [requirements/A2](requirements/A2/README.md)，归档 SHA-256 为 `30f8a9809dd4a358c24faac4a430701061f0c6e396db5b6bdc24a286407d6ad3`。实施父提交为 `caea8175b5c7507bf942b2e752a7327063bfdd43`。输入中的 TODO、NOT_RUN、reported 状态与原 48 项历史记录均保留，没有反写成本轮通过。

`.gitattributes` 为 `docs/requirements/A2/**` 禁用行尾转换，防止 Windows 检出改变输入字节。提交前已核对113个暂存blob与原工作区副本，差异为零；检查记录SHA-256为 `35c2e9ef5dd3486f616ce535d1e83c996c6f456715e69fd9c407ba4afedce627`，范围仅为Git输入字节保留。

原包检查的范围为DOCUMENT_PACKAGE_ONLY：80需求、24任务、20发现，产品测试零次。570项是父版本基线，655项是candidate.7与当时备份修复快照；candidate.9的694项、candidate.10的706项分别保留。核心实现已推送main提交 `92b094888606db0391e9f06a14c006db8191a1fd`；独立备份修复/前轮说明已推送 `e53fd18a0bedb011db69dd2b87e159c5bb67cf75`；其后5份验收/审查文件（build/archive、preview、maintenance、release gate测试与checker）和7份说明已推送main `a635ec443288218ffe16a189b7aa68600dd21f88`，远端一致。本轮增量包含 `authoring-draft-ledger-a2.mjs`、`authoring-publication-a2.mjs`、`core-contract-boundaries-a2.mjs`、诊断回归、新11源码及说明；提交与推送以Git历史和最终交付为准；独立验收harness/测试/说明不属于143打包输入，Runtime/Host诊断源码与3份版本元数据则纳入新11的143冻结输入。054实际产品源码executedCommit=a635ec4，执行harness另存原字节；059/060完整FIXTURE已独立V通过，实际执行仍绑定candidate.10与当时a635ec4原始源码。055/056和057记录executedCommit=e53；075/076原08:24执行commit未记录，09:30对既有源hash/测试trace的复验为verifiedAgainst=e53、reuse=true，不能反写原执行commit。

| 版本域 | 已部署 candidate.10 | 现场边界 |
|---|---|---|
| Bundle / Host | `1.0.0-candidate.10` | 官方同名9→10覆盖、五项文件hash/143冻结源输入匹配、桌面正常重开；原生内存身份/GUI仍PENDING，9失败历史保留 |
| Runtime | `1.0.0-candidate.7` | 实际安装Runtime identity、Hallmark健康及目录已读取；唯一writer核对，非原生组件创作验收 |
| Apps 数据格式 | schema `4` | 实际源离线迁移、完整备份/新目录恢复及桌面配置入口切换已执行，原源目录保留 |
| HTTP / catalog / bridge | `1` / `1` / `2.0` | 原八个 bridge 方法保留；新增能力通过 features 协商 |
| DSH | `0.2.0-rc.2` | 官方桌面为目标；隔离浏览器不代签原生输入 |
| 根 package / 旧合约 | `0.3.0` | 历史版本域，不能判定整套 Apps 运行版本 |

当前Runtime产物SHA-256为 `2264139fc4404a11dbe9fdde00a374b541d1bda1544ef784483bfb6547cc9844`。candidate.7 / Runtime candidate.5原安装/@/只读模型及入口切换为历史事实，证据版本不改写。更新9前的ValidateOnly记录原7桌面运行，用户正常退出后07:40:25Z由官方CLI执行7→9覆盖安装。candidate.8首版因独立审查发现嵌套SKU匹配边界而 `REJECTED_IMPLEMENTATION_REVIEW`、未安装，私有证据保留。

candidate.11已冻结新归档，Bundle/Host/Runtime均candidate.11、schema4，SHA `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`。143输入比旧10只有5项变化（Runtime/Host诊断源码与package/server/versions元数据），9个打包文件不同；Client、SDK JS/声明、starter、两CLI及maps与10原字节一致。新11核心四卡已实际重跑I26/26并独立V通过，最终包全仓727/727及类型/SDK/CLI/只读smoke/包内诊断通过，新11未安装到桌面。10:03:40的旧10输入观察与10:07后续5项差异分别保留；当前14 PASS由新11四卡与旧10十卡分别组成，不自动迁移其他10卡，已安装入口仍Host10/Runtime7/schema4。

当前已安装归档 `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.10.tgz` 的SHA-256为 `7a07175ca7d824c5b68892c5eb6c0492abd8bf75c7f0df27b5d4029e0a54e84a`，冻结包/manifest未因独立备份工具修复重打。历史candidate.9归档为 `dc0c884bcaa0f94d063ddbd9ad2a484b2e877293a0a3c39310b6017955a89154`、candidate.7为 `46a5d6c9910027c19c33b9327270f6418b51434d8018e06e770b21d302bcb524`，不能互相代表。归档、回退脚本、完整备份、签名回执、图片与原日志私有归档，公开仓库只保存范围/结果/摘要，不发布业务、凭据或Runtime数据。

早先严格前检因桌面未退出中止，原事实保留。08:41:55 UTC核实桌面进程0及任务所属旧Runtime38844后，通过Windows Stop-Process停止该进程，不能记作graceful SIGTERM。首轮完整备份因preview-fixture-dataset误识别为持久引用而在创建目录/报告前失败；中间apply成功但随后独立审查发现显示路径碰撞，原样HOLD且未作为最终安装前备份。修复后在新目标apply/verify通过，再执行覆盖安装和正常重开。

08:52:56 UTC只读进程核查：新Runtime62564为36994唯一listener、旧38844已退出，桌面主进程63296存在；原Board服务保留。profile/dataDirectory未再次切换。08:53:13 UTC只读旧view恢复状态：最后旧publication从过deadline mounting恢复为interrupted，pending=null、active/lastGood=null、draft_unpublished；没有mounted。旧Agent的_republish/重新读取建议是失败后的建议，不是新验收；当前等待用户在原会话发送继续要求。

## CR 语义与实现

- **CR-01：** 沿用原桌面、任意原会话、原输入框 @、原消息与原 Agent；只扩展 Apps 工作台、组件区和必要输入 source/addon。工作副本独立，保存为明确动作。三份图是参考，图片顺序不表示审批优先级。
- **CR-02：** 重命名生成元数据新版本；删除库项取消可发现性，保留历史和已打开副本；恢复历史生成新版本。打开时选中的 sourceRevision 与保存 CAS 的最新元数据基线分别记录。
- **CR-03：** 新增草稿、attempt、构建/预览回执、publication、UI 状态六类持久记录，使用 schema4。共享 Apps Provider 执行创作能力；普通 React/TSX/CSS、真实命令、冻结 dist 是主路径，没有另建 Agent 循环。v1 原入口保留，v2 SDK 使用 `./apps`、`./apps/react` 子路径。
- **CR-04：** 首次文件播种后 DB 配置为权威；更新须 CAS、暂停新分发、等待真实执行排空、使缓存代际失效。后台计划由持久 worker 执行，缺 worker 时明确不可用。

发布先进入 mounting；准确 session/view/build/publication/attempt/epoch 与 document nonce 的已协商 frame 完成 render/data/bridge 检查后才提交 view revision。onLoad 不等于成功。失败或超时保留 last-good；取消/重启/晚到结果不自动重跑，不覆盖已提交事实。

同一草稿的显式新attempt保留viewId/draftId及可编辑workspace，递增sourceRevision/epoch并替代旧attempt；A/B草稿与会话的源码目录独立。同expectedViewRevision并发提交两候选时，P2事务一并核对owner、最新未取消epoch、receipt/build及viewRevision，只允许当前代际提交一次；旧代际以ATTEMPT_SUPERSEDED或VIEW_CONFLICT拒绝，不自动换新revision重试。冻结规范不要求两个attempt同时保持当前合法，也不要求同草稿每个attempt另建目录；已冻结候选与历史证据保留。

candidate.10客户端补充独立于聊天工具行的候选发现：常驻root的NativePublicationObserver只订阅 `sidebarRight.mounted` 的真实当前会话，单飞、约1秒轮询所属views，再固定publicationId读取并检查owner/view/未过期mounting。原右栏AppsSidebarPane只在visible、owner一致且signal有效时使用正式SDK AppsNativeView；Apps主区单独发现自己的候选并选工作区。ToolView保留原消息固定身份卡，明确“打开当前工作视图”，不渲染竞争候选iframe。模块及限制见 [源码作者指南](source-component-authoring.md)。实现已打包/覆盖安装，隔离检查与原生GUI结论仍分开，尚无新原生挂载通过证据。

新增完整备份覆盖 25 类集合、源码/dist、外部草稿、日志、签名回执、截图、私有 runner key 和 UI 状态。新目录通过哈希锚定的 relocation 记录解析旧引用，保留不可变回执字节；GC 和格式回退检查活引用与新数据增量。实际数据的备份、校验与新根恢复已执行，低层步骤与全部 DATA-CUTOVER 断言分开记录。

## 已执行结果

以下 PASS 仅适用于注明的范围。相关套件通过不自动成为 TST-001..080 的完整结果；正式用例仍需全部断言、最低 scope 和执行记录。

| 证据 | 实际结果 | 范围 / 限制 |
|---|---|---|
| E-FULL-1 | 648 项：646 PASS、2 FAIL | 首轮失败日志保留；Host 期望补 viewRevision，starter SDK 夹具补 v2 子路径后重跑 |
| E-FULL-2 | **651/651 PASS；0 FAIL、0 SKIP、0 CANCELLED** | `npm test`，16,197.3902 ms；包括 fixture、隔离 HTTP 与真实源码/浏览器相关测试，未运行真实业务写或原模型整链 |
| E-FULL-3 | **655/655 PASS；0 FAIL、0 SKIP、0 CANCELLED** | 修复受控工作副本依赖缓存备份规则后 `npm test`，36,061.5173 ms；之前两轮日志保留，不用总数代签 80 张用例卡 |
| E-FULL-4 / E-TYPE-9 | **694/694 PASS；0 FAIL、0 SKIP、0 CANCELLED；类型检查 PASS** | candidate.9 健康/库存修复后，`npm test` 30,441.5462 ms；前三轮及 candidate.8 拒绝历史保留；仍非正式逐卡/现场整体验收 |
| E-FULL-10 / E-TYPE-10 / E-FROZEN-10 | **706/706 PASS；0 FAIL、0 SKIP；类型检查PASS；143源输入无差异** | 08:26:26.971Z冻结candidate.10；当时尚未安装，后续实际安装另记E-INSTALL-10。此包检查早于独立备份工具的新修复，不代签后者/正式逐卡/原生GUI |
| E-FULL-11 / E-TYPE-11 / E-PACK-11 / E-SMOKE-11 | **727/727 PASS；0 FAIL/SKIP/CANCELLED；类型、实际SDK/CLI与只读smoke PASS** | 10:15:07.772–10:15:40.680 UTC独立标准npm test，exit0/32,372.0297 ms；439实际执行源与143冻结打包输入pre/post零差异。归档内SDK JS/声明、starter、真实CLI双视口；Node-only Runtime11五GET/零mutation，无新安装/模型/native签认 |
| E-V-PACK-11 | **PASS_SCOPED_PACKAGE_REVIEW**；独立包证据复核 | 143输入/33产物及归档33成员、493引用、1058原I文件原字节、2 HMAC/CLI双视口10断言与最终CI实际727/727 exit0；445→439的未执行harness排除及两旧FAIL保留。仅包/source/隔离fixture；starter链接已安装普通依赖，CLI为隔离HTML/JS，新11未安装，无Native/R |
| E-DIAGNOSTIC-PACKED-11 | 实际tgz Host/Runtime能力版本诊断4/4 PASS | 从3046e499归档解包真实JS，缺版本Provider0拒绝、合法版本一次分发控制，source guard零差异；服务/lease/tools/routes清理，不代签桌面入口 |
| E-SURFACE-10 | 原生候选客户端164项关联检查及最终13项专项通过 | 独立候选发现、不挂ToolView也可展示、单frame授权/重复hello单飞、会话晚回/hidden/retire、超时与ready竞争、同view P1/P2及权限拒绝边界；隔离React/契约夹具，非原生桌面 |
| E-V-SURFACE-10 | 独立源码复核四项FIX_VERIFIED，无新遗留发现 | 08:28:05.103Z，重复hello逐消息校验、ready/timeout竞争再对账、同view P1→P2晚回执隔离、旧handler退役原grant；仅AI独立源码审查，未操作Runtime/桌面，无人类发布签名 |
| E-VISUAL-10 | candidate.10生产React视觉fixture复验26条PASS | 合成API、business/model调用0；结果machine JSON与旧26条字节摘要相同，新运行日志/冻结证据另存，不冒充桌面验收 |
| E-TYPE | TypeScript `--noEmit` PASS | 类型检查；不能证明宿主实际装配。正常日志为空，须结合命令退出成功记录 |
| E-PACK | SDK JS/声明、starter、独立创作 CLI PASS | 仓库外调用包内 Node ESM；v1 子路径兼容。starter 检查链接现有普通 React/ReactDOM/esbuild，未声称干净机器联网安装通过 |
| E-SOURCE | 真实构建、冻结 v2 预览 PASS | 同一 build 的 420/1040 两视口，各有握手/可见/布局/点击/输入五项断言，共 10 项；实际 PNG 与签名报告保留。隔离 fixture，非外部模型创作 |
| E-SMOKE | 包内 Runtime 与 5 项只读 HTTP PASS | 包 hash、Runtime candidate.5/schema4、26 旧工具目录核对；未安装桌面；隔离 smoke 的 Hallmark 后端 unavailable |
| E-PACK-9 / E-SOURCE-9 | candidate.9 SDK JS/声明、starter、包内实际 CLI 构建和双视口交互 PASS | 仓库外调用冻结包；同一 build 的420/1040各五项断言，共10项、实际PNG；隔离fixture，非原外部模型创作 |
| E-SMOKE-9 | candidate.9 生成 Runtime、5项只读 HTTP PASS | Runtime candidate.7/schema4、归档和产物 hash 核对；mutation=0，未安装桌面，不代签真实业务 |
| E-PACK-10 / E-SOURCE-10 | candidate.10包内SDK JS/声明、generator/starter、独立CLI实际构建与420/1040双视口10断言PASS | 仓库外调用解包JS，实际PNG与签名报告；starter链接现有普通依赖、独立CLI使用Node内建/无依赖夹具。干净机器正常starter依赖安装NOT_RUN；非原外部模型/桌面验收 |
| E-SMOKE-10 | candidate.10归档内Runtime与5GET/0mutation PASS | Runtime仍candidate.7/schema4、JS摘要不变；独立profile/process，原业务服务未改；隔离Hallmark unavailable不代表实际已运行源，未安装DSH |
| E-INSTALL-PLAN-11 | candidate.11私有版本固定官方CLI适配计划ValidateOnly PASS；installed=false | 10:25:22.955 UTC，原安装10、desktopRunning=true；保留同名替换/退出守卫/路径/备份/hash检查。公开安装器固定10/Runtime7，换manifest不能安装11；公开脚本及143冻结输入未改，无桌面/Runtime停止或新安装 |
| E-INSTALL-PLAN-10 | candidate.10官方同名覆盖ValidateOnly PASS；installed=false | 原安装9、desktopRunning=true、DSH0.2.0-rc.2；已请求用户正常退出。此证据只核对计划/包/原插件，不代签9→10安装或新内存版本 |
| E-PRESTOP-10 | 桌面完全退出后核实旧任务Runtime并停止 | 08:41:55.927Z桌面进程0，旧Runtime38844/36994身份核对；Windows Stop-Process，非graceful SIGTERM，不声称优雅退出 |
| E-BACKUP-FAIL-10 / E-BACKUP-HOLD-10 | 首轮备份创建前失败；中间apply保留HOLD、非最终备份 | 首轮误扫描preview-fixture-dataset，目录/报告均未创建且源DB未改；中间apply后独立复核发现JSON显示路径碰撞，原报告/目录原样保留，不作为最终安装前备份 |
| E-BACKUP-FIX-22 | 独立工具22回归/加强碰撞单项1/类型检查通过，源码复核PASS | 最终采用真实binding对象WeakSet身份；仅识别已有执行上下文里的未命名空间本地preview input标签。DB/签名report/typed refs/嵌套payload/含冒号namespace严格缺失拒绝。历史report无input digest，识别归档输入不能证明当时preview输入字节；不在10的143打包输入内、包未重打 |
| E-BACKUP-PRE-10 | 最终新目标完整备份apply/verify通过：1754文件/25集合 | `runtime-backup:572c46b04b9f624b752f8c07532e099bc6ba8bc48049e9d86cef9258d9f1cb4f`，`artifacts/apps-a2-bill-backup-pre-candidate10-reviewed`；包含当时2草稿/9attempt/6publication。新根restore及源码引用/重建见E-RESTORE-10/E-RESTORED-SOURCE-10/E-REBUILD-10，旧284/294备份历史保留 |
| E-INSTALL-10 / E-LIVE-10 | 官方同名9→10覆盖、安装文件/Runtime健康核对、正常重开 | 08:52:03Z安装；五hash匹配/143源输入零差异。08:52:27Z实际Runtime7/schema4、3 Provider/Hallmark健康，3GET/0mutation；08:52:34Z正常重开。新Runtime62564为36994唯一listener、旧38844已退，profile/dataDirectory未再切；原生内存身份/GUI/新authoring仍PENDING |
| E-OLD-RECOVERY-10 | 实际重启后只读旧candidate.9最后publication状态 | 08:53:13.779Z：interrupted、pending=null、active/lastGood=null、draft_unpublished；旧失败/源码/图片未覆盖，无mounted、save或新业务写。旧Agent重新发布建议不代签验收 |
| E-CONFIG | 相关 57/57 PASS | FIXTURE+CLOCK_CONTROL，含 7 个连接与 7 个 worker 新用例；排空、缓存代际、独立绑定、错过计划、重启、时区/DST；真实业务调用 0 |
| E-V-57 | 独立 V 复核 57/57 PASS | 40 项创作/证据/迁移/备份 + 17 项配置/worker/扩展/descriptor，FIXTURE 与隔离 SOURCE_EXEC；未代签 LIVE_HOST/LIVE_MODEL |
| E-INSTALL-PLAN | 官方覆盖安装方案 ValidateOnly PASS | 包/hash/版本/原同名插件与回退方案；仅为安装前计划检查，实际安装另记 E-INSTALL-7 |
| E-INSTALL-7 | 原同名插件经官方 CLI 实际覆盖安装 | 2026-10-07T07:11:25Z；Host/Client/Runtime/build CLI/preview CLI 五项 hash 匹配 candidate.7；旧包/配置私有备份校验；桌面重开另记 E-ENTRY-LIVE |
| E-INSTALL-9 / E-LIVE-9 | 官方CLI原同名7→9实际覆盖安装、安装文件与实际Runtime/健康核对 | 07:40:25Z安装；五项hash匹配且sourceInputMismatches=0；07:40:54Z实际Runtime candidate.7/schema4、health/Hallmark ok，三个只读入口200；新唯一writer已核对、旧进程停止，profile/dataDirectory未再次改；07:41:26Z桌面正常重开，原生内存/组件验收仍待实际查询 |
| E-MIGRATE-4 | 实际配置所指的离线 schema3 数据迁到独立 schema4 目标 | 2026-10-07T07:07:57.307Z；原 19 集合计数、116 个资产保留，6 新集合为空；备份校验、源未改变 |
| E-BACKUP-LIVE | 实际 schema4 完整备份及校验通过 | 2026-10-07T07:21:58.739Z；25 类原集合计数、284 个文件；2 项明确可重新生成的工作副本依赖缓存排除记录保留 |
| E-RESTORE-LIVE | 实际完整备份恢复至新根通过 | 2026-10-07T07:22:00.786Z；404 个可信 relocation 映射，原不可变证据字节不变；仅新目录，不覆盖源 |
| E-BACKUP-PRE-9 | 更新candidate.9前实际完整备份 | `runtime-backup:80d7d84c86c586764111768004d3120ac31ea47c8b7f13fcfd7a5b918dce1367`；294文件/25集合，包含当时1草稿/1attempt/8view/431 Provider记录；是新快照，不覆盖旧284文件备份或代签运行恢复 |
| E-BACKUP-17 / E-V-17 | 实施人及独立 V 各执行 17/17 PASS | 受控 node_modules 排除、显式依赖内证据引用拒绝、内部工作副本所有权和恢复映射等；FIXTURE/隔离 SOURCE_EXEC，不代签原 UI/模型 |
| E-ENTRY-LIVE | 实际配置入口、唯一 writer、Runtime 读取与桌面重开 | 2026-10-07T07:22:27Z 后完成入口切换、新 Runtime 启动，旧 writer 已退出、唯一 writer=true；正常重开07:22:57Z。Runtime candidate.5/schema4，三个 Provider ready、renderReadyV1/uiStateV1、health正常；当时原生GUI未验，后续一个原@/只读调用另记 E-NATIVE-READ-7 |
| E-NATIVE-READ-7 | 原生 @、人工手动发送、外部真实模型只读应用调用 | `deepseek-official/deepseek-flash/high`，用户问“可以用这个应用吗”；app.info/ops 成功，首次 stores unavailable、datasets 需澄清，重试 stores 与 collected 成功，结束 07:28:06.289Z；无组件创建/编辑/图像反馈链 |
| E-MODEL-CREATION-9 | 真实原输入@/人工发送→外部Agent创作局部通过，原生挂载失败；turn已结束 | 08:02:52.830Z冻结历史：技能工具1次、begin/record_build各7次、record_preview5次、read_image7次，实际源码/build/双视口预览/反馈修改有记录。08:03:08.861Z只读状态补充为5条failed_mount+1条已过deadline mounting；activeBuildId/lastGoodBuildId=null，无mounted、原输入附加或保存验收。预览附件确认不等于桌面原composer附加；用户要求暂不保存、无业务mutation |
| E-VISUAL-FINDING-9 | 用户实际截图与确认图复核：已安装目录视觉未达要求 | 长空白/技术ID/顶层按钮/二级应用导航等未落实；此项为实际视觉失败发现，尚无修复后桌面成品/验收图，不以fixture或原型效果代签 |
| E-UI-LOCAL | 打包candidate.10前局部生产React视觉整改26条fixture断言/类型检查通过 | 合成API，窄栏280/350/420、错误/空态与原会话范围；fixtureOnly=true、installedDshGuiCovered=false、businessCalls/modelCalls=0，6次mock状态操作不是业务写。旧结果已冻结另存，后续candidate.10复验记E-VISUAL-10；两次均非已安装桌面 |
| E-HEALTH-SOURCE | 108/108 相关测试、类型检查通过 | 实测业务源 health 2.009/3.867 秒超过旧1.5秒；默认探测10秒，失败缓存最多1秒、真实401保持，未增加业务重写。07:34:18Z，隔离源码/Provider 测试，尚非新候选安装验收 |
| E-STOCK-SOURCE / E-V-STOCK-52 | 实施人及独立 V 各52/52相关检查、类型检查 PASS | 07:38:20Z，顶层products与旧兼容形状；严格 offer/SKU/warehouse、嵌套冲突/重复/缺失/错误值拒绝，只inspect不重写。FIXTURE/隔离SOURCE_EXEC，不代签实际原 operation 的最终状态 |
| E-BUSINESS-RUN / E-V-BUSINESS | 本次四个mutation全部succeeded，各独立读回后恢复，流水PASS | 07:42:37.324Z完成；价格54.80→54.79，库存201→200。旧stock-test只inspect原operation成功后恢复，测试未重发；独立V于07:44:37Z核对同run恰好4mutation，各1次dispatchIntent/Source writeRef、HTTP200、succeeded和明确读回。SCRIPT/REAL_BUSINESS，不代签原生UI/模型业务操作或上品 |

真实浏览器 runner 使用独立 headless 进程/profile，没有接管用户桌面。单元测试已清理的临时证据与 E-SOURCE 持久保留材料分开记录，不把已删除的临时文件当最终可访问证据。

以下归档键相对于仓库根目录，在 Git 中被忽略，是本机定位清单而非公共下载链接。

| 编号 | 本机归档键 | SHA-256 |
|---|---|---|
| E-RESTORE-10 | `evidence/apps-a2-20261007/cutover/full-restore-pre-candidate10-reviewed.json` | `6e196f323c27a17bf9b668528750ccad7577b1a438302c8aa8c665bf3d6933c0` |
| E-RESTORED-SOURCE-10 | `evidence/apps-a2-20261007/cutover/restored-source-reference-check-candidate10.json` | `39e6f2c762017fb2a7c1c47b5d25632c7f6ddb53f0c8e5a56a736e424d816094` |
| E-REBUILD-10 | `evidence/apps-a2-20261007/cutover/restored-source-rebuild-candidate10.json` | `6dd7bd586095b44f2dd663d01ccb69a82cdbb66cf7419445c2a76a60835735fd` |
| E-FROZEN-11 / 归档 | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.11.tgz` | `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`；独立新包，最终包检查通过，未安装 |
| E-FROZEN-11 / manifest | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/build-manifest.json` | `7ce77c6ac4ed6a55c67c532676a178cc322b1ab2f0c34eae95c537453c38bd35`；33产物/143输入，旧10manifest不改 |
| E-VERIFICATION-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/candidate11-final-verification.json` | `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`；唯一新最终PASS，旧summary不覆盖 |
| E-V-PACK-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/independent-v-candidate11-32660a68-6b56-418e-a93b-75f1e2d6956a.json` | `01de93d9b0e1938cc9c0c9aa3b01d680ee95f3d80c9220ccb97cf5ec584da72e`；PASS_SCOPED_PACKAGE_REVIEW，仅包/source/隔离fixture |
| E-PREPUSH-11 | `evidence/apps-a2-20261007/cutover/diagnostic-followup-before-push-c104685f-7f74-482a-8b68-815034bbf1ca.json` | `86320d15b1a08207ed162e25cf4b11c9cb32071811bfee67bd8d50fa15aa67eb`；source/table/installed disk完整性，磁盘仍10，不签NativeMemory/R |
| E-INSTALL-PLAN-11 | `evidence/apps-a2-20261007/cutover/candidate11-desktop-plan-1e9f4d72-ad52-4968-a26f-39d10b5c8f81/plan.json` | `83afd3da8b0bd6163db81828d8366fdb5e205d3dac5deb0c1d87a6a711bcb120`；仅ValidateOnly，未安装 |
| E-FULL-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/full-test-final/result.json` | `dcfb79ae693fbb1c6bdd5ec0e36590650fc2955cd7872c9f087c91680d0189f8`；实际727/727、exit0、source pre/post守卫 |
| E-TYPE-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/typecheck/result.json` | `24c56ca9cda1f27677dfd147f117efcc002de92429d347ffd503f23e9ee9a642` |
| E-PACK-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/packed-sdk-cli/result.json` | `383c516936ed5130cff6e986509d6b5ee7f44e67152610b8f728f759b52a6b49` |
| E-SMOKE-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/generated-runtime-smoke.json` | `93e4b22418ad3d8596f982ef1a137917094bfd6ace0fed606507b0ac4b8ff12b`；Node-only Runtime11、5GET/0mutation |
| E-DIAGNOSTIC-PACKED-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/packed-diagnostic/result.json` | `d7cf5a548ffed442650a23cc9c83666eed01c1930351c4fff31f14b21aa91f5e` |
| E-VERIFICATION-11 / 首次wrapper FAIL | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/verification-summary.json` | `74d7136a3ff9bf6a37ff908800053fb67c730bce6457622ff3c202a46e991355`；私有计数parser误判spec输出，原记录保留 |
| E-VERIFICATION-11 / 第二次真实FAIL | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/verification-summary-final.json` | `62025edc3e1d991da0214b619479066795542b9317ee3d780f45ebb071dfc067`；真实726/727，隔离http.test.ts临时目录清理EPERM，原记录保留 |
| E-SOURCE-VERIFY-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/verification-execution-source-manifest.json` | `ebc3a5ac6f14b7ff304a87dca7d36cd9ffaecc3d0e43232d28a0d49803acd6b7`；439实际执行源原字节，排除6份未在npm test执行的独立acceptance.mjs |
| E-FORMAL-003-10 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/TST-003/FIXTURE/result.json` | `59dde334b04485504c44a964182d0235cd0e766c4189c4f130597d8dc9872955` |
| E-FORMAL-004-10 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/TST-004/FIXTURE/result.json` | `41e99475f9eb4ce76a350f0221aa735d7c1aba3e0aa332b07b64c5099d450028` |
| E-FORMAL-011-10-FAIL | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/TST-011/FIXTURE/result.json` | `fe481756fd601570c41f429afce6e3d4352814ce0851c65da6f42fd4027afd1f`；旧10诊断断言FAIL原样保留 |
| E-FORMAL-012-10 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/TST-012/FIXTURE/result.json` | `c9becdb050e2efb64d7a9008cf465d3ae9562e620ebf6d681bbeee01259ca9b9` |
| E-V-CORE-10 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/independent-v-core-contract-20261007-f78d6b8a-3c1a-4c0c-8fd0-6a099a720a76.json` | `d2566bc9cf8c5d1694540384840aee46e87e2d7545b5ad78633115d0b5cde265`；三卡完整FIXTURE通过，011 FAIL |
| E-HARNESS-CORE-10 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6/executed-harness.mjs` | `30733ef5de828c117d0ee1bca94326798a741898d28867c09290f5ba81e97e6b`；旧10实际执行原字节快照，不用后续修改覆盖 |
| E-FORMAL-003-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/TST-003/FIXTURE/result.json` | `d153264dd316ae460db1d5ee90e45a420fec6b79e96239308e86553ba64ef8a8`；新11实际重跑并独立V通过 |
| E-FORMAL-004-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/TST-004/FIXTURE/result.json` | `8e2d14caf630e6799563f0faa813f90bd0a33d5486da00cbef0e0423eaf0464b` |
| E-FORMAL-011-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/TST-011/FIXTURE/result.json` | `49b1283887b77d4aca62f5e2c409d13134c9157b9532ec85f90d797b529156f3`；旧10 FAIL不改写 |
| E-FORMAL-012-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/TST-012/FIXTURE/result.json` | `0af268ac7d292b7341aaec22f0f5bc339745a7846045d4feb44e1af6bd140e53` |
| E-HARNESS-CORE-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/executed-harness.mjs` | `b7fb0c9a91c01f2553f70bbae64229bb3b5eb14e616056f455e1acc32f706c31`；新11实际执行原字节，不混用旧30733快照 |
| E-V-CORE-11 | `evidence/apps-a2-20261007/formal-core-contract/a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2/independent-v-core-contract-candidate11-20261007-745e91e1-d063-41e2-ba4d-25963fe293ae.json` | `150bf9ef8d7495ba07c2a0c79a4e859ab7a877da682731dd9e5ce7c17a928563`；四卡完整FIXTURE通过，旧10元证据保留 |
| E-FORMAL-054 | `evidence/apps-a2-20261007/formal-draft-ledger/a2-draft-ledger-5f7081dd-9633-4f67-b458-cb5938983157/TST-054/FIXTURE/result.json` | `208e3bedc57e7d09ff1ee6a6d820cf679b20dc33d8324029a79801fae254b9e1` |
| E-V-054 | `evidence/apps-a2-20261007/formal-draft-ledger/a2-draft-ledger-5f7081dd-9633-4f67-b458-cb5938983157/independent-v-054-final-2026-10-07T09-56-26-105Z-e2233779-f3a2-40f1-abf2-37cb27d6c0b2.json` | `5c54d5244db84d6a11a232b4b55657d9fe78304c88e2dd9f436a648ee9cef581` |
| E-HARNESS-054 | `test/acceptance/authoring-draft-ledger-a2.mjs` | `5c9772ffafc8dcf6a4bb3b429bfd133589a8b9cf8f9a1dfff1bbf0bc78e25253`；实际执行原字节快照；本轮增量，提交与推送以Git历史和最终交付为准 |
| E-V-054 / 首次补充检查 | `evidence/apps-a2-20261007/formal-draft-ledger/a2-draft-ledger-5f7081dd-9633-4f67-b458-cb5938983157/independent-v-054-2026-10-07T09-55-18-282Z-2ae6ca09-3508-487a-a66b-510b3afbcfa8.json` | `44ff901c9284a7d1d6ff6aa9e2019f350e540d80e6152e6059bfb21045ce52bf`；目录零新增补充检查FAIL保留，最终scope更正已披露SQLite侧文件 |
| E-FORMAL-059 | `evidence/apps-a2-20261007/formal-publication/a2-publication-b03d068e-8c2e-4cf8-843d-a6f9f0afe5a1/TST-059/FIXTURE/result.json` | `348b330f2fc1c0e7c6b5c0390c6c44755f7b9c85bc7c67f700f8daebe12638b6` |
| E-FORMAL-060 | `evidence/apps-a2-20261007/formal-publication/a2-publication-b03d068e-8c2e-4cf8-843d-a6f9f0afe5a1/TST-060/FIXTURE/result.json` | `e5709e948289b5ea31808108f6387eb66cbb6bcb229944615579524ff61a0a11` |
| E-V-059-060 | `evidence/apps-a2-20261007/formal-publication/a2-publication-b03d068e-8c2e-4cf8-843d-a6f9f0afe5a1/independent-v-059-060-2026-10-07T10-04-00-660Z.json` | `007c04f224e649af398e3b8eba898b5a6b2bcaeb54bca96f1746e2edddaa7db2` |
| E-V-059-060 / 旧V | `evidence/apps-a2-20261007/formal-publication/a2-publication-b03d068e-8c2e-4cf8-843d-a6f9f0afe5a1/independent-v-059-060-2026-10-07T10-03-30-529Z.json` | `589fe9cabeec0004518a4a1c77eadac48602dd23b30ea24b32ab9b231baa5cf2`；旧V保留，10:04追加最终复核 |
| E-HARNESS-059-060 | `test/acceptance/authoring-publication-a2.mjs` | `46b44f865b26d57cefff86ec050a2cbd09cd80e398d8b27e69861b23dab068f7`；实际执行原字节；本轮增量，提交与推送以Git历史和最终交付为准 |
| E-DIAGNOSTIC-RED | `evidence/apps-a2-20261007/diagnostic-fix/red-2026-10-07T10-04-18.710Z-a7d1e99b-e023-40ae-86cf-13133e45eb25/result.json` | `c308473397a6ff3a5e47f68a43562c78f0d06edb50c9c41d99f33baa2f72805e`；新4回归预期FAIL揭示诊断缺口 |
| E-DIAGNOSTIC-GREEN | `evidence/apps-a2-20261007/diagnostic-fix/green-2026-10-07T10-04-40.643Z-5beca8d0-a235-4ab7-bcdd-7375db43c1ef/result.json` | `5ccac4df903c2df8096d34f4911284cd72f2774e2feba36571d9618446ab6f13`；10:04新4/4单元回归通过，当时未打包部署、不代签旧011或新候选 |
| E-FORMAL-055-056 | `evidence/apps-a2-20261007/formal-build-archive/a2-build-archive-928cf1f7-7faf-4aba-8bd2-20dbcb2b0065/result.json` | `526af553816f598154e280394b8e523fdf9c372cc4925f54b397baf3761a3527` |
| E-FORMAL-055 | `evidence/apps-a2-20261007/formal-build-archive/a2-build-archive-928cf1f7-7faf-4aba-8bd2-20dbcb2b0065/TST-055/FIXTURE+SOURCE_EXEC/result.json` | `8c943f1677a307714c5ddf1ed73310593f88cb7e13251792e367d9d942639349` |
| E-FORMAL-056 | `evidence/apps-a2-20261007/formal-build-archive/a2-build-archive-928cf1f7-7faf-4aba-8bd2-20dbcb2b0065/TST-056/FIXTURE/result.json` | `a1884c1ad921ad4f85aa8862530065ced05975082347d563d8fb9f0ef8ed60fb` |
| E-V-055-056 | `evidence/apps-a2-20261007/formal-build-archive/a2-build-archive-928cf1f7-7faf-4aba-8bd2-20dbcb2b0065/independent-v-055-056-20261007.json` | `3399f37cd0c9997a37bf901f3ee69a73cd2478dd3d672cf802a1b1b8ab023fca` |
| E-FORMAL-MAINT-4 | `evidence/apps-a2-20261007/formal-maintenance/maintenance-2026-10-07T09-30-10-078Z-0ac06523-9797-44d6-9048-035e996f2f6f/summary.json` | `ce415db9eafbe3fe3cc7db27878196257e7f7f845ebd7c03af0f9ac1162024bb` |
| E-FORMAL-MAINT-4 / index | `evidence/apps-a2-20261007/formal-maintenance/maintenance-2026-10-07T09-30-10-078Z-0ac06523-9797-44d6-9048-035e996f2f6f/evidence-index.json` | `d401bbdc154d608b486293383bd57e74100e4635c4218ee89562ee965c7f6c08` |
| E-V-MAINT-4 | `evidence/apps-a2-20261007/formal-maintenance/maintenance-2026-10-07T09-30-10-078Z-0ac06523-9797-44d6-9048-035e996f2f6f/independent-v-073-075-076-077-20261007.json` | `16be548e7c95769608d38bb27221826fbe7ebd98fc858f67a8782f6c43629502` |
| E-FORMAL-057 | `evidence/apps-a2-20261007/formal-preview/final-index-612ea9b7-85e7-4fba-9607-e4d67baf7b18.json` | `e4dcba2b2f71cc7a16f1c6d3273e8234c64f57189c8fb1d69c48199d80c46867`；原I索引中的V pending保留，实际V追加见下 |
| E-V-057 | `evidence/apps-a2-20261007/formal-preview/V-source-preview-final-20261007-0938.json` | `9b0f3040fe868e0927cd185bc3505fc18db13ebc96b6b69a81aaa8a4c6c0e26e` |
| E-RELEASE-EVIDENCE | `scripts/verify-a2-release-evidence.mjs` | `c484ff4f3ce696e7210e3f3e7e5d0675dc3951a1bc61249e13c6a71bc5539795`；仓库独立工具，非包内CLI |
| E-FULL-1 | `evidence/apps-a2-20261007/verification/full-test-1.txt` | `4067693b390eaab4493580cb85f8aad1d612b166547e633bc6d110c99283261d` |
| E-FULL-2 | `evidence/apps-a2-20261007/verification/full-test-2.txt` | `4f5fba163fc1d12f6a78a41a923b09b48b8d69ccdea010e30211a155880759f9` |
| E-FULL-3 | `evidence/apps-a2-20261007/verification/full-test-3.txt` | `90fd63d2e5e101d43962975dbf5912dd13748c6400acf2e33246c8b75b7f1743` |
| E-FULL-4 | `evidence/apps-a2-20261007/verification/full-test-4.txt` | `39d6b014e3c747c244add7479914dbc1aa6ab3f03171faac983aff23176cd09d` |
| E-FROZEN-10 | `evidence/apps-a2-20261007/verification/frozen-candidate10.json` | `0f872ef2ecf938cf27da25fb689d9489c3f8fc1cadbc0d227198f6ee5bd15ea9` |
| E-FULL-10 | `evidence/apps-a2-20261007/verification/full-test-candidate10.txt` | `ef74176f206450735da87676d013cedf13c008d785eb7094d141e9718ce5b28b` |
| E-TYPE-10 | `evidence/apps-a2-20261007/verification/typecheck-candidate10.txt` | `c720644252837bbcbf69f6eeb17238063da4de0dfc735c409c0e9f4ea690c36d`；空类型日志摘要相同，实际命令/成功身份见冻结证据 |
| E-VISUAL-10 | `evidence/apps-a2-20261007/verification/visual-candidate10.txt` | `5deb571124d600ed5a8c7f099fac1ad9d00cc56a7baa0621cb891fc731b0bec3` |
| E-VISUAL-10 / machine | `test/browser/apps-visual-artifacts/results.json` | `d298019e6be3aadea2199c727dbda28308cfdedaeb04cefc44330df04cfa35c4`；当前26条复验结果与旧结果字节相同，运行身份由新日志区分 |
| E-PACK-10 / E-SOURCE-10 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.10/sdk-package-fixture.json` | `cf5929a7913a5473ed6b582e8656636c424aeb5deec3b0b0208230b1505fd22b` |
| E-SMOKE-10 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.10/generated-runtime-smoke.json` | `81b9c1c11cbd43a9de8386b71733f251192b321d54802e0652849eec3b02b99a` |
| E-INSTALL-PLAN-10 | `evidence/apps-a2-20261007/verification/install-candidate10-validation.txt` | `0d04b304b9a393ee20508769c75553a1db78c771645f552cdcd14605e0d41144` |
| E-V-SURFACE-10 | `evidence/apps-a2-20261007/verification/native-surface-review-candidate10.json` | `ecae4b942b14cf56cd5fd5e01f6f17a1564ab873396f08046ab0b38a09fe26b4` |
| E-PRESTOP-10 | `evidence/apps-a2-20261007/cutover/candidate10-prestop.json` | `524ac5463c1e6af8aab989c83952d928e3b77f035e05dfe876ecaa7b49cf4d04` |
| E-BACKUP-FAIL-10 | `evidence/apps-a2-20261007/cutover/full-backup-pre-candidate10-initial-failure.json` | `cd11da12c2c75a3e3da62b4614e28fb029905041b5873b9d58385f86c43e81e0` |
| E-BACKUP-HOLD-10 / report | `evidence/apps-a2-20261007/cutover/full-backup-pre-candidate10.json` | `fc8d347d75dce80aabd296cc12c7a9a80a52502dd0dc7e32c0ed3ae748a51e65`；HOLD非最终上线备份 |
| E-BACKUP-HOLD-10 | `evidence/apps-a2-20261007/cutover/backup-candidate10-review-hold.json` | `ce7142d5aeedc580f434bf72cd602a582491dfb2a4398e7910ec09d57b701d74` |
| E-BACKUP-FIX-22 | `evidence/apps-a2-20261007/verification/backup-preview-reference-reviewed.json` | `ead67bc5038ea65236507c8171bdffe41be52bd37abb09e9c923ef046fbdbdba` |
| E-BACKUP-FIX-22 / regression | `evidence/apps-a2-20261007/verification/backup-preview-reference-tests-reviewed.txt` | `42b66d1af76a24c23965547a443d53faedb3901467d57b816074bbb7624ccc07` |
| E-BACKUP-FIX-22 / collision | `evidence/apps-a2-20261007/verification/backup-preview-reference-collision-reviewed.txt` | `7140cf950a77c965a64d9698ed7fab1fd1b3f08f1d7bba2a6335f9de481414b7` |
| E-BACKUP-FIX-22 / type | `evidence/apps-a2-20261007/verification/backup-preview-reference-typecheck-final.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`；结合总结中命令成功记录 |
| E-BACKUP-PRE-10 / apply | `evidence/apps-a2-20261007/cutover/full-backup-pre-candidate10-reviewed.json` | `63d0d8594cb7b10349cc10e911f4303fd5bdbf6f6ab459082fc855ddd1f1404c` |
| E-BACKUP-PRE-10 / verify | `evidence/apps-a2-20261007/cutover/full-backup-pre-candidate10-reviewed-verification.json` | `63d0d8594cb7b10349cc10e911f4303fd5bdbf6f6ab459082fc855ddd1f1404c` |
| E-INSTALL-10 / log | `evidence/apps-a2-20261007/verification/install-candidate10-actual.txt` | `f62cbddd0cdfaeeafdc25c6c89f70c671e7c512973c3a7ea5756c0007b88afbd` |
| E-INSTALL-10 / files | `evidence/apps-a2-20261007/cutover/installed-candidate10-files.json` | `04262e2d823d8c370bd9907556b423ad848dda5dfad43eb5b96fd5b5d49167b1` |
| E-LIVE-10 / Runtime | `evidence/apps-a2-20261007/cutover/live-runtime-candidate10.json` | `d30739cf466f416e9e3d36745fbfd4a9f935481d05646f1cea44e8f761a9ee86` |
| E-LIVE-10 / desktop | `evidence/apps-a2-20261007/cutover/desktop-candidate10-reopened.json` | `7aad7642c48e31c0b96134dfde41d4911d06c34e96f9102a8cd7ac6ef553d6c8` |
| E-LIVE-10 / process | `evidence/apps-a2-20261007/cutover/candidate10-process-check.json` | `e873c9bd201d3f8d3b1bef02b5438f90c295b7bcb582daae2cf8e74f6840fa08` |
| E-OLD-RECOVERY-10 | `evidence/apps-a2-20261007/cutover/candidate10-old-publication-after-restart.json` | `7a23fc24e9cd829a72e88cc4eae0d83c6bf4536961579dcb1f0251994f0d0523` |
| E-TYPE-9 | `evidence/apps-a2-20261007/verification/typecheck-candidate9.txt` | `c720644252837bbcbf69f6eeb17238063da4de0dfc735c409c0e9f4ea690c36d`；命令退出成功，日志仅为类型检查范围 |
| E-PACK-9 / E-SOURCE-9 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.9/sdk-package-fixture.json` | `168f30c7dc9f2df8a9b067918130bbce43201d1243f5cc48fff40f080726de0f` |
| E-SMOKE-9 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.9/generated-runtime-smoke.json` | `76a518ac4ec7a23f49ffdb0851de0bf1660c89ff05c434cf0cea4b8a3995fe25` |
| E-INSTALL-9 | `evidence/apps-a2-20261007/cutover/installed-candidate9-files.json` | `419e6886db868eab9f9b8dc0aab1a4a163fba8d5e5e91171b481319cebb6c89b` |
| E-LIVE-9 / Runtime | `evidence/apps-a2-20261007/cutover/live-runtime-candidate9.json` | `0d0a61ca91d00080e1715e3c0098e52cbd9480cd55088c8ce47ec44740bd25ad` |
| E-LIVE-9 / desktop | `evidence/apps-a2-20261007/cutover/desktop-candidate9-reopened.json` | `c45e2bbc4e808496cb79e517f0cb407970b2da1cda32c04d029b062a71d75124` |
| E-BACKUP-PRE-9 | `evidence/apps-a2-20261007/cutover/full-backup-pre-candidate9.json` | `85c308bf836ddd040d728fb5c8df9ddcf77143d2150d4d115e345735e4932159` |
| E-PACK / E-SOURCE | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.7/sdk-package-fixture.json` | `7bcfc8a8a0ae324b3a806f760d6649e3ac761ae7ff71ae2de0314ec6ec39966a` |
| E-SMOKE | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.7/generated-runtime-smoke.json` | `6aade84c3076321d581156aeeaac5c48bedf3b2734457916807ffc0a13bd00b0` |
| E-CONFIG | `evidence/apps-a2-20261007/runtime-refresh-config/final-scope.json` | `3cd291df4850867da9eda2382c6107c1aeeb1c14a2d86b46872fe0e0db48e66c` |
| E-INSTALL-PLAN | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.7/desktop-install-plan.json` | `b1a0e763c7b2e041c0b16093ef70e711c080ce0e7ba07b1919dbc8c8aa5aa7c2` |
| E-MIGRATE-4 | `evidence/apps-a2-20261007/cutover/migration-result.json` | `c84e1bb5c064e3187d992a9ae2030a105df55f1a230667d025d695501599fea3` |
| E-BACKUP-LIVE | `evidence/apps-a2-20261007/cutover/full-backup-actual.json` | `f36697584bbe844fc424413c674d5cb0517bf49f5716d3c01770d3d829d93148` |
| E-RESTORE-LIVE | `evidence/apps-a2-20261007/cutover/full-restore-actual.json` | `c781c05f73aea106f180acc8cb2a7b543494cc5ccf957db3cd1bbe9dc447cc34` |
| E-ENTRY-LIVE / profile | `evidence/apps-a2-20261007/cutover/profile-entry-switch.json` | `ef52484afd58f413714adf7f0ff91f9ca85d5195fe87b6ebff7bcbc8c2bec4fe` |
| E-ENTRY-LIVE / Runtime | `evidence/apps-a2-20261007/cutover/live-runtime-read.json` | `b40ecd8c380824ea60bccf0e4c90eda65225a90a78e70a9736713ee774dbd34a` |
| E-ENTRY-LIVE / writer | `evidence/apps-a2-20261007/cutover/writer-and-entry.json` | `3d410d6ef48adbabd1df35a2d356918cbab9c9ba9bfabd13bbd66e4e26b138fc` |
| E-ENTRY-LIVE / desktop | `evidence/apps-a2-20261007/cutover/desktop-reopened.json` | `b72342ec42e58c34de88992ee99ef874cc4a3a894b058e92d9098e9e676e9aaf` |
| E-BACKUP-17 | `evidence/apps-a2-20261007/verification/backup-workspace-controlled-tests-2.txt` | `8221dc8473fdd0c61e0b467d6648ed32a01b30692e9c9c40268603b6fc751d53` |
| E-NATIVE-READ-7 | `evidence/apps-a2-20261007/desktop-native-read-candidate7.json` | `dd5c725ace05e0555c8d115aa185c983b6e4696f6642bdb6fee743034b1e26fd` |
| E-MODEL-CREATION-9 | `evidence/apps-a2-20261007/desktop-native-creation-candidate9.json` | `9aa1abebd83456ee70198339398c013ce3a1bdce6bbb0fe7209b0d23f48f6049` |
| E-MODEL-CREATION-9 / state | `evidence/apps-a2-20261007/desktop-native-creation-candidate9-state.json` | `8b0d5a3b162a16957ae96c998196cc7f8a9a59294c5d0942d2936a40c73880a8`；只读实际state补充，未执行inspect/expire/write |
| E-MODEL-CREATION-9 / history | `evidence/apps-a2-20261007/desktop-native-creation-candidate9.private.zstd` | `b337aa7f9818e4a3a3afdebd844c4ffb35185060e50ba7e67f8c6512daafc659`；冻结原生历史副本，886285字节 |
| E-UI-LOCAL | `evidence/apps-a2-20261007/verification/apps-visual-local-before-candidate10/results.json` | `d298019e6be3aadea2199c727dbda28308cfdedaeb04cefc44330df04cfa35c4`；打包前冻结的生产React/合成API夹具结果，非已安装桌面 |
| E-HEALTH-SOURCE | `evidence/apps-a2-20261007/verification/health-timeout-fix-source.json` | `d24f6cae043fc8d0ff316e9da0c1722d504678e464db69dc4bfa57d205495a02` |
| E-BUSINESS-RUN | `evidence/apps-a2-20261007/live-bill/business-run.json` | `bca4c122985274ae72bf5ba757ab4f1f9233282b25b07c34ee0c1e08178b7d77`；最终PASS，包含原STOPPED历史 |

E-V-57 来自团队实际运行回报，未另声称公开了原始 V 日志。E-INSTALL-7 为整合执行人实际安装回报，私有安装/回退材料另归档，未以安装方案文件代替安装证据。构建/预览每张 PNG 的摘要由 E-PACK 所引用的签名报告定位。离线迁移身份为 `schema4:35267a5a760adcc958b32239f71f9e2fda0733ef0e362c14e3cf29f8318bd30b`，源 fingerprint 为 `25374357cd0ab32b69997fa7c9520b2eab29ddea1669281f5ee3911ede483b3d`；它们证明迁移来源，不是入口切换凭据。

历史284文件备份ID为 `runtime-backup:c3131e247c1b340297f43e36efd9afad7780e0b5261c77bb3d3048f1a05cc1dd`，当时独立工具摘要为 `de45172149112ee6ff17f3baf57b43eb568b55019c85cf3020032d4917ff31bf`。本轮最终工具 `packages/app-migration/src/runtime-backup.ts` 为 `8b655dc37502725ba878cc01db9cf05d058cf3cd660f76d3c6a2e1a6c26b39d6`，测试 `test/apps-migration/runtime-backup.test.ts` 为 `72a19876f632a892883c6140aba9cebfb1d123e9be0e6018bf2e097579f38d52`；不在candidate.10的143打包源输入中，独立记录22+1检查与新1754文件备份，不改写旧日志或包。

## 本轮新根恢复与完整最低范围验收

最终1754文件/25集合备份已于09:03:29.916 UTC真实恢复到 `artifacts/apps-a2-bill-restore-check-candidate10`，加入2773条可信relocation，源证据未改。随后只读核对6个归档、8份签名构建、6份签名预览、12张PNG、2草稿和44个新根引用均有效，引用核验期间新根1754文件字节未变化；不可变归档/签名报告/PNG保留原字节，恢复数据库另增可信映射。由恢复的Bill不可变归档建立新checkout，正常npm ci、已安装candidate.10 build CLI/SDK实际重建PASS，buildId仍为 `d3a4605b356ce70264fd2597cf25e122cb99c43f3b951977615ba84fc551de6b`，六个原归档未改。该SOURCE_EXEC不启动恢复Runtime、不二次切换桌面dataDirectory，不代签Agent编辑、last-good或native挂载；普通依赖通过仅适用于这份Bill归档及本地React夹具，不证明任意机器starter/file锁路径可迁移。

| 完整验收卡 | 独立V结论与最低scope | 执行与边界 |
|---|---|---|
| TST-003 | PASS_SCOPE_REVIEWED；FIXTURE；candidate.11 | 合成Source真实停HTTP后刷新/重开，原快照stale/time/payload保留、刷新unavailable、Source不改/无新operation；6/6，旧10 PASS保留 |
| TST-004 | PASS_SCOPE_REVIEWED；FIXTURE；candidate.11 | synthetic native gateway、实际生成SDK、component bridge三入口等价/各一次分发；另真实包内AppsClient+预生成Notes wrapper正常/错误各一只读调用；8/8，非桌面入口验收 |
| TST-011 | PASS_SCOPE_REVIEWED；FIXTURE；candidate.11 | 协议/catalog拒绝及新增能力刷新；不支持capabilityVersion在Provider前拒绝并提供requested9.0.0/registered1.0.0诊断；6/6，旧10 5/6 FAIL原样保留 |
| TST-012 | PASS_SCOPE_REVIEWED；FIXTURE；candidate.11 | 缺schema/坏input/query output字段拒绝，mutation坏output保unknown/inspect_only/不显示假成功/只读不重写；6/6，非真实业务写 |
| TST-054 | PASS_SCOPE_REVIEWED；FIXTURE | I 52/52；A/B相同React模板独立草稿，A连续edit revision/epoch 1→2→3，真实TSX exit1与unfinished查询；公开Runtime invocation关联、取消/晚到拒绝和原文件保留，非原Agent/桌面签认 |
| TST-055 | PASS_SCOPE_REVIEWED；FIXTURE+SOURCE_EXEC | 真实子进程/esbuild/输入变化拒绝、签名回执与不可变归档；TST-055 34断言，055/056 root共60断言，非native/模型签认 |
| TST-056 | PASS_SCOPE_REVIEWED；FIXTURE | 20断言；历史/活引用、legacy fixture/tamper/备份恢复，合成ready只建立fixture基线 |
| TST-057 | PASS；SOURCE_EXEC完整最低scope独立V通过 | 普通React依赖、v2/v1/错误major、资源字节及同一冻结React build的fixture/live_readonly；旧HTML/JS仅有效子集 |
| TST-059 | PASS_SCOPE_REVIEWED；FIXTURE | 无preview的B2真实归档拒绝且V0/C1不变；B1签名证据只进入mounting，显式合成ready后才提交；重复publish同结果/零domain新增，保存C1不自动生成版本 |
| TST-060 | PASS_SCOPE_REVIEWED；FIXTURE | a2先提交、延迟a1旧epoch拒绝；同expectedRevision的真实并发请求只允许当前代际publication与一次ready提交；A/B目录独立且owner冲突保留旧候选，未宣称纯revision比较失败或每attempt目录 |
| TST-073 | PASS_SCOPE_REVIEWED；FIXTURE | GC旧计划拒绝、新根25集合/原路径不可用/归档与签名截图恢复；direct-archive headless夹具，不签native或真实切库 |
| TST-075 | PASS_SCOPE_REVIEWED；FIXTURE+CLOCK_CONTROL | worker身份/无UI两数据集/错过计划单飞/重启/disabled/unavailable；原08:24记录按精确源与日志复验，无桌面/真实性能签认 |
| TST-076 | PASS_SCOPE_REVIEWED；FIXTURE | DB权威、排空/CAS/unknown、实际mock A/B请求版本与缓存失效；原生地址显示仍NOT_RUN |
| TST-077 | PASS_SCOPE_REVIEWED；DOC+FIXTURE | 冻结旧48CSV字节、身份/scope/model/版本/篡改/缺失拒绝及不可缩减集合；只审查离线资格，不执行断言或放行发布 |

054最终I run为 `a2-draft-ledger-5f7081dd-9633-4f67-b458-cb5938983157`，产品源码a635ec4、已安装candidate.10真实build CLI/SDK、隔离Runtime60363、NO_MODEL/业务写0。独立V `/root/draft_ledger_independent_v` 完成22项证据交叉检查：315语义引用、307原I索引文件、153执行源码、143包输入、5份HMAC、19 HTTP/18持久invocation，均与原SQL/目录/真实日志吻合；端口60363、构建PID29200/13948和lease已关闭。两个历史I run `a2-draft-ledger-bba3b1c2-fbce-4495-af86-96d6c3a9907c`（锁文件路径ENOENT失败）和 `a2-draft-ledger-bd986bce-73de-4b75-a935-e8bbb9e410c4`（52/52的前版运行）保留，不混作最终执行版本。

V最初的目录零新增补充检查FAIL原样保留：Node DatabaseSync readOnly读取WAL模式隔离库意外生成32768字节SHM和0字节WAL；主DB及307原I文件字节未变，没有SQL/业务写，侧文件未删除。追加scope更正与最终V均保留，不声称全目录无新增；054完整最低FIXTURE通过不提升063、LIVE_HOST或R。059/060完整最低FIXTURE已独立V通过，范围与原生/模型验收分开。

059/060最终I run为 `a2-publication-b03d068e-8c2e-4cf8-843d-a6f9f0afe5a1`，I40/40、执行产品源码a635ec4及安装10真实CLI/SDK。独立V `/root/publication_independent_v` 于10:04:00.659 UTC完成265检查：133文件引用、153源码快照、143包输入、8 build/7 preview签名报告、8候选、15实际CLI、25集合/462观察行/8事务文件、46HTTP，656原I文件字节未变。5个ready确认明确为合成fixture；V仅在新临时DB副本只读查询，副本及派生侧文件已清理，未改原I库。旧10:03 V追加保留；两个旧I run `a2-publication-d9e98da0-ab2b-427f-af96-660a167c4ef2`（锁路径失败）及 `a2-publication-1a186c76-3a52-476d-9505-e4de10aceaae`（前版36断言）均保留，不混用执行身份。

003/004/011/012旧10 I run为 `a2-core-contract-c9d1d175-d193-4eaf-aa08-be6cf62e16b6`，24断言中23PASS/1FAIL；V `/root/core_contract_independent_v` 完成18语义复核、223冻结文件、153执行源码和226引用原字节验证，正式003/004/012完整FIXTURE通过，011诊断缺口FAIL。V于10:03:40.099 UTC核对143输入与10一致，后续10:07:16.631 UTC记录5项源码/版本差异；旧I/V及候选10归档保留，不能称此后当前143输入仍等于10。

当前工作区随后修改 `packages/app-runtime/src/index.ts` 与 `packages/plugin-apps/src/index.ts`，补能力版本错误的requested/registered诊断；新增 `test/apps-host/capability-version-diagnostic.test.ts` 先4 FAIL、10:04局部4/4 PASS，真实red/green字节/日志另存。该修复进入独立candidate.11冻结包，旧candidate.10归档/manifest与已安装桌面不变。新11正式四卡实际重新执行且独立V通过后更新当前记录；旧10三卡PASS、011 FAIL及原V全部保留，其他10卡不自动迁移。新11最终全仓727/727及包检查通过、未安装，无新桌面结果。

candidate.11最终包验证独立记录为 `candidate11-final-verification.json`，SHA `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`。标准全仓最终运行727/727、exit0，未合并Root局部green或首轮stdout凑计数；首轮私有wrapper仅解析TAP而误判spec结果的FAIL、第二轮实际726/727因隔离http.test.ts临时目录清理EPERM失败均原样保留，旧verification-summary-final.json没有覆盖。最终运行在其余包/浏览器smoke结束后独立执行，439实际执行源码与143冻结打包输入前后零差异；这份守卫明确排除6个本阶段未执行的独立acceptance.mjs，实际.test.ts/package/script/config/冻结输入仍在守卫内。新11执行时源身份为a635ec4加冻结未提交诊断/版本变更，包检查及四卡V通过不自动迁移其余旧10卡，不证明原DSH已加载11，R仍未签认。

新11核心I在独立run `a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2` 实际重跑26/26通过，总记录SHA `410a912808f21c7bf0e8cb52b7020c8beab64a472c50fb990f8fd67514481d3d`；V `/root/core_contract_independent_v` 完成21/21语义复核和4/4独立诊断回归，四卡完整最低FIXTURE为PASS_SCOPE_REVIEWED。执行身份为a635ec4工作区快照，保留153源码及脏改patch，harness新b7fb快照与旧30733快照分别归档。实际Runtime source11，冻结11 AppsClient与预生成Notes call43 wrapper另有两只读调用，各一次Provider；10:15:40复核143输入/33产物零差异、226原I文件/4DB及旧10元证据字节保留。没有新11安装、原生/外部模型/真实业务或R签认。

055/056独立V为 `/root/maintenance_acceptance_gap_audit`，09:25:33.860 UTC追加只读复核；维护四卡同一V于09:35:14.745 UTC复核311冻结文件、1165语义引用，只有三处声明的missing/tamper负例，143包源输入零差异。09:30维护run共267断言，独立新增12窄测试/typecheck另记，不加到706包检查。06:29维护summary的四条过期源hash明确剔除且保留，未用中间run替代最终记录。

057独立V `/root/source_acceptance_gap_audit` 于09:36:58.785 UTC核对10份新签名report、377引用零意外错误、5个React carrier/30个HTTP资源manifest与原归档字节一致，实际v2四方法/v1/major3 transcript和单buildId负例通过；41个本地请求、零生产端口调用，关联Chrome/Node已退出。早期wrapper完整源码快照未保留的事实不抹去；React run执行harness为 `2a8ea3192f646b345f58ac5804b6a337788849b25edd2f640746c0604768bbdb`，最终live run为 `bfcb322c890a97c79722947d98c040754028acf104ce1a425550d69a80b8fab1`，不混用执行版本。

057实际live_readonly是本地真实Bill200行快照，fetchedAt=2026-10-07 07:50:12.932 UTC、sourceDataTime=2026-10-06 16:01:20.856 UTC、freshness=unknown；不是新live API查询或桌面展示。fixture八行合成数据与真实快照分开标记。旧HTML757执行只证明HTML/JS子范围。TST-058虽有SOURCE_EXEC负例和旧原Agent部分读图历史，完整LIVE_MODEL/双视口视觉反馈仍NOT_RUN；实际420截图价格/库存逐字换行保留，不能以无溢出断言代签视觉质量。

新增仓库工具 [verify-a2-release-evidence.mjs](../scripts/verify-a2-release-evidence.mjs) 强制CORE51/AUTHORING78/BUSINESS-WRITE52/DATA-CUTOVER53集合，调用者只能增加required卡，不能缩减；核对scope/model/candidate/commit/hash/bytes及重复/非PASS身份。它不执行产品测试、不独立证明断言，releaseApproved恒false，单卡DECLARED_TEST_SET无发布资格。离线用法见 [迁移运行手册](apps-migration-runbook.md)。四范围仍NOT_ACCEPTED，R未签认。

本页源码SHA对应本次实际执行工作区的原始字节，私有源码快照保留该序列化；Git文本行尾由各checkout设置决定。

## 实际角色记录

| 角色 | 实际身份 / 日期 | 确认范围 |
|---|---|---|
| A | Codex `/root/chat_component_architecture`；2026-10-07 15:01:41 +08:00 | CR-01..04 架构语义、创作后端/分发；不含桌面、原模型、业务或切库签认 |
| I | Codex `/root`、`/root/chat_component_architecture`、`/root/host_baseline`、`/root/domain_map`；2026-10-07 | 整合/证据与迁移、创作后端/打包、Host/Client、连接/worker/备份；路径见任务表 |
| V | Codex `/root/authoring_artifact_review`；2026-10-07 06:54:42–06:57:02 UTC | 独立执行 E-V-57 并复核 CR 实现一致性；未发现新 P1/P2，仅限该范围 |
| V 追加 | 同一独立 V；2026-10-07 07:24:55 UTC 完成 | 对备份规则修复执行 E-V-17，17/17 PASS；FIXTURE/隔离 SOURCE_EXEC，无原生 UI/模型签认 |
| V 库存追加 | 同一独立 V；2026-10-07 07:38:20 UTC 完成 | 首版发现嵌套SKU冲突而拒绝 candidate.8；最终严格匹配修复52/52及类型检查通过，FIXTURE/隔离SOURCE_EXEC，未代签真实库存恢复 |
| V 业务追加 | Codex `stock_original_inspection`；2026-10-07 07:44:37 UTC | 只读核实原operation、4次mutation/Source回执、独立价格与指定SKU/仓库库存读回恢复；SCRIPT/REAL_BUSINESS，不代签原生UI/模型操作 |
| V 客户端追加 | Codex `/root/native_candidate_surface/frame_surface_review`；2026-10-07 08:28:05.103 UTC | E-V-SURFACE-10四项修复独立源码复核，无新遗留发现；Runtime/桌面未操作，不代签LIVE_HOST |
| V 备份输入追加 | Codex `/root/backup_preview_reference_fix/preview_backup_scope_review`；2026-10-07 | WeakSet实际binding对象身份与加强匹配的独立fixture碰撞拒绝复核PASS；SOURCE_ONLY，无正式发布签名，不证明历史unsigned input逐字来源 |
| V 核心四卡旧10 | Codex `/root/core_contract_independent_v`；2026-10-07 10:07:16.214 UTC | E-V-CORE-10：003/004/012完整FIXTURE通过、011 FAIL；18语义/223文件/153源码/226引用，10:03基线与10:07后续源码差异分别记录，无native/R |
| V 核心四卡新11 | Codex `/root/core_contract_independent_v`；2026-10-07 10:15:40.541 UTC | E-V-CORE-11：四卡完整最低FIXTURE通过，I26/26、独立语义21/21/诊断4/4；143输入/33产物与226 I文件/4DB及旧10元证据保留，无native/model/R |
| V 新11包追加 | Codex `/root/core_contract_independent_v`；2026-10-07 10:22:29.854 UTC | E-V-PACK-11有限包证据复核通过：143/33/33归档成员/493引用/1058原I文件，2HMAC与CLI双视口10断言/最终CI复核；旧FAIL及未执行harness排除保留，无Native/R |
| V 054追加 | Codex `/root/draft_ledger_independent_v`；2026-10-07 09:56:26.105 UTC | E-V-054完整最低FIXTURE通过，22项原始证据检查；readonly SQLite生成SHM/空WAL的补充FAIL及更正保留，主DB/307原I字节不变；不代签063/native/R |
| V 059/060追加 | Codex `/root/publication_independent_v`；2026-10-07 10:04:00.659 UTC | E-V-059-060完整最低FIXTURE通过，265检查/656原I字节不变；5 ready均合成，无native/model/R，10:03旧V保留 |
| V 055/056追加 | Codex `/root/maintenance_acceptance_gap_audit`；2026-10-07 09:25:33.860 UTC | E-V-055-056两卡完整最低scope通过，60断言/26HTTP trace及源/引用/HMAC只读交叉复核，不代签native/R |
| V 维护四卡追加 | 同一独立V；2026-10-07 09:35:14.745 UTC | E-V-MAINT-4完整最低scope通过，311文件/1165引用、25集合/4归档/4签名核验；073 FIXTURE、075 FIXTURE+CLOCK_CONTROL、076 FIXTURE、077 DOC+FIXTURE |
| V 057追加 | Codex `/root/source_acceptance_gap_audit`；2026-10-07 09:36:58.785 UTC | E-V-057完整SOURCE_EXEC最低scope PASS；10签名/377引用/5React carrier/30资源manifest复核，058仍NOT_RUN，无native/外部模型/人类R签认 |
| R | 未签认 | 四个范围尚未放行；候选包通过不等于生产发布批准 |

以上是实际 AI 执行/复核身份，不是人类签名。I 未代签 R，夹具 V 结果未代签真实环境。

## 未决项与范围结论

| 范围 | 当前结论 | 尚需的实际证据 |
|---|---|---|
| CORE | **NOT_ACCEPTED** | candidate.10已官方同名覆盖/五hash/143源输入/实际Runtime健康/正常重开；076/077最低fixture卡已V通过，003/004/011/012新11完整FIXTURE独立V通过，旧10的011 FAIL保留；新11尚未安装，原生注册/内存身份、原48其余逐卡、卸载零残留/数据保留及080仍待验 |
| AUTHORING | **NOT_ACCEPTED** | 054/055/056/057最低scope V通过；059/060完整FIXTURE独立V通过；9真实源码/预览/读图后挂载失败、旧pub重启interrupted。10新GUI/内存、实际mounted/原输入附加/明确保存/另会话重开仍待人工验收，058完整LIVE_MODEL未完成 |
| BUSINESS-WRITE | **NOT_ACCEPTED** | 本次价格与库存的4个授权写动作/公开状态/独立读回恢复已通过SCRIPT/REAL_BUSINESS范围；上品、原生UI/模型业务操作及完整TST-078范围仍未完成 |
| DATA-CUTOVER | **NOT_ACCEPTED** | 最终1754文件备份新根restore/2773映射/源码签名PNG引用与普通npm ci重建SOURCE_EXEC通过，073最低FIXTURE卡V通过；未再次切桌面profile/dataDirectory，TST-079完整切库/运行历史草稿对账/条件回退仍待验，首失败与中间HOLD保留 |

用户批准价格 **54.80 CNY→读回→恢复54.79**、库存 **201→读回→恢复200**，本次流水四个mutation已完整成功并独立读回恢复。旧stock-test因顶层products解析遗漏曾pending/STOPPED；首次修复又被独立V发现嵌套SKU冲突而拒绝candidate.8，历史保留。最终严格offer/SKU/warehouse唯一匹配修复各52/52通过，`packages/core/src/write.ts`摘要为 `a166f50b9b407dc219518097930a204a6f402613857266c9a1bdbf47591e4e38`，测试见 `test/core/stock-readback.test.ts`。安装9后07:41:40Z只inspect原stock-test确认succeeded，独立registered查询确认201；新恢复操作完成后07:42:37Z确认200。原测试未重发；上品输入/动作另验。

用户截图的不可用提示已定位为真实业务源health超过旧1.5秒期限；Agent探测4180为旧服务查询，不是Apps自动fallback。修复默认10秒/短失败缓存、真实401/不重写边界后，candidate.9实际业务源健康读取ok。candidate.7原生技能目录列出hallmark-component-design及新描述，但无该turn读取SKILL/组件创作证据；后续candidate.9真实创作turn及原生历史已冻结，技能工具、普通源码/实际build/preview和read_image反馈修改有证据，正式发布没有mounted。主证据最初误选status字段而未列state，已以独立只读补充纠正；最后mounting行已超过deadline，不视为就绪。历史失败保留，后续新候选不得改写为旧请求成功。

截至2026-10-07 09:51:44.607 UTC，原session-401dbe36-127b-4432-beae-fbd16e0fb8f2只读观察仍为1186rows、886368bytes、零新human消息，最新model turn仍为07:57旧terminal。原会话手动继续待用户操作，不自动发送或声明新Agent通过。

candidate.9目录视觉与原生挂载失败保留，**VISUAL未验收**。局部重排/候选展示修复的candidate.10现已官方同名覆盖并正常重开，冻结706全仓/26视觉fixture/13专项/实际CLI双视口范围不变。新GUI/原生内存身份及实际mounted仍待用户在原会话手动继续；磁盘匹配/重开不代签视觉，旧Agent建议或runner截图不代签挂载。

实际备份首次因旧外部工作副本 node_modules 的 SDK junction 安全拒绝，原失败保留。修复限定可重新生成依赖缓存排除、manifest 记录和负例后，17 项检查、全仓 655 项及现场完整备份/恢复通过；不可变归档/证据的严格清单未放宽。恢复保留原 source/lock，file SDK 的相对锁路径在新根可能不适用；此时进入显式新 attempt，核实 SDK 定位后 npm install 生成新锁/输入 digest 并真实重建，不改旧回执。通常锁文件可复用时才使用 npm ci。

Client 丢响应原请求缓存可跨组件卸载/重开保留，但整页/浏览器进程重载后未承诺自动恢复；Runtime 原 invocation 持久可查。未知结果只读检查原身份，不生成新请求盲目重写。

后续执行追加 runId/scope/执行 commit/包 hash/断言/原始证据，并更新可变表。范围内强制项全部满足 [A.2 验收手册](requirements/A2/docs/03_ACCEPTANCE.md)后，才推进对应任务和范围的正式通过。
