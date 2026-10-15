# #30 历史展开真实就绪等待整合

基线 `891db9e88e4e05eec055f6f43b2b1bc3e51fb458`。本次属于 [#30 独立复核补充](https://github.com/123wusongzhi/dsh-hallmark-app/issues/30#issuecomment-6198849969) 固定等待竞态的同根因补充，不新增问题计数。仅修改 `test/plugin-apps/native-workspace.test.ts` 的一个同步点并增加本报告；同时收录已独立审核的包隔离报告，不改生产、冻结资料、scope 或其他测试。

## 最小改动与原断言保留

重命名后展开新的 ComponentHistory 实例，会触发第二次历史读取。旧测试固定等 40ms 就检查版本 3，而真实 HTTP 响应完成不代表 React 已收到并渲染。现在复用原 `waitForUI`，在 3000ms 内等待实际历史列表出现“版本 3 · 明确重命名”，然后继续执行原请求数、历史内容、CAS 和工作区断言。其他固定等待没有批量修改，子进程 15000ms 界限不变。

- 应用补丁 SHA-256：`89d4f0a88224ae1d77f359b0fdfa600f0f3176ec87f537a88da963e8c6b94a97`。
- 最终测试 SHA-256：`44cb9305d9c2b2d04707c0e38ed21e73ab4d331c088f9bcca583d52e03d330ac`，与独立审核候选逐字一致。
- 在本基线上重新用 TypeScript AST 提取外层及内嵌 TSX：原 60 个 assert 调用逐字、顺序一致；库初始目录、工作区初始标签页和重命名后目录刷新共 3 个原就绪等待逐字保留。新增的仅是第二次历史展开等待。
- 原测试和相关生产源码与独立审核基线 `043ab318b64e4ec8affbd75d232c7e1d7d8598d1` 相同。独立审核已验证真实第二次 GET 响应门闩：旧测试在正确响应被暂扣时精确红，新测试释放后绿，永不释放时 3000ms 有界红，正常连续 5/5 绿。两个负控制均自然 exit 1，不计为通过；本整合未重复这些控制。
- 独立审核还在其输入运行整个 plugin-apps 目录：158 tests、156 pass、0 fail、2 原条件 skip。此历史结果不冒充下面的新输入结果，也不等于全仓验证。

## 本次定向验证

Linux、Node `v24.19.0`，复用既有依赖，不重新安装；本地依赖软链未纳入索引。测试输入树为 `6eaa2502691e5699e3d2cea1fe023334b306d4d9`，验证后只新增本报告及 [891db9e 包内 Runtime 隔离复验报告](packaged-runtime-isolation-891db9e-20261015.md)。后者的官方构建和包内 1/1 通过绑定 891db9e 及报告中的真实归档哈希，不声称在本次新增等待输入上重新构建；仅收录报告，没有收录归档或其他生成物。

- 目标单测：1/1 pass，1.753 秒。
- 仓库外 cwd、绝对测试路径：1/1 pass，1.754 秒。
- 以下 5 文件串行：6/6 pass，5.512 秒。全部运行均 0 fail、0 skip、0 cancelled。

```sh
node --test --test-concurrency=1 \
  test/plugin-apps/native-workspace.test.ts \
  test/plugin-apps/native-workspace-summary.test.ts \
  test/plugin-apps/native-save-lifecycle.test.ts \
  test/plugin-apps/workspace-tab-close.test.ts \
  test/plugin-apps/native-recovery.test.ts
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
```

数据审计 PASS：308 testFiles、162 requiredFiles、161 infrastructureFiles，分类集合可以重叠。TypeScript、`git diff --cached --check` 与补丁 reverse-apply 检查均通过。1318 个测试输入文件前后哈希清单完全一致，汇总 SHA-256 为 `ffe7abf57d7c3f7e210c3512485ef50da532df538a46b56f9fe6f87881e09111`；邻近回归日志 SHA-256 为 `01baf44c4ac5fb6685ed23deae8ff2c0fd2c314645ccf607016630103323cf96`。命令没有触发时间/日志上限，目标测试外层临时目录与仓库外 cwd 均无残留。

本输入没有运行完整 `npm test`，不宣称全仓通过；既有 SQLite 失败、浏览器及 Windows 环境边界不由这次定向结果消除。没有合入待审 locate 候选，没有真实桌面、商家或浏览器验收。
