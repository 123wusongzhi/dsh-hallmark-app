# 上游兼容整合与两项交互修复：双 Node 组合回归

日期：2026-10-16 UTC。

## 结论与精确范围

测试源码提交：`641ecb9f5a93332bb0b3d27b99a14dc22815f179`。这是有界相关组合回归，不是该提交的全仓默认 `npm test`。此前其他提交的全仓结果不能替代本轮全仓结论。

完整纳入下列五目录及三个运行时契约，共 **104 个测试文件**；并发固定为 1，没有名称筛选、删除失败、放宽断言或改变 skip。

- `test/apps-components/*.test.ts`
- `test/plugin-apps/*.test.ts`
- `test/operations/*.test.ts`
- `test/business-pricing/*.test.ts`
- `test/operations-adapter/*.test.ts`
- `test/apps-runtime/business-settings-http.test.ts`
- `test/apps-runtime/workbench-http.test.ts`
- `test/apps-runtime/workbench.test.ts`

| 实际运行时 | npm | tests | pass | fail | skip | cancelled | audit / typecheck |
|---|---|---:|---:|---:|---:|---:|---|
| Node 24.21.0 | 11.19.0 | 614 | 612 | 0 | 2 | 0 | PASS / PASS |
| Node 22.18.0 | 10.9.3 | 614 | 612 | 0 | 2 | 0 | PASS / PASS |

两版原生统计与逐案例解析结果一致，案例名称/结果的多重集也完全相同。audit 均为 324 个测试文件、172 个 required 文件、167 个 infrastructure 文件，真实来源计数为淘宝/天猫 20、国际站 20、拼多多 1；无审计失败。

保留的两个 skip（不计为通过）：
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

## 本轮交付与兼容选择

- 上游 `08a8ff5510bb0d97b0ae7944a459868d1221822f` 已通过双亲合并保留祖先关系。采用包装草稿保护、外部店铺意图校验、可见工作台 fallback、SDK 回执状态内联及补充测试；保留本地 #77 确认重验证、#87 素材关闭保护、健壮 SDK harness 与有效回归断言。逐文件取舍见[选择性整合说明](upstream-08a8ff5-selective-integration-20261016.md)，不代表上游所有内容原样替换。
- 新交互项一：联动读取取消后释放刷新 busy，同时隔离旧响应。四个搜索/分页成功与失败迟到场景均在组合内；见[独立验证说明](../workbench-linked-cancellation-20261016.md)。该候选作者使用的 Node24 为 **24.19**；本轮组合使用 **24.21**，不能混称。
- 新交互项二：上架失败/待决/等待重试提供正确下一步，确认前重验可执行性。见[独立候选及修正说明](../listing-recovery-actions-20261016.md)。单次最近有效 deadline 定时器、同 revision 决策变化确认失效、按需计算整单指纹，均是该尚未发布候选在评审中的修正，不额外重复计为新的 UX 项目。
- 保留 `retryQueued` 同事件去重与后续主动重试、`onChooseStore` 接口；test-scope 冲突只合并双方新增登记，没有丢弃旧 scope。

## 命令与完整性

两版按 Node24 audit → 组合测试 → typecheck → Node22 audit → 组合测试 → typecheck 串行完成。各阶段上限 600 秒，均自然退出 0，无超时。每版使用对应 Node 绝对路径启动，并在该子进程 PATH 最前放置相同运行时的 bin；PATH 解析到的 Node 与记录的 execPath 一致。

在匹配依赖与已准备真实来源 fixture 的精确 checkout 中，分别选定对应 `NODE` 和 `NPMCLI` 后运行：

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" "test/apps-runtime/business-settings-http.test.ts" "test/apps-runtime/workbench-http.test.ts" "test/apps-runtime/workbench.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

冻结期间 1419 个 tracked 文件在全部六阶段前后 SHA-256 字节清单均一致；最终与初始清单一致。排序 JSON 清单聚合 SHA-256：`b8d576819d8d51ef432bf08cbc684c2d23b4726d452e3da7f3becbe825befcd6`。本报告在完成哈希后追加，不混入测试源码 SHA。

未安装依赖、未运行额外独立全量 build、未运行 source-preview、未发起真实商家写入、未发布。选定测试内部需要的隔离构建 fixture 正常运行。商家接口由录制来源与本地 mock/内存适配器覆盖；模拟写入仅作用于测试边界。

## 边界与证据

这不是浏览器视觉、真实桌面 Host 或真实商家端到端验证。非默认 `.mjs` 与真实 browser 套件未运行。本轮不含已知 SQLite 计划断言，因此不对它们的通过或失败状态作新结论。

素材保存永久 pending 时，关闭/应用切换仍被锁住；迟到完成不抢页不等于未知结果恢复已解决。两个 skip 仍是未运行边界。

完整日志、运行时 execPath/npm 路径、命令、阶段时间、逐案例结果及全部哈希清单保留在本地证据集合中，不是公共下载链接。以下日志摘要可用于核对原始证据：

| 日志 | SHA-256 |
|---|---|
| `node22.18-audit.log` | `ae7809ddbee1e71a5bc76344ed6cd2f8e9bcc41542f13c84fcda86191ba32d99` |
| `node22.18-related.log` | `1b3a115bdee950ff409fb2c805200e1d79b2a613a443431f12e248a2afa673fa` |
| `node22.18-typecheck.log` | `93c1d121b889e39a646b1ea45c82bb3dd1746533941dfeaacedf2870ef577db7` |
| `node24.21-audit.log` | `ae7809ddbee1e71a5bc76344ed6cd2f8e9bcc41542f13c84fcda86191ba32d99` |
| `node24.21-related.log` | `7d1cf003ffeaf665d73dab9dcf9634077acd0a72ed3edb3c8f3c8c4df41c34f8` |
| `node24.21-typecheck.log` | `4a98379ed5c0cfa7fa3a1b6415cb24d94f3b4c777a5197afd2eabdf67ef16736` |
