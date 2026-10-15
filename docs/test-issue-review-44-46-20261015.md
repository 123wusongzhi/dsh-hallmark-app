# 定时检查：测试 Issue #44–#46

Automation 20 在上一批完成后复查发现三项新问题，实际 created_at 为 UTC 2026-10-15 16:05:16、16:13:03、16:14:14，均晚于限定的 15:02:44。完整正文和评论已读取，三项均无评论。本任务原分支独立验证，不导入 issue 引用的另一分支历史。Windows / Node 24.12.0；当前生产均正确，本批只增加三个回归测试、分类和报告。

| Issue | 对项目的实际价值与独立执行链 | 隔离对照 |
| --- | --- | --- |
| [#44](https://github.com/123wusongzhi/dsh-hallmark-app/issues/44) Vite 资源路径 | 未修改的原模板副本→真实已装 Vite CLI→真实 startSourcePreview→入口 HTML 中 JS/CSS 引用的标准 URL 解析与逐项 HTTP GET。核对 200、独立 MIME、manifest 成员和实际产物字节；原测试的手工 HTML/直接 TSX 不消费 Vite 配置 | 旧邻近 10/10；只把 base 从 './' 改 '/'，Vite 仍构建成功、旧 10/10，新测实际 GET /assets/... 得到 404 而失败；配置原字节恢复组合 11/11，外 cwd 新 1/1 |
| [#45](https://github.com/123wusongzhi/dsh-hallmark-app/issues/45) 响应关闭传递取消 | 实际 Host→HTTP 完整 POST body→Runtime→独占只读 Provider。用户取消后，必须观察 Provider signal、实际结算、active 归零，才在同连接显式新读成功。直接 Runtime 和 fetch spy 无法锁定 response.close 桥 | 旧 7 文件 72/72；只删 response.close 的 abort 监听、保留 req.aborted，旧仍 72/72，新测在 Provider 取消门闩 5 秒界限自然失败，非外层超时/清理报错；原字节恢复组合 73/73，外 cwd 新 1/1 |
| [#46](https://github.com/123wusongzhi/dsh-hallmark-app/issues/46) partial 摘要状态 | 真实 HallmarkProvider / BusinessOperations / executeBusiness→Runtime→HTTP→Host invoke 和终态 inspect renderer。显式预置本地 succeeded/rejected 控制，真实引擎计算 partial；独立验证 raw/model 顶层状态、operation/plan/行/counts、BUSINESS_PARTIAL 与 never 语义 | 旧 8 文件 88/88；只将 businessProjection 顶层 status 写成 ok，旧仍 88/88，新 0/1 准确发现 ok ≠ partial；投影原字节恢复组合 89/89 |

三项都登记 infrastructure。#44 无业务数据；#45 是非业务可取消查询协议；#46 的两条终态记录只有显式本地身份/状态控制，没有商品事实。#46 不替换业务引擎结果：真实 submit 跳过已完成与不可重试的拒绝行；所有商家与 reviewer 外边界 throw 并验证调用数零，无 business_executions。允许真实本地授权/时间更新，只断言行不变，不冒充商家成功或强制整 plan 不可变。没有真实商家业务写入。

## 兼容性修正与验证

#46 首次主区集成为 172/173：测试过度限定旧 `POST /v1/operations/{id}/inspect`，但主区既有 Host 使用有会话校验的 `POST /v1/session-operations/{id}/inspect`，最终同样调用 runtime.inspect；所有 partial 核心断言已通过。最小调整仅在 apps_inspect 阶段要求上述两个有效路径之一恰好读取同一操作一次。全部状态、原值、错误、零重发、零 Provider 回查断言保留；没有修改用户 Host 功能或削弱核心回归。最终复测两树均通过。

- 去重最终组合：独立工作树 **173/173**、主工作区 **173/173**，零失败、零跳过。
- 两处 TypeScript noEmit 最终均通过。主区首次出现用户正在编辑的 related-products.test.ts 缺 searchCollectedItems 类型错误；最终该错误已随用户并行工作消失，本批未改此测试或接口。
- 独立冻结数据审计 PASS：303 测试文件、160 recorded 条目、158 infrastructure 条目；分类含 helper，不将条目数相加作为测试文件数。
- 主区审计仍 FAIL：用户未提交的 purchase-cost.test.ts 与 related-products.test.ts 未分类。本批三文件已登记；不改无关用户工作。
- 合并前 39 个既有修改/新增文件 SHA-256 全部保持，scope 单独合并；后续用户并行编辑另按当前状态保护。三个临时生产变异都原字节恢复，#41 的永久一行修复保留。

#44 复用主区现有组件依赖：collected-products 与 helen-margin 各 16 项声明依赖/开发依赖的实际版本精确一致。独立树 Helen 只增加 ignored junction，没有安装、更新清单/锁文件或修改 dist。先前 commerce-image-loading 的依赖缺失环境问题，在本批该旧测试中因依赖就绪通过；这不是代码修复收益。真实 Vite 新测本机约 6.5–12.75 秒，不声称提速。

测试以 import.meta.url 定位、Fetch 允许的本机端口有界重试、取消/执行期限和明确清理避免监控挂起。#44 构建副本先 unlink 自建依赖 junction，再检查根路径后清理项目；失败保留构建、manifest、HTML、请求及服务关闭记录。真实模板文件 SHA、dist 存在状态、依赖目标前后一致。#45 用门闩而非固定 sleep，失败清理发生在正向断言之后，无法替代取消证据。独立交叉审查无阻塞。

本批没有重跑全仓，不表述成全仓全绿：主区上一批四项旧 Host 工具/请求清单断言冲突仍未处理；此前完整套件的 authoring SDK 未构建失败及两项打包前提跳过也未在本批验证消除。全部本地原始对照、恢复哈希、环境和最终组合日志位于 `artifacts/issue-review-automation20-20261015T1620/`。首次主区集成计数与诊断另存 initial-main-integration.json，最终验证使用同名日志更新，不混称首次原始 TAP。

范围为真实本地构建、入口资源可达性、协议和模型 JSON 集成；不代表浏览器执行/动态懒加载全覆盖、视觉、桌面、上传、平台或性能验收。没有新增 skip、放宽生产校验、改写冻结记录、安装桌面或执行整包发布。
