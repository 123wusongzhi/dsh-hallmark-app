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

## 第二次发布：跨模块回归补强（Issues #25–#30）

新增生成 SDK → AppsClient 参数/取消信号契约、prepare复用提示 → provider 的单SKU范围、完整payload草稿的跨页模式、prepare描述预览 → resource provider 的全文续读、临时类目失败 → 普通重试恢复/成功缓存，以及工作区初次加载的状态等待。各项均做过隔离故障变异、旧测试漏检或竞态复现、新测试检出与恢复验证；生产实现原本正确的场景不标为生产bug。

16项累计整合后，17个受影响测试文件113/113通过，数据审计与全仓typecheck通过。完整回归2247 tests：2184 pass / 25 fail / 38 skip，270.048秒，退出码1，23个输入文件哈希前后不变。原first10的native-workspace等待竞态本轮修复且通过；不以本次通过覆盖此前完整日志。原23个脱敏ID输入契约失败及2个SQLite检查保留。完整日志SHA-256：`67982fcdd368a4e0344b2db2148472d56acbd7cad6a3b2211fcef5fccc301e9a`（日志仅本地留存，不在此文附件）。38个跳过仍不代表通过。没有合并主分支、没有改生产功能或冻结数据。

## 与上游测试改进同步：ad7595f

最新开发分支已在 e0a40cde 吸收 #15–#28，并在 ad7595f 吸收 #29–#32。本合并以 ad7595f 的内容为准，保留其项目内调整及两个上游审阅报告，不把旧实现覆盖回来。保留本文作为历史验证记录。

明确保留：#17 的原循环内反向依赖检查（不再带旧通用分类框架及其单测）；#20 的额外图片浏览器路径修复；#21 对未 git add、但未被忽略的源码输入兼容；#22 上海时区；#23 受控HTTP回应；#29 实际三页类目约束；#31 前提断言与期限调整。移除旧分类框架三文件是遵循上游设计，不是隐藏失败。

本地对 e0a40cde 原版完整回归为2235 tests，2172 pass /25 fail /38 skip，274.082秒。e0加未吸收四项时完整回归2237 tests，2174 pass /25 fail /38 skip，270.059秒（日志SHA3731716f96bcd7bf6c60646c3ac8471dd17bfa5400e92b8b6747f74c02306eee）。这两份完整结果属于各自精确输入，不能当作ad全仓结果。

对最新ad7595f独立验证：四项4/4，29个邻近文件317/317、0 skip，数据审计与全仓typecheck通过；未再重复运行ad全suite。已对比确认生产packages、脚本、包清单/锁文件、组件源码及冻结corpus相对已完整测过的e0+4保持不变；差异限于类别/版本两个测试、scope和文档。独立复核无意外回退。下一批新增边界检查仍逐项做正反对照后持续追加。
