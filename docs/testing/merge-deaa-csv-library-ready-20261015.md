# deaa 上游兼容、CSV 负例与组件库 ready 等待

整合父提交为 `2bb5e1dafe0f6265aafbaf8bd93ccab99e07892e` 和 `deaa494d111ad4afeece14c1540c7d5ca4839339`。本批只改测试、分类与报告。`packages/`、`component-workspace/`、`templates/` 对两个父提交均无差异；默认公开脱敏语料、生产脚本和依赖清单不变。两侧全部历史文档保留。

## 来源与改动

- 上游 [#49](https://github.com/123wusongzhi/dsh-hallmark-app/issues/49) 补充见 [原报告](../test-issue-review-49-20261016.md)：保留显式稳定 intent 的全部原检查，加入模型 JSON ≤16 KiB 和首调用早失败/响应门闩竞态保护，采用上游 30 秒总界限与 5 秒阶段界限。原精确一次 readonly GET 断言也保留；断言调用数由 35 增至 36。scope 合并去重，仅一个基础设施条目，保留无真实商家写入、无自动 mutation 重放的边界。
- CSV 候选 `e674659f5aef74bb707d066b389b9de34cc1c068`：为最后一列加合法引号并先验证有效对照，再只删除闭合引号，精确断言 `WEIGHT_REPORT_CSV_INVALID`。避免旧缺列错误掩盖 EOF 引号检查丢失；不改变真实业务字段或生产解析器。独立复核记录为相邻 44 tests、审计和 TypeScript 通过；独立变异证明旧 19 tests 漏检、新负例检出、恢复后通过。
- [#30 补充证据](https://github.com/123wusongzhi/dsh-hallmark-app/issues/30#issuecomment-6198343353)：AppsLibrary 初始目录等待实际卡片、打开按钮和 `aria-busy=false`；原 workspace ready 等待及 60 条断言原样保留。同时将测试构建入口与临时目录改为相对仓库位置。补丁 SHA-256：`6eab78b4ed0b123f96da75dcd0ed00db42d4c371e413f70e5746b9e4b4def8d8`。独立复核含旧延迟失败、新释放成功、永不 ready/空库有界失败及正常 5 次，共 9/9 对照符合预期。

## 此组合的定向验证

环境为 Linux、Node `v24.19.0`。复用根目录和两个组件工作区的既有依赖，无重新安装、无新增软链。去引用 pnpm 布局后先补齐其既有传递依赖；最初预检中的缺包失败保留在本地日志，不算最终测试结果。

- [回归入口](regression-entrypoints-and-boundaries.md) 列出的 16 文件，加 `test/plugin-apps/native-workspace.test.ts` 和 `test/ozon-business/order-weights.test.ts`，以 `node --test --test-concurrency=1` 顺序运行：41/41 通过，0 fail / skip / cancelled。
- `node scripts/audit-real-test-data.mjs`：PASS，307 测试文件、162 recorded、160 infrastructure；分类集合可重叠，不能相加当作文件总数。
- `npm_config_offline=true npm_config_update_notifier=false npm --offline run typecheck`：通过。
- `git diff --cached --check`：通过。没有降低失败断言、吞掉失败或改变 skip 条件。

上述定向结果不代表全套通过。后续完整串行 `npm --offline test` 使用此冻结输入，900 秒和 200 MiB 日志上限，单独记录准确 pass / fail / skip / cancelled、前后输入哈希及完整日志。预先已知 SQLite 范围失败不能用测试修补或生产变更掩盖。Linux 结果不替代 Windows、真实浏览器、线上模型或商家验收。
