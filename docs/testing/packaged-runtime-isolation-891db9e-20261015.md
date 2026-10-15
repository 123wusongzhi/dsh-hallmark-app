# candidate.76 包内 Runtime 隔离复验

## 结论与身份

2026-10-15 UTC，在 Linux x64 / Node `v24.19.0` 上，用源码提交 `891db9e88e4e05eec055f6f43b2b1bc3e51fb458` 的原版 `npm run build:apps` 离线生成真实候选包，再运行未修改的 `test/performance/runtime-artifact-isolation.test.ts`：**1 pass、0 fail、0 skip、0 cancelled**。移除本次构建用的 checkout `node_modules` 链接后再次得到相同结果。

本次恢复的是一项原先因缺归档而跳过的包验证；没有把其他浏览器、Windows 或宿主 skip 计为通过，没有重跑或改写历史全套总数。

- 包：`dsh-plugin-apps-bundle-1.0.0-candidate.76.tgz`，2,363,812 bytes
- archive SHA-256：`c83a4e530c6e26720026f1fd1e68977017584d981248d83edf0bae95c335da58`
- `lib/runtime.js` SHA-256：`258dcac14fda734faeff63764a3c1633ab2e290374f9c9f704d9f846650891d9`
- 原版构建脚本 SHA-256：`7c3494e0390778a9e56b5dd77f6613a4174780696f90167ff3caf61dbbb3c6ad`
- 使用既有 esbuild `0.25.0`、TypeScript `5.9.3`、Zod `4.3.6`，未安装新依赖
- 构建清单记录 149 个产物；构建后另逐项核对 366 个 `sourceInputs` 的 SHA-256，全部匹配
- 构建与测试未改变任何 Git tracked 文件；本报告是唯一新增源码树文件。归档、生成目录、清单、原始日志和含录制业务数据的验证 JSON 仅留作本地证据，不提交或打包上传

## 可重复命令

在该提交的独立工作树中，预先准备已有依赖及完整冻结语料。`DSH_REAL_CORPUS` 指向既有 `corpus.json`，其相邻哈希、响应与图像证据必须完整；不要重新访问商家服务采集。本次直接使用该提交已经入库的 SDK 文件，没有另行运行会改写源码的 SDK 生成器。

下面将本地证据目录及语料路径参数化；命令不下载或安装依赖。

```sh
# EVIDENCE 为已创建且可写的绝对本地目录；DSH_REAL_CORPUS 为已有语料绝对路径。
export npm_config_offline=true
export npm_config_update_notifier=false
export npm_config_cache="$EVIDENCE/npm-cache"
export DSH_REAL_CORPUS
mkdir -p "$npm_config_cache"
node --version
git rev-parse HEAD
npm run build:apps
node --test test/performance/runtime-artifact-isolation.test.ts
node scripts/performance/six-batch/packaging/validate-artifact.mjs . "$EVIDENCE/validation"
git diff --name-only
```

本次第一次构建在 `npm pack` 阶段因默认 npm 缓存 `/home/agent/.npm` 不可写而失败；显式指定工作区内的 `npm_config_cache` 后，原版脚本成功。没有改变脚本、追加 notifier CLI 参数、绕过 skip、制作简化测试包或调用 `--diagnostic-zod`。原版脚本执行 `npm pack --ignore-scripts`，未安装候选到 DSH。

## 实际隔离与断言

[正式 runner](../../scripts/performance/six-batch/packaging/README.md) 从真实 tgz 解包，校验归档和 Runtime 哈希，拒绝危险路径及归档链接，并检查祖先目录没有 `node_modules`。子进程使用新临时 cwd/HOME、清理后的环境及 strict module resolver；`NODE_PATH`、`NODE_OPTIONS` 均未传入。

本次 `acceptance=true`、`diagnosticOnly=false`、`dependencyProvisioning=null`。resolver 记录 **79 个模块路径**，恰为：

- `candidate/package/lib/runtime.js`：1 个
- `candidate/package/lib/vendor/zod/` 内：76 个
- 复制的 `harness/fixture.mjs`、`harness/parity-probe.mjs`：2 个

未载入 checkout 模块或任何 `node_modules`。两个 fetch 计数均为 0；业务输入来自既有录制数据，业务 gateway 使用本地受控响应。这里的网络计数针对 fetch，不应表述为所有 Node 网络 API 的通用沙箱证明。

实际包内 `composeAppsRuntime` 被执行，覆盖包括：

- 15 类非法定价配置均失败且代码为 `INVALID_PRICING_CONFIG`；版本冲突、字符串规范化及选定价格/重量/有效期边界有明确值断言
- 10 类非法包装输入均失败且代码为 `INVALID_PACKAGING`；冲突后批次回滚、重量累加与组成数量有断言
- 实际 profit provider 的售价、定价方案、包重断言；Notes 6 次操作的状态、输入错误及版本冲突代码断言

输出还记录 11 个 quote 场景、identity/catalog、SQLite schema/tables 等数据；本次没有调用 `compare-parity.mjs`，因此不能把“记录了完整输出”说成每个字段都与源码版或另一候选逐项比较。

## 失败反例

对同一正式归档各调用一次 `prepareRun`，先完成原始归档/Runtime 完整性检查，再只改变一次性解包副本；始终使用原版 preload 与 parity probe。原 tgz 和生产源码均未改变，反例结束均清理临时目录。

1. 删除解包副本的 `candidate/package/lib/vendor/zod/index.js`：子进程 exit 1，明确产生 `ERR_MODULE_NOT_FOUND`，报错路径指向缺失的 vendored 入口。
2. 将同一解包入口改成指向 checkout 中既有 Zod 入口的符号链接：子进程 exit 1，明确产生 `module escaped isolated run:`，指向 checkout Zod 的真实路径。

两项反例前后，原 tgz 的 SHA-256 均保持上述值。它们验证了真实包在缺少 vendored 依赖时无法假绿，以及 resolver 会拒绝通过符号链接逃回 checkout；反例不是新的可发布候选包。

## 边界

此测试的目标是指定候选包的独立 Runtime 验证，原有测试有效，本轮无需新增 issue 或修改断言。测试本身不逐项比对 `build-manifest.sourceInputs` 与当前 checkout；本次“来自上述源码提交”的结论由刚完成的官方构建、独立输入哈希核对和干净 tracked 状态共同支持。指定旧包的独立验收与当前源码新鲜度是不同结论。

本结果不代表宿主安装、Client/浏览器渲染、Windows wrapper、实际商家调用、整个包所有入口或全部延迟加载分支通过，也不是性能基准。其余环境条件仍按[回归入口与验证边界](regression-entrypoints-and-boundaries.md)单独记录。
