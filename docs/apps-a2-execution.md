# Apps A.2 实施与验收记录

本页记录A.2实施与现场执行，以下执行时间为UTC。**candidate.17已官方同名16→17覆盖安装**：812/812、类型/实际SDK与CLI/Runtime/诊断、145输入/33产物冻结；独立包32检查/17负例及官方ValidateOnly通过，20文件源码窄复核闭合。实际Runtime17/schema4、健康/Hallmark、Host监听和原2755行会话前缀核验通过；五份冷备regular files字节相同、内部junction重定位拓扑等价，源变化0。原两次冷备失败与旧16 lib/index.js预存38B漂移诊断保留，编辑者/意图UNKNOWN。正式验收为**35 PASS/0 FAIL/45 NOT_RUN**，原35卡保持10/11/12/14/15绑定，不迁17。Native内存/渲染/原输入/模型/业务/真实切库未验，四门禁NOT_ACCEPTED、R未签。

前轮起始main为 `ef54c46ec0178cb45149af65f0a7c8ceb5d29f51`；candidate.16阶段34文件已本地提交 `614814f34b08b096407825dcc6a7b26a47d1cf02` 并实际推送 `apps-component-display-retry`，远端ref相同；该批main三次InternalServerError保留原命令，当时远端main为 `06595bbd883ad57061d990a8b30691908f62af13`。本次17源码与说明的最终提交/推送以Git历史及交付记录为准。 历史15仅比14增加4份版本元数据及安装器泛化，共5项冻结输入变化；安装器在替换前核对全部33项tar二进制SHA与packed版本，在替换后核对磁盘33项产物。官方12→15覆盖已完成，Runtime15832/schema4与Host端口19387的监听已实际观察；启动包装exit1及observer传输异常保留，实际只读重开核对PASS另列。13全仓green后被独立边界审查阻断、14未安装的历史保留；14正式037/038完整最低V与15独立安装后验均已完成，下表按各自scope列明。

15归档SHA-256为 `0ae72a0fa7f02ea692cf861bc441f0464eb0a248ceddc9cd6f19468a03d29b64`，完整全仓命令记录 `ae6bfcf12b9a6d8a8eb3d0ce642b185698a82e14ce84277bc396f768e1e27aea`、verification-summary `6db8cf8f16e20acea8f588bbb712f9a27e1d47a19c220bc03f0d9fecf836e07d`、final-integrity `fd305d11193f7a75896179092151d5f72a2cd81b38b0a6ae3d3634449ec62650` 各按原实际产物记录；不覆盖14或迁移旧正式卡。

## candidate.17：同预览构建手动打开与失败重开（待验）

用户要求原侧栏手动打开同一成功预览build，并在显示失败后能重新打开。17的UI-only openDisplay/authorizeDisplayFrame/reportDisplayError已实施增量源码；publication继续固定构建/回执/归档，每次明确打开创建独立displayId/generation及新iframe/nonce。显示记录与准备快照在现有provider_records的component_displays/publication_views，保持schema4和原Runtime所有权；原startMount一次性协议保留兼容，在新侧栏路径中搁置，具体参数见[创作流程](source-component-authoring.md)和[ADR-010](apps-architecture-decisions.md)。17已冻结812/812与145输入/33产物并官方16→17覆盖，独立包32/17及源码复核闭合，Runtime健康/历史前缀通过；Native显示待验。

等待点击没有显示计时，不自动开栏。新侧栏直接加载同一成功预览归档，可信16旧归档由Host补协议nonce，Runtime仍严格校验；不为一次显示失败强制重建。准备态资源不能以“尚未mounting”为由拒绝：真实组合Host+Runtime隔离回归复现旧503并修正，原red/green与后续准备态/failed_mount/interrupted夹具各按实际范围保留。重开退役旧grant；旧nonce/frame/generation不能桥接、提交error/ready或导入导出UI状态。

error以phase/code/message写入当前display，Agent从inspect.latestDisplay/displays读诊断，不自动发送聊天。首次真实frame数据读取、React提交和全部required assertion PASS仍是首次展示门槛，不因重开降低。重复ready、已成功构建重开与历史P1显示不新增viewRevision，不覆盖当前活动构建；历史view_revisions快照bindings贯穿资源/数据/ready/UI状态/附加路径，不能给P1源码配P2数据。取消、被取代、无可信回执或权限失效目标拒绝，成功归档与旧失败材料保留；保存仍需明确请求。

前端局部61/61、type/diff实际0和源码/19条fixture引用冻结仅证明生产React/隔离HTTP或ComponentHost范围，actualDesktop/actualRuntime均false。独立V发现的owner变化无需rerender与directUiState旁路两个真实red保留，修复后的独立窄复核已冻结：20源码无新增变化、4项closed/无required open findings；后台兼容和真实Host glue补充均不冒充正式卡。TST-045的五次16失败保留，17完整矩阵正式I/V尚未通过，不提升原35/45、18 REVIEW/6 DOING、四门禁或R。

16阶段34文件实际本地提交614814f34b08b096407825dcc6a7b26a47d1cf02，并已推送apps-component-display-retry分支且远端ref相同；该批main三次InternalServerError未推成，当时远端main为06595bbd883ad57061d990a8b30691908f62af13。不能把分支push成功写成main成功；各旧命令/错误原样保留，17后续交付另记。

| 17准备 / 16分支交付证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-DISPLAY-FRONT-I | `evidence/apps-a2-20261007/manual-display-frontend/freeze-d5210b19-db81-40b6-9acb-6b9b7cacd94b/source-freeze-and-fixture-refs.json` | `64c26300100f681f870699de5be5d49dba4571f52fafbb21dc1c50174233a4a5` |
| E-BRANCH-PUSH-16 | `evidence/apps-a2-20261007/cutover/candidate16-delivery-e378d7c0-5ed8-4d49-9054-3fda357fea92/branch-push-actual-command.json` | `05d96ea343f8a03431616e5a87a2ae92045d23e1051952c53e1cb01489c4d64e` |
| E-DISPLAY-SOURCE-V-17 | `evidence/apps-a2-20261007/manual-display-review/review17-0a6c0313-26c5-40bb-9449-b6091b4a1df4/final-review-8ce2da0b-dbb4-4457-855d-2b6d628289e4.json` | `3eb21f006314fb33f2b54a06ce1007b4c9e965b0c565a4fdbc4d00672df82527` |
| E-PACK-17 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/verification-summary.json` | `e723637cc3fef3e286de0cca1103f7a54f38a40b5cb058bb5e93183926eee870` |
| E-PACK-17 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/verification-actual-command.json` | `4900e6aaf4e81afe80329e2b7ac29be1125186f3e374408c3883452dd09d2562` |
| E-FREEZE-17 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/final-integrity.json` | `b99b289e30a1390b28100c78257fed5e2e08b501f527dae354282c9829e2632e` |
| E-FREEZE-17 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/integrity-actual-command.json` | `49300b8ee3868611481f9369722672a8c212edc6b3999519f48c60396d04fb62` |

17归档SHA-256为 `e5cdbfefe9eab592f7cd733009deacdc215bab909a54cc09dd0128868bb3fa56`；812/812实际命令exit0，145打包输入/33产物与执行期间源码、旧16材料守卫零差异。独立源码复核20文件、4项问题已closed/无required open findings，原red和初期源码仍变化的记录保留。该独立复核使用原tgz内SDK16字节的私有新测试归档，Node renderReady为模拟；不是实际Bill旧归档或Native React显示，真实桌面进程重开恢复也未由三态fixture证明。actualNative/formalAcceptance/billActualArchive均NOT_RUN，不能把“旧SDK兼容fixture”写成“原业务组件原生已显示”。独立包复核与实际17安装已通过相应范围，原生点击仍待验；冻结时installed=false和Native/真实业务NOT_RUN不会因后续操作回写旧摘要。

## 当前17安装、冷备恢复与独立后验

16:09:13冷备v3实际exit0，五份备份覆盖Runtime、desktop userdata、原会话、整个workspace会话目录及实际旧同名插件。regular files字节相同、内部pnpm junction在新备份根重定位后拓扑等价，源变化0；不宣称junction绝对link bytes相同。这是本次私有停写冷备与恢复helper的范围，不能把它当成已打包维护CLI的新行为或完整Native恢复验收。15:52:50原stop-backup因旧遍历守卫拒绝Runtime内部依赖junction实际exit1，16:02:44冷备v2在复制前守卫exit1，两份失败均保留；不是workspace会话链接造成拒绝。

旧16初次独立安装后验曾与16 tar全部33项匹配；17切换前实际旧插件的lib/index.js已有一个prepared条件增加38B，其余32项仍匹配16。该文件mtime记为15:36:02，17官方ValidateOnly前后均观测到该漂移字节；ValidateOnly只证明观测到的38份profile文件前后未变，不能证明旧安装始终等于16 tar。诊断编辑者/意图为UNKNOWN_NOT_INFERRED，不推断改动者或用途；原失败、实际旧插件冷备和官方rollback均保留。

16:09:53官方同名16→17安装actual exit0；16:10:22派生正规化dispatcher启动actual exit0，16:10:51只读重开核验实际Runtime17/schema4、健康/Hallmark、Host监听进程3064及原2755行会话前缀相同。本轮未迁库或新增业务写，回退脚本保存在 `artifacts/desktop-apps-rollbacks/20261007T160950Z-776a1dc538c44dff951775da539bc77a/rollback.ps1`。独立安装后验33产物/145源码/原核心9774文件两遍零差异；最终3251引用、337包索引、352当前文件守卫及113原A.2/841旧证据守卫通过。Native内存/注册/原输入/模型/组件点击渲染、真实业务/切库和R仍未签认；等待用户实际原聊天操作不计为已发送或PASS。

| 17部署 / 独立复核证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-V-PACK-17 | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/package-installer-review.json` | `90c9352591d7a8a2a21a6388ccc8385849087762adcf8c029a6f47745cc53791` |
| E-V-PACK-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/review-actual-command.json` | `e11c6e0a4bf2c3e0256777e4b9247e298aed9eb4d96141424de114f0231df50d` |
| E-V-PACK-17 / official ValidateOnly | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/official-validation-result.json` | `a7d61dfc831092d6ef679b13cf6184905d4c3f057c55d8ee745a7c4fd6fca34b` |
| E-V-PACK-17 / official actual command | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/official-actual-command.json` | `3d76b77d11e5df7bd9bc72fe16c3aa95600a2ae674c19e9ddb6dada95b324a5a` |
| E-COLD-17 / original exit1 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/stop-and-backup-result.json` | `7caa8aedf23eba776112d5158292a27aca2423f7d4fe8938d24a5267455af2e3` |
| E-COLD-17 / v2 guard exit1 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/cold-backup-v2-actual-command.json` | `19c4edeae0878400584af25a74e8560015d5808336b559bd8602a9269f2c8cef` |
| E-COLD-17 / v3 exit0 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/cold-backup-v3-actual-command.json` | `ce673e93b3927d12d3ec2ee5256fa40da86df661cc5ed9cc2cf28ddeb1e512c6` |
| E-COLD-17 / recovery | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/operation/cold-backup-recovery-v3.json` | `3ffb7c494c545815c10ba8bda8a42beb4e0440d85d63d52182d9b1e4663fb7ef` |
| E-SKEW-16 / diagnosis | `evidence/apps-a2-20261007/formal-package-review/installed16-skew-859781c1-a175-4266-8489-ddeb136a576f/diagnostic-result-amended.json` | `25d0e3cf5a4479d7b9b93f7c217288c421d308482fe4afa201949a4dc19ad445` |
| E-INSTALL-17 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/install-recovery-v3-result.json` | `4d6dfe316a6232ec49909209d627a599bf1cb2b7a9a20f635a2780bbd0f0656d` |
| E-START-17 / actual command | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/start4-actual-command.json` | `5bb8503330bd62795240c5bbd3b858bc277325bef08e38b9087820a431d5832c` |
| E-RESTART-17 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/read-only-restart-check-v3.json` | `bb8d18b584bb83a64621357688acdcd010abc9f484579207344092c7658c7c23` |
| E-RESTART-17 / actual command | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/read-only-check-v3-command.json` | `57d226aa538ada6e21631975772803691b23c5eab755d1e1ba962b4a8296835c` |
| E-DISK-17 | `evidence/apps-a2-20261007/formal-package-review/postinstall17-051cc8ef-bfeb-4e6b-ae58-fd942da03a3d/result.json` | `937bfcb673dd393ab146f497c07bc0e49d63200f6bafc62e2ed7cde11871f9d0` |
| E-DISK-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/postinstall17-051cc8ef-bfeb-4e6b-ae58-fd942da03a3d/postinstall-actual-command.json` | `af68a6e25257c5467e4ffce5a5d5459b44d9913af1fb6039d169aa62979b13ce` |
| E-V-FREEZE-17 | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/freeze-result.json` | `c4967500fb09a0d4d633923ac7542ead892b399155ca1ee77cde9dc6278af632` |
| E-V-FREEZE-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/actual-command.json` | `c9273117b5af068be0d04ab83e9658614a9bbdcf063b8b5d344b7c5f647217d6` |
| E-V-FREEZE-17 / closure index | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/closure-index.json` | `bf1d19f9c7a9426276635a0bd4f16a60e290cbbb21a20adbe48508d3794ddbfd` |

## 已验增量与历史16实际安装

| 增量 | 完整最低scope / 实际结果 | 执行身份与边界 |
|---|---|---|
| TST-034 | FIXTURE/actual-command/静态依赖审计；I/V各124/124 | candidate.12，143输入/33产物/4ca9；101注册入口、165HTTP、484SQL。Host有FS/日志/进程端口能力，无SQLite业务事实，不称noFS |
| TST-035 | FIXTURE/actual-command；I/V各40/40、最终V1774/1774 | candidate.12；对象键重排保持dataset，数组/connection/projection变化区分dataset，major/schema拒绝与view/display身份分离 |
| TST-036 / TST-039 | FIXTURE/actual-command；独立V完整最低范围通过 | candidate.12；真实2→3迁移与quarantine、实际React构建/双视口/引用GC；旧037/038完整V被阻断的报告与I事实原样保留 |
| TST-037 / TST-038 | FIXTURE/actual-command；I/V各31/31、V20语义/12377检查/1955引用、30份V SQL副本 | candidate.14，144输入/33产物/d892；037=18、038=8、公共guards=5。独立V追加captured14 CLI输出wx碰撞8/8，不发明为原I31步骤；Native/真实业务/真实现场停写/R未验 |
| TST-046 | 本地FIXTURE/实际命令；I/V各13/13、每轮三入口各30真实样本；V18语义/135811检查/38234引用 | candidate.15、执行commit06595bbd；10000行/1000能力，真实hrtime/HTTP/SQLite/packed SDK，UTF8候选上下文不是token/模型消费，不是现场延迟承诺 |
| TST-047 | 材料/追踪FIXTURE；I及独立回放各204/204、V44/44/48803引用 | candidate.15；48历史路径全部可读，旧33身份与未运行范围保留；6项原source/build身份没有原归档执行hash链，不补原声明或放行四门禁 |
| candidate.15 包/安装器 | 778/778实际exit0、类型/SDK与真实CLI/Runtime/诊断；独立29检查/17负例通过 | 144输入/33产物；14→15仅4份版本元数据与安装器5输入变化，独立包复核未重跑全仓CI、未把14正式卡转15 |
| candidate.15 实际部署与后验 | 官方12→15同名覆盖exit0；实际Runtime15/schema4/四GET/健康/会话前缀核对；磁盘33/源144/核心9774两遍零差异 | 启动包装exit1、observer继承stdio问题与operatorExit=null保留；实际监听/只读重开证据PASS。后验不打开原SQLite、不操作GUI，不代签Native或TST-001整卡 |
| candidate.16 包与静态独立复核 | 801/801、类型/实际SDK及build/preview CLI、Runtime/诊断actual exit0；独立包31检查/17负例、默认与显式ValidateOnly各exit0 | 144输入/33产物；19文件独立源码复核无阻断、ownTestsExecuted=0，仅静态，不计为Native或正式卡V |
| candidate.16 实际部署与后验 | 官方15→16同名覆盖、三冷备核对、实际Runtime16/schema4/健康/四GET/历史前缀通过；33磁盘产物/144源码/9774原核心两遍零差异 | 未迁库/新增业务写；start首轮清单形状错误exit1和派生正规化重开exit0保留。Native内存/原输入/手动点击展示、正常app.quit/卸载与R待验 |

本次正式卡按执行包分布为candidate.10十张、candidate.11十二张、candidate.12九张、candidate.14两张、candidate.15两张，共35张；不拼成candidate.15整套正式验收。旧12的037拒绝报告未控制真实入口、038导出/inspect早于冻结均为BLOCKED，旧I和V不可重写。14持久enrollment/decision、启动/HTTP/body完成/Provider/调度守卫补齐后，独立V验证真实拒绝和恢复边界；冻结rename索引1、第一条导出SQL索引2、输出索引22。I辅助runbook有1项SHA差异，其余176执行源码/config/requirements与V一致，177捕获源、144打包输入/33产物和d892归档独立冻结。原operation GET为纯SQL读；POST inspect可追加恢复账本/事件及原unknown状态，不重发或逆向业务写入，不能称SQLite零写。操作说明见[维护手册](apps-migration-runbook.md)。

## 历史16部署与历史15范围

14:54:09 UTC受控停止/三冷备实际exit0，14:54:31官方同名15→16覆盖exit0，回退备份 `artifacts/desktop-apps-rollbacks/20261007T145428Z-5faffa6da94b4c11a4a29b141ff54dc1` 私有保存。首轮start在launch前因清单singleton被误作array退出1；新派生v2只正规化输入shape，14:55:11实际重开exit0，原失败不覆盖。Runtime PID14488、桌面PID19344与Host监听进程66800实际观察，14:55:19只读重开检查为Runtime16/schema4、四HTTP200和Hallmark健康；冷备1766行原会话历史逐项作为当前1767行前缀保留。本轮未迁移数据目录或新增业务写/保存，受控停止不代签正常app.quit。

| 当时版本域 | candidate.16历史实际状态 | 证据边界 |
|---|---|---|
| Bundle / Host磁盘 | `1.0.0-candidate.16`；33安装产物匹配 | 原同名15→16官方覆盖，插件原生内存/注册仍NOT_RUN |
| Runtime | `1.0.0-candidate.16` / schema4；PID14488 | 四只读HTTP200、Hallmark健康，不代签原生frame |
| 桌面 / Host监听 | DSH `0.2.0-rc.2`；桌面19344 / Host66800 | 实际重开，Native原输入/手动点击/显示与模型闭环待验 |
| 16冻结包 / 后验 | 801/801；144输入 / 33产物；原核心9774两遍零差异 | 31包检查/17负例；289引用/331包索引、55审查子进程退出；原SQLite未打开，GUI未操作 |

后验于14:56:17 UTC通过，独立freeze于14:56:23实际exit0/PID已退出。两次磁盘清单中33安装产物、144源输入和9774原核心文件均一致；最终289引用、331包索引及包/源码守卫通过。静态手动契约独立复核只读19文件，关闭两项P2源码问题且自身未执行测试或Native操作；不能把归档或磁盘后验当成模型调用/用户点击/展示确认或TST-001整卡。该轮TST-045未通过完整故障矩阵独立I/V，五次16失败保留，35/45不变。

| 16部署/复核证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-MANUAL-SOURCE-V | `evidence/apps-a2-20261007/manual-open-lifecycle/independent-review-a5822f6b-e534-4a96-8376-6c801ac59fb8/result.json` | `26b3ce2c7d79ae4334ddb53f6bb998e7f621d9c679b613c930835e66f84c2b53` |
| E-V-PACK-16 | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/package-installer-review.json` | `170e09790dc0d2d0677c9c5a64ac85e6b3590cfd4294097c007de94225c44c3c` |
| E-V-PACK-16 / actual command | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/review-actual-command.json` | `e6f96d622faedbb553743046e7ea83a1d9742f6b7c354e29530eeb8d02faed63` |
| E-V-PACK-16 / official ValidateOnly | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/official-validation-result.json` | `9824784ceba723a2740d7d94010146f3fe442dc8ff860c2b6eb4710ca204c7f7` |
| E-V-PACK-16 / official actual command | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/official-actual-command.json` | `c8d617a0a7a0b3d5653740def40c491c3b01c1ca8b0a9dc23eacb1662facf56d` |
| E-COLD-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/stop-and-backup-result.json` | `b5db08b42e0bdf0bba10ff09595157295baeaddcc338bf7784772243926f20cb` |
| E-INSTALL-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/install-result.json` | `a6b4ced3a43fb73f4fbd7b6b4ef5c831984cfae1d53740f167712c57ba23dc27` |
| E-START-16 / first exit1 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start-actual-command.json` | `7ccbef41de4467fefa8bec6f1ed19560f82359d9373d70e19273c60ecc27219d` |
| E-START-16 / normalized exit0 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start2-actual-command.json` | `50d27cd302fda4baeb2675bc64d86e4266f4adab3dbee9168a50a5515a990a5d` |
| E-START-16 / dispatch | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start-dispatch.json` | `de9a0a1d17b92c580293be8c47edf2d264dc765717ba6634388c8d89569fc90d` |
| E-RESTART-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/read-only-restart-check.json` | `bcc3131df2488812a05344286c8f34f600ca402a3db9f93ecc400a4c9e97446f` |
| E-RESTART-16 / actual command | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/read-only-check-command.json` | `706b5878f55b2986fd7d289710f03e7f1620f36e057a7407dc3832b02054737a` |
| E-DISK-16 | `evidence/apps-a2-20261007/formal-package-review/postinstall16-dd8df5d6-a56e-4bad-8f3a-43589c3b3e07/result.json` | `ec73d920761bd087ad4fdff9d6419cf10a127e9bcbbc9d18f3e200e9f8aadd19` |
| E-V-FREEZE-16 | `evidence/apps-a2-20261007/formal-package-review/freeze16-43ca61cf-790c-4de1-9ae7-57d9a88df4a0/freeze-result.json` | `f41035d61f151d10dd497e78d515d8841b9f1132f4493b2acab39db14674f76a` |
| E-V-FREEZE-16 / actual command | `evidence/apps-a2-20261007/formal-package-review/freeze16-43ca61cf-790c-4de1-9ae7-57d9a88df4a0/actual-command.json` | `4981b0a4fbd2555431e024a6bdd16d898f1206255d012a5e6b3737a9706ad0c0` |

| 版本域 | 历史实际部署candidate.15（当时） | 实际证据 / 未决范围 |
|---|---|---|
| Bundle / Host磁盘 | `1.0.0-candidate.15` | 官方同名12→15；33安装产物匹配，Host端口19387由47036监听；插件原生内存身份仍NOT_RUN |
| Runtime | `1.0.0-candidate.15` / schema4 | PID15832；健康和四只读接口通过，未执行新业务写入 |
| 桌面 / 协议 | DSH `0.2.0-rc.2`；HTTP/catalog `1`、bridge `2.0` | 桌面主进程42636实际重开；Native输入/渲染与模型整链另验 |
| 冻结包 | 778/778；144输入 / 33产物 | 15归档0ae72a0f…，仅包/源码/隔离执行与安装磁盘范围 |

13:14:04–13:14:38 UTC受控停止及冷备命令exit0；13:14:53–13:15:01官方同名安装exit0，原插件/配置回退备份保存在忽略目录 `artifacts/desktop-apps-rollbacks/20261007T131458Z-60985ee33fad41879efb6e894fadf01d`。启动命令实际已写Runtime/桌面启动记录，但observer继承stdio等待close，包装进程被精确停止后exit1；补充start-dispatch报告保留operatorExit=null。13:17:22独立只读检查确认四GET/监听和原1270行历史前缀全部相同，13:20:07独立后验两遍33/144/9774零差异。最后独立freeze又核对185交叉引用、330包索引、472私有文件守卫零差异，56个审查子进程均已退出。此范围不代签正常app.quit、原生注册、卸载、组件显示或现场数据切换。

## 新增046/047验收与手动打开要求

046/047仅按完整最低本地FIXTURE/实际命令范围通过独立V，正式表新增两卡为35 PASS/45 NOT_RUN；原33张PASS的全部825字段、前10列800值、113份冻结A.2输入与原48基线保留。24任务仍18 REVIEW/6 DOING，四门禁NOT_ACCEPTED，R未签认。两份新harness不属于144打包输入；本次结果使用当时冻结candidate.15，不能把后续candidate.16工作树冒充旧执行快照。

TST-046使用20个应用/1000项能力和固定10000条中文数据，direct tools、SDK script、mixed三入口交替各30次，I与V均真实执行90个样本，每组30成功/0失败。I与V分别计算nearest-rank P50/P95，不合并样本：I为678.53/798.30、1101.53/1617.60、1155.86/1637.62 ms；V为711.51/819.24、1153.18/1672.42、1155.79/1758.35 ms。候选模型输入序列化UTF8为23175/8816/17804 bytes；实际查询投影单输出最大392 bytes，并核对16 KiB单输出预算。这里没有模型消费/token量测或加速承诺；含记录HTTP、SQLite和首次冷执行成本，SDK脚本回调/汇总为明确披露的fixture调用代码，不是新增产品执行器。V的135811检查、18语义及38234引用通过；首I失败与私有V相对元数据root错误校正保留，不改旧记录。

TST-047实际逐项读取原48、冻结80和当前80，核对输入/输出、命令退出、版本/scope/断言、可读附件及包字节；I与独立回放各204/204，独立V44/44。执行时原表33 PASS/47 NOT_RUN、48路径全部可读且仅为历史，不自动继承为当前验收。known CSV archive→package-manifest→实际旧包字节只证明现在可读的已知包；055/056/073/075/076/077的原候选/source/build身份保留，`originalArchiveExecutionHashClaim=false`，没有原同祖先归档执行hash链。A.2 §08最低记录字段未要求统一candidateArchive顶层字段，不能以这个附加要求改旧33，也不能给旧记录补原声明。054原V的formalResult与archiveEvidence、059/060原V→父result→cards.recordRef保存真实耦合。未知archive/null候选和提供的hash冲突拒绝；旧candidate/scope不迁移15，资格CLI始终releaseApproved=false。旧reader失败及一次额外统一归档字段审查FAIL保留，新V按原完整最低范围复核并明确材料边界。

用户最新确认：在任何原会话用 `@` 选择应用，Agent实际构建并预览后，在原聊天工具卡提供“打开组件”，由用户手动打开到原侧栏；等待点击不计挂载超时、不自动展开。candidate.17增量将成功预览构建与独立显示尝试分开，UI-only openDisplay/authorizeDisplayFrame/reportDisplayError加载同一归档；失败可明确重新打开，新display/frame/generation退役旧文档，Agent可inspect读取phase/code/message。旧startMount一次性协议保留历史兼容，在新侧栏路径中搁置。candidate.17候选包已冻结：812/812、145输入/33产物及旧16冻结材料守卫零差异，独立20文件源码窄复核闭合；归档SHA-256为 `e5cdbfefe9eab592f7cd733009deacdc215bab909a54cc09dd0128868bb3fa56`。candidate.17已官方同名16→17覆盖安装；独立包32检查/17负例及官方ValidateOnly通过，实际Runtime17/schema4/健康/Hallmark与2755行原历史前缀核验；Native内存/侧栏点击显示仍待验，不将局部源码检查算作正式卡或显示成功。契约见[ADR-010](apps-architecture-decisions.md)和[创作流程](source-component-authoring.md)。

14:08附近candidate.15的原Agent确有真实构建和420/1040预览、8项互动通过，但原publication仍failed_mount，frameInstanceId字段缺省，未证明Native frame显示；用户中央聊天和右栏fallback截图是实际问题，不能归因于用户没有切聊天，也不能把官方mounted事件解释成右栏已经打开。Root随后只inspect原publication，HTTP200、零新发布/业务写；旧失败保留。16采用新的准备/点击流程；安装后需明确开始新attempt并实际构建/预览和手动点击，终态不会复活为成功，原失败不改写。

candidate.16的 `apps.authoring.publish` 将 publication 保持为 `prepared`、attempt 为 `publish_ready`，`mountStartedAt/readyDeadlineAt` 均为空。固定publication GET保留当前已提交view源码，候选只在 `publication.source`。原聊天卡固定所属session/view/publication/attempt/epoch/build身份；Observer只通知，workspace不自动展开。用户点击经Host UI路由调用 `POST /v1/authoring/startMount`，`params` 必须同时提供 `viewId/publicationId/attemptId/attemptEpoch/buildId/expectedViewRevision`。Runtime重验当前代际、view CAS、签名build/preview与归档；首次有效点击才创建15秒期限，重复不续期，终态不复活。该路由不注册成模型能力。真正frame完成授权、数据/状态恢复和React提交后，才确认展示并提升active/last-good。

prepared重启保留，取消或新attempt取代时终结所属prepared候选；旧mounting重启仍interrupted。保存共享路径对存在authoring draft的view选择性执行同一门禁，prepared/mounting或未确认构建不能绕过 `apps.authoring.save_component` 改用通用save保存；无authoring draft的旧static/legacy路径保持原行为。后端首次30/30针对性实际测试的typecheck exit2保留；后续保存门禁38/38与typecheck exit0仅证明源码/本地实际HTTP和隔离Chrome范围。完整包801/801和这些局部结果均不提升TST-045、Native/模型或四门禁；原35张卡仍按原候选绑定，不迁移16。

| 16阶段证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-MANUAL-BACKEND-I | `evidence/apps-a2-20261007/manual-open-lifecycle/implementation-0bb3c163-db41-4e49-8399-159dac8a3ecc/implementation-summary.json` | `55865beb91965f0d5f41591860bda8410c62eb49e1f7d5bf8bce026aa00aa70b` |
| E-MANUAL-SAVE-I | `evidence/apps-a2-20261007/manual-open-lifecycle/generic-save-final-ad939fce-cc5c-46ff-a1af-ff5d90985877/generic-save-summary.json` | `284cc4f94ad0e1cc1ddd68942e3fc489e137869202762c3bed0dfb07fb8e52ad` |
| E-MANUAL-SAVE-I / command | `evidence/apps-a2-20261007/manual-open-lifecycle/generic-save-final-ad939fce-cc5c-46ff-a1af-ff5d90985877/command-result.json` | `d75eb663e7ff510492f4fb03c3bdcfab4f212d565601a96c1bf673d01f072d0e` |
| E-PACK-16 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/verification-summary.json` | `532fd3fd0acb58749143cd95d442b9d9dab416d5e9cd5bca8f9d768a4de54905` |
| E-PACK-16 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/verification-actual-command.json` | `adb7d088199bff1ef54bea5a74268dbcdae212fbcc1c04cb150150a11ad4f753` |
| E-FREEZE-16 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/final-integrity.json` | `46b3957a71ebecdaa1521fd06cea0bc0f170b43130c9d0db3f8ce0e6ff097e84` |
| E-FREEZE-16 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/integrity-actual-command.json` | `976585bc53dd43657d53a9cdf04f71a4887d21107cc6177857a98d571ec983f8` |

16归档 `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.16.tgz` SHA-256为 `ea7d82c42d1a9efc73cc96aa354ff863cd9d513570877dd84d42ac6ea84475c6`；源码144输入和33产物逐项冻结，执行期间源码/旧15材料守卫零差异。包摘要的installed=false、nativeAcceptance/realBusinessAcceptance=NOT_RUN按本次打包范围保留；待后续实际安装和原生记录另列，不回写旧包摘要。

| 证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-I-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/a2-runtime-benchmark-5f29805b-fb2f-4e5d-a385-f2650c3aab39/result.json` | `e08fb076c2fd387193ff1ab15d30ab80035bfd53dca021b9ef5c2aa21af2f8f9` |
| E-FORMAL-046-15 | `evidence/apps-a2-20261007/formal-runtime-benchmark/a2-runtime-benchmark-5f29805b-fb2f-4e5d-a385-f2650c3aab39/TST-046/FIXTURE/result.json` | `f0a7dcdd9cebe095bda642425fac5d1e8601780f6fc097213860f0d13c1a5f9b` |
| E-FREEZE-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/freeze-c63e63bd-b77f-4e5b-87aa-7cdd9fe9cd51/freeze-result.json` | `0f616716f70f8372e66eca2706a12d0d38ac3b8411b03dc6127e23720bb299ca` |
| E-V-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/review-summary-final.json` | `9f6d3a776247ce0cfe03c7a2243567d9cbf73a94e32365e3f3788c0e9000c29b` |
| E-V-046 / command | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/review-stage2-command-result.json` | `fbdd6342089e71c74ffc130142c826ce01aae699b06c80d6136b722a933a73ed` |
| E-V-046 / index | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/final-v-artifact-index.json` | `f4e55afbcc23985612be4b0bc105a446c6b60cbbe31b8afd3db907a7f68aea08` |
| E-HARNESS-046 | `test/acceptance/runtime-benchmark-a2.mjs` | `ed764f964cf0ba9f3f3dc83ddcff7067bd7d55bc28a7eb90112f92b802608e4b` |
| E-I-047 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/result.json` | `440fb5d9de2322ec3c0620d44cf6eff033ea108fe11abfd153fd74bf98170636` |
| E-FORMAL-047-15 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/TST-047/FIXTURE/result.json` | `2d015d2eab324a469dcdda7b575e8dc98b457d1a217bff0b6f8edb73fdf4eca4` |
| E-FREEZE-047 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/artifact-freeze.json` | `467569c6d1523d5116e2f6ee202f977b90ff8a1478e7463a995ca75e8df8f6e6` |
| E-V-047 | `evidence/apps-a2-20261007/formal-release-traceability/independent-v-047-d4b952cb-1727-492a-a549-78e37e801e67/review-summary-final.json` | `1919ab4c4badc40a2208867b54d6cc35bc0c5ddd899a223fe045d7f1d86e9931` |
| E-V-047 / command | `evidence/apps-a2-20261007/formal-release-traceability/independent-v-047-d4b952cb-1727-492a-a549-78e37e801e67/review-actual-command.json` | `6eb7dbac27b5ec04ed981ecff33e535287c8504625a4ff7c5fcd8ec2eb152587` |
| E-HARNESS-047 | `test/acceptance/release-traceability-a2.mjs` | `041e185ca2b7ae613c2cdb1dbe6cd823f458888ba74221583fbd21115bd935c3` |
| E-NATIVE-15 / inspect | `evidence/apps-a2-20261007/native-resume15-4b4d2611-7e1c-409f-8422-d877c4ddd189/publication-inspection.private.json` | `10af8e8ab95355b3b8abef795931ac6642d40f478397ba3900ec0c7f4e5c2943` |
| E-NATIVE-15 / build | `artifacts/apps-a2-bill-runtime-restored/authoring-evidence/build-f6fff6a9-cb89-4632-978a-5e10f5955e63.json` | `96061e7e37e34b8dab8adc37fbd6dc28baafa06cc9e223dafd2f3e87c4969313` |
| E-NATIVE-15 / preview | `artifacts/apps-a2-bill-runtime-restored/authoring-evidence/preview-e91a1573-2df3-44fa-97a8-b4ae3b08da85.json` | `3b8f0d2097f8984d7e329a9b9887ffa5bcdb9d3a4ade780c97d1553ab5cfb953` |
| E-DELIVERY-15 | `evidence/apps-a2-20261007/cutover/candidate15-delivery-c5face90-1ecf-4428-9896-7b10f83d8fe9/delivery-result.json` | `0bd46cb8b79379307dc4c92d30c90e139163f267a208525812a467e87a6d1d7d` |

## 历史候选与输入记录

前轮**candidate.10（Host candidate.10 / Runtime candidate.7 / schema4）已于08:52:03 UTC通过官方插件管理器覆盖原同名插件，08:52:34 UTC正常重开桌面；五项安装文件hash、143个冻结源输入零差异、实际Runtime/三个Provider/Hallmark健康及唯一writer已核对。** Host/Client内存身份、实际GUI视觉与新authoring仍未通过；原Bill会话已有后续turn，挂载结果按最新只读记录另列。包冻结前706/706、类型检查、视觉fixture26条、实际包内CLI双视口10断言和只读smoke通过；独立备份工具另有22回归/加强碰撞单项/typecheck，最终备份1754文件/25集合apply/verify通过。candidate.9真实Agent创作到源码/build/preview/读图迭代但原生挂载失败，旧最后publication重启后interrupted；价格54.80→54.79/库存201→200四个授权写入恢复历史保留，本轮无新业务写或保存。四个范围未整体放行。

逐项进度见 [24项任务](apps-a2-tasks.md)和 [80项对照CSV](apps-a2-progress.csv)。CSV将相关检查与正式TST分开：TST-003/004/011/012/013/014/015/017/018/019/020/021/022/023/024/025/026/054/055/056/057/059/060/073/075/076/077二十七卡完整最低scope已独立V复核，该阶段为27 PASS/0 FAIL/53 NOT_RUN；`formalAcceptanceStatus=PASS`仅指该卡范围。核心四卡003/004/011/012、013–015、017–020及023共十二张PASS绑定candidate.11归档与各自执行源码，另外十张PASS保留candidate.10身份，新增五张PASS绑定candidate.12，不拼成任一候选全套二十七卡验收。旧10的TST-011 FAIL与所有历史证据原样保留。当时实际安装为candidate.12（Bundle/Host磁盘12、实际Runtime12/schema4），原生GUI/插件内存未验；10/9/7历史各按原范围记录，原正式卡不自动迁移12；24任务尚未整体VERIFIED，四门禁NOT_ACCEPTED。

前轮五卡增量：TST-021/022/024/025/026完整最低FIXTURE/actual-command独立V通过，该阶段27 PASS/0 FAIL/53 NOT_RUN：12五卡、11十二卡、10十卡各保留执行身份。TST-024 I64/64、V125/125及独立回放64/64/exit0已通过；016、Native/@/组件挂载和R未签认。新增script-run、error-contracts、source-view-save三个公开harness不属于143打包输入或既有774项CI glob，candidate.12归档/产物未改，该五卡批次未重打包、重装或重跑全仓CI；后续14新包778项另列。上一轮候选12源码/部署/说明与API/SDK、Runtime写入边界、模型预算harness已实际推送main `13f80f2cb351e979fc410c2b833e37860ceaf32e`；本轮三harness与7份说明增量的提交/推送以Git历史和最终交付为准；当时进行中的TST-035未纳入该批；后续完整最低V通过的31卡增量另列。

## 固定输入与版本

用户交付的审计包按原字节保存在 [requirements/A2](requirements/A2/README.md)，归档 SHA-256 为 `30f8a9809dd4a358c24faac4a430701061f0c6e396db5b6bdc24a286407d6ad3`。实施父提交为 `caea8175b5c7507bf942b2e752a7327063bfdd43`。输入中的 TODO、NOT_RUN、reported 状态与原 48 项历史记录均保留，没有反写成本轮通过。

`.gitattributes` 为 `docs/requirements/A2/**` 禁用行尾转换，防止 Windows 检出改变输入字节。提交前已核对113个暂存blob与原工作区副本，差异为零；检查记录SHA-256为 `35c2e9ef5dd3486f616ce535d1e83c996c6f456715e69fd9c407ba4afedce627`，范围仅为Git输入字节保留。

原包检查的范围为DOCUMENT_PACKAGE_ONLY：80需求、24任务、20发现，产品测试零次。570项是父版本基线，655项是candidate.7与当时备份修复快照；candidate.9的694项、candidate.10的706项分别保留。核心实现已推送main提交 `92b094888606db0391e9f06a14c006db8191a1fd`；独立备份修复/前轮说明已推送 `e53fd18a0bedb011db69dd2b87e159c5bb67cf75`；其后5份验收/审查文件（build/archive、preview、maintenance、release gate测试与checker）和7份说明已推送main `a635ec443288218ffe16a189b7aa68600dd21f88`，远端一致。`authoring-draft-ledger-a2.mjs`、`authoring-publication-a2.mjs`、`core-contract-boundaries-a2.mjs`、诊断回归、新11源码及7份说明所在16文件已推送main `0824a4a5ae76300616576c2efa5621a8f0144ca0`；其后 `api-sdk-contracts-a2.mjs`、`runtime-mutation-boundaries-a2.mjs`、`model-budget-a2.mjs` 与candidate12源码/部署/说明已实际推送main `13f80f2cb351e979fc410c2b833e37860ceaf32e`；独立验收harness/测试/说明不属于143打包输入，Runtime/Host诊断源码与3份版本元数据则纳入新11的143冻结输入。054实际产品源码executedCommit=a635ec4，执行harness另存原字节；059/060完整FIXTURE已独立V通过，实际执行仍绑定candidate.10与当时a635ec4原始源码。055/056和057记录executedCommit=e53；075/076原08:24执行commit未记录，09:30对既有源hash/测试trace的复验为verifiedAgainst=e53、reuse=true，不能反写原执行commit。

| 版本域 | 历史部署 candidate.12 | 现场边界 |
|---|---|---|
| Bundle / Host | `1.0.0-candidate.12`（磁盘） | 官方同名10→12覆盖、33产物/143冻结输入匹配；桌面重试启动，插件原生内存/GUI仍NOT_RUN，旧失败历史保留 |
| Runtime | `1.0.0-candidate.12` | PID60284/36994实际identity与四GET200/Hallmark健康；非原生组件创作验收 |
| Apps 数据格式 | schema `4` | 实际源离线迁移、完整备份/新目录恢复及桌面配置入口切换已执行，原源目录保留 |
| HTTP / catalog / bridge | `1` / `1` / `2.0` | 原八个 bridge 方法保留；新增能力通过 features 协商 |
| DSH | `0.2.0-rc.2` | 官方桌面为目标；隔离浏览器不代签原生输入 |
| 根 package / 旧合约 | `0.3.0` | 历史版本域，不能判定整套 Apps 运行版本 |

历史candidate.12 Runtime产物SHA-256为 `7ac300aeaa5f7ff6507d0d30bb1d1d4641d9be4cef7e651eec6c64ef17f2ef39`；旧10/Runtime7产物 `2264139fc4404a11dbe9fdde00a374b541d1bda1544ef784483bfb6547cc9844` 保留原范围。candidate.7 / Runtime candidate.5原安装/@/只读模型及入口切换为历史事实，证据版本不改写。更新9前的ValidateOnly记录原7桌面运行，用户正常退出后07:40:25Z由官方CLI执行7→9覆盖安装。candidate.8首版因独立审查发现嵌套SKU匹配边界而 `REJECTED_IMPLEMENTATION_REVIEW`、未安装，私有证据保留。

candidate.11已冻结新归档，Bundle/Host/Runtime均candidate.11、schema4，SHA `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`。冻结时143输入比旧10只有5项变化（Runtime/Host诊断源码与package/server/versions元数据），9个打包文件不同；Client、SDK JS/声明、starter、两CLI及maps与10原字节一致。新11核心四卡已实际重跑I26/26并独立V通过，最终包全仓727/727及类型/SDK/CLI/只读smoke/包内诊断通过，新11未安装到桌面。10:03:40的旧10输入观察与10:07后续5项差异分别保留；该11阶段22 PASS由新11十二卡（核心四卡、013–015、017–020与023）和旧10十卡分别组成，不自动迁移其他10卡，当时已安装入口为Host10/Runtime7/schema4；后续12实际部署另列。

历史已安装归档 `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.10.tgz` 的SHA-256为 `7a07175ca7d824c5b68892c5eb6c0492abd8bf75c7f0df27b5d4029e0a54e84a`，冻结包/manifest未因独立备份工具修复重打。历史candidate.9归档为 `dc0c884bcaa0f94d063ddbd9ad2a484b2e877293a0a3c39310b6017955a89154`、candidate.7为 `46a5d6c9910027c19c33b9327270f6418b51434d8018e06e770b21d302bcb524`，不能互相代表。归档、回退脚本、完整备份、签名回执、图片与原日志私有归档，公开仓库只保存范围/结果/摘要，不发布业务、凭据或Runtime数据。

历史12归档SHA `4ca9cf8cc8f5f727701c3457137142ea578ec85ee47f04044658699955b6051a`，Bundle/Host/Runtime12、schema4，774/774 exit0、类型/包内SDK/实际双视口CLI及只读smoke通过，360执行源码/143输入/33产物检查零差异；11原归档和7项前轮元证据未变。12与11有13打包输入和18产物变化，含固定12安装器、profit/错误边界/Pane修复；不迁移旧正式卡或宣称Native通过。

11:30:45–11:31:16 UTC受控停止了原桌面和Runtime并复制/检查Runtime冷备，但冻结operator使用裸true/false写记录，exit1，未在该失败阶段安装/启动。原脚本/结果不可变；11:36新增恢复入口不再停止进程、不覆盖旧备份，三冷备2202 Runtime+396桌面Roaming+1原会话共2599文件字节核对通过，totalBytes字段原null保留，不伪造总数。11:37:55官方同名安装12 exit0；独立磁盘比对9774核心文件原路径字节未变、33安装产物匹配、143源码冻结。此冷备/安装不是数据迁移或正式app.quit验收。

首次start记录exitCode0同时errorETIMEDOUT，原桌面启动日志有DesktopHostFatalError/EACCES19387，均保留。仅停止该次桌面69752并重试，未改核心/profile或停止Runtime60284；11:43:58–11:44:02桌面retry实际exit0/error=null，Host71548监听19387。11:45:55独立只读核对Runtime60284监听36994、identity12/schema4，/health、/v1/runtime、/v1/apps、原session的/v1/views均200，Hallmark status=ok，retry无FatalEACCES。冷会话1269→1270仅新增end-seed，全部旧JSON history prefix一致；插件NativeMemory/render/@/componentmount仍NOT_RUN，用户手动测试待回复，用户持续授权退出/重启无需再次询问。

早先严格前检因桌面未退出中止，原事实保留。08:41:55 UTC核实桌面进程0及任务所属旧Runtime38844后，通过Windows Stop-Process停止该进程，不能记作graceful SIGTERM。首轮完整备份因preview-fixture-dataset误识别为持久引用而在创建目录/报告前失败；中间apply成功但随后独立审查发现显示路径碰撞，原样HOLD且未作为最终安装前备份。修复后在新目标apply/verify通过，再执行覆盖安装和正常重开。

08:52:56 UTC只读进程核查：新Runtime62564为36994唯一listener、旧38844已退出，桌面主进程63296存在；原Board服务保留。profile/dataDirectory未再次切换。08:53:13 UTC只读旧view恢复状态：最后旧publication从过deadline mounting恢复为interrupted，pending=null、active/lastGood=null、draft_unpublished；没有mounted。旧Agent的_republish/重新读取建议是失败后的建议，不是新验收；这是当时的等待状态；后续原会话turn与挂载失败记录见下方最新观察。

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
| E-PACK-15 / E-V-PACK-15 | 778/778实际exit0；类型/真实SDK/CLI/Runtime/诊断；独立29检查/17负例PASS | 144输入/33产物，14→15仅5源变；独立复核不重跑全仓CI，不将14正式卡转15 |
| E-COLD-15 / E-INSTALL-15 / E-RESTART-15 / E-DISK-15 / E-FREEZE-15 | 官方12→15覆盖；实际只读重开和33/144/9774两遍磁盘核对PASS | stop/backup与install实际exit0；startup包装exit1、operatorExit=null保留；185refs/330index/472fileguards零差异，56审查子进程已退出。Native、原SQLite、TST-001整卡与R未验 |
| E-I-037-038-14 / E-V-037-038-14 / E-V-WX-14 | 完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED；I/V31/31、语义20/20、12377/12377、1955引用、30SQL副本；V追加wx8/8 | 原I31分037=18/038=8/guards=5；wx为独立V额外case，不属于原I31。14归档d892/144/33绑定，旧12BLOCKED原样保留，真实现场/Native/业务/R未验 |
| E-FULL-1 | 648 项：646 PASS、2 FAIL | 首轮失败日志保留；Host 期望补 viewRevision，starter SDK 夹具补 v2 子路径后重跑 |
| E-FULL-2 | **651/651 PASS；0 FAIL、0 SKIP、0 CANCELLED** | `npm test`，16,197.3902 ms；包括 fixture、隔离 HTTP 与真实源码/浏览器相关测试，未运行真实业务写或原模型整链 |
| E-FULL-3 | **655/655 PASS；0 FAIL、0 SKIP、0 CANCELLED** | 修复受控工作副本依赖缓存备份规则后 `npm test`，36,061.5173 ms；之前两轮日志保留，不用总数代签 80 张用例卡 |
| E-FULL-4 / E-TYPE-9 | **694/694 PASS；0 FAIL、0 SKIP、0 CANCELLED；类型检查 PASS** | candidate.9 健康/库存修复后，`npm test` 30,441.5462 ms；前三轮及 candidate.8 拒绝历史保留；仍非正式逐卡/现场整体验收 |
| E-PACK-12 / E-FULL-12 | **774/774 exit0、type/实际包内SDK/CLI及只读smoke通过** | 360执行源码/143inputs/33产物零差异；包内诊断4与SDKlost-response2；旧11原7件保留，仅隔离包检查，不迁移正式22卡 |
| E-PACK-14 | **778/778、类型/SDK与实际CLI/Runtime/诊断、144输入/33产物冻结通过** | 归档 `d89271e5b468269a9b0d89ea8003ee4034512c3c510cb1fc52638092d8187774`；final-integrity与verification-summary独立固定，installed=false/businessWrites=0/Native与R未验。不迁移旧12正式卡；13全仓通过但边界审查后未装 |
| E-REVIEW-CUTOVER-14 | 独立窄源码审查 `NO_OPEN_FINDING_IN_REVIEW_SCOPE` | 持久enrollment/decision、启动/HTTP/body完成/Provider/调度守卫和rollback先冻结；实际补查删除decision冷启动、stale lease并发唯一writer、半请求体跨rollback零新增direct storage写、wx碰撞保留冻结。仅source review，明确不是正式I/V/R签认 |
| E-I-034 / E-V-034 | 完整最低FIXTURE/actual-command/静态依赖审计PASS_SCOPE_REVIEWED | I与独立回放各124/124；101注册入口、165HTTP、484SQL的实际所有者审计；Host有FS读取/日志/进程端口能力、无SQLite，不声称noFS。candidate.12冻143/33/4ca9，未转新包 |
| E-I-035 / E-V-035 | 完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED | I/独立回放各40/40，最终V1774/1774；对象键重排同dataset、数组/connection/projection变化异dataset、major/schema拒绝和refresh保持view/display身份。329原I/328旧失败I保留，candidate.12冻143/33/4ca9 |
| E-I-036 / E-I-039 / E-V-036-039 | 036/039完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED；037/038旧12BLOCKED | V四卡报告整体PARTIAL_SCOPE_REVIEWED，只提升036/039。036实际2→3命令/ID映射/quarantine/原资产字节；039真实React构建/双视口/保留过期图/旧plan拒绝/相同plan实际GC只删B。旧038 I5事实不代签先冻结顺序，旧037报告拒绝未控制入口 |
| E-COLD-12 / E-INSTALL-12 / E-DISK-12 / E-RESTART-12 | 三冷备恢复/官方同名安装/独立磁盘与实际重启只读检查通过 | 首停止record-write exit1、首次start超时/EACCES保留；exact桌面retry恢复，四GET200、原会话JSON前缀未变。磁盘33/源码143/核心9774；非正式正常退出、迁移、NativeMemory/render或业务验收 |
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
| E-PROFIT-SOURCE-PRE12 | profit公共Provider→共享组件UI provenance与逐行展开已补齐；2新增/33相关回归、类型检查通过 | 公共Provider/Runtime/Presentation/Host/UI链只将外部源响应替换为合成数据；初始RED和首轮格式期望失败保留。不构成016完整卡、原DSH/model原话或真实GUI通过；该局部记录冻结时包尚待验证，后续12包/安装另列 |
| E-TRANSPORT-SOURCE-PRE12 / E-BRIDGE-SOURCE-PRE12 | Host/SDK25新增与48相关、Bridge14新增与42相关回归通过；类型检查exit0 | 限定ISOLATED_REGRESSION_ONLY；独立14/14有限review确认可冻结，旧RED/错误格式/超大恢复字段P2保留。此局部证据冻结时024完整卡未验且尚无12包/安装，后续实际结果另列 |
| E-FORMAL-023 / E-V-023 | 完整最低FIXTURE独立V PASS；I15/15、V17/17 | 0824a4a执行源码、candidate11原143输入/33产物pre/post匹配，194引用及原I24 JSON/全部含DB字节保留；V独立HTTP/gateway和query_only失败复测。首次私有Provider缺dispose清理失败保留/wx补记，不是产品FAIL |
| E-I-API-SDK / E-I-RUNTIME-MUTATION | 013–015 I16/16/V950检查；017–020 I25/25/V38/38；完整最低scope独立V通过 | 三份新harness在0824之后分别冻结原字节与candidate11输入/产物，013–015和017–020已独立V提升，早期API夹具/checker三FAIL保留，storeId string→integer实际生成/编译，anyOf属性投影未宣称覆盖 |
| E-I-SCRIPT-021-022 / E-V-021-022 | I16/16、独立复跑16/16；完整最低FIXTURE/actual-command通过 | 真实source ScriptRun→透明facade→packed SDK/production HTTP；独立语义52/52、SQL116/116，阶段补核845/845；477原文件保留。只证明同进程恢复，旧partial保存在冻结快照，非append-only run历史 |
| E-I-SOURCE-025-026 / E-V-025-026 | I32/32、V59/59、独立回放32/32；完整最低FIXTURE/actual-command通过 | 普通React/TSX/CSS真实构建/浏览器交互、Bbad真实编译失败保留旧B；A归档和另一view不变，显式save才INSERT component_versions。合成ready非DSH；仅storage updated_at可变化，view.value_json不变 |
| E-I-024 / E-V-024 | I64/64、V125/125和独立回放64/64 exit0；完整最低FIXTURE/actual-command通过 | Gateway注册/model render、packed SDK、Host.ui和真实HTTP组件桥接9结果一致，普通React actual SSR；ProductionErrorView只显示message，不宣称Native/browser或自动生产重试UI |
| E-CORE-BASELINE-11 | 实际pre-install core只读基线：9774文件/1,185,655,864字节/5进程 | 只记录安装前core，TST-001完整query/display/官方卸载/重开/post-inventory尚未执行，正式NOT_RUN；11未安装，无NativeMemory/R |
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
| E-FROZEN-12 / 归档 | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.12.tgz` | `4ca9cf8cc8f5f727701c3457137142ea578ec85ee47f04044658699955b6051a`；1009770 bytes，当前已安装，非NativeMemory证明 |
| E-PACK-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/verification-summary.json` | `1de69ac7ee5957aa005c39ab33532e1d92ba375912c2081f0b51d4187c7fa9a1`；冻结包检查，installed=false为执行时范围 |
| E-FULL-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/full-test/result.json` | `e322f521ce3338bddea92ecb10580ef51bbb4b5df067aa50d74cbc0f781b8b0d`；实际774/774 exit0 |
| E-FROZEN-12 / manifest | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/build-manifest.json` | `14083e2c4ccdfd196b43311a4d90b311515feb1e9ab86a993b80fccaea6932a8`；143sourceInputs/33artifacts |
| E-FROZEN-12 / package | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/package-manifest.json` | `b3798aa4a46bb3b2efd475d4287c9d5cef6e3aca4c866da75d5822ba2a982f0e` |
| E-PACK-INTEGRITY-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/final-integrity.json` | `38e942c3128a67cd1c0e00bfb6d7c0e7537d6b1dd900070acc383db918513b64`；360执行源码/143输入/33产物零差异 |
| E-INSTALLER-12 | `scripts/install-desktop-apps.ps1` | `cb44b9f74f0ea45ee23e284dba60905150bf40f87c0ea7afef227be242551320`；历史固定12/Runtime12，纳入12冻结输入 |
| E-STOP-FAIL-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/stop-and-backup-result.json` | `1adb268589aec0375bbcf986e5bde974207bad29e1b2893ffc15ddf12ea6ed31`；首record-write exit1保留 |
| E-COLD-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-backups-result.json` | `e8678de1e447fcdc83137b7a1a9203ae2b0a3640a3455e6dbd92abd620bb242d`；新增恢复三冷备exit0，不重停/不覆写 |
| E-INSTALL-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-install-result.json` | `c4c4635451eb90b46580450359aebbe9346a77407ddfeaab6d30361f7136fa4f`；官方同名覆盖12 exit0 |
| E-DISK-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/independent-disk-core-b5b74846-1e93-4ba2-902c-5488d4ebbe54/result.json` | `353073c6d1401a3a2ddc380ba7c163db4cf994a85ba2427dc687cac2fdb610ab`；核心9774/产物33/输入143，Native仍NOT_RUN |
| E-START-FIRST-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-start-result.json` | `3dde66f60bdd4c0113aaf19aa6e0e28791f5377fc6f1e5b654835e6ae1ea370d`；exitCode0且ETIMEDOUT，首Host EACCES保留 |
| E-DESKTOP-RETRY-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/desktop-retry-37774ee5-ec48-4bd8-96e9-0395e6fd4dba/command-result.json` | `f0967d957622e37b8e803e047e9633627d641a1b5509f8896ffd646a0fbb3a0f`；仅桌面retry，actual exit0/error=null |
| E-RESTART-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/desktop-retry-37774ee5-ec48-4bd8-96e9-0395e6fd4dba/read-only-restart-check.json` | `0fc1a423f03f891239bdd87a4a8df9cac2ca95bfa3e5bb8ca7044774767e68d4`；11:45:55四GET与原JSON前缀检查，Native/@待用户 |
| E-RESTART-COMMAND-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/readonly-restart-verification-bb7a8e31-f6b4-4232-a8b6-70601f208909/command-result.json` | `a9767c0164f820b33336f52e3beeea44d19a9d91b80ac5684e516ca61ddb29a0`；实际只读验证exit0/error=null |
| E-SIDEBAR-SOURCE-PRE12 | `evidence/apps-a2-20261007/transport-error-fix/final-sidebar-f292d41c-8c2c-4545-a8dc-eaacef2b8a5c/result.json` | `4eb5fd08346b19d31b36a18fe7668b24522d8c2549c35929daa1bd1e825834af`；6新增/29相关/typeexit0，非现场因果或Native通过 |
| E-FROZEN-11 / 归档 | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.11.tgz` | `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`；独立新包，最终包检查通过，未安装 |
| E-FROZEN-11 / manifest | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/build-manifest.json` | `7ce77c6ac4ed6a55c67c532676a178cc322b1ab2f0c34eae95c537453c38bd35`；33产物/143输入，旧10manifest不改 |
| E-VERIFICATION-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/candidate11-final-verification.json` | `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`；唯一新最终PASS，旧summary不覆盖 |
| E-V-PACK-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/independent-v-candidate11-32660a68-6b56-418e-a93b-75f1e2d6956a.json` | `01de93d9b0e1938cc9c0c9aa3b01d680ee95f3d80c9220ccb97cf5ec584da72e`；PASS_SCOPED_PACKAGE_REVIEW，仅包/source/隔离fixture |
| E-PREPUSH-11 | `evidence/apps-a2-20261007/cutover/diagnostic-followup-before-push-c104685f-7f74-482a-8b68-815034bbf1ca.json` | `86320d15b1a08207ed162e25cf4b11c9cb32071811bfee67bd8d50fa15aa67eb`；source/table/installed disk完整性，磁盘仍10，不签NativeMemory/R |
| E-INSTALL-PLAN-11 | `evidence/apps-a2-20261007/cutover/candidate11-desktop-plan-1e9f4d72-ad52-4968-a26f-39d10b5c8f81/plan.json` | `83afd3da8b0bd6163db81828d8366fdb5e205d3dac5deb0c1d87a6a711bcb120`；仅ValidateOnly，未安装 |
| E-INSTALL-PLAN-11 / 最新 | `evidence/apps-a2-20261007/cutover/candidate11-desktop-plan-500d38d9-9180-463a-84dd-55ffd4a76a3c/plan.json` | `dee08be82e5058ca23843d098f1bff494d985f3991b27b199b63b97b41a22517`；仅修私有计划显示版本标签/constants/root，guard保留，installed=false/desktopRunning=true；旧1e9计划保留 |
| E-CORE-BASELINE-11 | `evidence/apps-a2-20261007/cutover/desktop-core-before-candidate11-7b9aa5a7-dc6a-406e-8f2f-3e725e3cafd8/baseline.json` | `5c03554b2bb07ca0d7c14eb177a8b97a49cb37331db5ef7e02207ac8e9f775ce`；仅pre-install核心盘点，TST-001 NOT_RUN |
| E-I-SCRIPT-021-022 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/result.json` | `2ba20c2642ac9dfbccfa34b457b2352a934e21e9068ea581467058f600aee319`；I16/16，actual-command独立归档 |
| E-FORMAL-021-12 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/TST-021/FIXTURE/result.json` | `a80a3aefb04f7327919d9a6bc37365fad7e719c817c7857649ad21004921e040`；完整最低FIXTURE/actual-command |
| E-FORMAL-022-12 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/TST-022/FIXTURE/result.json` | `dc5c2d3d753ebb1208c076bcfd1ec81164c3561c79da18e201db117ecc39f947`；完整最低FIXTURE/actual-command |
| E-V-021-022 | `evidence/apps-a2-20261007/formal-script-run/independent-v-021-022-dde74bda-555d-4fbf-abc0-084890c22aff/independent-v-021-022-stage-reviewed-6ec05b91-370d-489b-9752-ab1243860821.json` | `8deaa677a7578b74fdd4b896b458a15f53bea6a8f477bf3e340c9615138f9fc5`；最终PASS_SCOPE_REVIEWED；首V引用归属FAIL保留 |
| E-HARNESS-021-022 | `test/acceptance/script-run-steps-a2.mjs` | `c2123fcf4d8b0981581514372963cae2c6d904ca1d49bd0aee90fcb583350f5e`；c212最终执行原字节，历史56a快照不改 |
| E-I-SOURCE-025-026 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/result.json` | `5acc1d9d5f8f481036a263eaef05de5fed22baebbe474051a1410f290aa88266`；I32/32：025十二项、026十六项及四项补充 |
| E-FORMAL-025-12 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/TST-025/FIXTURE/result.json` | `4553469a6459d97a74656dd23c4767949f7c1dd9c1eecdeec042fffd0b6b6f2b`；完整最低FIXTURE/actual-command |
| E-FORMAL-026-12 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/TST-026/FIXTURE/result.json` | `000d12f935c492a8e3d7394426ea95192775496d671a2c4127bbc6b2a6a06b3f`；完整最低FIXTURE/actual-command |
| E-V-025-026 | `evidence/apps-a2-20261007/independent-v-source-view-save/a2-v-source-view-save-980b48bb-6f32-4f35-9df2-31034498ee3f/result-final.json` | `f3938e58cef7605d5e9a0ec7119f62d189c093dd3b9ad5c2402bb9742b72cb0c`；最终V59/59；首V timestamp过强判据FAIL保留 |
| E-HARNESS-025-026 | `test/acceptance/source-view-save-boundaries-a2.mjs` | `d67ccd3541d6ae8253df00f83526c5613658180b9f46c93c4467d0cee54fd01e`；实际执行原字节 |
| E-I-024 | `evidence/apps-a2-20261007/formal-error-contract/a2-error-contract-65cf8e3a-8030-4cb5-807e-acee6083a8fe/result.json` | `1fb8fd2bf73ea49bc62737b26c4bd158413405f2b72b6158cd06311766de3257`；I64/64，完整最低scope已独立V通过 |
| E-FREEZE-024 | `evidence/apps-a2-20261007/formal-error-contract/operator-e86755df-e719-4dca-9896-08b56d5c3704/freeze-result.json` | `7646ab416080ef28130af76227eca83d92faeff39c1a1f518565ba180d0b0808`；实际命令exit0与I冻结；非V签认 |
| E-FORMAL-024-12 | `evidence/apps-a2-20261007/formal-error-contract/a2-error-contract-65cf8e3a-8030-4cb5-807e-acee6083a8fe/TST-024/FIXTURE/result.json` | `07e0c93af6dde1c0de13830bae1a289638cc19bfacc0f390bb54d56e575cf067`；完整最低FIXTURE/actual-command |
| E-V-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/review-result.json` | `ac4e610076a29b333aa5b0934a7a61837d3cf75e78beb743bd603720aea6e805`；V125/125；首SELECT*与声明四账本列的判据错误保留并追加校正 |
| E-PACK-14 / final-integrity | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.14/final-integrity.json` | `10c60be2903aa38c616b0b937be781c773900e28a49232a940e163693c8622c9` |
| E-PACK-14 / verification | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.14/verification-summary.json` | `5f39c3db73015af866112b4f2721ed84a4fa9f315a20e0133950ab623a762632` |
| E-REVIEW-CUTOVER-14 | `evidence/apps-a2-20261007/independent-review-cutover/review-final-84b73d92-681b-43bc-ac65-e5da24e03884/result.json` | `500660b03c4545dfd6f3cead2d89d875adf550ac5b0ee686ac42d17df3ee5c11`；source review、非正式卡/R |
| E-PACK-15 / archive | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.15.tgz` | `0ae72a0fa7f02ea692cf861bc441f0464eb0a248ceddc9cd6f19468a03d29b64`；冻结15归档；不迁移14正式卡 |
| E-PACK-15 / final-integrity | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/final-integrity.json` | `fd305d11193f7a75896179092151d5f72a2cd81b38b0a6ae3d3634449ec62650`；完整最终包/源码冻结 |
| E-PACK-15 / verification | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/verification-summary.json` | `6db8cf8f16e20acea8f588bbb712f9a27e1d47a19c220bc03f0d9fecf836e07d`；778/778、type与实际packed执行 |
| E-INSTALLER-15 | `scripts/install-desktop-apps.ps1` | `0131f6072aaea18a49999e87985d6550ed05c605b0ae96e8485784d5a6b5e684`；manifest动态版本/全33 tar二进制与安装磁盘核验；纳入15冻结源输入 |
| E-V-PACK-15 | `evidence/apps-a2-20261007/formal-package-review/review15-563b202d-a92a-4bce-b214-cd06179926a3/package-installer-review.json` | `1a85daae13cad7bec12f1a1c34fa276678ea028308a030a25c6b14ed1c8b9ccf`；独立29检查/17负例，不重跑全仓CI |
| E-V-PACK-15 / index | `evidence/apps-a2-20261007/formal-package-review/review15-563b202d-a92a-4bce-b214-cd06179926a3/package-review-artifact-index.json` | `4ae87323a5b68bd153a81355eeddd7e77e750ea43c741f8f37d3b54745c7b2ca`；独立330包索引 |
| E-DISK-15 | `evidence/apps-a2-20261007/formal-package-review/postinstall15-3de7ac15-6a3b-43bb-85bb-ad128da511cc/result.json` | `a03ca1431622e929578326c2bde76524e6a1b35847d43ae8b41f141bf4cd61ba`；33安装/144源/9774核心两遍核对，无原SQLite/GUI |
| E-FREEZE-15 | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/freeze-result.json` | `78290f1d0a92a71345ec46727b0040d76922dad0f881474a0e8c96071b1e3576`；185交叉引用/330包索引/472文件守卫零差异，56审查子进程退出 |
| E-FREEZE-15 / command | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/actual-command.json` | `d62233b1427a218ba21f2d985ef17752cdaaea55835bfd0a975a47a79da538b4`；实际child exit0，PID已退出 |
| E-FREEZE-15 / index | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/final-evidence-index-13f79dfd-26ed-40c3-ad06-883cdf774309.json` | `4b21abeb27976acad335d9d8264ea578380d8a795dfc632bf1de2fa686b1665c`；最终私有证据索引 |
| E-COLD-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/stop-and-backup-result.json` | `25da1391308e9b08b31a0fd58e85450fdb3e7726cc80430439261e398d43f620`；受控停止/冷备actual exit0，不代签正常app.quit |
| E-INSTALL-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/install-result.json` | `9608340f46d3206507e3e0358346cec5c92cef9bc56a4cf2d9ff578f143f55a5`；官方同名12→15 actual exit0 |
| E-RESTART-15 / dispatch | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/start-dispatch-observation.json` | `923d10fcb1c0de1f25808c03a3add95a158044c81fd960d8170c3a7f6415b947`；启动包装exit1/observer继承stdio异常；operatorExit=null，不伪造exit0 |
| E-RESTART-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/read-only-restart-check.json` | `64b2ac3147b22719fc30604857bd8ca177425d915e6276cfe26fb306fb382e4b`；实际Runtime15/schema4/四GET/Hallmark健康/原1270行前缀PASS |
| E-RESTART-15 / command | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/read-only-check-command.json` | `9180fd3648f73ed5237531b0b85e94e7e1f7a3bbbfb81e22c174a1725f842be7`；实际只读check exit0 |
| E-I-037-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/result.json` | `e96bc64035aa38a82206c1c9988f06474196971241b39e7170d4b8fccf213bed`；I31/31，03718/0388/guards5，绑定14 |
| E-I-037-038-14 / command | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/actual-command-result.json` | `8d9068a0f88254ec86276f5bb2c58bb165bb596319cb1df0fb52b122e07bb028`；实际I child exit0 |
| E-V-037-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-summary-final.json` | `e1de67236fa5cd51a7028cd5691264d9bffe72de6a9d7802f1c2e9eb7a638b57`；完整最低FIXTURE/actual-command，20语义/12377检查/1955引用/30SQL副本 |
| E-V-037-038-14 / detailed | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-result-identity-final.json` | `c38d4f75949cf9e35d3e78a64d954dc3a7d126279439574fb794eaff6ea1e55e`；独立完整复核，不代签Native/业务/R |
| E-V-037-038-14 / command | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-identity-final-command-result.json` | `736043cca0424bd4974f910f1a878095206a89536355e6a8b42d6d9b294eb382`；最终独立checker实际exit0 |
| E-V-WX-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/output-collision-result.json` | `55c4b5d10086188e410b19aeef024b615d758de284b8cb827f1ca1defde7b7aa`；captured14 CLI真实wx碰撞8/8，追加V而非原I31 |
| E-HARNESS-037-038-14 | `test/acceptance/migration-cutover-admission-a2.mjs` | `c7ab17371d85152abceaafa477074f1653080e5d8ec9f5273d0f98fd35e49f6c`；公开实际执行harness原字节 |
| E-HARNESS-035 | `test/acceptance/dataset-identity-a2.mjs` | `82946552187a3e5c22bbc2496976540cab84917af5e4961c30415b047c6cede7`；公开实际执行harness原字节 |
| E-HARNESS-036-039 | `test/acceptance/migration-cutover-boundaries-a2.mjs` | `2c4d33d5d96b9adcb3f7baeb33a65adc9aed6a5bf8595c4381c3c2e7f6356584`；公开实际执行harness原字节 |
| E-FULL-15 / command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/full-test/result.json` | `ae6bfcf12b9a6d8a8eb3d0ce642b185698a82e14ce84277bc396f768e1e27aea`；真实全仓命令exit0 |
| E-FULL-15 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/full-test/stdout.txt` | `e34df159eb8e2e022d41f2d0959769800d5e2ee9a258e518d4d1109daba2eb61`；真实778/778 CI stdout，actual exit0 |
| E-I-037-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/TST-037/FIXTURE/result.json` | `5cbafa678072969e1931c8da0712721d42875d0000bec48f9294e97d8ce84464`；正式I037 |
| E-I-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/TST-038/FIXTURE/result.json` | `089846495b6b08f7efc3f64603f089ddb45b2cf48eb77876c2ef45af2d9b4825`；正式I038 |
| E-I-034 | `evidence/apps-a2-20261007/formal-state-owner/a2-state-owner-8c28433a-9f81-4fee-b264-9b4b04f1234a/result.json` | `58e82c91e5552d71e073d39594cd9a4c6cb910f3a3924fff65def734c04ce958` |
| E-V-034 | `evidence/apps-a2-20261007/formal-state-owner/independent-v-034-7bdafb3a-89e2-4d12-b2c3-519c23f1cd27/review-summary-final.json` | `22c3c9fef8545e75c9c5ccf7ebaf9a5ae9989e1d9d4f30fee02ad34056846552` |
| E-HARNESS-034 | `test/acceptance/state-owner-boundaries-a2.mjs` | `67e9c30489e1cf8c891381c16e303bc3dbd22c81d6c6a6b6252c2239984fa2d0` |
| E-I-035 | `evidence/apps-a2-20261007/formal-dataset-identity/a2-dataset-identity-2b8cd05c-dd7d-4ae1-b6ae-1d1f397f1ae8/result.json` | `7e36651e0675c219e3c6be9ed9f67e74cea718c5c68fcdbadc5d6ce1f9696289` |
| E-V-035 | `evidence/apps-a2-20261007/formal-dataset-identity/independent-v-035-9645fedd-8674-4c64-97f5-6b3176615eca/review-result-final.json` | `c4462603a68314568977a3d7c6ce4a7fa532d64d5f12f31392836a8060fee194` |
| E-I-036 | `evidence/apps-a2-20261007/formal-migration-cutover/m-39362f6c-f466-4ed7-b19e-c53626fe3c15/TST-036/FIXTURE/result.json` | `26ab680ce852de7e50d91fff6fa62d2726cb8afe212cd7bf5317a1d451d6aab1` |
| E-I-039 | `evidence/apps-a2-20261007/formal-migration-cutover/m-39362f6c-f466-4ed7-b19e-c53626fe3c15/TST-039/FIXTURE/result.json` | `f5f759485088d68dc6e062b5e4b218cd84264302993873c5c2aea6f7392970b9` |
| E-V-036-039 | `evidence/apps-a2-20261007/formal-migration-cutover/independent-v-036-039-9f4537d9-2549-4cf6-bef0-0feb742bf7e0/review-summary-final.json` | `c9fd71eecbff1ed8f520626fe2d625ce964d5679c5d78909e70b852b99f767c5`；完整最低只PASS036/039，旧037/038BLOCKED |
| E-V-FREEZE-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/freeze-result.json` | `41185ce46304f596fba420447d83fec2afb7e9e1560de0b194c5c9fec88c47bb`；独立V冻结原字节 |
| E-V-INDEX-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/final-artifact-index.json` | `2aa7d612befdab5cbd232f09c842a1b1cee4efed0d7ecd42da8a507b7f2d71d2`；最终V索引 |
| E-HARNESS-024 | `test/acceptance/error-contracts-a2.mjs` | `5a53d37379ef53028c0740069af2f7d54535ea9f4f9efe8d35d0ea3358ab40aa`；实际执行原字节，未归入774CI |
| E-FORMAL-023 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/result.json` | `0ee52f57d916fa6a6c8b1229a9430a8173c77415ac6ce9c372fcb0996679b8e4`；I15/15、独立命令exit0 |
| E-V-023 | `evidence/apps-a2-20261007/formal-model-budget/review-17988222-5d59-4091-b166-ecefc2738bfe/review-result.json` | `b02504676b0c28594f38f576e11b7d3034354f7933f7803316164d51da233bc1`；完整最低FIXTURE、V17/17 |
| E-HARNESS-023 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/executed-harness.mjs` | `510a83e3535add6daf2d65752fa8def4db84164c0a2dd90bf1d4b0eed5f9e5bc`；实际执行原字节 |
| E-I-RUNTIME-MUTATION | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/result.json` | `8036c82b98e9f3b6e35292b0f1f416516ef3a089101cd7a5fa376136cf59d46a`；I25/25、独立V38/38完整FIXTURE通过 |
| E-V-017-020 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/independent-v-runtime-mutation-candidate11-af5a4874-4bb7-45fa-aec5-5c7acccbcec4.json` | `e51db9a259f9d7fc9b204380244ad8c50fd47d5a1d55920a074451e559af9b47`；四卡完整FIXTURE、独立V38/38 |
| E-HARNESS-017-020 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/executed-harness.mjs` | `9349444e03440a62f9d637db6722b4b438bad6bd0bbc8146d63004a66c07b4eb`；实际执行原字节 |
| E-I-API-SDK | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/result.json` | `689b09cf2e95ddff07dc42c267614dfde2dcce800b82c38693a825e9fd2fe268`；I16/16、独立V950检查，完整最低FIXTURE/actual-command通过 |
| E-V-013-015 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/independent-v-013-014-015-bc75683b-1727-410e-ac2d-d71e773c4a62.json` | `b9d68bfa81a1feb2eafdf2adf54ed37e857b79575ba4e02ce48286a6ffd78934`；完整最低FIXTURE/actual-command，950检查、六路径联动范围更正 |
| E-V-013-015 / 旧报告 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/independent-v-013-014-015-7e9122a3-e45b-4700-a3dc-07731861a748.json` | `f54f95e9970cbb36bd4972175847f4409694f3f50e450e61b10f77bf4cb8e6b8`；旧942检查报告原样保留 |
| E-FORMAL-013-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-013/FIXTURE/result.json` | `1ceda7a3a719710a021fa77adf75a92e6732d218bc741ccff87db40c17cca3b1` |
| E-FORMAL-014-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-014/FIXTURE/result.json` | `23a20a4737b6cbf1cab4dba12e2eae6fb52f80d7257b6df17704ae764847f71c` |
| E-FORMAL-015-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-015/FIXTURE/result.json` | `216bb65eab2ab66104bc1b3f65e51e52351497f6e5a96ffd0d833e104922ae11` |
| E-FORMAL-017-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-017/FIXTURE/result.json` | `2a1d1224ffc70253dde414c6907ff1c93a23ea14aabc2f44a730ebf779a71546` |
| E-FORMAL-018-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-018/FIXTURE/result.json` | `e76c9c89689ccf1ee64463de772ded07d7d95e955cc12fb46dd47c7c12723abd` |
| E-FORMAL-019-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-019/FIXTURE/result.json` | `4d661c07fb26ede8de8e0afeb571458ba25836a8df06e10a1e2e0da07bf1940a` |
| E-FORMAL-020-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-020/FIXTURE/result.json` | `6781e20ac73d7e93e29847fc24a44fb053cbb0ff4f3faad7fab6da98533af3b8` |
| E-FORMAL-023 / 卡 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/TST-023/FIXTURE/result.json` | `58814a3b73dbf37f8e19969ae00f7c8bf83b38f80a223e0bcd991db7228c7844` |
| E-HARNESS-013-015 | `test/acceptance/api-sdk-contracts-a2.mjs` | `d0a9e292e89ae3dddbb98f1ad32a4feaafec8bcac2c230e50ffb1550fe123e82`；实际执行原字节 |
| E-PROFIT-SOURCE-PRE12 | `evidence/apps-a2-20261007/verification/profit-provenance-execution-source.json` | `0a5d7000f3aef32f3f16201ab4f7e8ecb4cd85031fa8154c4171d8b3090c38e8`；真实公共链局部2新增/33相关/type通过，非Native/完整016 |
| E-NATIVE-MOUNT-DIAGNOSIS | `evidence/apps-a2-20261007/transport-error-fix/native-mount-readonly-76947d78-170a-43d6-af49-72c19e2769bc/result.json` | `ff800d32be967211b7e5adce2aeb17f54f7dace2ab5cb4ec29937697a771dadb`；只读源码诊断，现场因果未观察，不是live截图证明 |
| E-TRANSPORT-SOURCE-PRE12 | `evidence/apps-a2-20261007/transport-error-fix/final-eb63da9a-40d9-4a3f-aa37-2810152199f3/result.json` | `52e96f1c9430218fac3b5ba3abd6d833dc06bd17ba9668ef377e06ecb9d319e3`；Host/SDK局部回归，当时formalTST024=NOT_RUN_FULL_CARD；后续完整最低scope独立V另列 |
| E-BRIDGE-SOURCE-PRE12 | `evidence/apps-a2-20261007/bridge-failure-fix/suite-6f2c65f6-6db0-4bc9-a125-b454e302fb3c/result.json` | `1fb32d4699c24a8dd034bd98cf6a9a32694a925f7c576fff213829f90d632e0a`；源码回归exit0，非冻结12/Native |
| E-BRIDGE-TYPE-PRE12 | `evidence/apps-a2-20261007/bridge-failure-fix/typecheck-5c6b7bf1-16ea-4a01-88ff-9c41329773bc/result.json` | `0907d4c188c4d8c57447d4334b6d21690a08b1c2251d7df6b48e9705c556d3fd`；typecheck exit0 |
| E-BRIDGE-REVIEW / 旧P2 | `evidence/apps-a2-20261007/transport-error-fix/bridge-review-5f4c5ce4-87d4-4736-a061-808903b6ead3/review-result.json` | `71c5d2b56cc03170a6d969887795092b7bffc13e679bc990b4b080ca12dc17a2`；原REVIEW_FINDING/超大恢复字段P2报告保留，不混为最终有限review |
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
| TST-013 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 薄API复用现有业务实现，真实公开Runtime/Provider与mock Source调用保持操作/权限/schema/分页语义，非真实业务 |
| TST-014 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 未知写显式分类/拒绝，允许写仍统一durable operation与一次dispatch；unknown只inspect不重发 |
| TST-015 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 共享storeId字段string→integer导致六catalog路径/六TS-doc-tools投影联动；全SDK正向编译，所选API与unknown.data负向检查，anyOf属性typing未覆盖 |
| TST-017 | PASS；完整最低FIXTURE；candidate.11 | 20实际并发唯一invocation同tuple仅一operation/Provider/HTTP写；变payload拒绝零新写、跨app/connection隔离、持久intent先于dispatch |
| TST-018 | PASS；完整最低FIXTURE；candidate.11 | 私有Source接收后丢响应、实际Runtime子进程重开，unknown只inspect恢复/不重发；HTTP200仍按pending/partial/unknown业务状态核实 |
| TST-019 | PASS；完整最低FIXTURE；candidate.11 | 分发前取消零写、分发后不当撤销；晚成功/unknown证据保留、仅只读核实，无真实业务或原DSH签认 |
| TST-020 | PASS；完整最低FIXTURE；candidate.11 | 严格revision CAS只提交一次，旧revision拒绝且不自动追新revision；继承REVISION_CONFLICT shorthand按SPEC保留实际COMPONENT_CONFLICT，literal=false未伪称字面匹配 |
| TST-021 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实Hallmark query、Notes revision1提交后计算异常；可定位partial、持久子调用完整，恢复无重放 |
| TST-022 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实HallmarkProvider/Client/TaskBroker mock平台11 RUB写/读回成功后Notes提交丢响应unknown；恢复只inspect原Notes operation，Hallmark不重写或逆向补偿 |
| TST-023 | PASS；完整最低FIXTURE；candidate.11 | I15/15、独立V17/17；实际UTF-8≥1MiB结果投影≤16384字节、完整handle分页与真实query_only spill失败；独立HTTP/gateway复测、私有DB副本，非原DSH/真实模型原话验收 |
| TST-024 | PASS；完整最低FIXTURE/actual-command；candidate.12 | Gateway注册/modelrender、packed SDK、Host.ui→真实HTTP桥接9结果及普通React SSR一致；原mutation单POST、恢复inspect GET只读；非Native/browser自动错误mapper验收 |
| TST-025 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 空普通源码自定义状态，真实React/TSX/CSS构建/注册/浏览器交互；Bbad真实编译失败时旧B仍可用 |
| TST-026 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | B仅发布目标view；A归档/另一view不覆盖；build/open_source/publish不保存，显式save才新增版本 |
| TST-034 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command/静态依赖审计；candidate.12 | I/独立回放124/124；101入口165HTTP484SQL实际所有者，Host有FS/日志/端口但无SQLite，不是noFS；原143/33/4ca9冻结与旧I保留 |
| TST-035 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | I/独立回放40/40，V1774核对；canonical对象键同身份，数组/连接/projection变化异身份、major/schema先拒绝、refresh不改view/display；未迁移14 |
| TST-036 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 实际2→3正常/orphan/unknown工具迁移命令、ID映射/quarantine/原源资产；初始长路径FAIL/读取新增SHM32768和WAL0历史保留，3→4只支持输入 |
| TST-037 | **PASS**；新candidate.14完整最低FIXTURE/actual-command | I/V31中037各18断言及公共guards5；持久入口拒绝/冷启动/并发writer/body迟到已实际验证，V额外wx8/8；旧12 BLOCKED保留，Native/真实现场/R未签 |
| TST-038 | **PASS**；新candidate.14完整最低FIXTURE/actual-command | I/V各8断言及公共guards；rename1→SQL2→output22，A真实备份恢复、B完整增量导出/原unknown inspect无重写；POST inspect可写恢复账本，旧12 I/V BLOCKED历史保留 |
| TST-039 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实React A/B构建及双视口、活引用保留/过期/旧plan拒绝、sameplan CLI只删B；B图明确为合成GC输入、复用node_modules、非Native/模型 |
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

当时工作区随后修改 `packages/app-runtime/src/index.ts` 与 `packages/plugin-apps/src/index.ts`，补能力版本错误的requested/registered诊断；新增 `test/apps-host/capability-version-diagnostic.test.ts` 先4 FAIL、10:04局部4/4 PASS，真实red/green字节/日志另存。该修复进入独立candidate.11冻结包，该11阶段旧candidate.10归档/manifest与当时已安装桌面不变。新11正式四卡实际重新执行且独立V通过后更新当前记录；旧10三卡PASS、011 FAIL及原V全部保留，其他10卡不自动迁移。新11最终全仓727/727及包检查通过、未安装，该11阶段无新桌面结果，后续12实际部署另列。

candidate.11最终包验证独立记录为 `candidate11-final-verification.json`，SHA `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`。标准全仓最终运行727/727、exit0，未合并Root局部green或首轮stdout凑计数；首轮私有wrapper仅解析TAP而误判spec结果的FAIL、第二轮实际726/727因隔离http.test.ts临时目录清理EPERM失败均原样保留，旧verification-summary-final.json没有覆盖。最终运行在其余包/浏览器smoke结束后独立执行，439实际执行源码与143冻结打包输入前后零差异；这份守卫明确排除6个本阶段未执行的独立acceptance.mjs，实际.test.ts/package/script/config/冻结输入仍在守卫内。新11执行时源身份为a635ec4加冻结未提交诊断/版本变更，包检查及四卡V通过不自动迁移其余旧10卡，不证明原DSH已加载11，R仍未签认。

新11核心I在独立run `a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2` 实际重跑26/26通过，总记录SHA `410a912808f21c7bf0e8cb52b7020c8beab64a472c50fb990f8fd67514481d3d`；V `/root/core_contract_independent_v` 完成21/21语义复核和4/4独立诊断回归，四卡完整最低FIXTURE为PASS_SCOPE_REVIEWED。执行身份为a635ec4工作区快照，保留153源码及脏改patch，harness新b7fb快照与旧30733快照分别归档。实际Runtime source11，冻结11 AppsClient与预生成Notes call43 wrapper另有两只读调用，各一次Provider；10:15:40复核143输入/33产物零差异、226原I文件/4DB及旧10元证据字节保留。没有新11安装、原生/外部模型/真实业务或R签认。

055/056独立V为 `/root/maintenance_acceptance_gap_audit`，09:25:33.860 UTC追加只读复核；维护四卡同一V于09:35:14.745 UTC复核311冻结文件、1165语义引用，只有三处声明的missing/tamper负例，143包源输入零差异。09:30维护run共267断言，独立新增12窄测试/typecheck另记，不加到706包检查。06:29维护summary的四条过期源hash明确剔除且保留，未用中间run替代最终记录。

057独立V `/root/source_acceptance_gap_audit` 于09:36:58.785 UTC核对10份新签名report、377引用零意外错误、5个React carrier/30个HTTP资源manifest与原归档字节一致，实际v2四方法/v1/major3 transcript和单buildId负例通过；41个本地请求、零生产端口调用，关联Chrome/Node已退出。早期wrapper完整源码快照未保留的事实不抹去；React run执行harness为 `2a8ea3192f646b345f58ac5804b6a337788849b25edd2f640746c0604768bbdb`，最终live run为 `bfcb322c890a97c79722947d98c040754028acf104ce1a425550d69a80b8fab1`，不混用执行版本。

057实际live_readonly是本地真实Bill200行快照，fetchedAt=2026-10-07 07:50:12.932 UTC、sourceDataTime=2026-10-06 16:01:20.856 UTC、freshness=unknown；不是新live API查询或桌面展示。fixture八行合成数据与真实快照分开标记。旧HTML757执行只证明HTML/JS子范围。TST-058虽有SOURCE_EXEC负例和旧原Agent部分读图历史，完整LIVE_MODEL/双视口视觉反馈仍NOT_RUN；实际420截图价格/库存逐字换行保留，不能以无溢出断言代签视觉质量。

新增仓库工具 [verify-a2-release-evidence.mjs](../scripts/verify-a2-release-evidence.mjs) 强制CORE51/AUTHORING78/BUSINESS-WRITE52/DATA-CUTOVER53集合，调用者只能增加required卡，不能缩减；核对scope/model/candidate/commit/hash/bytes及重复/非PASS身份。它不执行产品测试、不独立证明断言，releaseApproved恒false，单卡DECLARED_TEST_SET无发布资格。离线用法见 [迁移运行手册](apps-migration-runbook.md)。四范围仍NOT_ACCEPTED，R未签认。

021/022最终I与独立V重跑各16/16；真实source ScriptRunRuntime的invoke经透明facade进入packed AppsSDK与production HTTP，没有新增/runs API或SDK ScriptRun export。021在Hallmark查询与Notes真实提交后计算异常，恢复完成步骤不重放；022在私有mock平台11 RUB写/读回成功后，Notes真实提交结果经实际HTTP丢失而unknown，恢复只inspect原operation，不重写或逆向改Hallmark。run当前行恢复为succeeded，旧partial由冻结前后快照保留，不宣称append-only或跨进程恢复。独立语义52/52、SQL116/116、阶段补核845/845，485阶段引用/171源码/143输入33产物核实，238最终I+235历史失败I+4冻结文件全字节不变；原DB只复制后SQLite读取，SHM/WAL仅在V私有副本。首V混合旧56a与新c212公共harness路径的引用归属FAIL保留，追加报告按执行快照更正；旧I唯一typeof guard差异及其失败日志保留。

025/026最终I32/32（12+16+4补充）、V59/59和隔离回放32/32通过；731原I文件/520引用/5HMAC保留。普通React/TSX/CSS与真实浏览器交互证明自由源码路径；Bbad真实编译失败保留旧B，A归档字节及另一view不覆盖，唯一component_versions INSERT sequence140位于显式save。ready为合成FIXTURE；server GET observer空响应由caller原始响应字节补证。begin(edit)可更新SQLite storage updated_at，但view.value_json完全不变；首V过强timestamp判据FAIL和最终追加校正均保留，不改原证据。

024最终I64/64、V125/125及独立回放64/64 exit0通过，321原I文件与5历史run字节保留，candidate12的143输入/33产物/归档4ca9未改。原mutation仅1次POST；恢复仅inspect GET并保留invocation/trace/operation原身份。真实compiled legacy_unverified source view走公开view open；没有fake grant或Native确认。普通React实际SSR展示类型错误字段，ProductionErrorView本身仅message；不宣称browser/Native或自动生产错误mapper/重试UI。两旧I harness descriptor/JSON view identity失败保留。首V私有SELECT*误将operations额外索引列与I声明四账本列比较而7/8FAIL，原报告保留；追加V按声明四列复核，完整SQL与额外索引列也留存，不写成产品FAIL。

本页源码SHA对应本次实际执行工作区的原始字节，私有源码快照保留该序列化；Git文本行尾由各checkout设置决定。

先完成的四卡形成当时31 PASS/49 NOT_RUN，旧27张PASS的身份不变。034 I最终58e82c91与独立完整V22c3c9fe各124/124，公开harness67e9c304；登记101入口、165 HTTP与484 SQL事实用于状态所有者审计。Host读取文件、日志和管理进程/端口，未拥有SQLite业务事实，不能把此卡写成Host无FS。执行commit为ef54c46，candidate.12的143输入/33产物/4ca9冻结原字节保留；当前14源码不冒充该旧执行快照。

035原I为 `a2-dataset-identity-2b8cd05c-dd7d-4ae1-b6ae-1d1f397f1ae8`，I40/40，独立回放 `a2-dataset-identity-a353686d-0b26-49d6-95d4-073ac62bbf4c` 40/40，最终V c4462603共1774项核对通过。源I commit13f80f2、V在ef54c46复核原143输入/33产物/4ca9；失败的dcf6旧I虽40断言通过、root格式检查FAIL仍原样保留，不能改记其root成功。首私有V因绝对路径/原始请求字符串与sourceRef对象判据错误FAIL，后续新V追加更正，不修改产品或原I。

036/039完整最低V c9fd71ee明确只PASS这两卡，报告整体PARTIAL_SCOPE_REVIEWED并含037/038 BLOCKED。036首长Windows路径SQL备份失败与只读准备时新增SHM32768/WAL0保留，V只打开字节副本；真实2→3正常/孤立/未知工具迁移与逐记录理由/原库资产核对通过。039以实际构建的A/B及双视口浏览器验证活引用/过期/旧计划拒绝/同plan CLI apply仅删除B；B无引用图是明示合成GC输入，复用依赖不代表clean-install。原四卡I/独立回放总33/33只描述事实检查，不把038的5事实或037的报告提升为完整最低PASS。

14窄源码审查500660b03对持久准入、冷启动删除decision、stale lease并发唯一writer、body延迟跨rollback以及wx碰撞冻结进行独立复核，明确 `acceptanceRole=not I/V/R signoff`。14 final-integrity10c60be2、verification5f39c3db固定完整包778/778及144输入/33产物；当时新037/038正式I/V及部署未完成；后续14完整V与15实际部署见本页前部。13原全仓green和审查发现历史保留。

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
| V 013–015追加 | Codex `/root/publication_independent_v`；2026-10-07 10:52:54.771 UTC | E-V-013-015最终950检查、487引用/302原I字节/14×25表差异/5真实命令核验；六共享schema路径范围、负向检查限制及旧V/3 FAIL保留，无真实业务/Native/R |
| V 017–020追加 | Codex `/root/core_contract_independent_v`；2026-10-07 | E-V-017-020完整最低FIXTURE通过，V38/38；116引用/131非源码JSON/298唯一路径/291原I文件与153源码/143输入/33产物复核，私有copy SQL，不代签原DSH/业务/R |
| V 023追加 | Codex `/root/formal_draft_ledger_fixture`；2026-10-07 10:46:20.903 UTC | E-V-023完整最低FIXTURE通过，V17/17、194引用/原I24 JSON及DB字节保留；私有copy实际HTTP/gateway/UTF8/分页/只读spill拒绝复测，清理补记保留，无原DSH/真实模型/R |
| V 021/022追加 | Codex `/root/draft_ledger_independent_v`；2026-10-07 | E-V-021-022完整最低范围通过，独立语义52/52、SQL116/116、隔离复跑16/16；历史公共harness引用归属的首V FAIL与追加校正保留，无Native/R |
| V 025/026追加 | Codex `/root/stable_error_acceptance_map`；2026-10-07 12:15:15.705 UTC | E-V-025-026完整最低范围通过，59/59、独立回放32/32、731原I文件/520引用/5HMAC；合成ready及timestamp判据更正披露，无Native/R |
| V 024追加 | Codex `/root/formal_draft_ledger_fixture`；2026-10-07 12:18:40.015 UTC | E-V-024完整最低FIXTURE/actual-command通过，125/125、隔离回放64/64、321原I文件与5历史run保留；SQL只读私有副本，首SELECT*额外索引列判据更正保留，无Native/R |
| V 054追加 | Codex `/root/draft_ledger_independent_v`；2026-10-07 09:56:26.105 UTC | E-V-054完整最低FIXTURE通过，22项原始证据检查；readonly SQLite生成SHM/空WAL的补充FAIL及更正保留，主DB/307原I字节不变；不代签063/native/R |
| V 059/060追加 | Codex `/root/publication_independent_v`；2026-10-07 10:04:00.659 UTC | E-V-059-060完整最低FIXTURE通过，265检查/656原I字节不变；5 ready均合成，无native/model/R，10:03旧V保留 |
| V 055/056追加 | Codex `/root/maintenance_acceptance_gap_audit`；2026-10-07 09:25:33.860 UTC | E-V-055-056两卡完整最低scope通过，60断言/26HTTP trace及源/引用/HMAC只读交叉复核，不代签native/R |
| V 维护四卡追加 | 同一独立V；2026-10-07 09:35:14.745 UTC | E-V-MAINT-4完整最低scope通过，311文件/1165引用、25集合/4归档/4签名核验；073 FIXTURE、075 FIXTURE+CLOCK_CONTROL、076 FIXTURE、077 DOC+FIXTURE |
| V 057追加 | Codex `/root/source_acceptance_gap_audit`；2026-10-07 09:36:58.785 UTC | E-V-057完整SOURCE_EXEC最低scope PASS；10签名/377引用/5React carrier/30资源manifest复核，058仍NOT_RUN，无native/外部模型/人类R签认 |
| R | 未签认 | 四个范围尚未放行；候选包通过不等于生产发布批准 |

以上是实际 AI 执行/复核身份，不是人类签名。I 未代签 R，夹具 V 结果未代签真实环境。

017–020独立V38/38核对116引用、131非源码JSON、298唯一路径，291原I文件原字节不变；5次SQL仅在V私有副本，派生SHM/WAL明确记录而未污染原I。153源码/143输入/33产物一致；5个raw Git blob仅CRLF与执行源码有字节差异，文本归一后相同，0824 clean生产只指Git文本empty diff。Runtime恢复PID45148/42432均已退出，51511无listener/lease/pending。023 V194引用、原I24 JSON及DB字节保留，独立HTTP/gateway和真实≥1MiB UTF8/≤16384输出、完整分页/query_only spill失败均核对；首次私有Provider缺dispose的清理失败与wx补记保留，不属于产品FAIL。

013–015完整最低FIXTURE/actual-command已独立V通过，I16/16、V950检查；旧942检查报告f54保留，新b9报告补核六路径。487语义引用（I索引473）、14组全25表差异、302原I文件字节不变，无原DB侧文件；5真实generator/tsc退出0/0/0/0/2，Provider5/WriteOps2/mock writes2、unknown重发0。一次共享storeId字段string→integer在catalog路径11/12/13/14/15.items/32联动，六处TS/doc/tools投影同步；正向编译整个SDK，负向消费仅所选API字段及unknown.data，不声称六组独立负向测试，anyOf属性typing未覆盖和旧3个夹具/checker FAIL保留。017–020完整FIXTURE已独立V通过。020的既有码为COMPONENT_CONFLICT，继承卡 shorthand 为REVISION_CONFLICT且literal=false，[冻结SPEC](requirements/A2/docs/02_SPEC.md) §00/§05.6与REQ-020保留既有码，严格CAS/一次提交/不自动追新revision断言未放宽。另只读发现共享组件profit的provenance.metricBasis映射丢失（016）、Host/SDK/bridge超时分类差异（024）；后续局部源码修复/回归已执行，016整卡仍NOT_RUN，024完整最低FIXTURE/actual-command已独立V通过，不以有限回归代签完整卡或正式FAIL，原DSH/model原话不可由工具投影代签。

以上新八卡013–015/017–020/023全部I/V在candidate11原143输入/33产物冻结基线上完成后，016共享显示与024传输错误局部修复/回归才执行，属于后续源码阶段；profit公共Provider到UI的provenance/行展开已补齐，Host/SDK与Bridge回归和有限review通过。同view重开时Pane目录判断未依nav.revision重验error/legacy的源码路径另已只读定位；官方mounted指当前屏幕会话，收起的rightbar仍挂载，不存在由空右栏形成的循环依赖。该路径不是8轮现场failed_mount的已观察因果；最小sidebar修复已通过6项生产React局部回归，第6例从5PASS/1FAIL的RED转为6/6GREEN：同view已授权iframe在目录503时保留，新nav成功后可清除警示。相关29/29及类型检查exit0；修复已纳入12冻结包，774/774及官方同名安装/重试启动结果另列。016完整卡仍NOT_RUN，024完整最低FIXTURE/actual-command已独立V通过；当前工作树不能继续作为143输入等于11的证明。11原归档/manifest及10/11原I/V不覆盖，11未安装，该阶段桌面磁盘12/实际Runtime12。

## 未决项与范围结论

| 范围 | 当前结论 | 尚需的实际证据 |
|---|---|---|
| CORE | **NOT_ACCEPTED** | candidate.15已官方同名覆盖，独立33产物/144输入/9774原核心两遍零差异，实际Runtime15四GET正常；35正式卡保留10/11/12/14/15各自身份，旧10的011 FAIL与旧12的037/038 BLOCKED历史保留；原生注册/插件内存、其余逐卡、卸载零残留/数据保留及080仍待验 |
| AUTHORING | **NOT_ACCEPTED** | 025/026普通源码/保存分离、054/055/056/057最低scope V通过；059/060完整FIXTURE独立V通过；9真实源码/预览/读图后挂载失败、旧pub重启interrupted。10阶段GUI/内存未验的历史保留；当前17原生插件内存、实际mounted/原输入附加/明确保存/另会话重开仍待人工验收，058完整LIVE_MODEL未完成 |
| BUSINESS-WRITE | **NOT_ACCEPTED** | 历史价格与库存的4个授权写动作/公开状态/独立读回恢复已通过SCRIPT/REAL_BUSINESS范围；当前17上品、原生UI/模型业务操作及完整TST-078范围仍未完成，无新业务写 |
| DATA-CUTOVER | **NOT_ACCEPTED** | 最终1754文件备份新根restore/2773映射/源码签名PNG引用与普通npm ci重建SOURCE_EXEC通过，073最低FIXTURE卡V通过；12三冷备与安装不构成切库验收；未再次切桌面profile/dataDirectory，TST-079完整切库/运行历史草稿对账/条件回退仍待验，首失败与中间HOLD保留 |

用户批准价格 **54.80 CNY→读回→恢复54.79**、库存 **201→读回→恢复200**，本次流水四个mutation已完整成功并独立读回恢复。旧stock-test因顶层products解析遗漏曾pending/STOPPED；首次修复又被独立V发现嵌套SKU冲突而拒绝candidate.8，历史保留。最终严格offer/SKU/warehouse唯一匹配修复各52/52通过，`packages/core/src/write.ts`摘要为 `a166f50b9b407dc219518097930a204a6f402613857266c9a1bdbf47591e4e38`，测试见 `test/core/stock-readback.test.ts`。安装9后07:41:40Z只inspect原stock-test确认succeeded，独立registered查询确认201；新恢复操作完成后07:42:37Z确认200。原测试未重发；上品输入/动作另验。

用户截图的不可用提示已定位为真实业务源health超过旧1.5秒期限；Agent探测4180为旧服务查询，不是Apps自动fallback。修复默认10秒/短失败缓存、真实401/不重写边界后，candidate.9实际业务源健康读取ok。candidate.7原生技能目录列出hallmark-component-design及新描述，但无该turn读取SKILL/组件创作证据；后续candidate.9真实创作turn及原生历史已冻结，技能工具、普通源码/实际build/preview和read_image反馈修改有证据，正式发布没有mounted。主证据最初误选status字段而未列state，已以独立只读补充纠正；最后mounting行已超过deadline，不视为就绪。历史失败保留，后续新候选不得改写为旧请求成功。

09:51:44.607 UTC的原会话观察为1186 rows/886368 bytes，保留为历史。11:06 UTC当时只读观察为1267条记录，最近turn.end为10:52:35 UTC，相关8轮publication均failed_mount，尚无原生mounted通过。该时点桌面10主PID63296与4子进程、Runtime62564保留历史。后续受控停止/三冷备/官方12安装/桌面retry及四GET已实际执行，不能记作正式app.quit验收；preflight Roaming397文件与实际停写后396文件分别保留。11:30冷会话1269 rows/964632 bytes，11:45重开后1270 rows仅加end-seed且全部旧JSON前缀相同；最新原Bill文件964715 bytes、mtime=11:44:06 UTC，仍无新用户GUI prompt；该11:45观察的桌面36380/Host71548、Runtime60284；13:17的15实际部署另列。原native mounted/@/附加和暂不保存的用户测试待回复，用户已授权退出/重启无需重复许可。

candidate.9目录视觉与原生挂载失败保留，**VISUAL未验收**。局部重排/候选展示修复的candidate.10现已官方同名覆盖并正常重开，冻结706全仓/26视觉fixture/13专项/实际CLI双视口范围不变。新GUI/原生内存身份及实际mounted仍待真实验收；已有原会话新turn不等于成功；磁盘匹配/重开不代签视觉，旧Agent建议或runner截图不代签挂载。

实际备份首次因旧外部工作副本 node_modules 的 SDK junction 安全拒绝，原失败保留。修复限定可重新生成依赖缓存排除、manifest 记录和负例后，17 项检查、全仓 655 项及现场完整备份/恢复通过；不可变归档/证据的严格清单未放宽。恢复保留原 source/lock，file SDK 的相对锁路径在新根可能不适用；此时进入显式新 attempt，核实 SDK 定位后 npm install 生成新锁/输入 digest 并真实重建，不改旧回执。通常锁文件可复用时才使用 npm ci。

Client 丢响应原请求缓存可跨组件卸载/重开保留，但整页/浏览器进程重载后未承诺自动恢复；Runtime 原 invocation 持久可查。未知结果只读检查原身份，不生成新请求盲目重写。

后续执行追加 runId/scope/执行 commit/包 hash/断言/原始证据，并更新可变表。范围内强制项全部满足 [A.2 验收手册](requirements/A2/docs/03_ACCEPTANCE.md)后，才推进对应任务和范围的正式通过。

本轮目标按用户最新确认调整为**完成可用的应用框架**：在原DSH任意会话用 `@` 选择应用，Agent实际创建、编辑和展示组件；用户从原工具卡手动打开同一预览构建，显示失败可重新打开；支持搜索、勾选并附加到原聊天输入，手动发送。优先做好前端外观、交互和性能，只修改需要的应用/组件位置。实现保持克制，不擅自增加安全校验、审计或防御代码。

本轮以这些实际可用流程和界面体验判断交付，源码和说明更新到GitHub。TODO仅作为参考；原A.2状态、35 PASS/45 NOT_RUN与既有证据保留作历史对照，045/G5逐卡、满矩阵和R签署不再作为本轮交付前置。新的实际体验仍按观察结果记录，不把历史未运行项改为PASS。

 Apps A.2 实施与验收记录

本页记录A.2实施与现场执行，以下执行时间为UTC。**candidate.17已官方同名16→17覆盖安装**：812/812、类型/实际SDK与CLI/Runtime/诊断、145输入/33产物冻结；独立包32检查/17负例及官方ValidateOnly通过，20文件源码窄复核闭合。实际Runtime17/schema4、健康/Hallmark、Host监听和原2755行会话前缀核验通过；五份冷备regular files字节相同、内部junction重定位拓扑等价，源变化0。原两次冷备失败与旧16 lib/index.js预存38B漂移诊断保留，编辑者/意图UNKNOWN。正式验收为**35 PASS/0 FAIL/45 NOT_RUN**，原35卡保持10/11/12/14/15绑定，不迁17。Native内存/渲染/原输入/模型/业务/真实切库未验，四门禁NOT_ACCEPTED、R未签。

前轮起始main为 `ef54c46ec0178cb45149af65f0a7c8ceb5d29f51`；candidate.16阶段34文件已本地提交 `614814f34b08b096407825dcc6a7b26a47d1cf02` 并实际推送 `apps-component-display-retry`，远端ref相同；该批main三次InternalServerError保留原命令，当时远端main为 `06595bbd883ad57061d990a8b30691908f62af13`。本次17源码与说明的最终提交/推送以Git历史及交付记录为准。 历史15仅比14增加4份版本元数据及安装器泛化，共5项冻结输入变化；安装器在替换前核对全部33项tar二进制SHA与packed版本，在替换后核对磁盘33项产物。官方12→15覆盖已完成，Runtime15832/schema4与Host端口19387的监听已实际观察；启动包装exit1及observer传输异常保留，实际只读重开核对PASS另列。13全仓green后被独立边界审查阻断、14未安装的历史保留；14正式037/038完整最低V与15独立安装后验均已完成，下表按各自scope列明。

15归档SHA-256为 `0ae72a0fa7f02ea692cf861bc441f0464eb0a248ceddc9cd6f19468a03d29b64`，完整全仓命令记录 `ae6bfcf12b9a6d8a8eb3d0ce642b185698a82e14ce84277bc396f768e1e27aea`、verification-summary `6db8cf8f16e20acea8f588bbb712f9a27e1d47a19c220bc03f0d9fecf836e07d`、final-integrity `fd305d11193f7a75896179092151d5f72a2cd81b38b0a6ae3d3634449ec62650` 各按原实际产物记录；不覆盖14或迁移旧正式卡。

## candidate.17：同预览构建手动打开与失败重开（待验）

用户要求原侧栏手动打开同一成功预览build，并在显示失败后能重新打开。17的UI-only openDisplay/authorizeDisplayFrame/reportDisplayError已实施增量源码；publication继续固定构建/回执/归档，每次明确打开创建独立displayId/generation及新iframe/nonce。显示记录与准备快照在现有provider_records的component_displays/publication_views，保持schema4和原Runtime所有权；原startMount一次性协议保留兼容，在新侧栏路径中搁置，具体参数见[创作流程](source-component-authoring.md)和[ADR-010](apps-architecture-decisions.md)。17已冻结812/812与145输入/33产物并官方16→17覆盖，独立包32/17及源码复核闭合，Runtime健康/历史前缀通过；Native显示待验。

等待点击没有显示计时，不自动开栏。新侧栏直接加载同一成功预览归档，可信16旧归档由Host补协议nonce，Runtime仍严格校验；不为一次显示失败强制重建。准备态资源不能以“尚未mounting”为由拒绝：真实组合Host+Runtime隔离回归复现旧503并修正，原red/green与后续准备态/failed_mount/interrupted夹具各按实际范围保留。重开退役旧grant；旧nonce/frame/generation不能桥接、提交error/ready或导入导出UI状态。

error以phase/code/message写入当前display，Agent从inspect.latestDisplay/displays读诊断，不自动发送聊天。首次真实frame数据读取、React提交和全部required assertion PASS仍是首次展示门槛，不因重开降低。重复ready、已成功构建重开与历史P1显示不新增viewRevision，不覆盖当前活动构建；历史view_revisions快照bindings贯穿资源/数据/ready/UI状态/附加路径，不能给P1源码配P2数据。取消、被取代、无可信回执或权限失效目标拒绝，成功归档与旧失败材料保留；保存仍需明确请求。

前端局部61/61、type/diff实际0和源码/19条fixture引用冻结仅证明生产React/隔离HTTP或ComponentHost范围，actualDesktop/actualRuntime均false。独立V发现的owner变化无需rerender与directUiState旁路两个真实red保留，修复后的独立窄复核已冻结：20源码无新增变化、4项closed/无required open findings；后台兼容和真实Host glue补充均不冒充正式卡。TST-045的五次16失败保留，17完整矩阵正式I/V尚未通过，不提升原35/45、18 REVIEW/6 DOING、四门禁或R。

16阶段34文件实际本地提交614814f34b08b096407825dcc6a7b26a47d1cf02，并已推送apps-component-display-retry分支且远端ref相同；该批main三次InternalServerError未推成，当时远端main为06595bbd883ad57061d990a8b30691908f62af13。不能把分支push成功写成main成功；各旧命令/错误原样保留，17后续交付另记。

| 17准备 / 16分支交付证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-DISPLAY-FRONT-I | `evidence/apps-a2-20261007/manual-display-frontend/freeze-d5210b19-db81-40b6-9acb-6b9b7cacd94b/source-freeze-and-fixture-refs.json` | `64c26300100f681f870699de5be5d49dba4571f52fafbb21dc1c50174233a4a5` |
| E-BRANCH-PUSH-16 | `evidence/apps-a2-20261007/cutover/candidate16-delivery-e378d7c0-5ed8-4d49-9054-3fda357fea92/branch-push-actual-command.json` | `05d96ea343f8a03431616e5a87a2ae92045d23e1051952c53e1cb01489c4d64e` |
| E-DISPLAY-SOURCE-V-17 | `evidence/apps-a2-20261007/manual-display-review/review17-0a6c0313-26c5-40bb-9449-b6091b4a1df4/final-review-8ce2da0b-dbb4-4457-855d-2b6d628289e4.json` | `3eb21f006314fb33f2b54a06ce1007b4c9e965b0c565a4fdbc4d00672df82527` |
| E-PACK-17 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/verification-summary.json` | `e723637cc3fef3e286de0cca1103f7a54f38a40b5cb058bb5e93183926eee870` |
| E-PACK-17 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/verification-actual-command.json` | `4900e6aaf4e81afe80329e2b7ac29be1125186f3e374408c3883452dd09d2562` |
| E-FREEZE-17 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/final-integrity.json` | `b99b289e30a1390b28100c78257fed5e2e08b501f527dae354282c9829e2632e` |
| E-FREEZE-17 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.17/integrity-actual-command.json` | `49300b8ee3868611481f9369722672a8c212edc6b3999519f48c60396d04fb62` |

17归档SHA-256为 `e5cdbfefe9eab592f7cd733009deacdc215bab909a54cc09dd0128868bb3fa56`；812/812实际命令exit0，145打包输入/33产物与执行期间源码、旧16材料守卫零差异。独立源码复核20文件、4项问题已closed/无required open findings，原red和初期源码仍变化的记录保留。该独立复核使用原tgz内SDK16字节的私有新测试归档，Node renderReady为模拟；不是实际Bill旧归档或Native React显示，真实桌面进程重开恢复也未由三态fixture证明。actualNative/formalAcceptance/billActualArchive均NOT_RUN，不能把“旧SDK兼容fixture”写成“原业务组件原生已显示”。独立包复核与实际17安装已通过相应范围，原生点击仍待验；冻结时installed=false和Native/真实业务NOT_RUN不会因后续操作回写旧摘要。

## 当前17安装、冷备恢复与独立后验

16:09:13冷备v3实际exit0，五份备份覆盖Runtime、desktop userdata、原会话、整个workspace会话目录及实际旧同名插件。regular files字节相同、内部pnpm junction在新备份根重定位后拓扑等价，源变化0；不宣称junction绝对link bytes相同。这是本次私有停写冷备与恢复helper的范围，不能把它当成已打包维护CLI的新行为或完整Native恢复验收。15:52:50原stop-backup因旧遍历守卫拒绝Runtime内部依赖junction实际exit1，16:02:44冷备v2在复制前守卫exit1，两份失败均保留；不是workspace会话链接造成拒绝。

旧16初次独立安装后验曾与16 tar全部33项匹配；17切换前实际旧插件的lib/index.js已有一个prepared条件增加38B，其余32项仍匹配16。该文件mtime记为15:36:02，17官方ValidateOnly前后均观测到该漂移字节；ValidateOnly只证明观测到的38份profile文件前后未变，不能证明旧安装始终等于16 tar。诊断编辑者/意图为UNKNOWN_NOT_INFERRED，不推断改动者或用途；原失败、实际旧插件冷备和官方rollback均保留。

16:09:53官方同名16→17安装actual exit0；16:10:22派生正规化dispatcher启动actual exit0，16:10:51只读重开核验实际Runtime17/schema4、健康/Hallmark、Host监听进程3064及原2755行会话前缀相同。本轮未迁库或新增业务写，回退脚本保存在 `artifacts/desktop-apps-rollbacks/20261007T160950Z-776a1dc538c44dff951775da539bc77a/rollback.ps1`。独立安装后验33产物/145源码/原核心9774文件两遍零差异；最终3251引用、337包索引、352当前文件守卫及113原A.2/841旧证据守卫通过。Native内存/注册/原输入/模型/组件点击渲染、真实业务/切库和R仍未签认；等待用户实际原聊天操作不计为已发送或PASS。

| 17部署 / 独立复核证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-V-PACK-17 | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/package-installer-review.json` | `90c9352591d7a8a2a21a6388ccc8385849087762adcf8c029a6f47745cc53791` |
| E-V-PACK-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/review-actual-command.json` | `e11c6e0a4bf2c3e0256777e4b9247e298aed9eb4d96141424de114f0231df50d` |
| E-V-PACK-17 / official ValidateOnly | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/official-validation-result.json` | `a7d61dfc831092d6ef679b13cf6184905d4c3f057c55d8ee745a7c4fd6fca34b` |
| E-V-PACK-17 / official actual command | `evidence/apps-a2-20261007/formal-package-review/review17-bcf85e52-88f9-44c5-a80e-cf36ba2d65f8/official-actual-command.json` | `3d76b77d11e5df7bd9bc72fe16c3aa95600a2ae674c19e9ddb6dada95b324a5a` |
| E-COLD-17 / original exit1 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/stop-and-backup-result.json` | `7caa8aedf23eba776112d5158292a27aca2423f7d4fe8938d24a5267455af2e3` |
| E-COLD-17 / v2 guard exit1 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/cold-backup-v2-actual-command.json` | `19c4edeae0878400584af25a74e8560015d5808336b559bd8602a9269f2c8cef` |
| E-COLD-17 / v3 exit0 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/cold-backup-v3-actual-command.json` | `ce673e93b3927d12d3ec2ee5256fa40da86df661cc5ed9cc2cf28ddeb1e512c6` |
| E-COLD-17 / recovery | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/operation/cold-backup-recovery-v3.json` | `3ffb7c494c545815c10ba8bda8a42beb4e0440d85d63d52182d9b1e4663fb7ef` |
| E-SKEW-16 / diagnosis | `evidence/apps-a2-20261007/formal-package-review/installed16-skew-859781c1-a175-4266-8489-ddeb136a576f/diagnostic-result-amended.json` | `25d0e3cf5a4479d7b9b93f7c217288c421d308482fe4afa201949a4dc19ad445` |
| E-INSTALL-17 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/install-recovery-v3-result.json` | `4d6dfe316a6232ec49909209d627a599bf1cb2b7a9a20f635a2780bbd0f0656d` |
| E-START-17 / actual command | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/start4-actual-command.json` | `5bb8503330bd62795240c5bbd3b858bc277325bef08e38b9087820a431d5832c` |
| E-RESTART-17 | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/read-only-restart-check-v3.json` | `bb8d18b584bb83a64621357688acdcd010abc9f484579207344092c7658c7c23` |
| E-RESTART-17 / actual command | `evidence/apps-a2-20261007/cutover/candidate17-operation-8a1f0361-ae39-4813-b0f7-3c09f3c8ba75/read-only-check-v3-command.json` | `57d226aa538ada6e21631975772803691b23c5eab755d1e1ba962b4a8296835c` |
| E-DISK-17 | `evidence/apps-a2-20261007/formal-package-review/postinstall17-051cc8ef-bfeb-4e6b-ae58-fd942da03a3d/result.json` | `937bfcb673dd393ab146f497c07bc0e49d63200f6bafc62e2ed7cde11871f9d0` |
| E-DISK-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/postinstall17-051cc8ef-bfeb-4e6b-ae58-fd942da03a3d/postinstall-actual-command.json` | `af68a6e25257c5467e4ffce5a5d5459b44d9913af1fb6039d169aa62979b13ce` |
| E-V-FREEZE-17 | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/freeze-result.json` | `c4967500fb09a0d4d633923ac7542ead892b399155ca1ee77cde9dc6278af632` |
| E-V-FREEZE-17 / actual command | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/actual-command.json` | `c9273117b5af068be0d04ab83e9658614a9bbdcf063b8b5d344b7c5f647217d6` |
| E-V-FREEZE-17 / closure index | `evidence/apps-a2-20261007/formal-package-review/freeze17-fdfc32b2-d1ad-4e5e-afcf-8536f125af10/closure-index.json` | `bf1d19f9c7a9426276635a0bd4f16a60e290cbbb21a20adbe48508d3794ddbfd` |

## 已验增量与历史16实际安装

| 增量 | 完整最低scope / 实际结果 | 执行身份与边界 |
|---|---|---|
| TST-034 | FIXTURE/actual-command/静态依赖审计；I/V各124/124 | candidate.12，143输入/33产物/4ca9；101注册入口、165HTTP、484SQL。Host有FS/日志/进程端口能力，无SQLite业务事实，不称noFS |
| TST-035 | FIXTURE/actual-command；I/V各40/40、最终V1774/1774 | candidate.12；对象键重排保持dataset，数组/connection/projection变化区分dataset，major/schema拒绝与view/display身份分离 |
| TST-036 / TST-039 | FIXTURE/actual-command；独立V完整最低范围通过 | candidate.12；真实2→3迁移与quarantine、实际React构建/双视口/引用GC；旧037/038完整V被阻断的报告与I事实原样保留 |
| TST-037 / TST-038 | FIXTURE/actual-command；I/V各31/31、V20语义/12377检查/1955引用、30份V SQL副本 | candidate.14，144输入/33产物/d892；037=18、038=8、公共guards=5。独立V追加captured14 CLI输出wx碰撞8/8，不发明为原I31步骤；Native/真实业务/真实现场停写/R未验 |
| TST-046 | 本地FIXTURE/实际命令；I/V各13/13、每轮三入口各30真实样本；V18语义/135811检查/38234引用 | candidate.15、执行commit06595bbd；10000行/1000能力，真实hrtime/HTTP/SQLite/packed SDK，UTF8候选上下文不是token/模型消费，不是现场延迟承诺 |
| TST-047 | 材料/追踪FIXTURE；I及独立回放各204/204、V44/44/48803引用 | candidate.15；48历史路径全部可读，旧33身份与未运行范围保留；6项原source/build身份没有原归档执行hash链，不补原声明或放行四门禁 |
| candidate.15 包/安装器 | 778/778实际exit0、类型/SDK与真实CLI/Runtime/诊断；独立29检查/17负例通过 | 144输入/33产物；14→15仅4份版本元数据与安装器5输入变化，独立包复核未重跑全仓CI、未把14正式卡转15 |
| candidate.15 实际部署与后验 | 官方12→15同名覆盖exit0；实际Runtime15/schema4/四GET/健康/会话前缀核对；磁盘33/源144/核心9774两遍零差异 | 启动包装exit1、observer继承stdio问题与operatorExit=null保留；实际监听/只读重开证据PASS。后验不打开原SQLite、不操作GUI，不代签Native或TST-001整卡 |
| candidate.16 包与静态独立复核 | 801/801、类型/实际SDK及build/preview CLI、Runtime/诊断actual exit0；独立包31检查/17负例、默认与显式ValidateOnly各exit0 | 144输入/33产物；19文件独立源码复核无阻断、ownTestsExecuted=0，仅静态，不计为Native或正式卡V |
| candidate.16 实际部署与后验 | 官方15→16同名覆盖、三冷备核对、实际Runtime16/schema4/健康/四GET/历史前缀通过；33磁盘产物/144源码/9774原核心两遍零差异 | 未迁库/新增业务写；start首轮清单形状错误exit1和派生正规化重开exit0保留。Native内存/原输入/手动点击展示、正常app.quit/卸载与R待验 |

本次正式卡按执行包分布为candidate.10十张、candidate.11十二张、candidate.12九张、candidate.14两张、candidate.15两张，共35张；不拼成candidate.15整套正式验收。旧12的037拒绝报告未控制真实入口、038导出/inspect早于冻结均为BLOCKED，旧I和V不可重写。14持久enrollment/decision、启动/HTTP/body完成/Provider/调度守卫补齐后，独立V验证真实拒绝和恢复边界；冻结rename索引1、第一条导出SQL索引2、输出索引22。I辅助runbook有1项SHA差异，其余176执行源码/config/requirements与V一致，177捕获源、144打包输入/33产物和d892归档独立冻结。原operation GET为纯SQL读；POST inspect可追加恢复账本/事件及原unknown状态，不重发或逆向业务写入，不能称SQLite零写。操作说明见[维护手册](apps-migration-runbook.md)。

## 历史16部署与历史15范围

14:54:09 UTC受控停止/三冷备实际exit0，14:54:31官方同名15→16覆盖exit0，回退备份 `artifacts/desktop-apps-rollbacks/20261007T145428Z-5faffa6da94b4c11a4a29b141ff54dc1` 私有保存。首轮start在launch前因清单singleton被误作array退出1；新派生v2只正规化输入shape，14:55:11实际重开exit0，原失败不覆盖。Runtime PID14488、桌面PID19344与Host监听进程66800实际观察，14:55:19只读重开检查为Runtime16/schema4、四HTTP200和Hallmark健康；冷备1766行原会话历史逐项作为当前1767行前缀保留。本轮未迁移数据目录或新增业务写/保存，受控停止不代签正常app.quit。

| 当时版本域 | candidate.16历史实际状态 | 证据边界 |
|---|---|---|
| Bundle / Host磁盘 | `1.0.0-candidate.16`；33安装产物匹配 | 原同名15→16官方覆盖，插件原生内存/注册仍NOT_RUN |
| Runtime | `1.0.0-candidate.16` / schema4；PID14488 | 四只读HTTP200、Hallmark健康，不代签原生frame |
| 桌面 / Host监听 | DSH `0.2.0-rc.2`；桌面19344 / Host66800 | 实际重开，Native原输入/手动点击/显示与模型闭环待验 |
| 16冻结包 / 后验 | 801/801；144输入 / 33产物；原核心9774两遍零差异 | 31包检查/17负例；289引用/331包索引、55审查子进程退出；原SQLite未打开，GUI未操作 |

后验于14:56:17 UTC通过，独立freeze于14:56:23实际exit0/PID已退出。两次磁盘清单中33安装产物、144源输入和9774原核心文件均一致；最终289引用、331包索引及包/源码守卫通过。静态手动契约独立复核只读19文件，关闭两项P2源码问题且自身未执行测试或Native操作；不能把归档或磁盘后验当成模型调用/用户点击/展示确认或TST-001整卡。该轮TST-045未通过完整故障矩阵独立I/V，五次16失败保留，35/45不变。

| 16部署/复核证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-MANUAL-SOURCE-V | `evidence/apps-a2-20261007/manual-open-lifecycle/independent-review-a5822f6b-e534-4a96-8376-6c801ac59fb8/result.json` | `26b3ce2c7d79ae4334ddb53f6bb998e7f621d9c679b613c930835e66f84c2b53` |
| E-V-PACK-16 | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/package-installer-review.json` | `170e09790dc0d2d0677c9c5a64ac85e6b3590cfd4294097c007de94225c44c3c` |
| E-V-PACK-16 / actual command | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/review-actual-command.json` | `e6f96d622faedbb553743046e7ea83a1d9742f6b7c354e29530eeb8d02faed63` |
| E-V-PACK-16 / official ValidateOnly | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/official-validation-result.json` | `9824784ceba723a2740d7d94010146f3fe442dc8ff860c2b6eb4710ca204c7f7` |
| E-V-PACK-16 / official actual command | `evidence/apps-a2-20261007/formal-package-review/review16-2f309664-833f-4437-a282-2f375c17b8c9/official-actual-command.json` | `c8d617a0a7a0b3d5653740def40c491c3b01c1ca8b0a9dc23eacb1662facf56d` |
| E-COLD-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/stop-and-backup-result.json` | `b5db08b42e0bdf0bba10ff09595157295baeaddcc338bf7784772243926f20cb` |
| E-INSTALL-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/install-result.json` | `a6b4ced3a43fb73f4fbd7b6b4ef5c831984cfae1d53740f167712c57ba23dc27` |
| E-START-16 / first exit1 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start-actual-command.json` | `7ccbef41de4467fefa8bec6f1ed19560f82359d9373d70e19273c60ecc27219d` |
| E-START-16 / normalized exit0 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start2-actual-command.json` | `50d27cd302fda4baeb2675bc64d86e4266f4adab3dbee9168a50a5515a990a5d` |
| E-START-16 / dispatch | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/start-dispatch.json` | `de9a0a1d17b92c580293be8c47edf2d264dc765717ba6634388c8d89569fc90d` |
| E-RESTART-16 | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/read-only-restart-check.json` | `bcc3131df2488812a05344286c8f34f600ca402a3db9f93ecc400a4c9e97446f` |
| E-RESTART-16 / actual command | `evidence/apps-a2-20261007/cutover/candidate16-operation-75ee4cde-aefd-4d2b-971e-5e8d550793d3/read-only-check-command.json` | `706b5878f55b2986fd7d289710f03e7f1620f36e057a7407dc3832b02054737a` |
| E-DISK-16 | `evidence/apps-a2-20261007/formal-package-review/postinstall16-dd8df5d6-a56e-4bad-8f3a-43589c3b3e07/result.json` | `ec73d920761bd087ad4fdff9d6419cf10a127e9bcbbc9d18f3e200e9f8aadd19` |
| E-V-FREEZE-16 | `evidence/apps-a2-20261007/formal-package-review/freeze16-43ca61cf-790c-4de1-9ae7-57d9a88df4a0/freeze-result.json` | `f41035d61f151d10dd497e78d515d8841b9f1132f4493b2acab39db14674f76a` |
| E-V-FREEZE-16 / actual command | `evidence/apps-a2-20261007/formal-package-review/freeze16-43ca61cf-790c-4de1-9ae7-57d9a88df4a0/actual-command.json` | `4981b0a4fbd2555431e024a6bdd16d898f1206255d012a5e6b3737a9706ad0c0` |

| 版本域 | 历史实际部署candidate.15（当时） | 实际证据 / 未决范围 |
|---|---|---|
| Bundle / Host磁盘 | `1.0.0-candidate.15` | 官方同名12→15；33安装产物匹配，Host端口19387由47036监听；插件原生内存身份仍NOT_RUN |
| Runtime | `1.0.0-candidate.15` / schema4 | PID15832；健康和四只读接口通过，未执行新业务写入 |
| 桌面 / 协议 | DSH `0.2.0-rc.2`；HTTP/catalog `1`、bridge `2.0` | 桌面主进程42636实际重开；Native输入/渲染与模型整链另验 |
| 冻结包 | 778/778；144输入 / 33产物 | 15归档0ae72a0f…，仅包/源码/隔离执行与安装磁盘范围 |

13:14:04–13:14:38 UTC受控停止及冷备命令exit0；13:14:53–13:15:01官方同名安装exit0，原插件/配置回退备份保存在忽略目录 `artifacts/desktop-apps-rollbacks/20261007T131458Z-60985ee33fad41879efb6e894fadf01d`。启动命令实际已写Runtime/桌面启动记录，但observer继承stdio等待close，包装进程被精确停止后exit1；补充start-dispatch报告保留operatorExit=null。13:17:22独立只读检查确认四GET/监听和原1270行历史前缀全部相同，13:20:07独立后验两遍33/144/9774零差异。最后独立freeze又核对185交叉引用、330包索引、472私有文件守卫零差异，56个审查子进程均已退出。此范围不代签正常app.quit、原生注册、卸载、组件显示或现场数据切换。

## 新增046/047验收与手动打开要求

046/047仅按完整最低本地FIXTURE/实际命令范围通过独立V，正式表新增两卡为35 PASS/45 NOT_RUN；原33张PASS的全部825字段、前10列800值、113份冻结A.2输入与原48基线保留。24任务仍18 REVIEW/6 DOING，四门禁NOT_ACCEPTED，R未签认。两份新harness不属于144打包输入；本次结果使用当时冻结candidate.15，不能把后续candidate.16工作树冒充旧执行快照。

TST-046使用20个应用/1000项能力和固定10000条中文数据，direct tools、SDK script、mixed三入口交替各30次，I与V均真实执行90个样本，每组30成功/0失败。I与V分别计算nearest-rank P50/P95，不合并样本：I为678.53/798.30、1101.53/1617.60、1155.86/1637.62 ms；V为711.51/819.24、1153.18/1672.42、1155.79/1758.35 ms。候选模型输入序列化UTF8为23175/8816/17804 bytes；实际查询投影单输出最大392 bytes，并核对16 KiB单输出预算。这里没有模型消费/token量测或加速承诺；含记录HTTP、SQLite和首次冷执行成本，SDK脚本回调/汇总为明确披露的fixture调用代码，不是新增产品执行器。V的135811检查、18语义及38234引用通过；首I失败与私有V相对元数据root错误校正保留，不改旧记录。

TST-047实际逐项读取原48、冻结80和当前80，核对输入/输出、命令退出、版本/scope/断言、可读附件及包字节；I与独立回放各204/204，独立V44/44。执行时原表33 PASS/47 NOT_RUN、48路径全部可读且仅为历史，不自动继承为当前验收。known CSV archive→package-manifest→实际旧包字节只证明现在可读的已知包；055/056/073/075/076/077的原候选/source/build身份保留，`originalArchiveExecutionHashClaim=false`，没有原同祖先归档执行hash链。A.2 §08最低记录字段未要求统一candidateArchive顶层字段，不能以这个附加要求改旧33，也不能给旧记录补原声明。054原V的formalResult与archiveEvidence、059/060原V→父result→cards.recordRef保存真实耦合。未知archive/null候选和提供的hash冲突拒绝；旧candidate/scope不迁移15，资格CLI始终releaseApproved=false。旧reader失败及一次额外统一归档字段审查FAIL保留，新V按原完整最低范围复核并明确材料边界。

用户最新确认：在任何原会话用 `@` 选择应用，Agent实际构建并预览后，在原聊天工具卡提供“打开组件”，由用户手动打开到原侧栏；等待点击不计挂载超时、不自动展开。candidate.17增量将成功预览构建与独立显示尝试分开，UI-only openDisplay/authorizeDisplayFrame/reportDisplayError加载同一归档；失败可明确重新打开，新display/frame/generation退役旧文档，Agent可inspect读取phase/code/message。旧startMount一次性协议保留历史兼容，在新侧栏路径中搁置。candidate.17候选包已冻结：812/812、145输入/33产物及旧16冻结材料守卫零差异，独立20文件源码窄复核闭合；归档SHA-256为 `e5cdbfefe9eab592f7cd733009deacdc215bab909a54cc09dd0128868bb3fa56`。candidate.17已官方同名16→17覆盖安装；独立包32检查/17负例及官方ValidateOnly通过，实际Runtime17/schema4/健康/Hallmark与2755行原历史前缀核验；Native内存/侧栏点击显示仍待验，不将局部源码检查算作正式卡或显示成功。契约见[ADR-010](apps-architecture-decisions.md)和[创作流程](source-component-authoring.md)。

14:08附近candidate.15的原Agent确有真实构建和420/1040预览、8项互动通过，但原publication仍failed_mount，frameInstanceId字段缺省，未证明Native frame显示；用户中央聊天和右栏fallback截图是实际问题，不能归因于用户没有切聊天，也不能把官方mounted事件解释成右栏已经打开。Root随后只inspect原publication，HTTP200、零新发布/业务写；旧失败保留。16采用新的准备/点击流程；安装后需明确开始新attempt并实际构建/预览和手动点击，终态不会复活为成功，原失败不改写。

candidate.16的 `apps.authoring.publish` 将 publication 保持为 `prepared`、attempt 为 `publish_ready`，`mountStartedAt/readyDeadlineAt` 均为空。固定publication GET保留当前已提交view源码，候选只在 `publication.source`。原聊天卡固定所属session/view/publication/attempt/epoch/build身份；Observer只通知，workspace不自动展开。用户点击经Host UI路由调用 `POST /v1/authoring/startMount`，`params` 必须同时提供 `viewId/publicationId/attemptId/attemptEpoch/buildId/expectedViewRevision`。Runtime重验当前代际、view CAS、签名build/preview与归档；首次有效点击才创建15秒期限，重复不续期，终态不复活。该路由不注册成模型能力。真正frame完成授权、数据/状态恢复和React提交后，才确认展示并提升active/last-good。

prepared重启保留，取消或新attempt取代时终结所属prepared候选；旧mounting重启仍interrupted。保存共享路径对存在authoring draft的view选择性执行同一门禁，prepared/mounting或未确认构建不能绕过 `apps.authoring.save_component` 改用通用save保存；无authoring draft的旧static/legacy路径保持原行为。后端首次30/30针对性实际测试的typecheck exit2保留；后续保存门禁38/38与typecheck exit0仅证明源码/本地实际HTTP和隔离Chrome范围。完整包801/801和这些局部结果均不提升TST-045、Native/模型或四门禁；原35张卡仍按原候选绑定，不迁移16。

| 16阶段证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-MANUAL-BACKEND-I | `evidence/apps-a2-20261007/manual-open-lifecycle/implementation-0bb3c163-db41-4e49-8399-159dac8a3ecc/implementation-summary.json` | `55865beb91965f0d5f41591860bda8410c62eb49e1f7d5bf8bce026aa00aa70b` |
| E-MANUAL-SAVE-I | `evidence/apps-a2-20261007/manual-open-lifecycle/generic-save-final-ad939fce-cc5c-46ff-a1af-ff5d90985877/generic-save-summary.json` | `284cc4f94ad0e1cc1ddd68942e3fc489e137869202762c3bed0dfb07fb8e52ad` |
| E-MANUAL-SAVE-I / command | `evidence/apps-a2-20261007/manual-open-lifecycle/generic-save-final-ad939fce-cc5c-46ff-a1af-ff5d90985877/command-result.json` | `d75eb663e7ff510492f4fb03c3bdcfab4f212d565601a96c1bf673d01f072d0e` |
| E-PACK-16 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/verification-summary.json` | `532fd3fd0acb58749143cd95d442b9d9dab416d5e9cd5bca8f9d768a4de54905` |
| E-PACK-16 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/verification-actual-command.json` | `adb7d088199bff1ef54bea5a74268dbcdae212fbcc1c04cb150150a11ad4f753` |
| E-FREEZE-16 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/final-integrity.json` | `46b3957a71ebecdaa1521fd06cea0bc0f170b43130c9d0db3f8ce0e6ff097e84` |
| E-FREEZE-16 / actual command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.16/integrity-actual-command.json` | `976585bc53dd43657d53a9cdf04f71a4887d21107cc6177857a98d571ec983f8` |

16归档 `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.16.tgz` SHA-256为 `ea7d82c42d1a9efc73cc96aa354ff863cd9d513570877dd84d42ac6ea84475c6`；源码144输入和33产物逐项冻结，执行期间源码/旧15材料守卫零差异。包摘要的installed=false、nativeAcceptance/realBusinessAcceptance=NOT_RUN按本次打包范围保留；待后续实际安装和原生记录另列，不回写旧包摘要。

| 证据 | 原始材料（本机忽略目录） | SHA-256 |
|---|---|---|
| E-I-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/a2-runtime-benchmark-5f29805b-fb2f-4e5d-a385-f2650c3aab39/result.json` | `e08fb076c2fd387193ff1ab15d30ab80035bfd53dca021b9ef5c2aa21af2f8f9` |
| E-FORMAL-046-15 | `evidence/apps-a2-20261007/formal-runtime-benchmark/a2-runtime-benchmark-5f29805b-fb2f-4e5d-a385-f2650c3aab39/TST-046/FIXTURE/result.json` | `f0a7dcdd9cebe095bda642425fac5d1e8601780f6fc097213860f0d13c1a5f9b` |
| E-FREEZE-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/freeze-c63e63bd-b77f-4e5b-87aa-7cdd9fe9cd51/freeze-result.json` | `0f616716f70f8372e66eca2706a12d0d38ac3b8411b03dc6127e23720bb299ca` |
| E-V-046 | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/review-summary-final.json` | `9f6d3a776247ce0cfe03c7a2243567d9cbf73a94e32365e3f3788c0e9000c29b` |
| E-V-046 / command | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/review-stage2-command-result.json` | `fbdd6342089e71c74ffc130142c826ce01aae699b06c80d6136b722a933a73ed` |
| E-V-046 / index | `evidence/apps-a2-20261007/formal-runtime-benchmark/independent-v-046-075c36b1-8231-41b7-a158-80519fb2d087/final-v-artifact-index.json` | `f4e55afbcc23985612be4b0bc105a446c6b60cbbe31b8afd3db907a7f68aea08` |
| E-HARNESS-046 | `test/acceptance/runtime-benchmark-a2.mjs` | `ed764f964cf0ba9f3f3dc83ddcff7067bd7d55bc28a7eb90112f92b802608e4b` |
| E-I-047 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/result.json` | `440fb5d9de2322ec3c0620d44cf6eff033ea108fe11abfd153fd74bf98170636` |
| E-FORMAL-047-15 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/TST-047/FIXTURE/result.json` | `2d015d2eab324a469dcdda7b575e8dc98b457d1a217bff0b6f8edb73fdf4eca4` |
| E-FREEZE-047 | `evidence/apps-a2-20261007/formal-release-traceability/a2-release-traceability-52433dd7-3e3e-4ae3-aba4-9776dba3b0a8/artifact-freeze.json` | `467569c6d1523d5116e2f6ee202f977b90ff8a1478e7463a995ca75e8df8f6e6` |
| E-V-047 | `evidence/apps-a2-20261007/formal-release-traceability/independent-v-047-d4b952cb-1727-492a-a549-78e37e801e67/review-summary-final.json` | `1919ab4c4badc40a2208867b54d6cc35bc0c5ddd899a223fe045d7f1d86e9931` |
| E-V-047 / command | `evidence/apps-a2-20261007/formal-release-traceability/independent-v-047-d4b952cb-1727-492a-a549-78e37e801e67/review-actual-command.json` | `6eb7dbac27b5ec04ed981ecff33e535287c8504625a4ff7c5fcd8ec2eb152587` |
| E-HARNESS-047 | `test/acceptance/release-traceability-a2.mjs` | `041e185ca2b7ae613c2cdb1dbe6cd823f458888ba74221583fbd21115bd935c3` |
| E-NATIVE-15 / inspect | `evidence/apps-a2-20261007/native-resume15-4b4d2611-7e1c-409f-8422-d877c4ddd189/publication-inspection.private.json` | `10af8e8ab95355b3b8abef795931ac6642d40f478397ba3900ec0c7f4e5c2943` |
| E-NATIVE-15 / build | `artifacts/apps-a2-bill-runtime-restored/authoring-evidence/build-f6fff6a9-cb89-4632-978a-5e10f5955e63.json` | `96061e7e37e34b8dab8adc37fbd6dc28baafa06cc9e223dafd2f3e87c4969313` |
| E-NATIVE-15 / preview | `artifacts/apps-a2-bill-runtime-restored/authoring-evidence/preview-e91a1573-2df3-44fa-97a8-b4ae3b08da85.json` | `3b8f0d2097f8984d7e329a9b9887ffa5bcdb9d3a4ade780c97d1553ab5cfb953` |
| E-DELIVERY-15 | `evidence/apps-a2-20261007/cutover/candidate15-delivery-c5face90-1ecf-4428-9896-7b10f83d8fe9/delivery-result.json` | `0bd46cb8b79379307dc4c92d30c90e139163f267a208525812a467e87a6d1d7d` |

## 历史候选与输入记录

前轮**candidate.10（Host candidate.10 / Runtime candidate.7 / schema4）已于08:52:03 UTC通过官方插件管理器覆盖原同名插件，08:52:34 UTC正常重开桌面；五项安装文件hash、143个冻结源输入零差异、实际Runtime/三个Provider/Hallmark健康及唯一writer已核对。** Host/Client内存身份、实际GUI视觉与新authoring仍未通过；原Bill会话已有后续turn，挂载结果按最新只读记录另列。包冻结前706/706、类型检查、视觉fixture26条、实际包内CLI双视口10断言和只读smoke通过；独立备份工具另有22回归/加强碰撞单项/typecheck，最终备份1754文件/25集合apply/verify通过。candidate.9真实Agent创作到源码/build/preview/读图迭代但原生挂载失败，旧最后publication重启后interrupted；价格54.80→54.79/库存201→200四个授权写入恢复历史保留，本轮无新业务写或保存。四个范围未整体放行。

逐项进度见 [24项任务](apps-a2-tasks.md)和 [80项对照CSV](apps-a2-progress.csv)。CSV将相关检查与正式TST分开：TST-003/004/011/012/013/014/015/017/018/019/020/021/022/023/024/025/026/054/055/056/057/059/060/073/075/076/077二十七卡完整最低scope已独立V复核，该阶段为27 PASS/0 FAIL/53 NOT_RUN；`formalAcceptanceStatus=PASS`仅指该卡范围。核心四卡003/004/011/012、013–015、017–020及023共十二张PASS绑定candidate.11归档与各自执行源码，另外十张PASS保留candidate.10身份，新增五张PASS绑定candidate.12，不拼成任一候选全套二十七卡验收。旧10的TST-011 FAIL与所有历史证据原样保留。当时实际安装为candidate.12（Bundle/Host磁盘12、实际Runtime12/schema4），原生GUI/插件内存未验；10/9/7历史各按原范围记录，原正式卡不自动迁移12；24任务尚未整体VERIFIED，四门禁NOT_ACCEPTED。

前轮五卡增量：TST-021/022/024/025/026完整最低FIXTURE/actual-command独立V通过，该阶段27 PASS/0 FAIL/53 NOT_RUN：12五卡、11十二卡、10十卡各保留执行身份。TST-024 I64/64、V125/125及独立回放64/64/exit0已通过；016、Native/@/组件挂载和R未签认。新增script-run、error-contracts、source-view-save三个公开harness不属于143打包输入或既有774项CI glob，candidate.12归档/产物未改，该五卡批次未重打包、重装或重跑全仓CI；后续14新包778项另列。上一轮候选12源码/部署/说明与API/SDK、Runtime写入边界、模型预算harness已实际推送main `13f80f2cb351e979fc410c2b833e37860ceaf32e`；本轮三harness与7份说明增量的提交/推送以Git历史和最终交付为准；当时进行中的TST-035未纳入该批；后续完整最低V通过的31卡增量另列。

## 固定输入与版本

用户交付的审计包按原字节保存在 [requirements/A2](requirements/A2/README.md)，归档 SHA-256 为 `30f8a9809dd4a358c24faac4a430701061f0c6e396db5b6bdc24a286407d6ad3`。实施父提交为 `caea8175b5c7507bf942b2e752a7327063bfdd43`。输入中的 TODO、NOT_RUN、reported 状态与原 48 项历史记录均保留，没有反写成本轮通过。

`.gitattributes` 为 `docs/requirements/A2/**` 禁用行尾转换，防止 Windows 检出改变输入字节。提交前已核对113个暂存blob与原工作区副本，差异为零；检查记录SHA-256为 `35c2e9ef5dd3486f616ce535d1e83c996c6f456715e69fd9c407ba4afedce627`，范围仅为Git输入字节保留。

原包检查的范围为DOCUMENT_PACKAGE_ONLY：80需求、24任务、20发现，产品测试零次。570项是父版本基线，655项是candidate.7与当时备份修复快照；candidate.9的694项、candidate.10的706项分别保留。核心实现已推送main提交 `92b094888606db0391e9f06a14c006db8191a1fd`；独立备份修复/前轮说明已推送 `e53fd18a0bedb011db69dd2b87e159c5bb67cf75`；其后5份验收/审查文件（build/archive、preview、maintenance、release gate测试与checker）和7份说明已推送main `a635ec443288218ffe16a189b7aa68600dd21f88`，远端一致。`authoring-draft-ledger-a2.mjs`、`authoring-publication-a2.mjs`、`core-contract-boundaries-a2.mjs`、诊断回归、新11源码及7份说明所在16文件已推送main `0824a4a5ae76300616576c2efa5621a8f0144ca0`；其后 `api-sdk-contracts-a2.mjs`、`runtime-mutation-boundaries-a2.mjs`、`model-budget-a2.mjs` 与candidate12源码/部署/说明已实际推送main `13f80f2cb351e979fc410c2b833e37860ceaf32e`；独立验收harness/测试/说明不属于143打包输入，Runtime/Host诊断源码与3份版本元数据则纳入新11的143冻结输入。054实际产品源码executedCommit=a635ec4，执行harness另存原字节；059/060完整FIXTURE已独立V通过，实际执行仍绑定candidate.10与当时a635ec4原始源码。055/056和057记录executedCommit=e53；075/076原08:24执行commit未记录，09:30对既有源hash/测试trace的复验为verifiedAgainst=e53、reuse=true，不能反写原执行commit。

| 版本域 | 历史部署 candidate.12 | 现场边界 |
|---|---|---|
| Bundle / Host | `1.0.0-candidate.12`（磁盘） | 官方同名10→12覆盖、33产物/143冻结输入匹配；桌面重试启动，插件原生内存/GUI仍NOT_RUN，旧失败历史保留 |
| Runtime | `1.0.0-candidate.12` | PID60284/36994实际identity与四GET200/Hallmark健康；非原生组件创作验收 |
| Apps 数据格式 | schema `4` | 实际源离线迁移、完整备份/新目录恢复及桌面配置入口切换已执行，原源目录保留 |
| HTTP / catalog / bridge | `1` / `1` / `2.0` | 原八个 bridge 方法保留；新增能力通过 features 协商 |
| DSH | `0.2.0-rc.2` | 官方桌面为目标；隔离浏览器不代签原生输入 |
| 根 package / 旧合约 | `0.3.0` | 历史版本域，不能判定整套 Apps 运行版本 |

历史candidate.12 Runtime产物SHA-256为 `7ac300aeaa5f7ff6507d0d30bb1d1d4641d9be4cef7e651eec6c64ef17f2ef39`；旧10/Runtime7产物 `2264139fc4404a11dbe9fdde00a374b541d1bda1544ef784483bfb6547cc9844` 保留原范围。candidate.7 / Runtime candidate.5原安装/@/只读模型及入口切换为历史事实，证据版本不改写。更新9前的ValidateOnly记录原7桌面运行，用户正常退出后07:40:25Z由官方CLI执行7→9覆盖安装。candidate.8首版因独立审查发现嵌套SKU匹配边界而 `REJECTED_IMPLEMENTATION_REVIEW`、未安装，私有证据保留。

candidate.11已冻结新归档，Bundle/Host/Runtime均candidate.11、schema4，SHA `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`。冻结时143输入比旧10只有5项变化（Runtime/Host诊断源码与package/server/versions元数据），9个打包文件不同；Client、SDK JS/声明、starter、两CLI及maps与10原字节一致。新11核心四卡已实际重跑I26/26并独立V通过，最终包全仓727/727及类型/SDK/CLI/只读smoke/包内诊断通过，新11未安装到桌面。10:03:40的旧10输入观察与10:07后续5项差异分别保留；该11阶段22 PASS由新11十二卡（核心四卡、013–015、017–020与023）和旧10十卡分别组成，不自动迁移其他10卡，当时已安装入口为Host10/Runtime7/schema4；后续12实际部署另列。

历史已安装归档 `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.10.tgz` 的SHA-256为 `7a07175ca7d824c5b68892c5eb6c0492abd8bf75c7f0df27b5d4029e0a54e84a`，冻结包/manifest未因独立备份工具修复重打。历史candidate.9归档为 `dc0c884bcaa0f94d063ddbd9ad2a484b2e877293a0a3c39310b6017955a89154`、candidate.7为 `46a5d6c9910027c19c33b9327270f6418b51434d8018e06e770b21d302bcb524`，不能互相代表。归档、回退脚本、完整备份、签名回执、图片与原日志私有归档，公开仓库只保存范围/结果/摘要，不发布业务、凭据或Runtime数据。

历史12归档SHA `4ca9cf8cc8f5f727701c3457137142ea578ec85ee47f04044658699955b6051a`，Bundle/Host/Runtime12、schema4，774/774 exit0、类型/包内SDK/实际双视口CLI及只读smoke通过，360执行源码/143输入/33产物检查零差异；11原归档和7项前轮元证据未变。12与11有13打包输入和18产物变化，含固定12安装器、profit/错误边界/Pane修复；不迁移旧正式卡或宣称Native通过。

11:30:45–11:31:16 UTC受控停止了原桌面和Runtime并复制/检查Runtime冷备，但冻结operator使用裸true/false写记录，exit1，未在该失败阶段安装/启动。原脚本/结果不可变；11:36新增恢复入口不再停止进程、不覆盖旧备份，三冷备2202 Runtime+396桌面Roaming+1原会话共2599文件字节核对通过，totalBytes字段原null保留，不伪造总数。11:37:55官方同名安装12 exit0；独立磁盘比对9774核心文件原路径字节未变、33安装产物匹配、143源码冻结。此冷备/安装不是数据迁移或正式app.quit验收。

首次start记录exitCode0同时errorETIMEDOUT，原桌面启动日志有DesktopHostFatalError/EACCES19387，均保留。仅停止该次桌面69752并重试，未改核心/profile或停止Runtime60284；11:43:58–11:44:02桌面retry实际exit0/error=null，Host71548监听19387。11:45:55独立只读核对Runtime60284监听36994、identity12/schema4，/health、/v1/runtime、/v1/apps、原session的/v1/views均200，Hallmark status=ok，retry无FatalEACCES。冷会话1269→1270仅新增end-seed，全部旧JSON history prefix一致；插件NativeMemory/render/@/componentmount仍NOT_RUN，用户手动测试待回复，用户持续授权退出/重启无需再次询问。

早先严格前检因桌面未退出中止，原事实保留。08:41:55 UTC核实桌面进程0及任务所属旧Runtime38844后，通过Windows Stop-Process停止该进程，不能记作graceful SIGTERM。首轮完整备份因preview-fixture-dataset误识别为持久引用而在创建目录/报告前失败；中间apply成功但随后独立审查发现显示路径碰撞，原样HOLD且未作为最终安装前备份。修复后在新目标apply/verify通过，再执行覆盖安装和正常重开。

08:52:56 UTC只读进程核查：新Runtime62564为36994唯一listener、旧38844已退出，桌面主进程63296存在；原Board服务保留。profile/dataDirectory未再次切换。08:53:13 UTC只读旧view恢复状态：最后旧publication从过deadline mounting恢复为interrupted，pending=null、active/lastGood=null、draft_unpublished；没有mounted。旧Agent的_republish/重新读取建议是失败后的建议，不是新验收；这是当时的等待状态；后续原会话turn与挂载失败记录见下方最新观察。

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
| E-PACK-15 / E-V-PACK-15 | 778/778实际exit0；类型/真实SDK/CLI/Runtime/诊断；独立29检查/17负例PASS | 144输入/33产物，14→15仅5源变；独立复核不重跑全仓CI，不将14正式卡转15 |
| E-COLD-15 / E-INSTALL-15 / E-RESTART-15 / E-DISK-15 / E-FREEZE-15 | 官方12→15覆盖；实际只读重开和33/144/9774两遍磁盘核对PASS | stop/backup与install实际exit0；startup包装exit1、operatorExit=null保留；185refs/330index/472fileguards零差异，56审查子进程已退出。Native、原SQLite、TST-001整卡与R未验 |
| E-I-037-038-14 / E-V-037-038-14 / E-V-WX-14 | 完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED；I/V31/31、语义20/20、12377/12377、1955引用、30SQL副本；V追加wx8/8 | 原I31分037=18/038=8/guards=5；wx为独立V额外case，不属于原I31。14归档d892/144/33绑定，旧12BLOCKED原样保留，真实现场/Native/业务/R未验 |
| E-FULL-1 | 648 项：646 PASS、2 FAIL | 首轮失败日志保留；Host 期望补 viewRevision，starter SDK 夹具补 v2 子路径后重跑 |
| E-FULL-2 | **651/651 PASS；0 FAIL、0 SKIP、0 CANCELLED** | `npm test`，16,197.3902 ms；包括 fixture、隔离 HTTP 与真实源码/浏览器相关测试，未运行真实业务写或原模型整链 |
| E-FULL-3 | **655/655 PASS；0 FAIL、0 SKIP、0 CANCELLED** | 修复受控工作副本依赖缓存备份规则后 `npm test`，36,061.5173 ms；之前两轮日志保留，不用总数代签 80 张用例卡 |
| E-FULL-4 / E-TYPE-9 | **694/694 PASS；0 FAIL、0 SKIP、0 CANCELLED；类型检查 PASS** | candidate.9 健康/库存修复后，`npm test` 30,441.5462 ms；前三轮及 candidate.8 拒绝历史保留；仍非正式逐卡/现场整体验收 |
| E-PACK-12 / E-FULL-12 | **774/774 exit0、type/实际包内SDK/CLI及只读smoke通过** | 360执行源码/143inputs/33产物零差异；包内诊断4与SDKlost-response2；旧11原7件保留，仅隔离包检查，不迁移正式22卡 |
| E-PACK-14 | **778/778、类型/SDK与实际CLI/Runtime/诊断、144输入/33产物冻结通过** | 归档 `d89271e5b468269a9b0d89ea8003ee4034512c3c510cb1fc52638092d8187774`；final-integrity与verification-summary独立固定，installed=false/businessWrites=0/Native与R未验。不迁移旧12正式卡；13全仓通过但边界审查后未装 |
| E-REVIEW-CUTOVER-14 | 独立窄源码审查 `NO_OPEN_FINDING_IN_REVIEW_SCOPE` | 持久enrollment/decision、启动/HTTP/body完成/Provider/调度守卫和rollback先冻结；实际补查删除decision冷启动、stale lease并发唯一writer、半请求体跨rollback零新增direct storage写、wx碰撞保留冻结。仅source review，明确不是正式I/V/R签认 |
| E-I-034 / E-V-034 | 完整最低FIXTURE/actual-command/静态依赖审计PASS_SCOPE_REVIEWED | I与独立回放各124/124；101注册入口、165HTTP、484SQL的实际所有者审计；Host有FS读取/日志/进程端口能力、无SQLite，不声称noFS。candidate.12冻143/33/4ca9，未转新包 |
| E-I-035 / E-V-035 | 完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED | I/独立回放各40/40，最终V1774/1774；对象键重排同dataset、数组/connection/projection变化异dataset、major/schema拒绝和refresh保持view/display身份。329原I/328旧失败I保留，candidate.12冻143/33/4ca9 |
| E-I-036 / E-I-039 / E-V-036-039 | 036/039完整最低FIXTURE/actual-commandPASS_SCOPE_REVIEWED；037/038旧12BLOCKED | V四卡报告整体PARTIAL_SCOPE_REVIEWED，只提升036/039。036实际2→3命令/ID映射/quarantine/原资产字节；039真实React构建/双视口/保留过期图/旧plan拒绝/相同plan实际GC只删B。旧038 I5事实不代签先冻结顺序，旧037报告拒绝未控制入口 |
| E-COLD-12 / E-INSTALL-12 / E-DISK-12 / E-RESTART-12 | 三冷备恢复/官方同名安装/独立磁盘与实际重启只读检查通过 | 首停止record-write exit1、首次start超时/EACCES保留；exact桌面retry恢复，四GET200、原会话JSON前缀未变。磁盘33/源码143/核心9774；非正式正常退出、迁移、NativeMemory/render或业务验收 |
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
| E-PROFIT-SOURCE-PRE12 | profit公共Provider→共享组件UI provenance与逐行展开已补齐；2新增/33相关回归、类型检查通过 | 公共Provider/Runtime/Presentation/Host/UI链只将外部源响应替换为合成数据；初始RED和首轮格式期望失败保留。不构成016完整卡、原DSH/model原话或真实GUI通过；该局部记录冻结时包尚待验证，后续12包/安装另列 |
| E-TRANSPORT-SOURCE-PRE12 / E-BRIDGE-SOURCE-PRE12 | Host/SDK25新增与48相关、Bridge14新增与42相关回归通过；类型检查exit0 | 限定ISOLATED_REGRESSION_ONLY；独立14/14有限review确认可冻结，旧RED/错误格式/超大恢复字段P2保留。此局部证据冻结时024完整卡未验且尚无12包/安装，后续实际结果另列 |
| E-FORMAL-023 / E-V-023 | 完整最低FIXTURE独立V PASS；I15/15、V17/17 | 0824a4a执行源码、candidate11原143输入/33产物pre/post匹配，194引用及原I24 JSON/全部含DB字节保留；V独立HTTP/gateway和query_only失败复测。首次私有Provider缺dispose清理失败保留/wx补记，不是产品FAIL |
| E-I-API-SDK / E-I-RUNTIME-MUTATION | 013–015 I16/16/V950检查；017–020 I25/25/V38/38；完整最低scope独立V通过 | 三份新harness在0824之后分别冻结原字节与candidate11输入/产物，013–015和017–020已独立V提升，早期API夹具/checker三FAIL保留，storeId string→integer实际生成/编译，anyOf属性投影未宣称覆盖 |
| E-I-SCRIPT-021-022 / E-V-021-022 | I16/16、独立复跑16/16；完整最低FIXTURE/actual-command通过 | 真实source ScriptRun→透明facade→packed SDK/production HTTP；独立语义52/52、SQL116/116，阶段补核845/845；477原文件保留。只证明同进程恢复，旧partial保存在冻结快照，非append-only run历史 |
| E-I-SOURCE-025-026 / E-V-025-026 | I32/32、V59/59、独立回放32/32；完整最低FIXTURE/actual-command通过 | 普通React/TSX/CSS真实构建/浏览器交互、Bbad真实编译失败保留旧B；A归档和另一view不变，显式save才INSERT component_versions。合成ready非DSH；仅storage updated_at可变化，view.value_json不变 |
| E-I-024 / E-V-024 | I64/64、V125/125和独立回放64/64 exit0；完整最低FIXTURE/actual-command通过 | Gateway注册/model render、packed SDK、Host.ui和真实HTTP组件桥接9结果一致，普通React actual SSR；ProductionErrorView只显示message，不宣称Native/browser或自动生产重试UI |
| E-CORE-BASELINE-11 | 实际pre-install core只读基线：9774文件/1,185,655,864字节/5进程 | 只记录安装前core，TST-001完整query/display/官方卸载/重开/post-inventory尚未执行，正式NOT_RUN；11未安装，无NativeMemory/R |
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
| E-FROZEN-12 / 归档 | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.12.tgz` | `4ca9cf8cc8f5f727701c3457137142ea578ec85ee47f04044658699955b6051a`；1009770 bytes，当前已安装，非NativeMemory证明 |
| E-PACK-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/verification-summary.json` | `1de69ac7ee5957aa005c39ab33532e1d92ba375912c2081f0b51d4187c7fa9a1`；冻结包检查，installed=false为执行时范围 |
| E-FULL-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/full-test/result.json` | `e322f521ce3338bddea92ecb10580ef51bbb4b5df067aa50d74cbc0f781b8b0d`；实际774/774 exit0 |
| E-FROZEN-12 / manifest | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/build-manifest.json` | `14083e2c4ccdfd196b43311a4d90b311515feb1e9ab86a993b80fccaea6932a8`；143sourceInputs/33artifacts |
| E-FROZEN-12 / package | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/package-manifest.json` | `b3798aa4a46bb3b2efd475d4287c9d5cef6e3aca4c866da75d5822ba2a982f0e` |
| E-PACK-INTEGRITY-12 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/final-integrity.json` | `38e942c3128a67cd1c0e00bfb6d7c0e7537d6b1dd900070acc383db918513b64`；360执行源码/143输入/33产物零差异 |
| E-INSTALLER-12 | `scripts/install-desktop-apps.ps1` | `cb44b9f74f0ea45ee23e284dba60905150bf40f87c0ea7afef227be242551320`；历史固定12/Runtime12，纳入12冻结输入 |
| E-STOP-FAIL-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/stop-and-backup-result.json` | `1adb268589aec0375bbcf986e5bde974207bad29e1b2893ffc15ddf12ea6ed31`；首record-write exit1保留 |
| E-COLD-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-backups-result.json` | `e8678de1e447fcdc83137b7a1a9203ae2b0a3640a3455e6dbd92abd620bb242d`；新增恢复三冷备exit0，不重停/不覆写 |
| E-INSTALL-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-install-result.json` | `c4c4635451eb90b46580450359aebbe9346a77407ddfeaab6d30361f7136fa4f`；官方同名覆盖12 exit0 |
| E-DISK-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/independent-disk-core-b5b74846-1e93-4ba2-902c-5488d4ebbe54/result.json` | `353073c6d1401a3a2ddc380ba7c163db4cf994a85ba2427dc687cac2fdb610ab`；核心9774/产物33/输入143，Native仍NOT_RUN |
| E-START-FIRST-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/recovery-start-result.json` | `3dde66f60bdd4c0113aaf19aa6e0e28791f5377fc6f1e5b654835e6ae1ea370d`；exitCode0且ETIMEDOUT，首Host EACCES保留 |
| E-DESKTOP-RETRY-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/desktop-retry-37774ee5-ec48-4bd8-96e9-0395e6fd4dba/command-result.json` | `f0967d957622e37b8e803e047e9633627d641a1b5509f8896ffd646a0fbb3a0f`；仅桌面retry，actual exit0/error=null |
| E-RESTART-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/desktop-retry-37774ee5-ec48-4bd8-96e9-0395e6fd4dba/read-only-restart-check.json` | `0fc1a423f03f891239bdd87a4a8df9cac2ca95bfa3e5bb8ca7044774767e68d4`；11:45:55四GET与原JSON前缀检查，Native/@待用户 |
| E-RESTART-COMMAND-12 | `evidence/apps-a2-20261007/cutover/candidate12-operation-0c530886-fb41-4b99-9340-9ac1d2b28f13/readonly-restart-verification-bb7a8e31-f6b4-4232-a8b6-70601f208909/command-result.json` | `a9767c0164f820b33336f52e3beeea44d19a9d91b80ac5684e516ca61ddb29a0`；实际只读验证exit0/error=null |
| E-SIDEBAR-SOURCE-PRE12 | `evidence/apps-a2-20261007/transport-error-fix/final-sidebar-f292d41c-8c2c-4545-a8dc-eaacef2b8a5c/result.json` | `4eb5fd08346b19d31b36a18fe7668b24522d8c2549c35929daa1bd1e825834af`；6新增/29相关/typeexit0，非现场因果或Native通过 |
| E-FROZEN-11 / 归档 | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.11.tgz` | `3046e499653d8a91f95c75e56156c45c2277ab48aa2b80c35240f2d23eb6f2c9`；独立新包，最终包检查通过，未安装 |
| E-FROZEN-11 / manifest | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/build-manifest.json` | `7ce77c6ac4ed6a55c67c532676a178cc322b1ab2f0c34eae95c537453c38bd35`；33产物/143输入，旧10manifest不改 |
| E-VERIFICATION-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/candidate11-final-verification.json` | `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`；唯一新最终PASS，旧summary不覆盖 |
| E-V-PACK-11 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.11/independent-v-candidate11-32660a68-6b56-418e-a93b-75f1e2d6956a.json` | `01de93d9b0e1938cc9c0c9aa3b01d680ee95f3d80c9220ccb97cf5ec584da72e`；PASS_SCOPED_PACKAGE_REVIEW，仅包/source/隔离fixture |
| E-PREPUSH-11 | `evidence/apps-a2-20261007/cutover/diagnostic-followup-before-push-c104685f-7f74-482a-8b68-815034bbf1ca.json` | `86320d15b1a08207ed162e25cf4b11c9cb32071811bfee67bd8d50fa15aa67eb`；source/table/installed disk完整性，磁盘仍10，不签NativeMemory/R |
| E-INSTALL-PLAN-11 | `evidence/apps-a2-20261007/cutover/candidate11-desktop-plan-1e9f4d72-ad52-4968-a26f-39d10b5c8f81/plan.json` | `83afd3da8b0bd6163db81828d8366fdb5e205d3dac5deb0c1d87a6a711bcb120`；仅ValidateOnly，未安装 |
| E-INSTALL-PLAN-11 / 最新 | `evidence/apps-a2-20261007/cutover/candidate11-desktop-plan-500d38d9-9180-463a-84dd-55ffd4a76a3c/plan.json` | `dee08be82e5058ca23843d098f1bff494d985f3991b27b199b63b97b41a22517`；仅修私有计划显示版本标签/constants/root，guard保留，installed=false/desktopRunning=true；旧1e9计划保留 |
| E-CORE-BASELINE-11 | `evidence/apps-a2-20261007/cutover/desktop-core-before-candidate11-7b9aa5a7-dc6a-406e-8f2f-3e725e3cafd8/baseline.json` | `5c03554b2bb07ca0d7c14eb177a8b97a49cb37331db5ef7e02207ac8e9f775ce`；仅pre-install核心盘点，TST-001 NOT_RUN |
| E-I-SCRIPT-021-022 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/result.json` | `2ba20c2642ac9dfbccfa34b457b2352a934e21e9068ea581467058f600aee319`；I16/16，actual-command独立归档 |
| E-FORMAL-021-12 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/TST-021/FIXTURE/result.json` | `a80a3aefb04f7327919d9a6bc37365fad7e719c817c7857649ad21004921e040`；完整最低FIXTURE/actual-command |
| E-FORMAL-022-12 | `evidence/apps-a2-20261007/formal-script-run/a2-script-run-f666b51a-b4b5-467b-80b2-d095f365c04a/TST-022/FIXTURE/result.json` | `dc5c2d3d753ebb1208c076bcfd1ec81164c3561c79da18e201db117ecc39f947`；完整最低FIXTURE/actual-command |
| E-V-021-022 | `evidence/apps-a2-20261007/formal-script-run/independent-v-021-022-dde74bda-555d-4fbf-abc0-084890c22aff/independent-v-021-022-stage-reviewed-6ec05b91-370d-489b-9752-ab1243860821.json` | `8deaa677a7578b74fdd4b896b458a15f53bea6a8f477bf3e340c9615138f9fc5`；最终PASS_SCOPE_REVIEWED；首V引用归属FAIL保留 |
| E-HARNESS-021-022 | `test/acceptance/script-run-steps-a2.mjs` | `c2123fcf4d8b0981581514372963cae2c6d904ca1d49bd0aee90fcb583350f5e`；c212最终执行原字节，历史56a快照不改 |
| E-I-SOURCE-025-026 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/result.json` | `5acc1d9d5f8f481036a263eaef05de5fed22baebbe474051a1410f290aa88266`；I32/32：025十二项、026十六项及四项补充 |
| E-FORMAL-025-12 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/TST-025/FIXTURE/result.json` | `4553469a6459d97a74656dd23c4767949f7c1dd9c1eecdeec042fffd0b6b6f2b`；完整最低FIXTURE/actual-command |
| E-FORMAL-026-12 | `evidence/apps-a2-20261007/formal-source-view-save/a2-source-view-save-6cb69d70-0b9b-4f35-9dda-c382abb90b72/TST-026/FIXTURE/result.json` | `000d12f935c492a8e3d7394426ea95192775496d671a2c4127bbc6b2a6a06b3f`；完整最低FIXTURE/actual-command |
| E-V-025-026 | `evidence/apps-a2-20261007/independent-v-source-view-save/a2-v-source-view-save-980b48bb-6f32-4f35-9df2-31034498ee3f/result-final.json` | `f3938e58cef7605d5e9a0ec7119f62d189c093dd3b9ad5c2402bb9742b72cb0c`；最终V59/59；首V timestamp过强判据FAIL保留 |
| E-HARNESS-025-026 | `test/acceptance/source-view-save-boundaries-a2.mjs` | `d67ccd3541d6ae8253df00f83526c5613658180b9f46c93c4467d0cee54fd01e`；实际执行原字节 |
| E-I-024 | `evidence/apps-a2-20261007/formal-error-contract/a2-error-contract-65cf8e3a-8030-4cb5-807e-acee6083a8fe/result.json` | `1fb8fd2bf73ea49bc62737b26c4bd158413405f2b72b6158cd06311766de3257`；I64/64，完整最低scope已独立V通过 |
| E-FREEZE-024 | `evidence/apps-a2-20261007/formal-error-contract/operator-e86755df-e719-4dca-9896-08b56d5c3704/freeze-result.json` | `7646ab416080ef28130af76227eca83d92faeff39c1a1f518565ba180d0b0808`；实际命令exit0与I冻结；非V签认 |
| E-FORMAL-024-12 | `evidence/apps-a2-20261007/formal-error-contract/a2-error-contract-65cf8e3a-8030-4cb5-807e-acee6083a8fe/TST-024/FIXTURE/result.json` | `07e0c93af6dde1c0de13830bae1a289638cc19bfacc0f390bb54d56e575cf067`；完整最低FIXTURE/actual-command |
| E-V-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/review-result.json` | `ac4e610076a29b333aa5b0934a7a61837d3cf75e78beb743bd603720aea6e805`；V125/125；首SELECT*与声明四账本列的判据错误保留并追加校正 |
| E-PACK-14 / final-integrity | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.14/final-integrity.json` | `10c60be2903aa38c616b0b937be781c773900e28a49232a940e163693c8622c9` |
| E-PACK-14 / verification | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.14/verification-summary.json` | `5f39c3db73015af866112b4f2721ed84a4fa9f315a20e0133950ab623a762632` |
| E-REVIEW-CUTOVER-14 | `evidence/apps-a2-20261007/independent-review-cutover/review-final-84b73d92-681b-43bc-ac65-e5da24e03884/result.json` | `500660b03c4545dfd6f3cead2d89d875adf550ac5b0ee686ac42d17df3ee5c11`；source review、非正式卡/R |
| E-PACK-15 / archive | `artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.15.tgz` | `0ae72a0fa7f02ea692cf861bc441f0464eb0a248ceddc9cd6f19468a03d29b64`；冻结15归档；不迁移14正式卡 |
| E-PACK-15 / final-integrity | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/final-integrity.json` | `fd305d11193f7a75896179092151d5f72a2cd81b38b0a6ae3d3634449ec62650`；完整最终包/源码冻结 |
| E-PACK-15 / verification | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/verification-summary.json` | `6db8cf8f16e20acea8f588bbb712f9a27e1d47a19c220bc03f0d9fecf836e07d`；778/778、type与实际packed执行 |
| E-INSTALLER-15 | `scripts/install-desktop-apps.ps1` | `0131f6072aaea18a49999e87985d6550ed05c605b0ae96e8485784d5a6b5e684`；manifest动态版本/全33 tar二进制与安装磁盘核验；纳入15冻结源输入 |
| E-V-PACK-15 | `evidence/apps-a2-20261007/formal-package-review/review15-563b202d-a92a-4bce-b214-cd06179926a3/package-installer-review.json` | `1a85daae13cad7bec12f1a1c34fa276678ea028308a030a25c6b14ed1c8b9ccf`；独立29检查/17负例，不重跑全仓CI |
| E-V-PACK-15 / index | `evidence/apps-a2-20261007/formal-package-review/review15-563b202d-a92a-4bce-b214-cd06179926a3/package-review-artifact-index.json` | `4ae87323a5b68bd153a81355eeddd7e77e750ea43c741f8f37d3b54745c7b2ca`；独立330包索引 |
| E-DISK-15 | `evidence/apps-a2-20261007/formal-package-review/postinstall15-3de7ac15-6a3b-43bb-85bb-ad128da511cc/result.json` | `a03ca1431622e929578326c2bde76524e6a1b35847d43ae8b41f141bf4cd61ba`；33安装/144源/9774核心两遍核对，无原SQLite/GUI |
| E-FREEZE-15 | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/freeze-result.json` | `78290f1d0a92a71345ec46727b0040d76922dad0f881474a0e8c96071b1e3576`；185交叉引用/330包索引/472文件守卫零差异，56审查子进程退出 |
| E-FREEZE-15 / command | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/actual-command.json` | `d62233b1427a218ba21f2d985ef17752cdaaea55835bfd0a975a47a79da538b4`；实际child exit0，PID已退出 |
| E-FREEZE-15 / index | `evidence/apps-a2-20261007/formal-package-review/freeze15-8f39066d-06b9-44ba-b624-99a0647b9c03/final-evidence-index-13f79dfd-26ed-40c3-ad06-883cdf774309.json` | `4b21abeb27976acad335d9d8264ea578380d8a795dfc632bf1de2fa686b1665c`；最终私有证据索引 |
| E-COLD-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/stop-and-backup-result.json` | `25da1391308e9b08b31a0fd58e85450fdb3e7726cc80430439261e398d43f620`；受控停止/冷备actual exit0，不代签正常app.quit |
| E-INSTALL-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/install-result.json` | `9608340f46d3206507e3e0358346cec5c92cef9bc56a4cf2d9ff578f143f55a5`；官方同名12→15 actual exit0 |
| E-RESTART-15 / dispatch | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/start-dispatch-observation.json` | `923d10fcb1c0de1f25808c03a3add95a158044c81fd960d8170c3a7f6415b947`；启动包装exit1/observer继承stdio异常；operatorExit=null，不伪造exit0 |
| E-RESTART-15 | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/read-only-restart-check.json` | `64b2ac3147b22719fc30604857bd8ca177425d915e6276cfe26fb306fb382e4b`；实际Runtime15/schema4/四GET/Hallmark健康/原1270行前缀PASS |
| E-RESTART-15 / command | `evidence/apps-a2-20261007/cutover/candidate15-operation-b58de7bd-8f72-4c39-80ff-01d6fce76f2d/read-only-check-command.json` | `9180fd3648f73ed5237531b0b85e94e7e1f7a3bbbfb81e22c174a1725f842be7`；实际只读check exit0 |
| E-I-037-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/result.json` | `e96bc64035aa38a82206c1c9988f06474196971241b39e7170d4b8fccf213bed`；I31/31，03718/0388/guards5，绑定14 |
| E-I-037-038-14 / command | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/actual-command-result.json` | `8d9068a0f88254ec86276f5bb2c58bb165bb596319cb1df0fb52b122e07bb028`；实际I child exit0 |
| E-V-037-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-summary-final.json` | `e1de67236fa5cd51a7028cd5691264d9bffe72de6a9d7802f1c2e9eb7a638b57`；完整最低FIXTURE/actual-command，20语义/12377检查/1955引用/30SQL副本 |
| E-V-037-038-14 / detailed | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-result-identity-final.json` | `c38d4f75949cf9e35d3e78a64d954dc3a7d126279439574fb794eaff6ea1e55e`；独立完整复核，不代签Native/业务/R |
| E-V-037-038-14 / command | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/review-identity-final-command-result.json` | `736043cca0424bd4974f910f1a878095206a89536355e6a8b42d6d9b294eb382`；最终独立checker实际exit0 |
| E-V-WX-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/independent-v-037-038-candidate14-d626b7c9-91a0-407e-b97b-f11ec7c6a4d7/output-collision-result.json` | `55c4b5d10086188e410b19aeef024b615d758de284b8cb827f1ca1defde7b7aa`；captured14 CLI真实wx碰撞8/8，追加V而非原I31 |
| E-HARNESS-037-038-14 | `test/acceptance/migration-cutover-admission-a2.mjs` | `c7ab17371d85152abceaafa477074f1653080e5d8ec9f5273d0f98fd35e49f6c`；公开实际执行harness原字节 |
| E-HARNESS-035 | `test/acceptance/dataset-identity-a2.mjs` | `82946552187a3e5c22bbc2496976540cab84917af5e4961c30415b047c6cede7`；公开实际执行harness原字节 |
| E-HARNESS-036-039 | `test/acceptance/migration-cutover-boundaries-a2.mjs` | `2c4d33d5d96b9adcb3f7baeb33a65adc9aed6a5bf8595c4381c3c2e7f6356584`；公开实际执行harness原字节 |
| E-FULL-15 / command | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/full-test/result.json` | `ae6bfcf12b9a6d8a8eb3d0ce642b185698a82e14ce84277bc396f768e1e27aea`；真实全仓命令exit0 |
| E-FULL-15 | `evidence/apps-a2-20261007/candidates/1.0.0-candidate.15/full-test/stdout.txt` | `e34df159eb8e2e022d41f2d0959769800d5e2ee9a258e518d4d1109daba2eb61`；真实778/778 CI stdout，actual exit0 |
| E-I-037-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/TST-037/FIXTURE/result.json` | `5cbafa678072969e1931c8da0712721d42875d0000bec48f9294e97d8ce84464`；正式I037 |
| E-I-038-14 | `evidence/apps-a2-20261007/formal-migration-cutover-admission/m-19aff6d3-3c40-4f78-a658-2c64f4539aaf/TST-038/FIXTURE/result.json` | `089846495b6b08f7efc3f64603f089ddb45b2cf48eb77876c2ef45af2d9b4825`；正式I038 |
| E-I-034 | `evidence/apps-a2-20261007/formal-state-owner/a2-state-owner-8c28433a-9f81-4fee-b264-9b4b04f1234a/result.json` | `58e82c91e5552d71e073d39594cd9a4c6cb910f3a3924fff65def734c04ce958` |
| E-V-034 | `evidence/apps-a2-20261007/formal-state-owner/independent-v-034-7bdafb3a-89e2-4d12-b2c3-519c23f1cd27/review-summary-final.json` | `22c3c9fef8545e75c9c5ccf7ebaf9a5ae9989e1d9d4f30fee02ad34056846552` |
| E-HARNESS-034 | `test/acceptance/state-owner-boundaries-a2.mjs` | `67e9c30489e1cf8c891381c16e303bc3dbd22c81d6c6a6b6252c2239984fa2d0` |
| E-I-035 | `evidence/apps-a2-20261007/formal-dataset-identity/a2-dataset-identity-2b8cd05c-dd7d-4ae1-b6ae-1d1f397f1ae8/result.json` | `7e36651e0675c219e3c6be9ed9f67e74cea718c5c68fcdbadc5d6ce1f9696289` |
| E-V-035 | `evidence/apps-a2-20261007/formal-dataset-identity/independent-v-035-9645fedd-8674-4c64-97f5-6b3176615eca/review-result-final.json` | `c4462603a68314568977a3d7c6ce4a7fa532d64d5f12f31392836a8060fee194` |
| E-I-036 | `evidence/apps-a2-20261007/formal-migration-cutover/m-39362f6c-f466-4ed7-b19e-c53626fe3c15/TST-036/FIXTURE/result.json` | `26ab680ce852de7e50d91fff6fa62d2726cb8afe212cd7bf5317a1d451d6aab1` |
| E-I-039 | `evidence/apps-a2-20261007/formal-migration-cutover/m-39362f6c-f466-4ed7-b19e-c53626fe3c15/TST-039/FIXTURE/result.json` | `f5f759485088d68dc6e062b5e4b218cd84264302993873c5c2aea6f7392970b9` |
| E-V-036-039 | `evidence/apps-a2-20261007/formal-migration-cutover/independent-v-036-039-9f4537d9-2549-4cf6-bef0-0feb742bf7e0/review-summary-final.json` | `c9fd71eecbff1ed8f520626fe2d625ce964d5679c5d78909e70b852b99f767c5`；完整最低只PASS036/039，旧037/038BLOCKED |
| E-V-FREEZE-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/freeze-result.json` | `41185ce46304f596fba420447d83fec2afb7e9e1560de0b194c5c9fec88c47bb`；独立V冻结原字节 |
| E-V-INDEX-024 | `evidence/apps-a2-20261007/formal-error-contract/independent-v-668d3a35-4556-44b0-93fc-51320935d767/final-artifact-index.json` | `2aa7d612befdab5cbd232f09c842a1b1cee4efed0d7ecd42da8a507b7f2d71d2`；最终V索引 |
| E-HARNESS-024 | `test/acceptance/error-contracts-a2.mjs` | `5a53d37379ef53028c0740069af2f7d54535ea9f4f9efe8d35d0ea3358ab40aa`；实际执行原字节，未归入774CI |
| E-FORMAL-023 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/result.json` | `0ee52f57d916fa6a6c8b1229a9430a8173c77415ac6ce9c372fcb0996679b8e4`；I15/15、独立命令exit0 |
| E-V-023 | `evidence/apps-a2-20261007/formal-model-budget/review-17988222-5d59-4091-b166-ecefc2738bfe/review-result.json` | `b02504676b0c28594f38f576e11b7d3034354f7933f7803316164d51da233bc1`；完整最低FIXTURE、V17/17 |
| E-HARNESS-023 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/executed-harness.mjs` | `510a83e3535add6daf2d65752fa8def4db84164c0a2dd90bf1d4b0eed5f9e5bc`；实际执行原字节 |
| E-I-RUNTIME-MUTATION | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/result.json` | `8036c82b98e9f3b6e35292b0f1f416516ef3a089101cd7a5fa376136cf59d46a`；I25/25、独立V38/38完整FIXTURE通过 |
| E-V-017-020 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/independent-v-runtime-mutation-candidate11-af5a4874-4bb7-45fa-aec5-5c7acccbcec4.json` | `e51db9a259f9d7fc9b204380244ad8c50fd47d5a1d55920a074451e559af9b47`；四卡完整FIXTURE、独立V38/38 |
| E-HARNESS-017-020 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/executed-harness.mjs` | `9349444e03440a62f9d637db6722b4b438bad6bd0bbc8146d63004a66c07b4eb`；实际执行原字节 |
| E-I-API-SDK | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/result.json` | `689b09cf2e95ddff07dc42c267614dfde2dcce800b82c38693a825e9fd2fe268`；I16/16、独立V950检查，完整最低FIXTURE/actual-command通过 |
| E-V-013-015 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/independent-v-013-014-015-bc75683b-1727-410e-ac2d-d71e773c4a62.json` | `b9d68bfa81a1feb2eafdf2adf54ed37e857b79575ba4e02ce48286a6ffd78934`；完整最低FIXTURE/actual-command，950检查、六路径联动范围更正 |
| E-V-013-015 / 旧报告 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/independent-v-013-014-015-7e9122a3-e45b-4700-a3dc-07731861a748.json` | `f54f95e9970cbb36bd4972175847f4409694f3f50e450e61b10f77bf4cb8e6b8`；旧942检查报告原样保留 |
| E-FORMAL-013-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-013/FIXTURE/result.json` | `1ceda7a3a719710a021fa77adf75a92e6732d218bc741ccff87db40c17cca3b1` |
| E-FORMAL-014-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-014/FIXTURE/result.json` | `23a20a4737b6cbf1cab4dba12e2eae6fb52f80d7257b6df17704ae764847f71c` |
| E-FORMAL-015-11 | `evidence/apps-a2-20261007/formal-api-sdk/a2-api-sdk-d60c3484-68a2-41d8-9634-e6accfe16942/TST-015/FIXTURE/result.json` | `216bb65eab2ab66104bc1b3f65e51e52351497f6e5a96ffd0d833e104922ae11` |
| E-FORMAL-017-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-017/FIXTURE/result.json` | `2a1d1224ffc70253dde414c6907ff1c93a23ea14aabc2f44a730ebf779a71546` |
| E-FORMAL-018-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-018/FIXTURE/result.json` | `e76c9c89689ccf1ee64463de772ded07d7d95e955cc12fb46dd47c7c12723abd` |
| E-FORMAL-019-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-019/FIXTURE/result.json` | `4d661c07fb26ede8de8e0afeb571458ba25836a8df06e10a1e2e0da07bf1940a` |
| E-FORMAL-020-11 | `evidence/apps-a2-20261007/formal-runtime-mutation/a2-runtime-mutation-414352a0-3952-416f-a8d6-217e4d9459e5/TST-020/FIXTURE/result.json` | `6781e20ac73d7e93e29847fc24a44fb053cbb0ff4f3faad7fab6da98533af3b8` |
| E-FORMAL-023 / 卡 | `evidence/apps-a2-20261007/formal-model-budget/a2-model-budget-3bf52705-cf07-43c2-8726-b25836f53b8b/TST-023/FIXTURE/result.json` | `58814a3b73dbf37f8e19969ae00f7c8bf83b38f80a223e0bcd991db7228c7844` |
| E-HARNESS-013-015 | `test/acceptance/api-sdk-contracts-a2.mjs` | `d0a9e292e89ae3dddbb98f1ad32a4feaafec8bcac2c230e50ffb1550fe123e82`；实际执行原字节 |
| E-PROFIT-SOURCE-PRE12 | `evidence/apps-a2-20261007/verification/profit-provenance-execution-source.json` | `0a5d7000f3aef32f3f16201ab4f7e8ecb4cd85031fa8154c4171d8b3090c38e8`；真实公共链局部2新增/33相关/type通过，非Native/完整016 |
| E-NATIVE-MOUNT-DIAGNOSIS | `evidence/apps-a2-20261007/transport-error-fix/native-mount-readonly-76947d78-170a-43d6-af49-72c19e2769bc/result.json` | `ff800d32be967211b7e5adce2aeb17f54f7dace2ab5cb4ec29937697a771dadb`；只读源码诊断，现场因果未观察，不是live截图证明 |
| E-TRANSPORT-SOURCE-PRE12 | `evidence/apps-a2-20261007/transport-error-fix/final-eb63da9a-40d9-4a3f-aa37-2810152199f3/result.json` | `52e96f1c9430218fac3b5ba3abd6d833dc06bd17ba9668ef377e06ecb9d319e3`；Host/SDK局部回归，当时formalTST024=NOT_RUN_FULL_CARD；后续完整最低scope独立V另列 |
| E-BRIDGE-SOURCE-PRE12 | `evidence/apps-a2-20261007/bridge-failure-fix/suite-6f2c65f6-6db0-4bc9-a125-b454e302fb3c/result.json` | `1fb32d4699c24a8dd034bd98cf6a9a32694a925f7c576fff213829f90d632e0a`；源码回归exit0，非冻结12/Native |
| E-BRIDGE-TYPE-PRE12 | `evidence/apps-a2-20261007/bridge-failure-fix/typecheck-5c6b7bf1-16ea-4a01-88ff-9c41329773bc/result.json` | `0907d4c188c4d8c57447d4334b6d21690a08b1c2251d7df6b48e9705c556d3fd`；typecheck exit0 |
| E-BRIDGE-REVIEW / 旧P2 | `evidence/apps-a2-20261007/transport-error-fix/bridge-review-5f4c5ce4-87d4-4736-a061-808903b6ead3/review-result.json` | `71c5d2b56cc03170a6d969887795092b7bffc13e679bc990b4b080ca12dc17a2`；原REVIEW_FINDING/超大恢复字段P2报告保留，不混为最终有限review |
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
| TST-013 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 薄API复用现有业务实现，真实公开Runtime/Provider与mock Source调用保持操作/权限/schema/分页语义，非真实业务 |
| TST-014 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 未知写显式分类/拒绝，允许写仍统一durable operation与一次dispatch；unknown只inspect不重发 |
| TST-015 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.11 | 共享storeId字段string→integer导致六catalog路径/六TS-doc-tools投影联动；全SDK正向编译，所选API与unknown.data负向检查，anyOf属性typing未覆盖 |
| TST-017 | PASS；完整最低FIXTURE；candidate.11 | 20实际并发唯一invocation同tuple仅一operation/Provider/HTTP写；变payload拒绝零新写、跨app/connection隔离、持久intent先于dispatch |
| TST-018 | PASS；完整最低FIXTURE；candidate.11 | 私有Source接收后丢响应、实际Runtime子进程重开，unknown只inspect恢复/不重发；HTTP200仍按pending/partial/unknown业务状态核实 |
| TST-019 | PASS；完整最低FIXTURE；candidate.11 | 分发前取消零写、分发后不当撤销；晚成功/unknown证据保留、仅只读核实，无真实业务或原DSH签认 |
| TST-020 | PASS；完整最低FIXTURE；candidate.11 | 严格revision CAS只提交一次，旧revision拒绝且不自动追新revision；继承REVISION_CONFLICT shorthand按SPEC保留实际COMPONENT_CONFLICT，literal=false未伪称字面匹配 |
| TST-021 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实Hallmark query、Notes revision1提交后计算异常；可定位partial、持久子调用完整，恢复无重放 |
| TST-022 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实HallmarkProvider/Client/TaskBroker mock平台11 RUB写/读回成功后Notes提交丢响应unknown；恢复只inspect原Notes operation，Hallmark不重写或逆向补偿 |
| TST-023 | PASS；完整最低FIXTURE；candidate.11 | I15/15、独立V17/17；实际UTF-8≥1MiB结果投影≤16384字节、完整handle分页与真实query_only spill失败；独立HTTP/gateway复测、私有DB副本，非原DSH/真实模型原话验收 |
| TST-024 | PASS；完整最低FIXTURE/actual-command；candidate.12 | Gateway注册/modelrender、packed SDK、Host.ui→真实HTTP桥接9结果及普通React SSR一致；原mutation单POST、恢复inspect GET只读；非Native/browser自动错误mapper验收 |
| TST-025 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 空普通源码自定义状态，真实React/TSX/CSS构建/注册/浏览器交互；Bbad真实编译失败时旧B仍可用 |
| TST-026 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | B仅发布目标view；A归档/另一view不覆盖；build/open_source/publish不保存，显式save才新增版本 |
| TST-034 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command/静态依赖审计；candidate.12 | I/独立回放124/124；101入口165HTTP484SQL实际所有者，Host有FS/日志/端口但无SQLite，不是noFS；原143/33/4ca9冻结与旧I保留 |
| TST-035 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | I/独立回放40/40，V1774核对；canonical对象键同身份，数组/连接/projection变化异身份、major/schema先拒绝、refresh不改view/display；未迁移14 |
| TST-036 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 实际2→3正常/orphan/unknown工具迁移命令、ID映射/quarantine/原源资产；初始长路径FAIL/读取新增SHM32768和WAL0历史保留，3→4只支持输入 |
| TST-037 | **PASS**；新candidate.14完整最低FIXTURE/actual-command | I/V31中037各18断言及公共guards5；持久入口拒绝/冷启动/并发writer/body迟到已实际验证，V额外wx8/8；旧12 BLOCKED保留，Native/真实现场/R未签 |
| TST-038 | **PASS**；新candidate.14完整最低FIXTURE/actual-command | I/V各8断言及公共guards；rename1→SQL2→output22，A真实备份恢复、B完整增量导出/原unknown inspect无重写；POST inspect可写恢复账本，旧12 I/V BLOCKED历史保留 |
| TST-039 | PASS_SCOPE_REVIEWED；完整最低FIXTURE/actual-command；candidate.12 | 真实React A/B构建及双视口、活引用保留/过期/旧plan拒绝、sameplan CLI只删B；B图明确为合成GC输入、复用node_modules、非Native/模型 |
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

当时工作区随后修改 `packages/app-runtime/src/index.ts` 与 `packages/plugin-apps/src/index.ts`，补能力版本错误的requested/registered诊断；新增 `test/apps-host/capability-version-diagnostic.test.ts` 先4 FAIL、10:04局部4/4 PASS，真实red/green字节/日志另存。该修复进入独立candidate.11冻结包，该11阶段旧candidate.10归档/manifest与当时已安装桌面不变。新11正式四卡实际重新执行且独立V通过后更新当前记录；旧10三卡PASS、011 FAIL及原V全部保留，其他10卡不自动迁移。新11最终全仓727/727及包检查通过、未安装，该11阶段无新桌面结果，后续12实际部署另列。

candidate.11最终包验证独立记录为 `candidate11-final-verification.json`，SHA `2897a886983bb83a1d56eff364b2a1cadbbffc0ce02a5556dfbfa59abbbbc410`。标准全仓最终运行727/727、exit0，未合并Root局部green或首轮stdout凑计数；首轮私有wrapper仅解析TAP而误判spec结果的FAIL、第二轮实际726/727因隔离http.test.ts临时目录清理EPERM失败均原样保留，旧verification-summary-final.json没有覆盖。最终运行在其余包/浏览器smoke结束后独立执行，439实际执行源码与143冻结打包输入前后零差异；这份守卫明确排除6个本阶段未执行的独立acceptance.mjs，实际.test.ts/package/script/config/冻结输入仍在守卫内。新11执行时源身份为a635ec4加冻结未提交诊断/版本变更，包检查及四卡V通过不自动迁移其余旧10卡，不证明原DSH已加载11，R仍未签认。

新11核心I在独立run `a2-core-contract-0be571e6-e889-4271-ba9c-9368505be5f2` 实际重跑26/26通过，总记录SHA `410a912808f21c7bf0e8cb52b7020c8beab64a472c50fb990f8fd67514481d3d`；V `/root/core_contract_independent_v` 完成21/21语义复核和4/4独立诊断回归，四卡完整最低FIXTURE为PASS_SCOPE_REVIEWED。执行身份为a635ec4工作区快照，保留153源码及脏改patch，harness新b7fb快照与旧30733快照分别归档。实际Runtime source11，冻结11 AppsClient与预生成Notes call43 wrapper另有两只读调用，各一次Provider；10:15:40复核143输入/33产物零差异、226原I文件/4DB及旧10元证据字节保留。没有新11安装、原生/外部模型/真实业务或R签认。

055/056独立V为 `/root/maintenance_acceptance_gap_audit`，09:25:33.860 UTC追加只读复核；维护四卡同一V于09:35:14.745 UTC复核311冻结文件、1165语义引用，只有三处声明的missing/tamper负例，143包源输入零差异。09:30维护run共267断言，独立新增12窄测试/typecheck另记，不加到706包检查。06:29维护summary的四条过期源hash明确剔除且保留，未用中间run替代最终记录。

057独立V `/root/source_acceptance_gap_audit` 于09:36:58.785 UTC核对10份新签名report、377引用零意外错误、5个React carrier/30个HTTP资源manifest与原归档字节一致，实际v2四方法/v1/major3 transcript和单buildId负例通过；41个本地请求、零生产端口调用，关联Chrome/Node已退出。早期wrapper完整源码快照未保留的事实不抹去；React run执行harness为 `2a8ea3192f646b345f58ac5804b6a337788849b25edd2f640746c0604768bbdb`，最终live run为 `bfcb322c890a97c79722947d98c040754028acf104ce1a425550d69a80b8fab1`，不混用执行版本。

057实际live_readonly是本地真实Bill200行快照，fetchedAt=2026-10-07 07:50:12.932 UTC、sourceDataTime=2026-10-06 16:01:20.856 UTC、freshness=unknown；不是新live API查询或桌面展示。fixture八行合成数据与真实快照分开标记。旧HTML757执行只证明HTML/JS子范围。TST-058虽有SOURCE_EXEC负例和旧原Agent部分读图历史，完整LIVE_MODEL/双视口视觉反馈仍NOT_RUN；实际420截图价格/库存逐字换行保留，不能以无溢出断言代签视觉质量。

新增仓库工具 [verify-a2-release-evidence.mjs](../scripts/verify-a2-release-evidence.mjs) 强制CORE51/AUTHORING78/BUSINESS-WRITE52/DATA-CUTOVER53集合，调用者只能增加required卡，不能缩减；核对scope/model/candidate/commit/hash/bytes及重复/非PASS身份。它不执行产品测试、不独立证明断言，releaseApproved恒false，单卡DECLARED_TEST_SET无发布资格。离线用法见 [迁移运行手册](apps-migration-runbook.md)。四范围仍NOT_ACCEPTED，R未签认。

021/022最终I与独立V重跑各16/16；真实source ScriptRunRuntime的invoke经透明facade进入packed AppsSDK与production HTTP，没有新增/runs API或SDK ScriptRun export。021在Hallmark查询与Notes真实提交后计算异常，恢复完成步骤不重放；022在私有mock平台11 RUB写/读回成功后，Notes真实提交结果经实际HTTP丢失而unknown，恢复只inspect原operation，不重写或逆向改Hallmark。run当前行恢复为succeeded，旧partial由冻结前后快照保留，不宣称append-only或跨进程恢复。独立语义52/52、SQL116/116、阶段补核845/845，485阶段引用/171源码/143输入33产物核实，238最终I+235历史失败I+4冻结文件全字节不变；原DB只复制后SQLite读取，SHM/WAL仅在V私有副本。首V混合旧56a与新c212公共harness路径的引用归属FAIL保留，追加报告按执行快照更正；旧I唯一typeof guard差异及其失败日志保留。

025/026最终I32/32（12+16+4补充）、V59/59和隔离回放32/32通过；731原I文件/520引用/5HMAC保留。普通React/TSX/CSS与真实浏览器交互证明自由源码路径；Bbad真实编译失败保留旧B，A归档字节及另一view不覆盖，唯一component_versions INSERT sequence140位于显式save。ready为合成FIXTURE；server GET observer空响应由caller原始响应字节补证。begin(edit)可更新SQLite storage updated_at，但view.value_json完全不变；首V过强timestamp判据FAIL和最终追加校正均保留，不改原证据。

024最终I64/64、V125/125及独立回放64/64 exit0通过，321原I文件与5历史run字节保留，candidate12的143输入/33产物/归档4ca9未改。原mutation仅1次POST；恢复仅inspect GET并保留invocation/trace/operation原身份。真实compiled legacy_unverified source view走公开view open；没有fake grant或Native确认。普通React实际SSR展示类型错误字段，ProductionErrorView本身仅message；不宣称browser/Native或自动生产错误mapper/重试UI。两旧I harness descriptor/JSON view identity失败保留。首V私有SELECT*误将operations额外索引列与I声明四账本列比较而7/8FAIL，原报告保留；追加V按声明四列复核，完整SQL与额外索引列也留存，不写成产品FAIL。

本页源码SHA对应本次实际执行工作区的原始字节，私有源码快照保留该序列化；Git文本行尾由各checkout设置决定。

先完成的四卡形成当时31 PASS/49 NOT_RUN，旧27张PASS的身份不变。034 I最终58e82c91与独立完整V22c3c9fe各124/124，公开harness67e9c304；登记101入口、165 HTTP与484 SQL事实用于状态所有者审计。Host读取文件、日志和管理进程/端口，未拥有SQLite业务事实，不能把此卡写成Host无FS。执行commit为ef54c46，candidate.12的143输入/33产物/4ca9冻结原字节保留；当前14源码不冒充该旧执行快照。

035原I为 `a2-dataset-identity-2b8cd05c-dd7d-4ae1-b6ae-1d1f397f1ae8`，I40/40，独立回放 `a2-dataset-identity-a353686d-0b26-49d6-95d4-073ac62bbf4c` 40/40，最终V c4462603共1774项核对通过。源I commit13f80f2、V在ef54c46复核原143输入/33产物/4ca9；失败的dcf6旧I虽40断言通过、root格式检查FAIL仍原样保留，不能改记其root成功。首私有V因绝对路径/原始请求字符串与sourceRef对象判据错误FAIL，后续新V追加更正，不修改产品或原I。

036/039完整最低V c9fd71ee明确只PASS这两卡，报告整体PARTIAL_SCOPE_REVIEWED并含037/038 BLOCKED。036首长Windows路径SQL备份失败与只读准备时新增SHM32768/WAL0保留，V只打开字节副本；真实2→3正常/孤立/未知工具迁移与逐记录理由/原库资产核对通过。039以实际构建的A/B及双视口浏览器验证活引用/过期/旧计划拒绝/同plan CLI apply仅删除B；B无引用图是明示合成GC输入，复用依赖不代表clean-install。原四卡I/独立回放总33/33只描述事实检查，不把038的5事实或037的报告提升为完整最低PASS。

14窄源码审查500660b03对持久准入、冷启动删除decision、stale lease并发唯一writer、body延迟跨rollback以及wx碰撞冻结进行独立复核，明确 `acceptanceRole=not I/V/R signoff`。14 final-integrity10c60be2、verification5f39c3db固定完整包778/778及144输入/33产物；当时新037/038正式I/V及部署未完成；后续14完整V与15实际部署见本页前部。13原全仓green和审查发现历史保留。

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
| V 013–015追加 | Codex `/root/publication_independent_v`；2026-10-07 10:52:54.771 UTC | E-V-013-015最终950检查、487引用/302原I字节/14×25表差异/5真实命令核验；六共享schema路径范围、负向检查限制及旧V/3 FAIL保留，无真实业务/Native/R |
| V 017–020追加 | Codex `/root/core_contract_independent_v`；2026-10-07 | E-V-017-020完整最低FIXTURE通过，V38/38；116引用/131非源码JSON/298唯一路径/291原I文件与153源码/143输入/33产物复核，私有copy SQL，不代签原DSH/业务/R |
| V 023追加 | Codex `/root/formal_draft_ledger_fixture`；2026-10-07 10:46:20.903 UTC | E-V-023完整最低FIXTURE通过，V17/17、194引用/原I24 JSON及DB字节保留；私有copy实际HTTP/gateway/UTF8/分页/只读spill拒绝复测，清理补记保留，无原DSH/真实模型/R |
| V 021/022追加 | Codex `/root/draft_ledger_independent_v`；2026-10-07 | E-V-021-022完整最低范围通过，独立语义52/52、SQL116/116、隔离复跑16/16；历史公共harness引用归属的首V FAIL与追加校正保留，无Native/R |
| V 025/026追加 | Codex `/root/stable_error_acceptance_map`；2026-10-07 12:15:15.705 UTC | E-V-025-026完整最低范围通过，59/59、独立回放32/32、731原I文件/520引用/5HMAC；合成ready及timestamp判据更正披露，无Native/R |
| V 024追加 | Codex `/root/formal_draft_ledger_fixture`；2026-10-07 12:18:40.015 UTC | E-V-024完整最低FIXTURE/actual-command通过，125/125、隔离回放64/64、321原I文件与5历史run保留；SQL只读私有副本，首SELECT*额外索引列判据更正保留，无Native/R |
| V 054追加 | Codex `/root/draft_ledger_independent_v`；2026-10-07 09:56:26.105 UTC | E-V-054完整最低FIXTURE通过，22项原始证据检查；readonly SQLite生成SHM/空WAL的补充FAIL及更正保留，主DB/307原I字节不变；不代签063/native/R |
| V 059/060追加 | Codex `/root/publication_independent_v`；2026-10-07 10:04:00.659 UTC | E-V-059-060完整最低FIXTURE通过，265检查/656原I字节不变；5 ready均合成，无native/model/R，10:03旧V保留 |
| V 055/056追加 | Codex `/root/maintenance_acceptance_gap_audit`；2026-10-07 09:25:33.860 UTC | E-V-055-056两卡完整最低scope通过，60断言/26HTTP trace及源/引用/HMAC只读交叉复核，不代签native/R |
| V 维护四卡追加 | 同一独立V；2026-10-07 09:35:14.745 UTC | E-V-MAINT-4完整最低scope通过，311文件/1165引用、25集合/4归档/4签名核验；073 FIXTURE、075 FIXTURE+CLOCK_CONTROL、076 FIXTURE、077 DOC+FIXTURE |
| V 057追加 | Codex `/root/source_acceptance_gap_audit`；2026-10-07 09:36:58.785 UTC | E-V-057完整SOURCE_EXEC最低scope PASS；10签名/377引用/5React carrier/30资源manifest复核，058仍NOT_RUN，无native/外部模型/人类R签认 |
| R | 未签认 | 四个范围尚未放行；候选包通过不等于生产发布批准 |

以上是实际 AI 执行/复核身份，不是人类签名。I 未代签 R，夹具 V 结果未代签真实环境。

017–020独立V38/38核对116引用、131非源码JSON、298唯一路径，291原I文件原字节不变；5次SQL仅在V私有副本，派生SHM/WAL明确记录而未污染原I。153源码/143输入/33产物一致；5个raw Git blob仅CRLF与执行源码有字节差异，文本归一后相同，0824 clean生产只指Git文本empty diff。Runtime恢复PID45148/42432均已退出，51511无listener/lease/pending。023 V194引用、原I24 JSON及DB字节保留，独立HTTP/gateway和真实≥1MiB UTF8/≤16384输出、完整分页/query_only spill失败均核对；首次私有Provider缺dispose的清理失败与wx补记保留，不属于产品FAIL。

013–015完整最低FIXTURE/actual-command已独立V通过，I16/16、V950检查；旧942检查报告f54保留，新b9报告补核六路径。487语义引用（I索引473）、14组全25表差异、302原I文件字节不变，无原DB侧文件；5真实generator/tsc退出0/0/0/0/2，Provider5/WriteOps2/mock writes2、unknown重发0。一次共享storeId字段string→integer在catalog路径11/12/13/14/15.items/32联动，六处TS/doc/tools投影同步；正向编译整个SDK，负向消费仅所选API字段及unknown.data，不声称六组独立负向测试，anyOf属性typing未覆盖和旧3个夹具/checker FAIL保留。017–020完整FIXTURE已独立V通过。020的既有码为COMPONENT_CONFLICT，继承卡 shorthand 为REVISION_CONFLICT且literal=false，[冻结SPEC](requirements/A2/docs/02_SPEC.md) §00/§05.6与REQ-020保留既有码，严格CAS/一次提交/不自动追新revision断言未放宽。另只读发现共享组件profit的provenance.metricBasis映射丢失（016）、Host/SDK/bridge超时分类差异（024）；后续局部源码修复/回归已执行，016整卡仍NOT_RUN，024完整最低FIXTURE/actual-command已独立V通过，不以有限回归代签完整卡或正式FAIL，原DSH/model原话不可由工具投影代签。

以上新八卡013–015/017–020/023全部I/V在candidate11原143输入/33产物冻结基线上完成后，016共享显示与024传输错误局部修复/回归才执行，属于后续源码阶段；profit公共Provider到UI的provenance/行展开已补齐，Host/SDK与Bridge回归和有限review通过。同view重开时Pane目录判断未依nav.revision重验error/legacy的源码路径另已只读定位；官方mounted指当前屏幕会话，收起的rightbar仍挂载，不存在由空右栏形成的循环依赖。该路径不是8轮现场failed_mount的已观察因果；最小sidebar修复已通过6项生产React局部回归，第6例从5PASS/1FAIL的RED转为6/6GREEN：同view已授权iframe在目录503时保留，新nav成功后可清除警示。相关29/29及类型检查exit0；修复已纳入12冻结包，774/774及官方同名安装/重试启动结果另列。016完整卡仍NOT_RUN，024完整最低FIXTURE/actual-command已独立V通过；当前工作树不能继续作为143输入等于11的证明。11原归档/manifest及10/11原I/V不覆盖，11未安装，该阶段桌面磁盘12/实际Runtime12。

## 未决项与范围结论

| 范围 | 当前结论 | 尚需的实际证据 |
|---|---|---|
| CORE | **NOT_ACCEPTED** | candidate.15已官方同名覆盖，独立33产物/144输入/9774原核心两遍零差异，实际Runtime15四GET正常；35正式卡保留10/11/12/14/15各自身份，旧10的011 FAIL与旧12的037/038 BLOCKED历史保留；原生注册/插件内存、其余逐卡、卸载零残留/数据保留及080仍待验 |
| AUTHORING | **NOT_ACCEPTED** | 025/026普通源码/保存分离、054/055/056/057最低scope V通过；059/060完整FIXTURE独立V通过；9真实源码/预览/读图后挂载失败、旧pub重启interrupted。10阶段GUI/内存未验的历史保留；当前17原生插件内存、实际mounted/原输入附加/明确保存/另会话重开仍待人工验收，058完整LIVE_MODEL未完成 |
| BUSINESS-WRITE | **NOT_ACCEPTED** | 历史价格与库存的4个授权写动作/公开状态/独立读回恢复已通过SCRIPT/REAL_BUSINESS范围；当前17上品、原生UI/模型业务操作及完整TST-078范围仍未完成，无新业务写 |
| DATA-CUTOVER | **NOT_ACCEPTED** | 最终1754文件备份新根restore/2773映射/源码签名PNG引用与普通npm ci重建SOURCE_EXEC通过，073最低FIXTURE卡V通过；12三冷备与安装不构成切库验收；未再次切桌面profile/dataDirectory，TST-079完整切库/运行历史草稿对账/条件回退仍待验，首失败与中间HOLD保留 |

用户批准价格 **54.80 CNY→读回→恢复54.79**、库存 **201→读回→恢复200**，本次流水四个mutation已完整成功并独立读回恢复。旧stock-test因顶层products解析遗漏曾pending/STOPPED；首次修复又被独立V发现嵌套SKU冲突而拒绝candidate.8，历史保留。最终严格offer/SKU/warehouse唯一匹配修复各52/52通过，`packages/core/src/write.ts`摘要为 `a166f50b9b407dc219518097930a204a6f402613857266c9a1bdbf47591e4e38`，测试见 `test/core/stock-readback.test.ts`。安装9后07:41:40Z只inspect原stock-test确认succeeded，独立registered查询确认201；新恢复操作完成后07:42:37Z确认200。原测试未重发；上品输入/动作另验。

用户截图的不可用提示已定位为真实业务源health超过旧1.5秒期限；Agent探测4180为旧服务查询，不是Apps自动fallback。修复默认10秒/短失败缓存、真实401/不重写边界后，candidate.9实际业务源健康读取ok。candidate.7原生技能目录列出hallmark-component-design及新描述，但无该turn读取SKILL/组件创作证据；后续candidate.9真实创作turn及原生历史已冻结，技能工具、普通源码/实际build/preview和read_image反馈修改有证据，正式发布没有mounted。主证据最初误选status字段而未列state，已以独立只读补充纠正；最后mounting行已超过deadline，不视为就绪。历史失败保留，后续新候选不得改写为旧请求成功。

09:51:44.607 UTC的原会话观察为1186 rows/886368 bytes，保留为历史。11:06 UTC当时只读观察为1267条记录，最近turn.end为10:52:35 UTC，相关8轮publication均failed_mount，尚无原生mounted通过。该时点桌面10主PID63296与4子进程、Runtime62564保留历史。后续受控停止/三冷备/官方12安装/桌面retry及四GET已实际执行，不能记作正式app.quit验收；preflight Roaming397文件与实际停写后396文件分别保留。11:30冷会话1269 rows/964632 bytes，11:45重开后1270 rows仅加end-seed且全部旧JSON前缀相同；最新原Bill文件964715 bytes、mtime=11:44:06 UTC，仍无新用户GUI prompt；该11:45观察的桌面36380/Host71548、Runtime60284；13:17的15实际部署另列。原native mounted/@/附加和暂不保存的用户测试待回复，用户已授权退出/重启无需重复许可。

candidate.9目录视觉与原生挂载失败保留，**VISUAL未验收**。局部重排/候选展示修复的candidate.10现已官方同名覆盖并正常重开，冻结706全仓/26视觉fixture/13专项/实际CLI双视口范围不变。新GUI/原生内存身份及实际mounted仍待真实验收；已有原会话新turn不等于成功；磁盘匹配/重开不代签视觉，旧Agent建议或runner截图不代签挂载。

实际备份首次因旧外部工作副本 node_modules 的 SDK junction 安全拒绝，原失败保留。修复限定可重新生成依赖缓存排除、manifest 记录和负例后，17 项检查、全仓 655 项及现场完整备份/恢复通过；不可变归档/证据的严格清单未放宽。恢复保留原 source/lock，file SDK 的相对锁路径在新根可能不适用；此时进入显式新 attempt，核实 SDK 定位后 npm install 生成新锁/输入 digest 并真实重建，不改旧回执。通常锁文件可复用时才使用 npm ci。

Client 丢响应原请求缓存可跨组件卸载/重开保留，但整页/浏览器进程重载后未承诺自动恢复；Runtime 原 invocation 持久可查。未知结果只读检查原身份，不生成新请求盲目重写。

后续执行追加 runId/scope/执行 commit/包 hash/断言/原始证据，并更新可变表。范围内强制项全部满足 [A.2 验收手册](requirements/A2/docs/03_ACCEPTANCE.md)后，才推进对应任务和范围的正式通过。
