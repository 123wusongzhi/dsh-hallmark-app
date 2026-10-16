# 三项草稿与回执恢复：双 Node 组合验证

日期：2026-10-16 UTC。精确测试源码 SHA：`796665ca7ae4f4ec4ad504aaead748f25afa7667`。

## 结果

这是相关组合回归，不是本提交的默认全仓验证。旧 `9384e50` 的全仓结果保留为历史证据，不能据此宣称这三项新增后的提交已经跑过全仓。

完整运行五个目录及三个运行时契约，共 **106 个文件**；并发 1，没有名称筛选、修改 skip 或放宽断言。新增 Agent 与 discard 两个文件由原目录通配自然纳入。

| 实际 Node | npm | tests | pass | fail | skip | cancelled | audit / typecheck |
|---|---|---:|---:|---:|---:|---:|---|
| 24.21.0 | 11.19.0 | 635 | 633 | 0 | 2 | 0 | PASS / PASS |
| 22.18.0 | 10.9.3 | 635 | 633 | 0 | 2 | 0 | PASS / PASS |

两版 audit 均 PASS：326 个测试文件、173 required、168 infrastructure；来源数 20/20/1，无审计失败。原生测试统计与逐案例解析一致；两版案例名称/结果多重集一致。

相对上一轮 `641ecb9` 的相同目录组合：
- Node 24.21：新增案例 21，移除 0；新增失败 0；新增/移除 skip 为 0/0。
- Node 22.18：新增案例 21，移除 0；新增失败 0；新增/移除 skip 为 0/0。

保留的两个 skip 不计为通过：
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

## 三项交付范围

以下为本批三项工作，不表示 GitHub issue 编号；本报告不猜测尚未分配的 issue ID。

1. **素材页 Agent 需求草稿保护**：折叠和重复打开不覆盖手写内容；空正文仍可编辑，空白需求不允许交接；手改且未成功放入原聊天的正文进入既有局部关闭保护，配置保存不代替需求保存。交接只确认对应快照，明确尚未发送；owner 变化及迟到回执隔离。详见[独立候选说明](../material-agent-request-draft-20261016.md)。不扩展为跨 app/session/实例持久草稿。
2. **包装规则 save/remove 回执恢复**：权威成功回执与随后读取失败分开处理；保存或重置已成功时不把读取失败伪装成写入失败，不重发已成功操作。保留后续编辑及其 dirty 状态，正确跟进服务端 revision，正常 compare-and-swap 契约继续成立。保存和移除两条分支均在实际包装设置回归中覆盖。
3. **经营草稿版本冲突后的显式放弃恢复**：局部确认后仅放弃当前 owner 的已应用编辑，并重新读取原批次最新版本；失败可重试，原批次缺失不偷偷选择其他批次。尚未加入批次的独立表单保留；隐藏、owner/new edit/write-state 变化使旧确认失效。pending/unknown 写入的既有锁不被绕过。详见[独立候选说明](../business-discard-recovery-review-20261016.md)。

包装 reset 后的追加修正属于同一项交付，不重复计算为新的 UX 项目。

## 精确命令与冻结

测试范围：
- `test/apps-components/*.test.ts`
- `test/plugin-apps/*.test.ts`
- `test/operations/*.test.ts`
- `test/business-pricing/*.test.ts`
- `test/operations-adapter/*.test.ts`
- `test/apps-runtime/business-settings-http.test.ts`
- `test/apps-runtime/workbench-http.test.ts`
- `test/apps-runtime/workbench.test.ts`

两版串行执行 audit → 相关测试 → typecheck。每阶段上限 600 秒，均自然退出 0、无超时。每版绝对 Node execPath 与对应 PATH 解析结果一致，npm CLI 来自同一运行时目录。没有依赖安装或新建完整 worktree。

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" "test/apps-runtime/business-settings-http.test.ts" "test/apps-runtime/workbench-http.test.ts" "test/apps-runtime/workbench.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

对子进程 PATH 前置对应 Node bin。全部六阶段前后及整轮 1425 个 tracked 文件字节哈希一致，聚合 SHA-256：`cb6aed2e95d70890c3327d166d667a44fdd31f6e9e6b9eef557a4d755a0d9360`。最终源码核查结束后才追加本报告，报告提交不混入 tested SHA。

## 边界与证据

并行审查另发现 #76 结构化上品编辑的 m 单位选项与适配器仅支持 mm/cm 不匹配。进一步对照确认，既有包装合同原本优先采用维护规则/来源，合法 mm/cm 和 g/kg 手填值也可能被规则值替换；草稿只补缺项。当前缺陷包括编辑器未清楚展示该优先级、允许编辑会被规则覆盖的字段及误导文案，不能归因于 m 单位一种情况。本次冻结源码未含此补充修复，组合通过不代表它已解决；后续需保留业务优先级，单独验证 UI 来源投影与缺项输入校验。

这不是默认全仓、source-preview、真实浏览器、Windows/macOS、已安装桌面 Host 或真实商家验收。没有真实商家写入、外部 Agent 调用或发布。真实来源事实由已准备 fixture 提供，transport/write 故障在本地隔离模拟。默认相关测试内部的必要构建产物正常保留；未额外运行独立全量构建。

素材保存永久 pending 的关闭/应用切换锁仍是边界；迟到回执保护不能被解释为未知结果恢复已经解决。Agent 已开始的 native handoff 不可由此取消，晚回执仅保证不会覆盖新 owner。两个 skip 不计为通过。

原始日志、实际运行时/命令/时间、逐案例结果、对上一组合的多重集差集、逐阶段源码清单均保留在本地独立证据集合，不是公共下载链接。

| 日志 | SHA-256 |
|---|---|
| `node22.18-audit.log` | `6b9048b46f303086ae791504999e44b0ec339dd2bb4c3d36c6d2825b954e7bbc` |
| `node22.18-related.log` | `e2875e205d43a44cfe375bb5ecfc82b0f4b395759389eb5e7248c39c53307404` |
| `node22.18-typecheck.log` | `93c1d121b889e39a646b1ea45c82bb3dd1746533941dfeaacedf2870ef577db7` |
| `node24.21-audit.log` | `6b9048b46f303086ae791504999e44b0ec339dd2bb4c3d36c6d2825b954e7bbc` |
| `node24.21-related.log` | `5fe453f61d00952fbd6a99e1d2996f8d45cef6fd51413c25d55aa84b1aa92922` |
| `node24.21-typecheck.log` | `4a98379ed5c0cfa7fa3a1b6415cb24d94f3b4c777a5197afd2eabdf67ef16736` |
