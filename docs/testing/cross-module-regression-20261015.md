# 跨模块回归测试改进记录

基线：`0c2de5cf57667b49ae6a6b20e46ed6350f6da168`。本提交是已验证第一批 10 项测试改进，对应 Issues #15–#24。只修改测试、审计及说明，不修改生产功能或冻结数据。

## 完整回归

在相同最新基线、Node v24.19.0、npm 11.9.0 和锁定依赖下：

- 原版：2228 tests，2158 pass / 32 fail / 38 skip，256.068 秒。
- 第一批整合：2242 tests，2178 pass / 26 fail / 38 skip，268.051 秒。
- 全仓 TypeScript 检查通过。完整测试退出码仍为 1，不能称全绿。
- 修复了 8 个既有失败；新增 14 个测试。23 个脱敏数据输入契约失败保留；原 scheduler-scope 与本次新增发现的 C1 SQLite 工作量/计划检查失败保留。
- 额外 native-workspace 初次等待失败：原版与整合版交错各三次均 2 fail / 1 pass，测试和272个生产文件哈希相同。此既有竞态另见 #30，不含在本提交。
- 38 skip 均保留：20 个 Windows 专用、17 个浏览器条件、1 个未构建归档。浏览器未完成，不能计入成功。

每项问题、故意改坏代码的对照、完整单项补丁及边界见 #15–#24。最新语料 productId 脱敏为非数字标识使价格场景 Number(productId) 得到 NaN；未放宽生产校验、未修改数据来让结果变绿。

## 安装与复验

根目录运行 `pnpm install --frozen-lockfile --ignore-scripts`；两个 `component-workspace/collected-products` 与 `component-workspace/helen-margin` 分别运行 `npm ci --ignore-scripts --no-audit --no-fund`。安装阶段可能访问包仓库。

测试阶段：

```sh
export npm_config_offline=true
export npm_config_update_notifier=false
export npm_config_audit=false
export npm_config_fund=false
export DSH_REAL_CORPUS="$PWD/artifacts/real-source-tests-20261013/corpus.json"
npm --offline test
# 上述非零退出是真实失败，单独保留，不改成成功。
node node_modules/typescript/bin/tsc --noEmit
```

npm 11.9.0 的 CLI `--update-notifier=false` 会导出空环境值，子 npm 又恢复默认更新检查；纯配置控制已复现。仅通过非空环境字符串关闭 notifier，不重复传该 CLI false。配置不是系统级网络隔离或抓包证明。两次被出站检测阻止的中断记录保留，未混入完整统计。

## 后续原则

重点是跨模块行为：实际执行上游给出的调用参数、读取提示与续页，而非只检查源码文字；让有代表性的变异触发失败，恢复代码后通过。保留独立预期、失败与未执行结果，不以删断言或扩大跳过换取通过。所有验证使用隔离测试环境，不调用真实商家写接口。
