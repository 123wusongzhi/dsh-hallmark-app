# 回归入口与验证边界

入口核对基线：`956324e1af54da6ac58318267c51400eb86ee474`；下方专项另包含本提交的 #50。以下命令从项目根目录运行；入口以 [package.json](../../package.json) 为准，不代表所有模块均有覆盖。

## 先准备，再选择入口

使用 Node ≥22.18，准备项目依赖和 [冻结测试资料](../../test/real-data/README.md)。本分支已包含默认的脱敏快照；`npm run prepare:test-data` 离线生成浏览器数据，不需要重新采集。Vite/源码组件用例还需要对应 `component-workspace/collected-products`、`component-workspace/helen-margin` 子项目的已安装依赖；主工作区依赖就绪不能代替这些子项目的依赖。

- `npm test`：先运行 `scripts/audit-real-test-data.mjs`，再以 `--test-concurrency=1` 执行 `test/**/*.test.ts`，包含嵌套目录。它不会自动执行独立的 `.mjs` 验收脚本，也不等同于真实浏览器或打包验证全部通过。
- `npm run test:apps`：同样先审计，但仅运行 `test/` 下 `app-contracts`、`app-hallmark`、`app-notes`、`apps-runtime`、`apps-components`、`dsh-compat`、`apps-host`、`apps-migration` 八个目录的直接 `*.test.ts`。它不包含 `authoring`、`source-preview`、`plugin-client`、`collection`、`service` 等目录，不能替代 `npm test`。
- `npm run test:real` 侧重冻结资料审计和来源回放；`npm run typecheck` 检查类型。数据接入审计不证明业务断言充分，类型检查也不能代替运行测试。

## 复跑已落地的跨模块接缝

下面集中复跑检查竞态、业务投影、缓存换代、等待/取消/部分/空结果、明确重试、源码选择、snapshot 刷新、Vite 资源和下载/构建恢复。只运行指定文件时不会触发 npm 的 pretest，因此先显式审计。此专项不是全套替代品。

```sh
node scripts/audit-real-test-data.mjs
node --test --test-concurrency=1 \
  test/apps-host/inspection-race.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/catalog-refresh-http.test.ts \
  test/apps-host/rate-limit-recovery.test.ts \
  test/apps-host/read-cancellation-recovery.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/apps-host/collected-empty-search.test.ts \
  test/apps-host/collection-column-fidelity.test.ts \
  test/apps-host/explicit-intent-retry.test.ts \
  test/source-preview/selection-refresh-chain.test.ts \
  test/source-preview/selection-retry-chain.test.ts \
  test/source-preview/selection-bulk-chain.test.ts \
  test/source-preview/vite-asset-paths.test.ts \
  test/plugin-client/snapshot-refresh-lifecycle.test.ts \
  test/authoring/result-reader-runtime.test.ts \
  test/authoring/failed-build-http-recovery.test.ts
npm run typecheck
```

续行写法适用于 POSIX shell；在 PowerShell 中可将 `node --test` 及文件参数合成一行。真实 Runtime/HTTP、React 隔离渲染或本地 Vite 构建通过，只证明各测试实际走过的链路，不证明线上模型、商家写入或浏览器视觉效果。

## 需要额外环境的检查

- **真实浏览器**：如 `test/authoring/generated-performance.test.ts`、`test/authoring/preview-runner.test.ts`，检查 `DSH_PREVIEW_BROWSER_PATH` 或各文件的默认路径；浏览器不存在会跳过。设置路径前先确认对应 Chrome/Edge 已安装。独立浏览器与性能入口见 [C1/C2 说明](../../test/acceptance/component-display/README.md)，不在普通 `.test.ts` 文件发现范围内的脚本须另跑。
- **Windows**：`test/apps-host/runtime-installer.test.ts`、`test/plugin-apps/business-skills-install.test.ts` 及 authoring 的 Windows wrapper 分支需要 Windows 和相应 PowerShell；Linux 上的 skip 不能证明这些分支通过。
- **打包产物**：按 [README 的 Apps V1 步骤](../../README.md#apps-v1-开发与验证) 执行 `npm run generate:apps-sdk`、`npm run build:apps` 后再验证。`test/performance/runtime-artifact-isolation.test.ts` 缺少候选归档会跳过；部分 authoring 测试还同时要求浏览器及 `bundles/apps/lib/` 产物。源码测试通过不能替代包内隔离验证。

保持仓库默认的文件级串行执行。套件含浏览器耗时门禁；独立性能验收应避开其他测试、构建和浏览器负载。并发 2 等设置仍属单独实验，不是默认推荐，也不能直接与串行结果比较性能。

## 记录结果时

记录 `git rev-parse HEAD`、`git status --short`、Node/系统/依赖及浏览器/归档条件、准确命令、退出码和完整日志；分别列出 pass、fail、skip、cancelled。skip 不计为 pass，失败不可用缩小文件范围或放宽断言掩盖。旧全套报告只属于其记录的 SHA；新增测试、生产修复或合并后的输入必须另行验证，不能套用历史总数。
