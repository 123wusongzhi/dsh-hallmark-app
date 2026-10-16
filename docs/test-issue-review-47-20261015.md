# 定时检查：测试 Issue #47

Automation 20 在上一批完成后复查发现 [#47](https://github.com/123wusongzhi/dsh-hallmark-app/issues/47)，实际 created_at 为 UTC 2026-10-15 16:20:42，晚于限定的 15:02:44。完整正文与评论已读，无评论。独立基线为原分支 `c16b43a04219ac2fac619c9c2bb010cf4d05be29`，Windows / Node 24.12.0。

这项建议有实际价值：成功搜索可同时保留非空原始 raw 与空 matches。空 matches 表示没有符合条件的商品，不能回退 raw 给用户无关商品和误导性的下一页。当前生产 `matches ?? raw` 正确，无需改动；已有 Adapter 测试虽覆盖该响应形态，却未跨 Core 的选择表达式。

新增 `test/apps-host/collected-empty-search.test.ts` 使用两条未改动、经 hash 校验的冻结摘要，经真实 HallmarkClient Adapter→Core/HallmarkDomain→HallmarkProvider→SQLite Runtime→实际 HTTP→注册 Host 工具→renderer JSON。字面量独立期望 items=[]、total=0、无 cursor，同时核对 Adapter raw/matches、原生结果、模型结果、持久化结算证据；另分开验证真正空源、503 unavailable/read_retry、快照成功载荷保留及显式恢复。四次调用恰好四次源 items 读取和四次 routed 查询，无 operation、无自动重发；恢复不改历史失败证据。

| 对照 | 结果 |
| --- | --- |
| 旧 22 文件，原实现 | 334/334，零跳过/取消 |
| 新测试，原实现 | 1/1 |
| 只把 Core 表达式改为 matches 非空才使用、否则 raw | 旧仍 334/334；新 0/1，准确在真实模型空 items 断言发现无关原始行 |
| 原字节恢复后旧+新 | 335/335，零跳过/取消 |
| 最终五文件定向组合，独立树及主工作区 | 均 51/51，零跳过/取消 |
| TypeScript noEmit，两处 | 均通过 |

最小适配保留未来合法元数据：不强制整个 data/payload 只能有三项字段，不限制 health 探测缓存次数；仅约束核心空结果及实际 items 读取次数。使用 30 秒总期限、5 秒局部期限、测试取消传播、Fetch 安全本机端口有界重试，以及构造前登记的分层清理。没有 sleep、浏览器或安装。

兼容性只读复核明确这是旧能力 `hallmark.collected.search`，不是现代 `hallmark.collection.read`。主区用户未提交的 filterRelatedProducts 仅进入详情归一化、getLegacyDetail/resourceRead 和 collection-4 缓存映射，不在本次搜索链上；零行后置 enrichment 仍为零行。保留其新模块文件供现有静态 import 加载，没有编辑或导入其实现到本任务提交。

新测试登记 recorded。独立数据审计 PASS：304 测试文件、161 recorded 条目、158 infrastructure 条目（含 helper，分类数不作为测试文件总数相加）。主区审计仍 FAIL：用户新增未提交 purchase-cost.test.ts、related-products.test.ts 未分类；本轮新增文件已分类。不改变无关工作。合并前 41 个既有修改/新增文件 SHA-256 未变，scope 单独合并保留已有条目。

临时 Core 变异已恢复原字节，SHA-256 `39ee45c375ac199c4c2746bfa97e8d01378c0dc9d59c8e446c227747f7454fa2`，生产 diff 为空；#41 已提交的一行修复保留。本批仅提交测试、分类、报告。没有改写冻结记录、放宽校验或新增 skip。

没有重复全仓套件，不宣称全仓全绿。此前主区四项旧 Host 清单断言冲突、authoring SDK 未构建失败及两项打包前提跳过未在此批消除；commerce-image-loading 已在上一批因依赖就绪定向通过。证据在 `artifacts/issue-review-automation20-20261015T1640/`。全部源响应为冻结摘要及显式空源/503控制，只有回环 HTTP，无真实商家、平台或写入行为。
