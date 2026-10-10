# candidate72 统一分支验收

基线：`4e1cd98082a432e2ca89f606927da29eb26ddb67`，注解 tag `52d12f7ee593fe04944c63b5d01fb0e924a6eee5`。2026-10-10 17:31:48Z 再查 GitHub，映射未变；目标分支 `perf/candidate72-agent-toolchain-20261010` 当时不存在。

本分支组合：渐进 describe、原 invocationId 只读恢复及终态证据衔接、operationId 服务端会话授权与 await 后重核、#7 list override 兼容 guard、#12 lazy state、#13 请求内 listing index、#14 字节复制。新的 path-only discovery 实验不在本次生产代码中。

## 云端环境与方式

Node 24.19.0，相同精确冻结依赖，root 与两组件依赖齐全。TZ=Asia/Shanghai；可写 npm cache、PNPM_HOME；A2 receipt 固定 fixture 与当前源码 docs/requirements/A2/templates 逐字节相同。全部构建、测试、基准整段持 `/tmp/hallmark-c72-cpu.lock`。

依次生成 SDK、Apps bundle、plugin，tsc --noEmit；全仓 `node --test --test-concurrency=1 --test-timeout=60000 test/**/*.test.ts`；最后独立 smoke。全仓返回非零也继续单独 smoke。不把旧70门禁或产物替代72实测。

## 结果

纯72：1586 tests，1565 pass，4 fail，1 cancelled，16 skipped。生成/Apps build/plugin build/typecheck/独立 smoke 全通过。

最终集成：1666 tests，1645 pass，4 fail，1 cancelled，16 skipped；相对纯72新增80项全部通过，失败/取消5个名称及原因完全相同，无新增失败。首轮1666 tests，1644 pass，5 fail，1 cancelled，16 skipped；新增 native-guidance 旧测试直接读顶部大guidance，已迁移到真实 render 后按返回指针重组，全部原规则断言保持，定向5/5。新断言证明该长路径 fixture 原完整模型回复本来超过16384B，旧render确实 RESULT_SPILL_FAILED；短guidance旧路径未变。该失败与修正均保留，没有放宽测试期望或改生产规避。

纯72既有失败/取消：
- procurement-full-source:28，planMode application/delivery 不一致。
- runtime-backup:207、273、407，云端 Node24 rmdir symlink ENOTDIR。
- bridge:84，旧mock-clock 150秒提交测试在60000ms取消。

这些不是全绿；没有在本次工具优化范围内修改它们。

## 构建身份

新 Apps archive SHA256：8435cd68c3e46863238bdbc79bb91b634ca6719357e1b3f67ffd8aa531cfd4de。
隔离解包 smoke runtime SHA256：cf4213f0f4e8b6e399b39a037bcf64cf6bdc2a0c8523d1190f9656a3a8334344；5请求、0变更，未安装进DSH。

337项 build sourceInputs 与最终生产源码逐字节一致，0漂移。两侧 [build/package manifest](candidate72-toolchain-evidence/) 均已收录，来源当前各自新构建。测试/文档随后更新不改生产打包输入。

非作者 HTTP 安全边界2/2：原调用owner强绑定；大resultRef允许既有同连接授权继承、拒绝异连接/解绑；延迟Provider.inspect期间撤绑定后403且不泄露回执，原operation实际成功不被破坏。全部只合成数据；没有真实店铺、外部LLM、部署或桌面验收。

详见 [渐进契约](candidate72-progressive-describe.zh-CN.md)、[原调用恢复](candidate72-invocation-recovery.zh-CN.md)、[operation授权](candidate72-operation-owner.zh-CN.md)、[native agent正负观察](candidate72-native-agent-evaluation.zh-CN.md)、[72性能数据](candidate72-revalidation.md)。

原始TAP输出及初轮失败已压缩收录于 candidate72-toolchain-evidence，保留准确测试总数和失败集合。不是全仓全绿，不将197秒与196秒短观测作时延收益。

迁移测试的 render 参数类型修正后，最终 tsc exit0、guidance 5/5再次通过；该改动仅 TypeScript 类型注解。此前 typecheck 的 unknown/JsonValue 诊断同样保留，最终采用 typecheck-corrected 记录。
