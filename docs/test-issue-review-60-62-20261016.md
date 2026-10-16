# 测试 issue #60–62 审查与兼容性验证（2026-10-16）

本轮接受三项有实际帮助的问题：修正测试准备入口、恢复声明支持的 Node 22.18 生产读取、修复超时测试夹具的生命周期。
默认全量已自然结束；本轮修复的定向验证通过，完整结果仍有下述独立失败，不代表全仓全绿。

独立树输入为 `a72cf5b217a85658ef52ea01227bc1dfabd85e44`，Windows x64；完整 issue 正文及各一条评论均已阅读归档。
以下创建时间使用 GitHub 的 `created_at`（UTC），均晚于本轮既定筛选时间 `2026-10-15T15:02:44Z`。

| Issue | 实际创建时间 | 独立判断与处理 |
| --- | --- | --- |
| [#60](https://github.com/123wusongzhi/dsh-hallmark-app/issues/60) | 2026-10-15T20:26:13Z | 根安装命令与默认数据描述误导；仅修正文档 |
| [#61](https://github.com/123wusongzhi/dsh-hallmark-app/issues/61) | 2026-10-15T20:46:38Z | 编号 SQLite 参数绑定在最低支持版本失败；保留最小生产修复 |
| [#62](https://github.com/123wusongzhi/dsh-hallmark-app/issues/62) | 2026-10-15T20:46:51Z | 无真实 I/O 的 abort 夹具导致 Node22 取消；修复夹具并增强负控 |

#60 直接影响新机器进入测试的路径：根目录只有 `pnpm-lock.yaml`，没有 npm 锁文件。
在新建 ignored 临时目录仅复制根清单与锁文件，使用空 user/global npm 配置、独立缓存、offline 与 ignore-scripts，`npm ci` 自然 exit 1，明确报 EUSAGE 缺锁。
没有在工作树根执行该命令，探针未生成 node_modules；原清单、锁文件、浏览器数据哈希及依赖 junction 身份前后相同。

根 README 改为 `pnpm install --frozen-lockfile --ignore-scripts`，并指向已有的先生成 SDK、构建再完整测试的步骤。
根 README 和 `test/real-data/README.md` 区分默认公开脱敏快照、可选外部完整快照和不入库的浏览器生成文件。
组件子项目有自己的 npm 锁文件，其 `npm ci` 指引保持原样；历史验收和安装记录未改。

清除子进程的 `DSH_REAL_CORPUS` 后，生产加载器读取并校验默认公开数据：41 条记录、20/20/1 来源配额、41 张图片。
清单、SHA 文件与全部响应／图片引用恰好等于 Git 跟踪的 134 个文件，共 17,741,629 字节，无缺失或多余引用。
已有依赖下运行 `node --test --test-reporter=tap test/collection/real-corpus.test.ts`：45 pass、0 fail/skip/cancel，2268.8924 ms。
该定向命令未运行会写审计报告的 npm 包装入口，也未生成数据、安装依赖或连接商家；不宣称 fresh install 已验证。

#61 的旧测试已经能检出问题，关键是实际运行声明支持的最低版本，而不是再制造一个生产变异。
无仓库依赖探针中，22.18 的 `SELECT ?1` 加位置实参抛 `ERR_SQLITE_ERROR: column index out of range`；24.12 正常。
匿名占位符的位置绑定、完整编号名对象绑定，以及对象键乱序控制，在两个版本均正常。

只保留 `RuntimeStore` 两处参数列表修改：scope 显式绑定 app/connection/namespace；revision 显式绑定 session/view，只有 SQL 包含 build 条件时才提供 `?3`。
原 SQL、排序、JSON 解析、索引、schema/user_version、事务和不可变证据逻辑保持原样；采用该版本已提供的 namedParameters 接口。
接口依据：[Node 22.18 SQLite 官方文档](https://nodejs.org/download/release/v22.18.0/docs/api/sqlite.html)。
三处既有 EXPLAIN 测试同步使用完整编号名绑定，原索引、无扫描、有界解析与排序断言保留。
既有 revision case 增加六行独立预期，涵盖含占位符语法的字面量、缺省／空／非空 build、来源不存在和 session/view 互换。

| 独立树固定范围 | Node 22.18 修改前 | Node 22.18 修改后 | Node 24.12 修改前／后 |
| --- | --- | --- | --- |
| 原 8 文件、48 项 | 26 pass / 22 fail | 48 pass / 0 fail | 48/48 pass ／ 48/48 pass |
| schema4、migration、workbench-migration 原 3 文件、14 项 | 未补跑 | 14/14 pass | 修改后 14/14 pass |

上表所有已执行轮次均 0 skip/cancel；失败与成功执行不同工作量，耗时不用于宣称性能提升。
JSON 重复键、顶层 null、非法／深层 JSON、JSON5 错误优先级、scheduler 顺序／恢复、配置与会话隔离等原检查均保留。
Node22 原 disk-store 在 close 前抛错，Windows 清理的 EBUSY 会遮蔽绑定异常；首轮原日志保留，同一旧用例修复后正常 close/reopen。
本机固定组未剩余独立 planner/index 失败；这不能外推其他系统或 Node 24.19 的结果。

#62 独立复现区分 fail 与 cancel：Node24 原文件 19/19 pass，Node22 为 17 pass、0 fail、2 cancel、0 skip。
两次 cancel 均为 Promise 未完成而事件循环已经结束；裸 abort Promise 没有真实 I/O，不能据此认定生产 HTTP 取消失效。

最终只修改 `test/app-hallmark/listing-assets.test.ts`：保留全部 19 个测试名和 96 个原 assert，新增 16 个 assert，无删除或 skip。
慢 publish 分支使用 native fetch 访问本机回环 HTTP 服务，响应有界为 1,000 ms；server、socket、延迟定时器均 unref，客户端真实 I/O 提供生命周期。
取消在服务端收到请求后发起；response close 清定时器，after 清连接并等待 server close，断言 pending=0、socket=0、listening=false。
保留 whole-call 200 ms 预算、原 5 s 边界、逐文件分类、失败不缓存和普通新调用重试成功。
预算可合法耗尽于文件准备阶段，因此允许实际 HTTP 为 0 或 1 次，且任何已开始请求都关闭；caller 取消仍准确检查 1/0/1 请求／成功响应／关闭。

首个候选存在独立发现的漏检：快响应 mock 忽略已 abort 的 signal，复用上次失效预算仍能假通过。
最终在 fetch 边界调用 `throwIfAborted()`，使快夹具也遵守 native fetch 的即时拒绝语义；该真实生产变异在两个版本均转为明确断言失败。
另用不保留在源码中的 300 ms 首次准备延迟验证，预算／重试用例在两个版本均通过，HTTP 为 0/0/0，无需假定机器足够快。

两个版本各执行以下八种自然生产负控，共 16 次明确 ERR_ASSERTION/testCodeFailure，全部 exit 1，0 cancel/skip/超时终止：

- 禁用预算、延长预算超过服务端响应、publish 漏传 signal、预算错误误分类。
- 忽略 caller signal、caller 取消误分类、失败批次写入真实内容缓存键、下一调用复用已 abort 的预算。

最终完整文件及恢复轮在两个版本均 19 pass、0 fail/skip/cancel；失败缓存与 retry 的原行为断言未放宽。
每个负控只在独立树临时变异 `packages/app-hallmark/src/listing-assets.ts`，均 finally 恢复原 Buffer，验证逐字节相等及 SHA。
恢复 SHA256 为 `8ba0a7f845c80c80859ff4c07abf94a21c556814d36e635059fca665d9444113`；本项没有永久生产修改。

运行时使用现有 Windows Node 24.12.0（SQLite 3.50.4）和显式路径的官方 Windows Node 22.18.0（SQLite 3.50.2）。
22.18 的 [node.exe](https://nodejs.org/dist/v22.18.0/win-x64/node.exe) 按同版 [SHASUMS256.txt](https://nodejs.org/dist/v22.18.0/SHASUMS256.txt) 验证 SHA256：
`c22d1c59a1f767a1ed0178445a027f2257d318c55430fc819d48f269586822b7`。
没有安装 Node、改全局 PATH 或安装项目依赖；子进程使用选定运行时的 process.execPath。

主工作区集成保护 107 个既有 modified/untracked 文件；store.ts 只替换两个绑定调用。
逆向去掉这两处替换后，SHA 证明用户 blockedResume/canDispatchBlockedAsset 等 WIP 原字节保留；其余 7 个原干净路径才 apply。
主区相同 12 个定向文件在 Node22/24 各 81 pass、0 fail/skip/cancel；分别耗时 18.294 s、13.924 s。
主区最新 typecheck 与真实数据 audit 均 PASS，本轮未出现上轮的三个 jobs 诊断或五个分类失败。

按文档执行 SDK 生成和 bundle 构建完成，installed:false；生成 SDK 只有 LF/原 CRLF 字节差异，规范化文本完全相同，已恢复原字节后构建。
生成文件不提交，不安装到 DSH；以上定向、类型和构建结果不替代下表默认全量。

| 默认串行 npm test 最终轮 | total | pass | fail | skip | cancel | 同输入 typecheck | 同输入 audit |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Node 22.18 | 2263 | 2261 | 2 | 0 | 0 | PASS | PASS |
| Node 24.12 | 2263 | 2262 | 1 | 0 | 0 | PASS | PASS |

全量保持原测试发现范围、默认串行和原 skip 条件；冻结输入后的源／测试 SHA 清单与完整输入 manifest 留存。
Node22 默认全量保留两个失败：provider 精确关联期望 on_sale、实际 unknown，与上一轮同类现象一致；以及 actual packaged Runtime validates pricing and packaging without checkout dependencies。Node24 仅后一项失败；provider 通过不表示该偶发已修复。
provider 的本次失败未留存数据库取证，不能把先前同毫秒排序诊断当成本次已证实归因，也不宣称偶然消失就是修复。
打包回放的原 parity-probe 把冻结脱敏 productId='test-reference-2' 直接 Number() 转成 NaN，在 StableHallmarkBusinessStore.put 的 canonicalJson 入口被拒绝，尚未进入 RuntimeStore 或本批修改的 SQL。
该 probe 与 a72 基线 Git blob 完全相同；旧全套因无 bundle 跳过过此项，不能说它此前已执行通过。主区此文件已有用户修改，未混入本批。
两轮均使用默认 npm test（含原 pretest 数据审计），测试发现范围、串行度与 skip 条件没有改写；构建就绪后本轮没有 skip。全量前后全部已跟踪输入 SHA 一致，未遗留测试或构建造成的源码修改。以上完整验证冻结在 #63 新断言应用之前，不将这些计数借作 #63 候选的全量结果。

仅以已有依赖进行 Windows 离线／本机回环验证；没有 Linux、全新安装、商家写入、实时商品状态、原生桌面安装或全平台通过的结论。
所有既有断言、测试发现与分类保留；未新增测试文件或冻结业务数据 fixture，未加依赖、通用框架或跳过。
本机证据根为 `artifacts/issue-review-automation20-20261015T2050/`，完整原日志不随本报告发布：

- `issue60/`：完整正文评论、隔离缺锁日志、公开引用集合、45 项 TAP 和保护哈希。
- `issue61/`：REVIEW、summary、探针、原／修复 8 文件与迁移日志、fix.diff、源码 SHA。
- `issue62/`：正文评论、summary、首候选漏检、最终候选、16 个负控及逐次 Buffer 恢复记录。
- 根目录：main-integration/main-validation、SDK 换行差异、build-bundle、full-validation 输入 manifest 及双版本全量日志。
