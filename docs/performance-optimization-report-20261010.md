# DSH 性能优化报告

执行时间：2026-10-09 至 2026-10-10（Asia/Shanghai）

基线：candidate55，提交 `0d2d4c1e801d35b6ea62581ad4259ffd518c4533`。本轮依据《DSH_candidate55_15_Optimization_Review_R0》逐项复现结论实施，目标是在保留完整性、权限、并发控制和正式验收门槛的前提下减少重复工作。

## 交付与验收

原报告 15 项均已实施对应优化，并已回写到项目目录 `E:/project/deepseek_h/dsh-hallmark-app`，保留现有 candidate56 侧栏、收藏和会话组件改动。独立优化版本完整验收 **1,198/1,198 通过**，candidate56 合并副本与回写后的原项目均为 **1,211/1,211 通过，0 失败、0 跳过**。原项目的 SDK 生成、类型检查和开发包构建均通过。

优化先在独立工作副本实施，避免覆盖主目录同时进行的 candidate56 侧栏、收藏和会话组件改动。原改动的源码内容、二进制补丁和 SHA256 清单已保存，另建兼容性副本合并验证。本轮只修改本地项目和生成开发包，不安装插件，不切换运行中的服务，不操作真实店铺。

回写前检查原分支、提交、改动清单、补丁及 40 个已有改动文件的摘要；检查通过后备份并更新 **65 个文件**。更新文件与已验收合并副本逐字节一致，其余文件原样保留。全仓库 757 个源码/文档文件的清单和内容均已核对；其中 456 个未改动文本文件与新工作副本仅存在 LF/CRLF 差异，保留原目录换行格式。原分支 `fix/agent-binding-preview` 和 HEAD 未切换，原目录改动未代替用户提交。

可恢复的本地优化提交为 `75e598c9147b44947fc8e484fa43d963ba1032b7`，candidate56 兼容性合并提交为 `5a007521ebe562eb51e3b0b7b65b07612929981b`，历史 SDK 原字节保存规则提交为 `309ce890962222ac7cc89bc1eec278518ac73592`。合并分支为 `codex/performance-integration-candidate56`，恢复点与回写前备份位于文末证据目录。

开发包为 [dsh-plugin-apps-bundle-1.0.0-candidate.56.tgz](E:/project/deepseek_h/dsh-hallmark-app/artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.56.tgz)，SHA256：`48844275effae0aca7354376cec3404a5f8356b284b5df3813ee59f4bd428473`；构建结果 `installed:false`。

## 主要实测结果

以下分别使用固定基线复现、优化后的真实模块、认证本地 HTTP 服务、React 组件和独立 headless Chrome。业务数据为测试数据，耗时属于本机观察，不代表实际桌面宿主或生产服务的响应时间。

| 场景 | 优化前 | 优化后 | 结论与边界 |
| --- | --- | --- | --- |
| 65 文件、约 8 MiB 归档冷校验 | 130 次内容读取，16,777,292 字节 | 65 次，8,388,646 字节 | 去掉同次校验的重复内容读取。 |
| 同归档暖校验 | 每次 130 次内容读取 | 0 次内容读取 | 仍检查全部文件身份、纳秒时间信息和目录成员；15 次计时中位数 54.53 → 1.19 ms，操作系统文件缓存已热。 |
| 1,000 条无关记录 + 2 条目标记录 | 解析 1,002 条 | 解析 2 条 | 命中复合索引；15 次计时中位数 2.040 → 0.0168 ms，仅是该查询路径。 |
| 纯标题/描述修改的数据源验证 | 再执行一次真实查询 | 0 次新增查询 | 仅复用相同语义、能力、样本、会话和上下文的已确认结果，保留原时间。 |
| Native apps_list | 4 次 HTTP 请求 | 3 次 | 去掉同一次调用内的重复身份握手。 |
| 明确连接和能力版本的 Native 查询 | 6 次 HTTP 请求 | 首次 3 次，缓存命中 2 次 | 每次仍检查 Runtime 身份和目录摘要；服务端动态确认授权并实际执行。 |
| 约 333 KB 绑定快照 | 超过 262,144 字节桥接上限，失败 | 完整分块重组，最大 HTTP 桥封包 87,722 字节 | 保留单消息上限；单快照最多 32 MiB，容量不足明确失败，不截断数据。 |
| 同份 333,235 字节数据的正式 Chrome 预览 | 冻结旧 SDK 在双视口明确 FAIL | 新 SDK 在 420/1040 双视口 PASS | 完整正文 SHA256 一致；首次每视口 6 块，重复刷新 0 块；正式截图和报告保留。 |
| 相同内容的再次读取 | 再传完整内容 | 只传当前元数据，新增块数 0 | 数据版本、缓存时间仍更新；后端仍有取数、复制和计算摘要的成本。 |
| 100 个视图、21 次不变轮询 | 21 个完整响应，4,399,521 字节 body | 1 个完整响应，209,501 字节 body | body 减少 95.24%；请求仍为 21 次，20 次返回 304。Runtime 的 304 路径不解析视图列表。 |
| 20 次连续 UI 状态变化，保存较慢 | 20 次写入 | 2 次写入 | 在途写入最多 1 个，最终保存最新值；等待保存的调用仍等待持久化成功。 |
| A → B → A 标签切换 | 容器挂载 3 次 | 2 次 | 当前和最近 2 个工作副本保活；真实 NativeView 隐藏恢复仍为同一 iframe、授权和 display，新增全量 viewData 读取 0 次。 |
| 已登记的失败预览，恢复条件后重试 | 新 attempt 需要多构建 1 次 | 新 attempt 多构建 0 次，重新运行浏览器 | 明确 `retryStage:preview`；复用有签名证据的未变归档，保留原执行身份和时间。 |
| 同构建、同交互的草稿诊断 | 正式流程 2 视口、2 次 fixture 读取 | 草稿 1 视口、1 次读取 | 草稿恒 INCOMPLETE，不能代替正式发布证据。单次观察 958 → 620 ms，不泛化加速比。 |

## 对应原报告的 15 项

| 编号 | 落地措施 | 保留的质量与稳定性约束 |
| --- | --- | --- |
| 01 重复完整性校验 | 同次去重；归档和证据使用有数量、容量上限的已验证缓存。 | 文件或目录成员变化失效；普通篡改、复原 mtime、证据祖先篡改均拒绝。归档缓存 64 项、指纹容量 8 MiB；证据缓存 128 项、16 MiB。 |
| 02 失败阶段无法直接重跑 | check runner 增加明确阶段和重试身份，取得真实新 attempt/epoch。 | 不覆盖旧失败证据；同 retryId 恢复原结果；丢响应只确认原身份，不隐式再次执行。 |
| 03 全环境导致误失效 | 内置构建精确识别安全依赖；自定义构建可明确声明额外环境变量。 | 未声明的自定义命令仍保守比较全部环境；安全变量不能被声明排除；旧 checkpoint 不静默升级，环境值不写诊断。 |
| 04 网关串行过宽 | 仅已发现的业务 query/compute，且 Runtime 描述为 declared_safe 时声明可并行。 | 未知能力、业务 mutation、内部 presentation/authoring 仍不放宽；实际锁和写入幂等由 Runtime 执行。 |
| 05 大数据桥接失败 | 增加协商式 dataTransferV1，64 KiB 分块、内容摘要和相同内容复用；读取器返回值与私有缓存隔离。 | 老 SDK 保留原错误和上限；每块校验身份、nonce、连接权限、绑定、配置和能力版本；正文篡改及重复 binding 身份拒绝。冻结包允许并行完成，普通刷新不删除在途传输。 |
| 06 标题修改重新验证 | 纯元数据修改复用确认结果。 | 映射、字段语义、能力描述、路由、查询和上下文变化继续真实验证；缺少可信指纹的旧定义首次仍验证；提交时重查描述与 CAS。 |
| 07 每次预览成本 | 增加独立单视口草稿诊断，与正式 checkpoint 和摘要分开。 | 正式双视口、交互断言、截图、真实执行和发布门槛保持；草稿不能登记正式预览。 |
| 08 查询解析无关记录 | 精确匹配查询白名单及适用索引，减少 display、draft、版本等扫描。 | 参数化 SQL、集合/字段白名单；空值、跨会话隔离和旧 store stub 回退均验证；增加的索引写成本见下文。 |
| 09 初始化阻塞 | 必要数据与可选上下文/UI 恢复分开处理，晚恢复不覆盖已发生的本地编辑。 | 身份、必要数据、React commit 和 required 断言仍是 ready 条件；可选失败显示警告，不能虚报展示成功。 |
| 10 多次 HTTP 往返 | 明确路由时由认证服务端完成动态路由确认、Runtime 执行和模型投影；能力描述按目录摘要缓存。 | 旧 Host 不支持时走原路径；已提交新路径后绝不补发旧路径；结果丢失只回查原 invocation；Host 输出 Schema 检查保持。 |
| 11 每轮完整创作指引 | 默认提示保留核心体验、缓存、权限和写入规则；完整路径、请求模板及政策按 begin 描述/成功结果提供。 | 受信任会话约束、模型结果预算和完整开发指引保持；不因精简提示要求用户额外安装技能。 |
| 12 全量轮询 | views 使用 ETag/304，同时跟踪 views 和 authoring_drafts 集合；绑定内容按摘要复用；隐藏时暂停业务刷新。 | 视图和草稿状态变化都使版本失效；外部 SQLite 提交、回滚、本地关闭/恢复及晚响应均覆盖。绑定数据的后端复制/摘要尚有优化空间。 |
| 13 状态保存堆积 | 一个在途保存 + 一个待处理最新版本，相同状态不重复写，增加可等待的 flush。 | expectedStateRevision 和冲突检测保持；未成功持久化不会返回已保存；卸载取消等待并清理监听。 |
| 14 标签反复冷启动 | 最多保留 3 个工作副本容器，隐藏暂停，返回时轻量核对版本。 | 关闭、淘汰、会话切换真实卸载并释放授权；隐藏初始化等恢复后继续，启动超时只累计可见时间。 |
| 15 全局 busy | 不同 view 的关闭/恢复采用各自冲突域；共享创作和同 view 的冲突仍串行。 | 双击防重、CAS、未知回执锁及只读确认保持；并行结束不能抢回用户已切换的焦点。 |

## 回归与兼容性

| 验收版本 | 完整测试 | 类型检查 | SDK / 开发包 |
| --- | --- | --- | --- |
| candidate55 独立优化副本 | 1,198 通过；0 失败、0 跳过 | 通过 | 通过 |
| candidate56 兼容性合并副本 | 1,211 通过；0 失败、0 跳过 | 通过 | 通过 |
| 回写后的原项目目录 | 1,211 通过；0 失败、0 跳过 | 通过 | 通过，未安装 |

独立优化版本最终完整测试 1,198 项全部通过，无跳过；类型检查、生成 SDK 和开发包构建通过。验收覆盖 Runtime/SQLite、授权、CAS、迁移/备份、归档和证据完整性、HTTP 故障与恢复、SDK 旧协议、React 生命周期、模板、仓库外打包 CLI、真实 Chrome 预览。

第一轮完整测试 1,176 项，1,160 通过、16 失败。失败项包含旧测试对单一请求路径/最后一条消息的假设、新增可选证据字段的历史模板断言、缺少工作副本示例依赖、一次 Windows 浏览器临时目录清理失败，以及当轮尚未修正的测试错误判断。均保留原日志并逐项处理；HTTP 故障矩阵扩为 SDK、Host 旧路径、Host 协商新路径，38 项通过；针对回归 23 项通过。最终结论以最后一次全量运行结果为准。

随后发现分块响应的预览证据采集未包含元数据中的绑定版本，导致原模板的版本证据断言失败。已修复采集并保留原断言，再次全量运行 1,198/1,198 通过。兼容性合并同时保留 candidate56 侧栏文案、收藏、工作副本目录草稿状态及文档退役队列；ETag 跟踪视图和草稿两个集合，并增加真实 HTTP 的草稿状态变化回归。合并版首次 1,211 项中唯一失败为测试随机端口不可用，已改由操作系统分配端口；再次完整运行 **1,211/1,211 通过，0 失败、0 跳过**，两次日志均保留。

独立审查发现并修复了刷新期间撤权、inline 内容摘要未验证、重复 binding 元数据、返回对象污染私有缓存，以及普通刷新误删在途冻结包等边界，并加入永久回归测试。

## 代价与仍未证实的收益

- 索引增加写成本：1,000 条无关 provider 记录批量写入单次观察 13.08 → 32.95 ms，数据库 1,622,016 → 1,658,880 字节，增加 36 KiB。已使用适用 namespace 的部分索引并删除不必要索引；不能声称写路径加速。
- 分块消除了单消息容量障碍，但首次读取需额外请求；传输正文保留总容量 64 MiB、最多 64 项、两分钟过期，单项 32 MiB。达到上限或身份失效时明确拒绝，不能冒充全量成功。
- 相同内容复用主要减少跨 HTTP/iframe 的正文传输；后端仍可能读取完整快照并做复制、序列化和摘要，客户端为隔离可变返回值也会复制内容。
- 保活上限为 3 个容器，可增加常驻内存；尚未实测用户桌面内存、标签时延或生产吞吐。Workbench 实例标签维持原生命周期，保活覆盖工作副本视图。
- 隐藏暂停覆盖新 SDK 协作和宿主业务桥；第三方组件自己的动画、定时器需自行管理。旧 SDK 内部轮询不会因新可见性消息自动停止，但宿主会拒绝隐藏期间的业务请求。
- 自定义构建声明 environmentKeys 时须覆盖真实额外依赖；任意组件自有异步 importState 仍需在组件内部协调编辑，宿主保护覆盖恢复读取和迁移晚返回。
- 正式预览仍完整运行，草稿只是更便宜的诊断入口；不将诊断结果计作正式性能或质量验证。

## 复现资料

- [原 15 项验证报告](E:/project/deepseek_h/audit-output/candidate55-report-verification/DSH_candidate55_15_Optimization_Verification.md)
- [后端测量与限制](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/backend/measurements.json)
- [CLI 实际运行证据](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/cli/findings.json)
- [前端测量及验证](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/ui/UI_Optimization_Report.md)
- [真实 HTTP 网关请求比较](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/gateway/measurements.json)
- [真实 HTTP 大数据传输](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/gateway/data-transfer-http.json)
- [正式 Chrome 新旧 SDK 对照](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/ui/large-preview-d7f601f7-25d1-4a26-a592-0ed4d96c6faf/result.json)
- [1,198 项完整验收日志](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/full-test-final2.log)
- [candidate56 合并版 1,211 项完整验收日志](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/full-test-final.log)
- [原项目回写后 1,211 项完整验收日志](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/main-project/full-test.log)
- [原项目类型检查日志](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/main-project/typecheck.log)
- [原项目开发包构建日志](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/main-project/build.log)
- [最终交付验收清单及源码、日志、开发包摘要](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/main-project/acceptance.json)
- [原目录改动恢复点和 SHA256 清单](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/source-snapshot/manifest.json)
- [回写记录、全文件摘要与备份索引](E:/project/deepseek_h/performance-optimization-20261009/artifacts/performance/integration/applied-backup/applied.json)
- [重试、环境依赖和草稿使用说明](component-authoring/performance-cli.md)

复现环境：Windows，实测 Node `v24.12.0`，在最终项目根目录 `E:/project/deepseek_h/dsh-hallmark-app` 执行。项目要求 Node >=22.18；示例工程依赖按其已有锁文件准备。依次运行：

```powershell
npm run generate:apps-sdk
npm run build:apps
npm run typecheck
node --test --test-concurrency=4 test/**/*.test.ts
```

先生成 SDK/包以准备模板依赖。全部测试使用本地 fixture 与独立浏览器，不需要真实业务凭据。

## 2026-10-10 安装补记

上述 SHA256 为 `48844275effae0aca7354376cec3404a5f8356b284b5df3813ee59f4bd428473` 的冻结优化包现已通过官方管理器安装到 DSH，Desktop 与原数据目录的 Runtime 均已重启。57 个已安装产物和实际页面脚本核对通过；新性能协议已声明，现场 10 次不变目录读取全部返回无正文的 304，原组件、素材、连接和 121 个会话文件均保持完整。安装前报告原字节另存本机证据目录，之前的验收清单与日志保持原样。

此前 1,211 项完整验收针对本报告的冻结输入。工作目录另有验收后新增开发，已保留，未混入此次安装，也不自动沿用此前测试结论。详细安装、数据保留、回滚及边界见[性能优化包安装记录](performance-installation-20261010.md)。
