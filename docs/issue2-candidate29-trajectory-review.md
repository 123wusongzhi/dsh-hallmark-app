# candidate.29 创作轨迹复核与下一轮方案

日期：2026-10-08。参考用户提供的 DSH_Issue2_Branch_Review_candidate27_R0.md，并重新核对当前工作区代码；该报告的 candidate.27 结论不直接视为 candidate.29 验收结果。

## 已结束的真实会话

- 标题：商品利润率分页组件（2）
- session：session-ca7db911-e936-4b54-8631-4216e92895c2
- 用户请求：展示在售商品、采购成本、实际售价、利润率，支持分页。
- 请求开始：15:29:17；实际 display ready：15:34:35.119；turn/end completed：15:34:54.121（北京时间）。
- 请求到展示约 318 秒，到最终答复约 337 秒；96 个模型步骤、116 次工具调用。
- 安装依赖输出确认 SDK candidate.29，运行上下文含 developerDocs、Windows launcher 和截图位置指引。
- 第 17 步初始化模板；8 次 checkRunner 调用、5 个 attempt、4 次实际预览（INCOMPLETE、FAIL、PASS、PASS）。不能将 8 次调用说成 8 次完整构建预览。
- 发布 publication e2f507d6-89f4-4bea-b53f-2c9791ac4acd；display 08824aa3-6af9-4f8c-9cac-479315413476 为 ready，validationStatus verified。
- 本地轨迹快照：artifacts/trajectory29/session.jsonl；可读摘录：artifacts/trajectory29/compact.txt。未操作用户桌面。

## 改善与剩余浪费

已改善：使用开发者文档及 product-list；使用 Windows check launcher，不再因空 EXIT 重跑正式检查；直接使用正式预览的分步骤截图，没有另建 Host/CDP。成功预览约 2.8–2.9 秒，完整检查约 12 秒。与上一轮约 11 分 34 秒相比本轮结束约 5 分 37 秒，但任务与生成内容不同，不据单样本宣称稳定提升比例。

1. 第 56–73 步：改源码后先撞 NEW_ATTEMPT_REQUIRED，换 attempt 漏改 sourceRevision，生成身份错误报告；误以为 dist 陈旧，清理后再撞 ATTEMPT_STATE_INVALID；随后读内部实现、报告，再开 attempt。15:32:23 至 15:33:03 约 40 秒主要消耗在编排纠错，而非编写组件。
2. 第 43、73 步：两次在第二页搜索第一页 SKU，测试计划错误，分别导致约 12 秒失败预览。第一次已口头识别却没有修正动作顺序。preview.json 和 .check-request.json 内各维护一份 assertions，加重了修改负担。
3. 第 75–80 步：仅修改测试计划，仍被要求新 attempt。错误摘要明确 stage=build；sourceInputDigest 遍历除 node_modules/.git/.preview/dist 外全部文件，将工作区内 preview.json、.check-request.json 计入源码。不是“已登记预览不可变”导致：此前失败预览没有自动登记。
4. 第 37–41 步：pnpm esbuild 脚本策略失败，Agent 又尝试安装/单独构建/检查输出。约 22 秒的环境绕行，实际二进制已存在。应提供与当前运行环境一致的安装方式，不能通过关闭全局策略修复。
5. 第 8–24 步：产品查询共 9 次，含 6 次 query 探测；resultReader 输出解包连续猜错两次。domain.ts 当前 query 是对整行 JSON 做子串搜索，不能把 query=on_sale 宣称为严格状态筛选。
6. 首次 PASS 后增加的一轮修改，是 Agent 自行增加的页级利润率统计与单品口径不一致。修正本身必要，但该统计不在用户要求内。不要继续添加额外 KPI 再为其反复验证。

## 最优先：检查请求由工具组装，源码与验证配置分开

修改范围以既有 check CLI、starter 和开发者文档为主，不新增后台服务或 Agent 循环。

- 增加薄的请求准备入口：接收明确的 attemptId，复用 inspect 返回的 epoch/sourceRevision/viewId/workspacePath；一次写完整请求，Agent 不再手改多处身份。新 attempt 仍显式 begin，不自动替用户创建。
- 请求和日志生成在 evidenceRoot；正式预览计划只保留一份，check 通过 planPath 读取，保留现有内联格式兼容。
- starter 使用既有 .preview 目录放测试计划（目前已不计入 sourceInputDigest）；示例、文档和生成器一并迁移。不要全局忽略任意 JSON 或弱化源码校验。
- 只改计划时复用成功 build，错误直接指出实际变化阶段。已登记回执仍不可改写；需要新 attempt 时明确给出继续入口。
- 合并报告 P1-01：有效 FAIL/INCOMPLETE 也登记，失败后 inspect 必须反映失败；响应丢失只补登记同一报告。失败 checkpoint 重试也应先恢复结果，不能登记失败后又启动新执行。
- 注意关联影响：登记失败预览后，当前 attempt 生命周期可能要求下一次验证新建 attempt。不能同时承诺“失败登记不可变”和“任意改计划沿用同一 attempt”。本轮保持既有生命周期，明确此限制；不借机新增跨 attempt 回执复用体系。

验收：请求身份只由 Runtime 当前 attempt 产生；只改 .preview 计划不触发 BUILD_INPUT_CHANGED；未改源码的同请求恢复不启动构建；失败后 inspect 不再建议等待；不动已经生成的旧回执。

## 第二优先：提供可直接运行、数据不写死的分页验证样例

- 在现有 product-list 预览样例补搜索→清空搜索→勾选/附加→翻页→当前页勾选/附加→返回→刷新；保留后续页附加覆盖。
- 搜索词来自本次当前页实际可见行，而非固定 SKU 或固定命中数。如需能力扩展，只增加从指定元素读取文本填入输入框的窄操作，不增加脚本语言或任意 JS。
- 一个正式计划文件，check 自动读取；动作失败报告包含 case、视口、实际计数/文本，减少看完整源码的需要。
- 合并报告 P2-02：requiredMethods 按每个视口分别检查，防止一个视口掩盖另一个。
- 利润率样例默认展示原字段，不自加汇总指标；需要汇总时先明确口径，不能自行选择平均值冒充经营整体利润率。

验收：数据换 SKU、换顺序仍能验证；搜索不会残留到翻页附加；单视口漏分页/附加不能 PASS。目标是普通首版一轮检查，真实缺陷最多一次有明确原因的修正；这是目标而非现有保证。

## 随后的小修

- 报告 P1-02：refresh 成功、catch、finally 使用与分页相同的请求序号。当前源码仍只检查 client。修复正确性，不能称为本轨迹耗时根因。
- 报告 P2-01：后续页复用首屏 partial/error/freshness 转换规则。当前仍删除新页 error、fresh 降为 unknown。本轨迹未观察到因此返工。
- 安装指引给出已验证的当前本机包管理方式；如使用 pnpm，只配置 esbuild 所需的项目级脚本许可，不修改全局策略。
- Hallmark descriptor 明确 query 现有语义；若“在售”需严格准确，增加窄的 status 筛选并在分页前执行。补 resultReader 的 result.data.products 解包示例，停止重复查询猜层级。

## 执行建议与效果判定

优先做“请求自动组装与配置隔离”，再做“可直接复用的分页验证计划”。报告四项都保留，但按本次实测收益重新排序。不承诺节省固定百分比；下一次同类请求比较准备耗时、实际构建/预览次数、身份错误数、重复读内部实现次数与请求到 display.ready 时长。本文件仅为分析与方案，尚未实施下一轮代码修复或安装。
