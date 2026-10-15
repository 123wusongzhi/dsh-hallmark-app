# Node 22 listing-assets 取消夹具：独立实跑复核

日期：2026-10-15 UTC。结论：**通过，限于该 test-only 修复及下述验证范围。**

## 输入身份与执行边界

- 基线：`26e235b28769c2ce83c23442fef25d5843cccfe6`。
- 被审候选：`7cd20bd0b0622240d3eb84e599ddf4f7fe69be50`，仅修改 `test/app-hallmark/listing-assets.test.ts`。
- 在独立新 clone 中实际执行作者的完整自足脚本，从上述基线 checkout 后应用内嵌补丁；未改作者工作树。
- 官方 Linux x64 Node v22.18.0；对照 v24.19.0。Node 22 归档 SHA-256 `c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7`，与保存的官方校验表一致；本次独立重算相同。Node 22 可执行文件 SHA-256 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。
- 只读复用既有依赖；没有依赖安装、全局环境调整、生产修复、skip、推送或 issue 发布。

## 完整脚本实跑结果

27 条命令全部满足其预期，包括故意失败的负例；整个脚本 exit 0。

| 检查 | Node 22.18.0 | Node 24.19.0 |
|---|---|---|
| 基线完整文件 | 17 pass / 2 cancelled | 19 pass |
| 最终补丁完整文件 | 19 pass | 19 pass |
| 首次 import 准备延迟 300ms | 1 pass；HTTP 0/0/0 | 1 pass；HTTP 0/0/0 |
| 8 类故障注入 | 8 次精确断言失败 | 8 次精确断言失败 |
| 恢复生产后完整文件 | 19 pass | 19 pass |
| 离线准备 browser-data 后 tsc --noEmit | exit 0 | exit 0 |

16 次负例全部为 exit 1、`ERR_ASSERTION`、`testCodeFailure`；各为 1 fail / 0 cancelled / 0 skipped / 0 todo，未以 runner timeout 或进程 kill 当作通过。故障覆盖禁用预算、预算晚于响应、publish 漏 signal、预算误分类、忽略 caller signal、caller 误分类、失败入缓存、普通重试失败。

正常及恢复后的预算用例均实际记录 `requests=1,responses=0,closed=1`。旧 Node 22 的两个取消均是 `Promise resolution is still pending but the event loop has already resolved`；第二条是前一条取消后的连带结果，不能称为独立生产 caller-cancellation 缺陷。

## 独立补强检查

1. TypeScript AST 提取断言调用，按规范空白后的表达式与出现次数逐一比较：原有 96 条全部保留；候选共 112 条，仅新增 16 条。原预算上限、逐文件错误码、空缓存、普通重试和 caller 非预算错误码断言均未删除或放宽。
2. 额外在慢准备 300ms 条件下分别禁用预算、推迟预算、漏传 publish signal；两版本共 6 次都在测试主体以 `ready !== failed` 的 `ERR_ASSERTION` 精确失败，0 cancelled。因此允许准备期合法的 HTTP 0/0/0，不会放过这些真实取消链路退化。
3. 额外诊断仅临时增加观测和断言，双版本完整文件各 19/19。两个取消用例的响应 close 回调均观测到请求 socket 已 destroyed、response 已 destroyed，且 1 请求 / 0 响应 / 1 关闭；after 开始时 pending 响应为 0。
4. 必须准确区分请求取消与夹具清理：Node 22 的两个用例在 after 前各残留一个没有收到 HTTP 请求、bytesRead=0 的连接；Node 24 此次均无剩余连接。候选的 `server.close()` 和 `closeAllConnections()` 显式清理这些夹具连接。结束后 pending=0、sockets=0、server.listening=false，并实际连接旧端口得到 `ECONNREFUSED`。不能声称所有服务端 socket 都只靠 abort 自然消失。
5. 为验证上一区别，曾临时删除 closeAllConnections，Node 22 在清理阶段取消；原请求在此前已自然中止。该试验说明 cleanup 不应删除，不是最终候选失败。生产漏 signal 负例则在 cleanup 前的主体断言报 `ready !== failed`，未被强制关闭伪造为成功。

所有额外诊断均已恢复；原生产内容及全部 955 个 tracked 非 test 输入再次重算 SHA-256，与开始一致。最终 tracked diff 只有已审 test 补丁。

## 审查判断

慢 publish 的真实调用路径是 `publish → request → fetchImpl → native fetch(input, init) → loopback HTTP`，原 signal 保持传递。access/import/public-readback 仍为原受控 fixture，不应称为完整真实 Provider 或真实商家调用。

延迟响应为有限 1,000ms 的成功响应，且该 timer、listener、服务端 accepted sockets 均 unref；不存在为了撑过测试而添加的长保活 timer。正常请求 abort 后清除响应 timer。缺失或过晚取消时，成功响应自然返回并使业务断言失败。5 秒 test timeout 和脚本的 60 秒外层上限只作边界，验收执行均未触发。

本次可以接受该最小测试夹具修复。没有修改生产逻辑，也不据此声称全仓 Node 22 通过、浏览器/桌面验收完成或真实图片服务交付成功。

## 冻结摘要

- 测试 Git blob：`a2200bb60d003894dc9240b7417d6e20f7ad2f50`
- 测试 SHA-256：`b53334502dfa87443e317aeb79f7f6ca143ed25c96e80d4d1d73f5b7e98dbc04`
- 完整补丁 SHA-256：`1a2febf298b10587229744240017fed7f1c6541140247d6953af275b9c45d105`
- 自足复现脚本 SHA-256：`8bbecc42771450b20504cd9eadcc50a5be51a33a424a7a5683b6c238c153055b`
- 恢复后生产 listing-assets.ts SHA-256：`e4a01bbf006b5bac567a981df1c030d38c1ac20fd57bce02cedda18f0d573a66`

配套中文 issue 正文包含完整可读补丁和完整实跑 Python 脚本；已检查正文代码与实际运行文件逐字一致。脚本接受 source/node22/node24/output 路径，从冻结 SHA 自动新建隔离树并保存每条命令、TAP、输入和日志 hash、非 test 前后清单。原始本机证据另外归档，未把本机绝对路径当作公开复现入口。
