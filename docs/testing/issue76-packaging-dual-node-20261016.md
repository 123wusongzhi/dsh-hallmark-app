# Issue 76 包装编辑补充：双 Node 整合回归

日期：2026-10-16 UTC。精确测试源码 SHA：`2b257a3ac14688a9e93940d811f2c051450f532f`。

## 结果与范围

本次验证 issue 76 的包装编辑补充，不计为新 UX 问题。测试在此前三项草稿/回执修复之上运行，保留经营草稿显式放弃、包装 save/remove 回执恢复、素材 Agent 需求保护。

这是相关组合回归，不是默认全仓测试。不能沿用 `9384e50` 的全仓结果声称本提交已经跑过全仓。

完整运行 **112 个文件**，并发 1，无名称过滤、改 skip 或放宽断言：

| 实际 Node | npm | tests | pass | fail | skip | cancelled | audit / typecheck |
|---|---|---:|---:|---:|---:|---:|---|
| 24.21.0 | 11.19.0 | 677 | 675 | 0 | 2 | 0 | PASS / PASS |
| 22.18.0 | 10.9.3 | 677 | 675 | 0 | 2 | 0 | PASS / PASS |

两版 audit 均 PASS：327 个测试文件、174 required、168 infrastructure；来源数 20/20/1。原生总数与逐案例解析一致；两版案例名称/结果多重集一致。

两个保留 skip 不计为通过：
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

## 保留的规则与本次验证内容

原问题不只是单位选项：已有维护/来源包装规则时，mm/cm 与 g/kg 的手填数值也不会覆盖规则值。本补充保持原有规则优先契约，不把改变单位当成覆盖来源规则的办法。

- 公共投影仅暴露重量、尺寸两组的 `rules` / `draft` / `missing` 状态；不泄露来源证据。老 provider 未提供元数据时保持未知，不假装存在锁定规则。
- 有规则的组独立锁定，展示采用值与来源；缺少规则的组保持可编辑，fallback 仅填补该组。重量与尺寸互不阻塞，半缺失及完整缺失场景均有验证。
- 可新增的单位为 g/kg、mm/cm，移除不受支持的 m 新选项；历史非法值仍可见、可纠正。无效 fallback 保留原输入并给字段问题；无关有效组仍可规范化。既有非法 payload 不得覆盖或阻断权威来源规则。
- “按当前包装规则更新草稿”是显式 revise，保存草稿并重新解析定价等字段，不提交商家操作。旧值、采用值与来源可见；规则未变时保持既有去重 revision 行为。
- dirty/raw、pending/busy、确认、恢复及不可编辑行下保留入口保护。已合入的显式 discard 和包装回执恢复没有被覆盖。
- 实际适配器、provider、业务引擎、公共投影、React 编辑器与包装仓库共同覆盖来源完整/缺失/半缺失、单位等价、跨组 fallback、无效输入及显式维护规则更新；测试断言平台 dispatch 与模型 review 为零。

独立候选细节与初轮证据见[包装编辑补充说明](../issue76-packaging-editor-supplement-20261016.md)。先前[三项组合报告](draft-receipt-combination-dual-node-20261016.md)对未包含本修复的声明仍是其 tested SHA 下的历史事实；本报告记录后续精确补充。

## 测试发现与复现

五目录、三个运行时契约、两个 Host 公共投影/部分状态契约，加实际查到的三个包装相关测试。plugin-apps 的包装设置测试已经被通配包含，没有重复执行：
- `test/apps-components/*.test.ts`
- `test/plugin-apps/*.test.ts`
- `test/operations/*.test.ts`
- `test/business-pricing/*.test.ts`
- `test/operations-adapter/*.test.ts`
- `test/apps-runtime/business-settings-http.test.ts`
- `test/apps-runtime/workbench-http.test.ts`
- `test/apps-runtime/workbench.test.ts`
- `test/apps-host/business-value-projection.test.ts`
- `test/apps-host/business-partial-status.test.ts`
- `test/business-packaging/packaging.test.ts`
- `test/service/packaging-settings.test.ts`
- `test/app-hallmark/packaging-evidence.test.ts`

两版按 audit → 相关测试 → typecheck 串行完成。各阶段上限 600 秒，均自然退出 0，无超时。每版 Node 绝对 execPath 与 PATH 解析结果一致，npm CLI 来自相同运行时目录；精确路径、时间和命令保留在 metadata。

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" "test/apps-runtime/business-settings-http.test.ts" "test/apps-runtime/workbench-http.test.ts" "test/apps-runtime/workbench.test.ts" "test/apps-host/business-value-projection.test.ts" "test/apps-host/business-partial-status.test.ts" "test/business-packaging/packaging.test.ts" "test/service/packaging-settings.test.ts" "test/app-hallmark/packaging-evidence.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

仅对子进程 PATH 前置匹配 Node bin。1429 个 tracked 文件在全部六阶段前后及整轮字节哈希一致；排序清单聚合 SHA-256：`8f7b2af6a5618fad9096c3386c28bda893375151372c0bdaac8b53e43850831c`。测试与最终哈希完成前没有改动 tracked 源码；本报告及候选文档的历史措辞在之后以 doc-only 提交追加。

## 边界与证据

开始可用磁盘约 872MB，使用现有 checkout/依赖；未删除旧证据、未安装依赖、未复制完整树、未额外运行全量构建。测试内部需要的隔离构建正常运行。后续相关测试启动前设有 300MiB 空间保护。

未运行默认全仓/source-preview、真实浏览器、已安装桌面 Host、Windows/macOS 或真实商家端到端场景；没有真实商家写入、模型 review 或发布。两个 skip 不计通过。素材永久 pending 保存的关闭/应用切换锁仍是边界，不能由本次包装测试推断未知结果恢复已解决。

完整日志、逐案例结果、运行时与命令、逐阶段源码哈希和证据摘要保留为本地独立验证资料，不是公共下载链接。

| 原始日志 | SHA-256 |
|---|---|
| `node22.18-audit.log` | `92c808b4adcfaebaf8e1412ef649b309c6fd505d65035fceb8ceb346570c44bc` |
| `node22.18-related.log` | `41fade26e9a94a3a84d263797f490800e6ffe1cee7d2d9fd49bb8ef8e8791620` |
| `node22.18-typecheck.log` | `93c1d121b889e39a646b1ea45c82bb3dd1746533941dfeaacedf2870ef577db7` |
| `node24.21-audit.log` | `92c808b4adcfaebaf8e1412ef649b309c6fd505d65035fceb8ceb346570c44bc` |
| `node24.21-related.log` | `07050e49d8ee29e488d12af678cf3cc2c69e5ee274708b12c6220f341d110eaa` |
| `node24.21-typecheck.log` | `4a98379ed5c0cfa7fa3a1b6415cb24d94f3b4c777a5197afd2eabdf67ef16736` |
