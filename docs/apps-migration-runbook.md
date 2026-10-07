# Apps 数据升级、备份、回退与清理

正式验收为**33 PASS/0 FAIL/47 NOT_RUN**：034/035/036/039绑定12，037/038的完整最低FIXTURE/actual-command绑定14，旧12被阻断的历史保留。candidate.15已官方12→15覆盖安装，包778/778与144输入/33产物冻结；独立安装33/源144/核心9774两遍零差异，实际Runtime15/schema4/四GET/健康与原会话前缀核实，启动包装exit1保留。下文持久准入/回退守卫来自14已冻结源码，15仅版本元数据和安装器5项源输入变化；不把14正式卡迁到15，也不代签真实切库、Native、R或四门禁。

## A.2：离线检查与工具身份

当前[install-desktop-apps.ps1](../scripts/install-desktop-apps.ps1)从明确传入的 `-PackageManifestPath` 读取candidate身份；省略时只使用源码Bundle版本对应的manifest。替换前核对schema4、Bundle/Host/Runtime相同版本、归档SHA、packed身份及全部33项tar成员的二进制SHA，拒绝错版本/多余成员/修改字节；安装后再次核对磁盘33项产物。`-ValidateOnly`仅检查，不停止桌面或安装；实际替换仍由官方desktop profile插件管理器执行并保留原包/配置回退备份。此次已官方12→15覆盖；该脚本不停止Runtime、不迁移app.db、不代签原生内存或现场切库。历史固定12/10安装器快照保留，详情见[执行记录](apps-a2-execution.md)。

先核对明确manifest的官方安装计划；此命令不停止/安装桌面：

```powershell
.\scripts\install-desktop-apps.ps1 -PackageManifestPath "evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/package-manifest.json" -ValidateOnly
```

命令从核实过源码/版本的本仓库根目录执行，Node须支持node:sqlite与原生TypeScript。安装包build/preview CLI使用Host guidance返回的Node方式；本页的 `migrate-apps-schema4.mjs`、`backup-apps.mjs` 是**仓库维护工具**。完整备份模块/CLI不在candidate.10的143打包sourceInputs或安装入口，须独立记源码/hash/日志，不能拼接不存在的已安装lib备份命令。

操作前确认实际 schema、源数据/资产根、新目标路径、连接版本和当前进程。冻结源入口并停止所有 Runtime writer，等待实际执行排空；对 queued/dispatching/pending/unknown 按原 operationId/taskId/requestId 只读核实。未决结果不能靠重发写入或删除记录“解决”。优先正常退出官方桌面，再执行官方同名插件更新；本次用户已授权受控停止/重启，若无app.quit端点且Native工具关闭，须核实任务进程、保存完成会话/配置并停写冷备后受控停止，不将Stop-Process记为正常退出验收。不要凭旧 URL 假定服务停止。

`--offline-confirmed` / `--offline` 是操作者明确的停写声明，不会停止进程、屏蔽入口或保证所有业务网络写入都已停。writer lease 还须核对 PID/进程/监听；遇到残留先查所有者，不能删除 lease 绕过唯一 writer。源、备份、目标不能重叠；目标必须新目录，失败产物留作诊断，不覆盖或递归清空来重试。

## A.2：schema3→4 独立迁移

下面均为路径示例，须替换成已核实的离线源与全新目标；不要指向原 Hallmark 业务数据库。首次 dry-run：

```powershell
node scripts/migrate-apps-schema4.mjs --source "E:/offline-apps-schema3" --target "E:/new-apps-schema4" --offline-confirmed
```

审阅来源指纹、集合/资产清单、源/目标 schema 和缺失/未知问题；同一离线源 apply：

```powershell
node scripts/migrate-apps-schema4.mjs --source "E:/offline-apps-schema3" --target "E:/new-apps-schema4" --offline-confirmed --apply
```

程序生成一致 SQLite 备份（包含已提交 WAL）和完整资产 manifest，复制到独立目标后事务新增六个 authoring 集合。原 19 个集合、view/history/source 身份保留；旧构建不会凭迁移变成 verified，历史仍 legacy_unverified，不发明 BuildReceipt/PreviewReceipt。保留迁移 ID、源 fingerprint、每集合对账、文件 hash 与源未变校验。正常 Runtime 打开既有 schema3 会拒绝并要求离线升级，不在原库上悄悄执行新 DDL。

schema2 源先执行下方历史 2→3 工具到独立中间目录，再按当前 3→4 工具执行；分别记录两次迁移，不跳过旧 unknown/quarantine 检查。

若必须恢复迁移时的 schema3 备份，只可恢复到另一新目录：

```powershell
node scripts/migrate-apps-schema4.mjs --restore "E:/verified-schema3-backup" --target "E:/new-restored-schema3"
```

该命令恢复格式3，不启动旧代码、不切入口。新库已有数据增量时不能据此恢复旧 writer；先冻结并导出增量，按条件回退程序判断兼容读取/回迁范围。

## A.2：schema4 完整备份、核验与恢复

完整备份与升级备份分开：完整备份保存 schema4 数据、25 类集合、SQLite/WAL 一致状态、源码/dist、历史版本、外部可编辑工作副本、日志、签名构建/预览报告、PNG、UI 状态及 runner key。不能只复制 apps.db 或仅导出 JSON 来宣称可恢复创作链。

```powershell
node scripts/backup-apps.mjs --mode dry-run --source "E:/offline-apps-schema4" --backup "E:/private-backups/apps-schema4-run1" --offline --output "E:/operator/backup-dry-run.json"
node scripts/backup-apps.mjs --mode apply --source "E:/offline-apps-schema4" --backup "E:/private-backups/apps-schema4-run1" --offline --output "E:/operator/backup-applied.json"
node scripts/backup-apps.mjs --mode verify --backup "E:/private-backups/apps-schema4-run1" --output "E:/operator/backup-verified.json"
node scripts/backup-apps.mjs --mode restore --backup "E:/private-backups/apps-schema4-run1" --target "E:/new-restored-schema4" --output "E:/operator/backup-restored.json"
```

dry-run 不代替 apply；verify 不代替运行恢复；restore 只创建新目标，不改源或桌面配置。每个 output 须新文件且位于源/备份/恢复目录之外；命令拒绝覆盖输出。依次检查退出状态和报告，不在前一步失败后继续串行执行下一步。完整 manifest 保留每个文件字节数/hash、集合逻辑指纹与引用；缺图/缺锁/缺归档/缺 key、未知表/外部引用、篡改、路径越界、非受控符号链接或备份期间源变化会拒绝通过。

**依赖缓存排除有边界。** 仅明确识别为可编辑工作副本的 node_modules 可重新生成缓存被排除，不跟随其中 junction/symlink，manifest 列出排除路径和原因。Runtime 内的工作副本须有明确 draft/view 所有权或已认证恢复映射，且位于 component-workspace/restored-workspaces；不是对全 Runtime 的 node_modules 通配忽略。不可变源码归档、dist、回执/截图和其他 Runtime 目录保持严格清单。若持久资产/证据明确引用被排除依赖中的文件，则拒绝备份，不能静默遗漏。

source、dist、package.json 和原锁文件仍保存。原锁/依赖路径适用时恢复后执行 npm ci（或相应包管理器），再新 attempt 构建；不要把“恢复 dist 可读”当成“编辑依赖已安装”。file SDK 的相对锁路径在新根可能失效，不能保证任意恢复目录直接 npm ci 成功：保留原 source/lock，进入显式新 attempt，核实当前 guidance 的 SDK 路径后 npm install 生成新锁、新输入 digest 并真实重建，旧归档/签名回执保持原字节。

恢复会加入哈希锚定的 evidence_relocations，映射原绝对报告、源码工作目录和资产引用到新根；原不可变 JSON/签名报告字节不重写，即使旧目录仍在也使用已验证的新映射。每次访问核对 manifest/hash/映射边界。恢复目录再次备份/恢复保留别名历史；缺失、冲突、篡改映射或未在 manifest 中的引用不猜新路径。

完整备份包含数据库连接配置、service-key、runner 私有签名 key 和业务/会话材料，必须私有保管。对外发布摘要与 hash，不提交备份目录、完整 manifest、PNG 中的真实业务或密钥；恢复不输出 key 内容。

本轮首apply因未签名preview input中的本地dataset标签被误当持久引用，在目录/报告创建前失败；中间apply后独立复核发现JSON显示路径碰撞，原目录/报告保留HOLD，未作为最终备份。最终工具仅按已有执行上下文识别归档输入，以实际binding对象WeakSet身份区分本地未命名空间标签；DB、签名report、typed refs、嵌套payload和所有含冒号namespace仍严格拒绝missing。历史签名report没有input digest，识别归档输入不证明当时逐字preview输入，原JSON/签名/图片不改写。

最终工具摘要 `8b655dc37502725ba878cc01db9cf05d058cf3cd660f76d3c6a2e1a6c26b39d6`，22回归、加强碰撞单项1/1和类型检查通过，独立源码复核PASS。新目标 `artifacts/apps-a2-bill-backup-pre-candidate10-reviewed` apply/verify通过，1754文件/25集合，ID `runtime-backup:572c46b04b9f624b752f8c07532e099bc6ba8bc48049e9d86cef9258d9f1cb4f`；已restore到 `artifacts/apps-a2-bill-restore-check-candidate10`，2773可信映射、6归档/8构建签名/6预览签名/12PNG/2草稿/44新根引用核验通过，引用核验期间新根1754文件字节未变化；不可变归档/签名报告/PNG保留原字节，恢复数据库另增可信映射；恢复归档的新checkout正常npm ci/已安装build CLI/SDK重建通过，原6归档保留。报告摘要见执行页，范围SOURCE_EXEC，未启动恢复Runtime、二次切桌面配置或验收Agent编辑/last-good/native。

实际旧工作副本依赖junction首轮安全拒绝已保留；限定排除规则与显式证据引用负例修复后，实施人/独立V各17/17、当时全仓655/655，实际完整备份/校验/恢复均已通过相应步骤。后续candidate.9另有694/694，不改写旧备份执行版本。备份ID为 `runtime-backup:c3131e247c1b340297f43e36efd9afad7780e0b5261c77bb3d3048f1a05cc1dd`；可核对hash与范围见执行页，不用步骤通过代签DATA-CUTOVER全部断言。

## A.2：唯一 writer、入口切换与条件回退

离线迁移/恢复核对完成后，保存新库rollback baseline，审阅原格式/schema4增量，按[A.2验收范围](requirements/A2/docs/03_ACCEPTANCE.md)记录四范围。maintenance CLI的**数据库检查使用只读schema3/4连接**，不隐式迁移；这不等于所有命令无文件副作用。GC apply取得Runtime writer lease后按真实格式写库/删除获准资产；candidate.14的cutover/rollback还会持久修改目标目录的准入文件，必须先阅读下文。当前15包含该守卫；旧12没有持久准入控制，旧12运行结果不能代签新守卫或现场门禁。

```powershell
node scripts/apps-maintenance.mjs --directory "E:/new-apps-schema4" --mode baseline --output "E:/operator/schema4-rollback-baseline.json"
node scripts/apps-maintenance.mjs --directory "E:/new-apps-schema4" --mode gc --output "E:/operator/schema4-gc-plan.json"
```

**新cutover与rollback会先冻结目标准入。** 工具取得独立cutover-control lease，创建/核对 `cutover-enrollment.json` 并以新临时文件/原子替换写入 `cutover-admission.json` 的 `allowed:false`，随后才读库检查/导出。enrollment保存目标曾参与准入控制的身份；删除decision文件不能令已enroll的目标冷启动放行。缺失、非法、不同目录/数据库/登记身份或拒绝决定会阻止启动，新普通HTTP入口返回503。不要删除这些控制文件、手写allowed:true或删除lease绕过冻结。

以下命令只示范当前源码参数；directory、cutover时间和evidence须替换为已核实的实际值，output必须全新文件：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/new-apps-schema4" --mode cutover --evidence "E:/operator/cutover-evidence.json" --output "E:/operator/cutover-decision-new.json"
node scripts/apps-maintenance.mjs --directory "E:/new-apps-schema4" --mode rollback --baseline "E:/operator/schema4-rollback-baseline.json" --cutover-at "2026-10-07T00:00:00.000Z" --output "E:/operator/rollback-deltas-new.json"
```

cutover evidence严格包含 `oldWriterStopped`、`runtimeWriterCount`、G0..G4的 `gateStates`、`unresolvedOperationIds`、`migrationStatus`；所有值必须来自实际停写/排空/逐卡记录。检查还读取库中queued/dispatching/pending/unknown，不能仅从传入清单删掉未决项。拒绝为exit2并持久保持allowed:false；仅完整检查通过、报告成功写出后才记录允许决定。报告以wx写入，输出碰撞/命令异常不会取消已写冻结；保留失败材料并使用新output，不能把日志中某段allowed:true当最终准入已提交。

rollback在导出前持久冻结新入口，输出分支A/B、未决原operation及操作/资产/绑定/authoring增量；评估后**仍保持冻结**，不自动恢复旧库或打开旧writer。运行中冻结只保留既有operation的 `GET /v1/operations/{id}`、`POST /v1/operations/{id}/inspect` 核实，不允许新业务、直接storage写、创作/配置/调度分发。GET是纯SQL读取；POST inspect可以追加recovery ledger、unknown inspectevents和恢复状态等内部SQLite记录，但只核实原operation，不能重发外部业务或自动补偿，绝不是“冻结后SQLite全零写”。尚未派发的请求在初始入口、完整body读取后、Provider派发和调度边界再次检查；已经在途的工作须按原身份核实并等待实际排空。

CLI不会停止桌面/Runtime/旧业务服务，不证明旧进程已停、不代替drain、唯一writer/平台效果或现场验收。SQLite readOnly只限制SQL写入，WAL库读取可能生成SHM/空WAL侧文件，不承诺目录零新增，须记录并保留原事实。14源码已补decision缺失冷启动、stale lease并发回收单writer、半请求体跨rollback零新增direct storage写及wx碰撞保留冻结边界；窄独立review不是037/038正式I/V或R签认。原12的037报告未控制入口、038导出早于冻结的BLOCKED记录不可改写。

确认目标 Runtime 可由准确安装包读取，配置指向新 dataDirectory/明确 serviceUrl，实际新 Runtime 单 writer；核对旧进程/监听关闭、来源/绑定/组件/history/操作和所有资产，再正常重开官方桌面并读取实际内存 identity。配置切换不是改价/库存/上品的业务验收，scope 分开记录。脚本不会自动代办服务停启或桌面配置修改。

无增量且无未决操作时，依据已验证备份讨论旧格式恢复；有新增 succeeded/unknown、用户资产/保存版本/绑定或 authoring 状态增量时必须导出并停止盲目恢复旧库写入。先使用能读新格式的兼容代码核实数据；恢复旧插件不等于回退 schema，也不能撤销外部业务。维护 baseline/rollback 会比较新增 authoring 摘要和导出范围。

GC 默认 dry-run；attempt/receipt/UI 状态、pending candidate、active/last-good/previous-good、保存历史和外部引用均参与保留。审阅最终绝对路径和同一 plan，停 writer 后才 apply；引用或状态变化、越界、符号链接、过期计划拒绝执行。关闭 view、删除库项与物理 purge 分开，保留仍活的历史/工作副本/源码。

14的037/038完整最低FIXTURE/actual-command已由I/V各31/31和最终V20语义/12377检查复核；独立V另执行captured14 maintenance CLI wx碰撞8/8。freeze先于实际导出SQL的顺序为rename1→SQL2→output22。14正式卡仍绑定d892/144输入/33产物；15包/安装器及实际部署后验另有独立证据，不自动移植该卡。旧12的037入口未控制、038未先冻结的完整V BLOCKED历史保留；上述隔离通过不替代现场停写/drain或TST-079。

## A.2：离线验收证据资格审查

仓库独立工具 [verify-a2-release-evidence.mjs](../scripts/verify-a2-release-evidence.mjs) 的SHA-256为 `c484ff4f3ce696e7210e3f3e7e5d0675dc3951a1bc61249e13c6a71bc5539795`，不在candidate.10安装包中。先准备包含真实卡记录及文件引用的离线manifest，再写全新输出路径：

```powershell
node scripts/verify-a2-release-evidence.mjs --manifest "E:/operator/offline-card-manifest.json" --output "E:/operator/evidence-review-new.json"
```

该工具只核对离线scope/model/candidate/commit/hash/bytes、重复身份/非PASS、旧CSV冻结字节与required集合，不执行测试、不独立证明断言，releaseApproved恒false。STATIC不能代签LIVE_HOST，文件bytes不能代签tokens；输出exit0只表示声明卡集合具备继续复核资格，缺失/冲突/篡改退出2，既有输出拒绝覆盖。DECLARED_TEST_SET单卡/局部集合不是发布资格，命名范围不得用缩小清单规避强制项。

| 命名范围 | 强制最低卡集合 | 当前整体结论 |
|---|---|---|
| CORE | 原48卡+076/077/080，共51 | NOT_ACCEPTED |
| AUTHORING | CORE+049..075，共78 | NOT_ACCEPTED |
| BUSINESS-WRITE | CORE+078，共52 | NOT_ACCEPTED |
| DATA-CUTOVER | CORE+073/079，共53 | NOT_ACCEPTED |

required只允许增加；原48历史CSV仍42项reported remainingReal NOT_RUN，两种获准逐字序列化CRLF `b5b0a728fe4e7d42ed15e7122432ab7e4c6395aaf9a2042adcc61de90382eb92` / LF `5885e2375bc5711a36d90a635647966b27b850ebfe8b7ff0e95a7a342575c779`按选定字节核对，不任意归一化重写历史；A.2派生基线摘要 `f05edf24340f5c9fd904f33ae99dc98f1a0fd31c1ad4d760c95003391e073ceb`。本轮003/004/011/012/013/014/015/017/018/019/020/021/022/023/024/025/026/054/055/056/057/059/060/073/075/076/077二十七卡完整最低scope独立V通过，011旧10基线FAIL原样保留，四张核心卡已在新11真实重跑并独立V通过，当前47卡仍NOT_RUN；维护267断言/独立12窄测试/typecheck和原706包检查分开。073 FIXTURE直接归档浏览器恢复不代签v2/native切库，075/076旧08:24源与trace的复验不发明原执行commit，077资格审查不代签R。详情/实际V身份见 [A.2执行记录](apps-a2-execution.md)。

## A.2 历史验证范围

A.2 Runtime使用schema4；前轮candidate.12已于11:37:55 UTC通过官方管理器覆盖原同名插件；冷备恢复、33项安装产物/143冻结输入与9774核心文件字节不变已核对。首次启动超时并出现EACCES19387，原日志保留；11:44:02 UTC仅重试桌面后启动，11:45:55 UTC核实Runtime12/schema4、四只读HTTP200及Hallmark健康。Host插件内存身份、原生GUI/@/组件挂载仍NOT_RUN，原22张正式PASS仍绑定10/11；新增12五卡另列，不自动迁移。 前轮candidate.10曾通过官方插件管理器覆盖原同名插件并正常重开桌面，五安装hash/143冻结源输入及实际Runtime7/健康/唯一writer核对通过。candidate.7的schema3→4、116资产/原集合保留、284文件/25集合备份、404映射新根恢复，以及更新9前294文件备份均保留原范围；本轮最终严格备份另为1754文件/25集合apply/verify通过。**低层步骤与全部数据切换验收分开记录。** 本轮该备份已恢复新根并完成2773映射、归档/签名/PNG/草稿引用核验及普通npm ci/安装CLI重建（SOURCE_EXEC），未再次切换桌面dataDirectory；GUI/原生内存/新创作、完整历史/草稿对账、附件/条件回退/上品仍待验，见 [A.2执行记录](apps-a2-execution.md)。

08:41:55 UTC桌面完全退出后核实任务所属旧Runtime38844，使用Windows Stop-Process停止，非graceful SIGTERM；完成最终备份后08:52:03 UTC安装10、08:52:34 UTC正常重开。当时新Runtime62564是36994唯一listener，旧38844已退；profile/dataDirectory未再切换。该旧10阶段Runtime JS为 `2264139fc4404a11dbe9fdde00a374b541d1bda1544ef784483bfb6547cc9844`，协议/schema和冻结包未变更；706项包检查不代签之后独立维护工具修复或原生GUI。

5份验收/审查文件和7份说明已推送a635ec4，前轮16文件已推送0824a4a；之后三个API/SDK、Runtime写入边界和模型预算harness及候选12说明已实际推送13f80f2。054/059/060完整FIXTURE已独立V通过（该阶段共27PASS/0FAIL/53NOT_RUN，新12五卡021/022/024/025/026、新11十二卡（核心四卡、013–015、017–020与023）和旧10其他十卡分别绑定）；candidate.11（Bundle/Host/Runtime11、schema4）归档已冻结，最终包检查727/727、类型/实际SDK/CLI/只读smoke及包内诊断通过，包独立V有限复核通过、003/004/011/012新11完整FIXTURE已独立V通过且未部署，003/004/012旧10 FIXTURE已V通过、011旧10 FAIL保留，旧10证据不可自动提升为后续候选；054的V只读SQL检视生成隔离SHM/空WAL的偏差已保留并更正，主DB和307原I文件字节不变，未触及现场或本页1754文件恢复核验结论。

本页先列当前 schema3→4 和 schema4 全量备份命令，后面保留旧 schema2→3 的 V1 历史。不要把旧目标 schema3 命令直接当成 A.2 Runtime 可运行数据。

前轮五卡增量：TST-021/022/024/025/026完整最低FIXTURE/actual-command独立V通过，该阶段27 PASS/0 FAIL/53 NOT_RUN：12五卡、11十二卡、10十卡各保留执行身份。TST-024 I64/64、V125/125及独立回放64/64/exit0已通过；016、Native/@/组件挂载和R未签认。新增script-run、error-contracts、source-view-save三个公开harness不属于143打包输入或既有774项CI glob，candidate.12归档/产物未改，该五卡批次未重打包、重装或重跑全仓CI；后续14新包778项另列。上一轮候选12源码/部署/说明与API/SDK、Runtime写入边界、模型预算harness已实际推送main `13f80f2cb351e979fc410c2b833e37860ceaf32e`；本轮三harness与7份说明增量的提交/推送以Git历史和最终交付为准。

后续12已补profit公共Provider→UI provenance/行展开（2新增/33相关/type通过）与传输/Bridge局部源码回归；同view重开Pane缓存路径已定位、最小修复6项React局部回归/29项相关/type通过，已纳入12冻结包774/774并官方同名安装，桌面retry和四GET/Runtime12检查完成。原22张正式PASS仍绑定10/11；新增12五卡另列，不自动迁移。原Bill会话8轮failed_mount历史保留，源码诊断不证明现场因果。已受控停止桌面/Runtime，首记录脚本裸布尔字面量exit1原样保留；新增恢复不重停/不覆盖旧备份，三冷备2202 Runtime+396桌面Roaming+1原会话共2599文件核对通过，totalBytes原null不改。首次start超时及EACCES保留，exact桌面retry后恢复；原会话1269→1270仅end-seed且旧JSON前缀一致。不记作正式正常退出或数据切库验收，profile/dataDirectory未迁移；用户已授权退出/重启无需重复许可，Native/@/组件挂载仍待用户。

历史桌面安装入口按版本固定：当时公开 [install-desktop-apps.ps1](../scripts/install-desktop-apps.ps1) 已固定candidate.12/Runtime12（SHA cb44b9f74f0ea45ee23e284dba60905150bf40f87c0ea7afef227be242551320），纳入12冻结输入并已用于官方同名覆盖。candidate.11计划时的旧公开脚本固定10/Runtime7（原SHA453c6a…），当时不能仅传入11 manifest安装11，旧冻结输入保留。candidate.11使用固定11版本的私有官方CLI适配计划，保留原同名插件替换、桌面退出守卫、路径/备份/hash检查；10:25:22.955 UTC首计划与10:34:25.585 UTC最新计划均只通过ValidateOnly；最新私有计划校正显示版本标签及固定constants/root，原guard保留，旧1e9计划原样保留。`installed=false`、`desktopRunning=true`，没有停止桌面/Runtime或安装11。candidate.11原安装器快照及143冻结sourceInputs未改；当时12安装器是后续独立版本，不反写旧11证据；计划证据见 [执行记录](apps-a2-execution.md)。

## 历史 V1：schema2→3 迁移与夹具记录

以下保留 Apps V1 的 schema2→3 工具、旧回退/GC 程序与当时证据。文中的“当前”“NOT_RUN”和 schema3 指该历史阶段；本轮 A.2 的实际状态和 schema4 完整备份以上文及执行记录为准。旧工具仍用于明确 schema2 来源，不用作新 schema4 数据的格式降级。

本手册对应 SPEC 的 PROC-MIG-01、PROC-RBK-01，以及 TODO-023/024/025。实现版本为本仓库 Apps V1 候选代码；Node 需要支持 `node:sqlite` 和原生 TypeScript（本次夹具运行版本 v24.12.0）。命令均从 `dsh-hallmark-app` 目录运行。

当前证据来自合成 schema-2 副本，证明迁移、备份、回退判定、GC 和实际 Runtime 组合根的代码行为。真实业务库、Host 安装、外部业务写入与生产切换均为 `NOT_RUN`。夹具通过不表示 G0–G4 或生产发布已获准；实际切换仍要求这些门禁的独立证据。

## 历史 V1：PROC-MIG-01：准备副本并检查

1. 停止旧入口接收新请求和所有旧业务写入。核查未决操作的原始 operationId/taskId/requestId，保留只读回查结果。软件切换不会撤销外部业务。
2. 确定离线源数据库、资产根和一个新的目标目录。此实现要求目标独立于源资产目录，源库保持 schema 2；不能把目标指向原目录或其子目录。
3. 由操作者明确给出旧 Hallmark 后端对应的 connectionId。不能用店铺名、storeId、默认端口推断连接。连接配置文件只包含显式路由，令牌由独立运行配置提供。

示例连接映射（路径和 ID 必须替换为已核实值）：

```json
{
  "appId": "hallmark",
  "connectionId": "verified-backend",
  "displayName": "Verified legacy backend",
  "config": { "baseUrl": "http://127.0.0.1:4173" },
  "configRevision": 1,
  "enabled": true
}
```

只读 dry-run 命令：

```powershell
node scripts/migrate-apps.mjs --source "E:/offline-copy/app.db" --source-directory "E:/offline-copy" --target "E:/apps-candidate" --connection-file "E:/operator/connection.json" --offline-confirmed --report "E:/operator/migration-dry-run.json"
```

`--offline-confirmed` 是停写检查的明确断言，不会替操作者停止旧服务。工具拒绝检测到的源 writer 文件和目标 writer lease；无法通过文件证明旧服务的全部网络写入均已停止，因此仍需实际进程及入口核查。dry-run 不创建目标库、不修改源库。报告为 `needs_migration` 时退出码为 2。

逐表核对 `counts.source = counts.mapped + counts.quarantined`；检查每条 `records` 的源 ID 和目标 ID、26 项 `legacyTools`、`datasetAliases.canonicalBinding`、所有文件 SHA256、`assetErrors` 与 `unresolvedOperationIds`。任何未知工具/连接/记录形状、孤儿入口、无法确认的 view owner 或缺失历史版本均阻止 apply。原记录保留在 Provider 命名空间或完整数据库备份中，报告列出隔离原因，不能把隔离数量写成转换成功。

## 历史 V1：一致备份和离线 apply

完成审阅后，对同一离线副本执行：

```powershell
node scripts/migrate-apps.mjs --source "E:/offline-copy/app.db" --source-directory "E:/offline-copy" --target "E:/apps-candidate" --connection-file "E:/operator/connection.json" --offline-confirmed --apply --report "E:/operator/migration-applied.json"
```

apply 取得目标 `runtime-writer.json` 独占 lease，使用 SQLite backup API 生成一致数据库副本，包含已提交的 WAL 内容；不会仅复制正在打开的主 db 文件。备份位于目标的 `backups/migration-<hash>/`，包含 `app.db`、`export.json`、`manifest.json` 与实际 `assets/`。manifest 为数据库和每个所引用文件记录字节数、SHA256，并核对数据库逻辑指纹。源码工程、dist、历史构建、已存在的预览、spill 文件以及 pending-closures 恢复文件均纳入所引用资产清单。额外恢复文件可通过程序接口 `MigrationOptions.recoveryFiles` 显式传入；CLI 当前自动处理 pending-closures。

`apps.db` 是独立的 schema 3。所有目标集合必须为空；重复执行同一迁移会验证原备份及目标资产后返回原 migrationId，输入发生变化则不能复用已有目标。失败的目标保留供诊断，不会覆盖源库或自动恢复业务写入。重新运行前先审阅失败原因和已有目标状态。

迁移后的源码归档固定为 `source-components/builds/<buildId>/`，与 `composeAppsRuntime`、SourceComponentStore 和 GC 同一根目录。历史普通源码和 dist 可离线打开；保存资产的原字段另存于 Provider 记录，新公共组件/入口/模板使用严格契约。历史保存组件 owner 保持 null；有明确原 owner 的草稿保持原 sessionId；打开保存组件时显式创建新会话草稿，不能自动认领原草稿。

数据入口在同一保存资产中保留原 `legacyBinding` 和 `legacyFieldOrder`，供旧界面回显 query、fieldMap 和原列顺序；执行仍只使用 canonical DatasetBinding。组件入口的 assetId 与 componentId 独立，显式更新历史保存组件会保留原入口 ID、pin/order，不创建第二条入口。

保存组件及历史版本保留原 resolved template 快照为 `legacyTemplate`；原模板删除后，快照仍可用于编辑回显。迁移后的组件、入口和模板先通过当前 shared descriptor 严格 Schema，未知 metadata 或无效公开形状隔离并阻止 apply。

数据身份使用 SPEC 10.3 的 `dataset:v1:<sha256>`，旧 datasetKey 有显式 canonicalBinding 别名。迁移快照标记 stale；原来源时间缺失时 sourceDataTime 保持 null，不能用迁移时间冒充数据时间。原 24h result_sets 和内部任务记录保留原过期信息。迁移历史快照的可选择资源列表为空，刷新得到当前 ResourceRef 后才可进行新的选择操作。

未决旧操作保留原 operationId 并以 unknown/inspect_only 导入，不会重发旧 mutation。内部领域证据和 Runtime 记录使用同一 operationId，原 taskId/requestId 和来源记录可追踪。pending-closures 的会话不重新启用。

## 历史 V1：验证与切换门禁

切换前在隔离目录验证 strict `list_saved`、历史 source/dist/manifest、原快照字段、连接绑定和所有操作映射；不能以组件名称猜测资源匹配。生成真实 G0–G4、唯一 writer 和未决操作核查文件，例如：

```json
{
  "oldWriterStopped": true,
  "runtimeWriterCount": 1,
  "gateStates": { "G0": "VERIFIED", "G1": "VERIFIED", "G2": "VERIFIED", "G3": "VERIFIED", "G4": "VERIFIED" },
  "unresolvedOperationIds": [],
  "migrationStatus": "migrated"
}
```

这些值必须引用真实证据填写；示例不构成放行。门禁检查命令：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode cutover --evidence "E:/operator/cutover-evidence.json" --output "E:/operator/cutover-report.json"
```

工具只判定证据，不启动、停止或切换服务。任何 gate 未验证、旧 writer 未停止、writer 数量不为 1、迁移未验证或存在未解释操作时 `allowed=false`。实际切换记录应附 cutoverAt、候选包版本、schema 版本、connectionId、备份 ID、进程身份及 Runtime identity。

## 历史 V1：PROC-RBK-01：冻结与有条件回退

正式切换前保存基线：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode baseline --output "E:/operator/rollback-baseline.json"
```

回退时先冻结新入口，停止新的业务分发，再导出判定：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode rollback --baseline "E:/operator/rollback-baseline.json" --cutover-at "2026-10-07T00:00:00Z" --output "E:/operator/rollback-report.json"
```

基线比较保留原 ID，覆盖新增操作、保存组件版本、保存资产及绑定变更/删除。所有 maintenance 查询默认使用只读 schema-3 连接。

- 分支 A：没有新增业务/用户资产/绑定，且不存在 queued/dispatching/pending/unknown，才允许依据已验证备份讨论旧格式恢复。仍需核对服务版本和唯一 writer，不会自动恢复旧服务。
- 分支 B：任何新操作、保存或绑定增量都必须导出；一条 succeeded 与一条 unknown 同时存在时，两条记录及成功回执均保留，禁止直接还原旧 app.db 后恢复写入。先只读回查 unknown，优先使用能读取 schema 3 的兼容代码；旧格式接管需另行完成可验证的增量迁移。

报告总是 `freezeRequired=true`、`externalBusinessReversed=false`。没有充分证据时保持冻结；反向业务操作必须经应用显式能力产生新的操作记录。

## 历史 V1：引用 GC 与存储策略

默认仅列出清理计划：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode gc --output "E:/operator/gc-plan.json"
```

默认保留期为 7 天。报告包括候选、字节数和保留原因；引用来自草稿、保存组件及历史、模板/入口、操作/调用/运行记录、Provider 记录、上下文和迁移证据。保存版本不自动过期；时间未知的记录保守保留。当前 apply 范围为无引用构建、旧临时 view、无引用 dataset；磁盘 spill 和其他恢复/诊断文件保守保留，不在本版直接删除。

审阅每个最终绝对路径后，在 Runtime writer 已停止的隔离目录显式执行同一计划：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode gc --plan "E:/operator/gc-plan.json" --apply --output "E:/operator/gc-applied.json"
```

apply 取得独占 lease，验证记录状态摘要与候选引用，拒绝过期计划、路径变化、符号链接和越界目标。无引用 view 的 source 引用解除后，其 build 可在下一次 dry-run 重新评估。操作、历史版本及迁移证据不会被清理。writer lease 残留时应先核查进程，不自动删除 lease 规避唯一 writer。

## 历史 V1：可复现证据

```powershell
$env:APPS_MIGRATION_EVIDENCE_DIR = "E:/project/deepseek_h/dsh-hallmark-app/evidence/apps-v1-20261007/P5"
node --test test/apps-migration/*.test.ts
Remove-Item Env:APPS_MIGRATION_EVIDENCE_DIR
```

测试创建独立临时源库及构建，验证后删除临时夹具；JSON 报告保存计数、映射、哈希、判定和断言结果，报告中的临时文件路径不是发布资产下载路径。测试同时覆盖：11 个旧集合、26 工具映射、历史两版、WAL 一致备份、篡改/孤儿/未知表阻断、关闭意图、可重入、双 writer 阻断、成功与 unknown 两条回退增量，以及 GC 引用保护。实际 composeAppsRuntime 验证 strict 保存目录、历史 source/dist/manifest 与缓存，旧 query/fieldMap/列顺序完整保留；用户显式保存打开的历史版本后，版本递增且保留唯一原入口及 pin/order。

证据目录：`P5/TODO-023/migration/`、`P5/TODO-024/rollback/`、`P5/TODO-025/operations/`。真实源库迁移、真实业务回查、真实 Host 交互、生产服务切换和容量长期观测仍须在对应记录中保留 `NOT_RUN`，不得由夹具报告代签。

`P5/TODO-024/full-rehearsal/` 另记录完整复制环境执行：实际字节复制的 schema-2 数据库、独立旧服务子进程、test supervisor 的唯一 writer 与入口冻结、在途刷新 drain、停机/监听关闭/lease 释放、核查/全资产备份/迁移，以及真正 schema-3 Runtime HTTP 验证和测试端点切换。无增量分支实际恢复备份并启动旧格式副本读取保存组件；有增量分支实际执行一条 succeeded 和一条 unknown，导出两条完整证据、冻结 Runtime，并在数据库打开前阻止旧 writer 恢复。所有业务请求仅指向独立 loopback mock。13 项迁移相关回归通过，生产 G0–G4 判定仍明确不放行。
