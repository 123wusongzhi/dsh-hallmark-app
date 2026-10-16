# 组合数据 warning oracle 独立复核

结论：接受这一 test-only 补强。公开基线实现能保留上游警告；问题是旧测试的实际值互比不能检出丢失回归。本轮没有发现或声称基线存在生产 warning 丢失故障。

- 基线：`543e965143a5da2dc8a17ca31d6c61cdd6ef5dee`；从该 Git 对象分别新建四态与 related 两个隔离树，没有使用作者候选工作树字节。
- Node：官方 22.18.0 与当前 24.19.0。
- 两个运行时均为同一 10 文件、同一 152 项：旧测试/原实现 152 通过；旧测试/清空 sourceWarnings mutation 152 通过；新 oracle/mutation 151 通过、1 精确断言失败；新 oracle/恢复实现 152 通过。8 阶段用例名集合逐项一致，均 0 skip/cancel/todo。
- 唯一红项：`identical fresh cache hit skips archive write; divergent/saved-only cache repairs archive and survives failure/restart`；`ERR_ASSERTION`、`deepStrictEqual`，actual `[]`，expected `['retained warning']`，不是加载、超时或 fixture 错误。
- 35 文件扩展 related：两运行时各 429/429，0 skip/cancel/todo。两个运行时的四态树与 related 树分别通过 audit 与 tsc，共 8 次检查退出 0。
- 默认 `readOzonComposition` → `readOzonData` → 快照 → 实际 `composedData` 消费 helper 实跑：原实现首次/缓存/消费者都有 2 条实重适用范围说明；mutation 三处均 `[]`。两种状态都是 status ok、total 1、cursor null、cache.stale false，accepted item.actualWeight 为 310；第二次读取未增加端口调用。
- 契约依据：[composed-table README](https://github.com/123wusongzhi/dsh-hallmark-app/blob/543e965143a5da2dc8a17ca31d6c61cdd6ef5dee/docs/component-authoring/examples/composed-table/README.md#L5) 明写上游警告保留在“数据说明”；[默认 weights 读取器](https://github.com/123wusongzhi/dsh-hallmark-app/blob/543e965143a5da2dc8a17ca31d6c61cdd6ef5dee/packages/app-hallmark/src/ozon-data.ts#L216-L221) 发出单件范围与 skipped 数量警告；[实际消费代码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/543e965143a5da2dc8a17ca31d6c61cdd6ef5dee/docs/component-authoring/examples/composed-table/data.ts#L6-L10) 保留字符串 warning，[渲染处](https://github.com/123wusongzhi/dsh-hallmark-app/blob/543e965143a5da2dc8a17ca31d6c61cdd6ef5dee/docs/component-authoring/examples/composed-table/main.tsx#L51) 将其显示在数据说明。它们不是可静默丢弃的内部元数据。
- 补丁只新增一个独立 literal 预期，保留旧 cache 等值、0 put、归档修复、失败与重启断言；不增加或删掉测试项，不改生产文件。
- 两隔离树各 1359 tracked 文件 finally 恢复；再从 Git archive 重算全部 SHA-256，全部相等。生产原 hash `706ded38c2cb4bea569e4ab9ab979b9c8b67ec7d98a841c12ada5d68937cdbee`。完整逐文件证据见 `restoration-hashes.json`。

范围：仅离线源码和消费者 helper 验证；商品用公开脱敏快照派生输入，weights 接口为明确构造的边界条件。没有访问真实平台、业务写、浏览器/UI 验收、全仓测试或部署。作者早期 setup/probe 调试未纳入生产缺陷依据；本独立两套执行无 setup 重试或测试重跑筛选。

交付文件为本地归档索引，未随报告发布；完整自足复现见[问题 #72](https://github.com/123wusongzhi/dsh-hallmark-app/issues/72)。包括 `candidate.patch`、`mutation.patch`、自足 `reproduce.py`（含 probe）、`reproduce_related.py`、`issue.zh.md`；逐阶段日志与摘要在 `four-states/`、`related/`。未 push、未发 issue。
