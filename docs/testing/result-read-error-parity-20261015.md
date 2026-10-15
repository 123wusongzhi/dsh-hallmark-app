# 长结果读取的错误透传：跨模块覆盖候选

基线 `2bb5e1dafe0f6265aafbaf8bd93ccab99e07892e`，Linux 6.18.44、Node v24.19.0，复用现有锁定依赖。此候选仅增加测试和分类说明；没有修改生产功能或冻结数据，没有发布、推送或并入其他工作树。

## 结论和去重

当前实现正确。发现的是一处旧测试漏检：合法长 Unicode JSON Pointer 经 `HttpAppsHostTransport.readModelResult` 自动改走 POST 后，真实 Runtime 400 参数拒绝必须保持其错误语义，不能被兼容旧 Runtime 的 fallback catch 误报成 POST 不可用。

现有 `long-result-url.test.ts` 已覆盖长指针成功、HTTP 直接参数校验、旧 peer 404 和不回退 GET；但参数拒绝没有经 transport、注册 Host 工具及 renderer 消费。现有 `result-fields` 使用独立 `/project` 分支，`result-locate` 使用 `/locate`；直接 reader 抛错也不经过长 POST catch。本候选不重复 #40 delay、#46 partial、#47 空搜索、#49 intent、#50 列位、CSV EOF 或组件等待。

这里保留当前 HTTP 合同：`code=INVALID_REQUEST`，message 分别为 `INVALID_PAGE` 和 `RESULT_PATH_NOT_FOUND`，`retryPolicy=never`。不要求新增生产错误码，也不把 Runtime 当前的通用错误编码描述成新缺陷。

## 新测试实际执行的链路

`test/apps-host/result-read-error-parity.test.ts` 使用显式非业务 query fixture Provider，由真实 AppsRuntime 执行和持久化、真实 model projection 生成 resultRef，再经实际回环 HTTP、HttpAppsHostTransport、注册 `apps_inspect` 及 renderer：

- 同一原始结果中，短键与长且含 `/~` 的键保存相同两条 JSON 协议控制值；无商品、SKU、价格或商家事实。
- 第一页到第二页原样执行实际 continuation，核对 0、false、null 和完整字段，明确验证短路径 GET、长路径 POST。
- 两个 schema-valid 语义错误由真实 Runtime 拒绝：越界 cursor 和不存在的子路径。HTTP wire body 是真实 Response 的 clone，没有 mock response 或替换 Runtime reader。
- 独立断言 HTTP 400 的完整错误对象，再核对 Host/renderer 保留该对象。GET 与 POST 必须给出相同失败语义。
- 读取合法末尾空页，并显式修正请求后成功读取同一 retained result。每个动作恰好一次 HTTP read，无自动重试或替代路由。
- query Provider 只执行一次；12 次读取后，仍只有一个 dataset、无 operation，持久化 result 和 invocation 逐值不变。

有 15 秒测试总界限、10 秒共享取消信号、5 秒请求期限；每一步清理另外设独立 2 秒界限，某步失败仍继续其他清理并用 AggregateError 保留原失败与清理失败；端口使用 Fetch 可用高位范围并仅对已占用/不可用端口有界重试。初始化阶段即登记逆序清理，检查 Host 注销工具、Server 关闭、Store 关闭；正常完成和 Runtime 成功清理均检查 connection active=0。仓库外 cwd 可以直接运行。没有真实桌面、浏览器或远端平台验证。

## 单点突变证据

临时仅删除 `packages/plugin-apps/src/transport.ts` 的一行：

```ts
if(statusCode!==undefined&&statusCode!==404&&statusCode!==405)throw error;
```

这模拟兼容 catch 的常见回归：不再区分真实已支持 POST 路由返回的参数拒绝与旧 peer 的 404/405。未修改生产校验、权限或身份逻辑，未按测试专门注入分支。

- 原字节，旧 10 文件：85/85 pass，0 fail、0 skip、0 cancelled。
- 上述单点突变，完全相同旧 10 文件：85/85 pass，0 fail、0 skip、0 cancelled。
- 突变下新测：0/1 pass，精确失败 `actual unavailable / expected failed`。失败前已验证真实长 POST HTTP 400 与 `INVALID_REQUEST / INVALID_PAGE / never`，不是端口、初始化、清理或外层超时失败。
- 生产原字节恢复，新旧 11 文件：86/86 pass，0 fail、0 skip、0 cancelled，7.331 秒。
- 仓库外 cwd 新测：1/1 pass。
- 显式 Host.start 拒绝的测试夹具控制：自然退出 1，Host/Server/Runtime/Store 均关闭，并保留原始初始化错误。
- 实际 Provider 不自行返回、但遵守取消的控制：约 5.3 秒自然失败，cancelled=0；Host/Server/Runtime/Store 均关闭，Runtime 连接 active=0。
- 完全忽略取消、永不结算的 Provider 控制：约 7.3 秒自然失败，cancelled=0；AggregateError 保留原始 query 失败和 Runtime disposal 超时。Host/Server/Store 已关闭，但 Runtime 未完全 dispose，不能声称全部释放。没有改生产 Runtime 来掩盖这个控制。
- 分类审计：PASS，308 testFiles、162 requiredFiles、161 infrastructureFiles（分类允许重叠）。全仓 tsc noEmit 最终通过。

初次分类运行因遗漏 infrastructure reason 失败，补充准确说明后复验通过；初次 tsc 指出新测试解析值被断言收窄为 unknown，增加测试 helper 的显式类型后通过。二者原失败日志保留。首次完全忽略取消的 Provider 控制曾在 15 秒外层测试时限取消；这是新增夹具清理不足的证据，不计合格结果。补入逐步有界清理后，最终该控制明确失败并自然退出。最终测试再跑相同单点突变确认仍红，再恢复组合全绿。没有删断言、改冻结记录或增加 skip。

生产文件恢复 SHA-256：`5fe6ef32de1f853274c36ad813f303df02f30ba0d7b6cf1d0846a59c65a886d9`，与基线逐字相同。所有生产目录及冻结数据 git diff 为空。本候选没有运行完整 npm test，86 项不能称全仓通过。

## 复跑

在基线加此候选后运行：

```sh
node scripts/audit-real-test-data.mjs
node --test --test-concurrency=1 \
  test/apps-host/result-read-error-parity.test.ts \
  test/apps-host/long-result-url.test.ts \
  test/apps-host/result-fields.test.ts \
  test/apps-host/result-locate.test.ts \
  test/apps-host/result-request-snapshot.test.ts \
  test/apps-host/transport-error-contract.test.ts \
  test/apps-host/session-route-errors.test.ts \
  test/apps-runtime/http.test.ts \
  test/apps-runtime/result-reader.test.ts \
  test/apps-runtime/result-reader-string-equivalence.test.ts \
  test/apps-runtime/result-locate.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

旧邻近集合即去掉第一行新增文件，其余十文件完全相同。突变前保存 transport 原字节，仅删除上面唯一一行；分别跑旧集合和新单文件，之后用原字节恢复再跑组合。所有控制仅在独立工作树执行。

本机初始/修正证据目录 `artifacts/cross-error-contract-audit/` 保留全部历史结果及 mutation diff。最终一键复验目录 `artifacts/result-read-repro-500mqb_6/` 包括旧原版/突变、新突变、恢复组合、仓库外 cwd、类型/分类检查、三个清理负控制和逐文件 SHA 汇总。最终日志 SHA-256：旧突变 `2f761c199b21ab8b27a1843e58c0f623a11864db5848bfff2ac3f4941d7706fa`；新突变 `959cb24fa3ae3506f11d44af9434cf988772b84fa120ffabaedfb9ce1d8d40b3`；恢复组合 `7efa29a681e42ac9979209707955dc6dfea01bb9c5b66b0b9b061ee229786914`。

本机一键复验工具为 `artifacts/cross-error-contract-audit/reproduce.py`，使用 `python <此工具的绝对路径> <已应用候选的独立checkout绝对路径>`。它要求 transport 原 SHA 一致，将日志写到目标 checkout 新建的 artifact 子目录，逐步验证预期退出码，并在 finally 中恢复生产原字节；清理负控制必须自然失败且 cancelled=0。该工具和日志是独立审查证据，不混入默认测试或生产补丁。

## 独立复核（当前集成基线）

在全新独立工作树、基线 `14558f5b3996113e4d8a11451e341e94165c3d40`、Linux 6.18.44、Node v24.19.0 上重跑同一复现工具，未推送或修改共享工作树。旧 #49 分类 reason 已在该基线更新，作者补丁无法原样套入该处；仅保留基线的现有 reason、追加本测试的分类项。测试文件与作者候选逐字一致，SHA-256 为 `40ed4120e015915ebab9e9c2c494011140165a7c971291da5d7f7646f21fc407`。

独立结果：

- 旧十文件原版：85 pass、0 fail、0 cancelled、0 skipped，7.157 秒。
- 唯一突变仍仅删除 transport 非 404/405 再抛守卫；旧十文件：85 pass、0 fail、0 cancelled、0 skipped，7.568 秒。
- 突变的新测试：自然 exit 1，0 pass、1 fail、0 cancelled、0 skipped，0.361 秒。准确失败在新测试第 89 行，actual `unavailable`、expected `failed`；先前的真实长 POST HTTP 400 和完整错误对象断言均已通过。
- 恢复生产原字节后新旧十一文件：86 pass、0 fail、0 cancelled、0 skipped，7.918 秒。
- `/tmp` 外 cwd：1/1 pass；分类审计 PASS（308 / 162 / 161）；全仓 `tsc --noEmit` exit 0。
- Host.start 初始化拒绝：自然 exit 1，0.293 秒，原始异常保留，Host/Requests/Server/Runtime/Store 全部 closed。
- 可取消永等 Provider：自然 exit 1，5.341 秒，cancelled=0，全部 closed，Runtime connection active=0。
- 忽略取消的永等 Provider：自然 exit 1，7.311 秒，cancelled=0。AggregateError 同时保留原始 query 未成功断言和 `Runtime disposal did not settle within 2000 ms`；Host/Requests/Server/Store closed，Runtime failed。未完成的 dispose promise 没有被取消或神奇释放，不能把该控制描述成全部清理成功。

代码审查确认使用真实 `AppsHost.start` 注册的工具和 renderer，真实 Provider→Runtime 持久化及 projection、HTTP Server、transport、Host 错误归类均实际执行。fetch 包装只记录实际 Response clone、合并取消信号，不替换响应或错误；`apps_inspect` 的 schema 校验先于所有语义拒绝。短 GET 与长 POST 各六次读取，包括 continuation、两个精确语义拒绝、合法末尾空页及显式更正读取。恢复后的正式路径检查 Provider=1、dataset=1、operations=0、持久化 result/invocation 不变及 active=0。新测试没有依赖已有固定业务样本或伪造业务事实。

清理顺序为 Host→Requests→Server→Runtime→Store，逐步单独最多 2 秒；任一步失败会继续后续步骤，并保留主失败。初始化控制只证明在 Host.start 拒绝处资源被关闭，不扩称覆盖了全部可能的初始化异常。正常路径和可取消控制的 active=0 断言在 Runtime.dispose 成功之后执行。没有发现阻止发布该测试候选的问题。

独立完整证据目录为 `artifacts/result-read-repro-enkgc987/`，逐次退出码及 SHA-256 在 `summary.json`。关键日志 SHA-256：旧原版 `e3e8dda18f78ebc899c15d04e68c00293bb03112111c4935a0f20f11c706ec76`；旧突变 `76716378199b975214658fef434ac39ae387c1cb28c5c34bdcf90180a5e8e30a`；新突变 `cc699b669760f13613c82b7af912c7f1e615f9975bdbb8ac42ba318114d41122`；恢复组合 `61fd086057f6e12f2c7c9609e0a288bbdd9befc85a171ee33a81763553314eb1`。生产 transport 仍为上述原 SHA，生产目录及冻结数据无 diff；此复核未执行全仓 npm test，86 项只代表列明的邻近集合。

复核的第一次准备因旧 reason 补丁上下文冲突，误在缺少新测试的树启动了工具；其新测步骤报文件不存在，工具 finally 已恢复生产原字节。该次证据保留于 `artifacts/result-read-repro-vgqnfv1q/`，不计入有效 mutation 结论。适配分类后完整复跑才产生上述有效证据。
