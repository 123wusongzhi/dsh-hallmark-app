# chunk progress 异步拒绝断言独立复核

复核时间：2026-10-15 UTC。冻结 `9140337fd660ce3be769e80d775021494cc16c3d`，tree `c2b1fed1eff4fb0bcf1563520e41c8898a509343`。候选仅测试提交 `0a3a9329ffbac55686c9561dcd21ec1d4bfde12f`。

## 结论

通过。一处真实测试假绿：旧 `chunk-progress-deadline.test.ts` 在 async transport callback 内断言父侧 `chunkProgressKey === ''`，外层无错误匹配器的 `assert.rejects` 把该 AssertionError 当作预期拒绝。自然单点变异仅删除父侧 `||chunk.id!==request.id`；SDK 的独立身份校验仍拒绝，不能据此声称 SDK 接受错误块或泄漏数据。

修补只改变既有 malformed case：callback 保存实际 reply 后返回；SDK 拒绝匹配明确协议错误标记，base64 例匹配 atob 标准错误名；父侧空 key 断言移到拒绝边界之外，增加 reply 非空保护。原 6 个 case、五种 malformed 输入及其他 case 字节保留，无新测试文件、skip 或生产修复。

## 独立实跑

新隔离 checkout 上逐次运行作者最终自足脚本，Node 22.18.0 与 24.19.0 结果一致：

- 旧测试 / 原生产：6/6；旧测试 / 单点变异：6/6 假绿。
- 透明 observer 直接记录旧第 37 行 callback 的 `AssertionError / ERR_ASSERTION`，仍 6/6；无 observer 的对照也假绿。
- 新测试 / 同一生产变异：5 pass / 1 fail，准确失败于 `id: malformed replies cannot extend the parent deadline`，实际 `chunk:wrong:…:0`，期望空字符串。
- 新测试 / 恢复生产：6/6；五个相关文件 26/26，零 skip/cancel；数据审计 PASS（308/162/161，来源20/20/1）；TypeScript noEmit exit0。

另外独立运行真实 React `useComponentBridge` → `ComponentHost` → SDK reader。只用假的 window transport 和确定性时钟，不替换上述生产实现或伪造异常：29,000ms 返回 4 个 wrong-id 块，SDK 始终 `INVALID_DATA_TRANSFER`、零 progress；原版父 idle deadline 在30,000ms触发，变异版在59,000ms触发，恢复后回到30,000ms。两种 Node 各完成 baseline/mutant/restored。此 probe 证明 idle 被误续期；180秒 hardcap 没有改动，保留的绝对期限回归通过，不声称无限阻塞。

## Oracle 与范围

前四种错误匹配源码明确的 `INVALID_DATA_TRANSFER` 标记，没有绑定 Error 类、stack 或引擎文案。base64 匹配 [HTML atob 标准](https://html.spec.whatwg.org/multipage/webappapis.html#dom-atob)的 `InvalidCharacterError` 名称，不绑定 DOMException 实例身份或消息。补丁没有改变输入可接受集合、并发方式或分块限制；若未来明确更改错误契约，测试应随契约调整。

恢复清单逐一核对 429 个受版本控制的生产/脚本/根配置文件 Git blob 与 SHA-256，全部等于冻结基线。生产源 SHA-256 为 `6b9908628ff27ff7ba90782ebed13de55048ed059f6c5c9f2319d1effb38349e`；旧绿与新红的变异源均为 `9c94779487bdb3c82abce2e74b245542297957e92ad70a5f1276aae121a1fe27`。

自足 issue 草稿包含完整补丁、已实跑复现脚本与 frame probe；原始日志/命令/退出码/哈希保留在独立证据目录。没有创建 issue、push 或运行全仓/浏览器/性能基准；其他已知全仓失败未在此消除。
