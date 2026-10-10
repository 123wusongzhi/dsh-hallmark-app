# candidate72 工具链复现

精确基线：`4e1cd98082a432e2ca89f606927da29eb26ddb67`（`v1.0.0-candidate.72`）。Node ≥22.18，依赖按仓库 README 安装。

这些脚本仅使用隔离合成数据、真实仓库 Host/Runtime 和 loopback HTTP。没有真实店铺或外部模型请求。数据输出到传入的本地目录；数字不是部署中的真实 LLM 成功率。

## 渐进工具契约

以下在修复工作树执行，`$BASELINE` 是精确72干净工作树绝对路径，`$OUT` 是新的证据目录。所有构建/测试/基准共用一个锁，避免不同任务污染计时。

```sh
mkdir -p "$OUT"
flock /tmp/hallmark-c72-cpu.lock bash -c '
  node test/acceptance/toolchain-c72/describe-sweep.mjs "$1" "$3/baseline-describe.json"
  node test/acceptance/toolchain-c72/describe-sweep.mjs "$2" "$3/patched-describe.json"
  node test/acceptance/toolchain-c72/authoring-trajectory.mjs "$1" "$3/baseline-authoring.json"
  node test/acceptance/toolchain-c72/authoring-trajectory.mjs "$2" "$3/patched-authoring.json"
  node test/acceptance/toolchain-c72/review-descriptor-pages.mjs "$2" "$3/descriptor-pages.json"
  node test/acceptance/toolchain-c72/scan-page-budget.mjs "$2" "$3/page-budget.json"
' bash "$BASELINE" "$PWD" "$OUT"
```

- sweep 逐项调用真实注册工具 execute→output.render，记录91项的完整输入可达性与UTF-8模型文本字节。
- authoring 轨迹真实创建隔离草稿并执行诊断。基线断在describe；修复可完成inspect。它不是完整build/preview发布验收。
- review 11组检查包含完整91份output无损重组、超大input、内容身份、Unicode、数组、escaped own-property与极限key。
- page-budget 扫描450个中文key长度，确保fallback跨页稳定。

## 原调用只读恢复

```sh
bash test/acceptance/toolchain-c72/recovery-comparison.sh "$PWD" "$BASELINE" "$OUT/recovery"
```

runner自身持有共享锁，不要再套同一flock。它新建独立基线worktree并复用本地node_modules，不fetch/install；保留worktree供检查。基线成功断言必须red，补丁用例必须green，生成comparison.json和完整合成HTTP/工具轨迹。不得复用已存在的输出目录。

## 集成门禁

```sh
flock /tmp/hallmark-c72-cpu.lock bash -c '
  export TZ=Asia/Shanghai
  export npm_config_cache="${npm_config_cache:-/tmp/hallmark-c72-npm-cache}" PNPM_HOME="${PNPM_HOME:-/tmp/hallmark-c72-pnpm-home}"
  mkdir -p "$npm_config_cache" "$PNPM_HOME"
  node scripts/generate-apps-sdk.mjs &&
  node scripts/build-apps-bundle.mjs &&
  node scripts/build-plugin.mjs &&
  node_modules/.bin/tsc --noEmit &&
  node --test --test-concurrency=1 --test-timeout=60000 test/**/*.test.ts &&
  node scripts/smoke-apps-bundle.mjs
'
```

运行日志需区分baseline、修复、当前集成commit；本地证据不是已公开附件。报告在 `docs/performance/candidate72-progressive-describe.zh-CN.md` 与 `docs/performance/candidate72-invocation-recovery.zh-CN.md`。

固定 A2 receipt fixture 必须来自当前 docs/requirements/A2/templates 的逐字节副本；root 及 component-workspace 两组件依赖齐全。不要以修改测试期望解决环境缺失。全仓若非零仍须单独执行 smoke，并与精确纯72失败集合比较，不能称全绿。
