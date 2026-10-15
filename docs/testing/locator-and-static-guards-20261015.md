# #53 定位续读与两项冗余源码断言整合

基线 `ba7d20c52c7c4189e7f0d01f80ffd122f1e2ce06`。本批只修改 `test/apps-host/result-locate.test.ts`、`test/plugin-client/client.test.ts` 并新增本报告；生产、冻结数据、scope、默认并发和 skip 条件均不变。没有合入 SDK 编译去重候选。

## #53：执行真正的定位 continuation

[#53 完整独立证据](https://github.com/123wusongzhi/dsh-hallmark-app/issues/53) 确认当前生产实现正确，但旧 Host HTTP 测试没有消费 literal 定位的非零 continuation。新增用例从真实 Provider 查询、Runtime 持久化和 model projection 得到 resultRef，经注册 Host 工具、实际 HTTP、Runtime reader 和 renderer 连续执行每个返回指令。

非业务文本显式使用 Unicode 字符。独立预期核对五页 returned `[0,1,1,1,0]`、精确扫描窗口、三个 offset `65536/65544/65552`、length `2` 和 readCursor `65280/65288/65296`；再按每个 readCursor 读取原文，确认匹配字符串。它区分首个无匹配但未结束窗口与终止空页，检查无遗漏/重复、一次 Provider 查询、同一 retained dataset 未改及无业务 operation。

- 采用独立审核补丁 SHA-256 `1100b810e0213bdad1fb8a0aeff76e712af3177cae7321624f9c6328da843d05`，候选测试 SHA-256 `d0044675e479fadb4606b45632706ed532e7b3ec0a2fb1df3e2b1a5bdc287c4f`。旧 test 主体逐字保留；仅增加所需 imports、fixture 和一个新 test。
- 独立审核输入 `891db9e88e4e05eec055f6f43b2b1bc3e51fb458`：旧 38 原版通过；仅在 `/locate` POST 组装时丢 cursor，旧 38 仍通过，新测在第二页精确报 `0 !== 65536`；恢复后 39 通过。初始化和 Provider 门闩两个失败控制均自然退出并完成清理。
- 此整合没有重跑生产 mutation 或失败注入；556 个受保护 packages/scripts/冻结文件在当前树逐个匹配独立审核的固定 Git blob，原实现没有被改变。

## #54：两项冗余源码字符串断言

[#54 完整独立证据](https://github.com/123wusongzhi/dsh-hallmark-app/issues/54)。采用 `fe57046e854d0bd239fefa61d3f594f696b2d8d8` 的唯一测试文件改动：删除 `renderer.includes('role="tablist"')` 和 `renderer.includes('下一页')` 两个正向源码字符串检查，并标注真实行为覆盖位置 `test/apps-components/product-image-loading.test.ts`。

在本树用 TypeScript AST 复核 client 测试：112 个 assert 调用变为 110 个，恰好去掉上述两项；剩余调用逐字、顺序一致。所有既有渲染行为测试保持不变。

入口边界：若只自定义运行 `test/plugin-client/*.test.ts`，删除后这个窄入口不再保护上述 tablist 与下一页标签两个细节。默认 `npm test`、`npm run test:apps` 和本次 client 组合都包含 `test/apps-components/product-image-loading.test.ts` 的真实渲染行为测试，因此这些完整或相关入口仍保留相应行为覆盖。

独立审核在同一 ba7d20c 基线证明：把 JSX role 改成等价表达式，或把相同按钮标签提取为导入常量，各自使旧套件产生唯一误报（23/24），既有行为测试仍 7/7，删除两项检查后各为 24/24。真实 role 错误仍触发两项行为失败；nextPage 改为 no-op，或把 aria-label 与可见标签同时改错，均仍触发准确行为失败。生产和临时模块随后恢复。

收益是消除已复现的等价重构误报和重复维护职责，不宣称加速。这里没有基准测试，也没有用缩小运行范围代替有效行为覆盖。

## 最终组合定向验证

Linux、Node `v24.19.0`，复用已安装依赖；本地依赖软链未暂存，没有安装依赖。测试输入树 `4de290e62abe767f9c4d8f2c679760d498a7abf8`；验证后只新增本报告。

- 新定位用例按名称筛选：1/1 pass；仓库外 cwd、绝对路径同样 1/1 pass。
- 定位相关 12 文件：39/39 pass，8.760 秒。
- 全部 plugin-client 直接测试文件加 product-image-loading：136/136 pass，9.781 秒。
- 上述各命令独立记录，不合计；全部 0 fail、0 skip、0 cancelled。
- `node scripts/audit-real-test-data.mjs`：PASS，308 testFiles、162 requiredFiles、161 infrastructureFiles。162 个 required 条目包含 147 个 `.test.ts` 与 15 个 runner/fixture 辅助文件；147 个 recorded 测试加 161 个 infrastructure 测试组成 308 个测试文件，两个测试集合无重叠，不能直接把 162 与 161 相加当作测试总数。
- `node node_modules/typescript/bin/tsc --noEmit`、`git diff --cached --check`：通过。

```sh
node --test --test-concurrency=1 \
  test/apps-host/result-fields.test.ts \
  test/apps-host/result-locate.test.ts \
  test/apps-host/result-request-snapshot.test.ts \
  test/apps-host/result-string-bytes.test.ts \
  test/apps-runtime/result-locate.test.ts \
  test/apps-runtime/result-reader-string-equivalence.test.ts \
  test/apps-runtime/result-reader.test.ts \
  test/authoring/result-reader-runtime.test.ts \
  test/authoring/result-reader.test.ts \
  test/apps-runtime/executable-result-hints.test.ts \
  test/apps-host/long-result-url.test.ts \
  test/apps-host/binding-integration.test.ts
node --test --test-concurrency=1 test/plugin-client/*.test.ts test/apps-components/product-image-loading.test.ts
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
```

1320 个测试输入文件前后哈希清单一致，汇总 SHA-256：`218fbb63f6114b3f2f16ed7db8239d2bb43172bc213ffa3519d3d7a387df5f02`。定位 39 项日志 SHA-256：`942bbe444b143a25f9a6623dbe7ed66048e994db85de8e2c6e5271e60667654a`；client 136 项日志：`e56a5497d7085aacaaa25c844e7f24e094173c39fceac58f231602ae1cfb70b9`。命令自然结束，没有触发时间/日志上限，外部 cwd 无残留。

未运行完整 `npm test`，不宣称全仓通过；既有 SQLite 失败及环境 skip 的历史结论不变，也不迁移为本输入的完整结果。没有真实浏览器、Windows、商家或外部模型验收。
