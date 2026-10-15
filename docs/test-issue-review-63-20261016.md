# Issue #63：视觉审核 POST 的草稿上下文

在 #60–62 的冻结全量运行期间发现 #63，实际 `created_at=2026-10-15T21:01:27Z`，晚于任务起点。已读取完整正文与一条评论，先只读准备，待上一批全量自然结束、提交 `ebb96b1157e5a8630b5c40688691dadfe5b15221` 后才执行故障对照。

## 价值与最小修正

当前生产已发送 draft，没有新增生产修复。原测试只要求 `state[0]` 是字符串，不能防止视觉请求丢失本例已经提供的待审草稿。对模型比较来源与草稿的既有功能而言，此覆盖有实际价值。

仅修改 `test/decisions/decision-review.test.ts` 的原视觉图片协议用例：捕获实际 fetch POST body，在 review 返回后保留原 typeof 字符串、图片标签／图片项顺序、完整 data URL、成功状态与协议名称断言，再新增一条独立上下文比较。预期来自调用者 source 与原 fixture 的明确 draft、versions、图片 id/role，不读取 serializer 生成预期；原 recorded corpus 与业务数据均不变。

原 fetch 内断言失败虽然会被 reviewer 转为 pending，但原成功状态断言仍能检出它，不能把这种捕获机制笼统归为假绿。本次确证的漏检是 draft 内容未被原字符串类型检查保护；后移断言同时保留更直接的失败位置。

本项目的兼容性修正：没有照搬对整个 JSON 对象的 deepEqual。该做法会冻结顶层键集合，使合法额外上下文 metadata 假红。最终解析后仅投影本例需保真的 source/draft/versions/images 四字段，再完整比较其内容，图片顺序与版本值仍受保护。没有新增审核步骤，不要求 unknown source/draft 非空，也不要求所有调用者提供 policy。

原文件 16 个测试名不变，另一个图片文件 4 项不变；AST 核对原 73 个 assert 全部保留（仅 body→submitted 局部改名），最终 74 个。正式 diff 为 13 行增加、4 行移除；无新测试文件、case、依赖、分类、skip 或通用框架。

## 双版本独立对照

Windows x64，使用上一批已验证的官方便携 Node22.18.0 与本机 Node24.12.0；复用现有依赖，不访问模型或真实商城。

| 固定两文件阶段 | Node22.18 | Node24.12 |
| --- | --- | --- |
| 正确生产＋旧测试 | 20/20 pass | 20/20 pass |
| 生产序列化临时删除 draft＋旧测试 | 20/20 pass，漏检 | 20/20 pass，漏检 |
| 同一故障＋最终投影断言 | 19 pass／1 fail | 19 pass／1 fail |
| 原字节恢复＋最终测试 | 20/20 pass | 20/20 pass |
| 额外合法 metadata＋初始严格候选 | 19 pass／1 假红 | 19 pass／1 假红 |
| 同 metadata＋最终四字段投影 | 20/20 pass | 20/20 pass |

draft 故障唯一失败为原用例 `a host-provided verified image protocol sends image parts rather than a text URL`，差异准确显示 draft 缺失；不是加载、网络或 runner 超时。所有这些轮次均 0 skip/cancel。

初始严格候选另做五种负控：删 source、删 versions、交换标签／图片项、损坏图片 URL、改变协议名，双版本各精确单项断言失败。最终仅调整顶层投影兼容性；保留的原图片与协议断言不变，不把这份旧候选矩阵伪称最终 SHA 的重跑。最终版本另重新完成上表 draft 四阶段及相关回归。

两版本各执行七组普通 assert 边界探针，确认 unknown source/draft、可选 policy 与原无效版本行为保持；这些不是新增七个 TAP case。一次证据脚本把无匹配测试文件也算为 file-pass，后改为过滤时仅传目标文件，原 runner 计数失败单独留存，未改被测行为或放宽期望。

所有临时变异仅在独立树 `packages/service/src/decision-image-protocol.ts`，finally 写回原 Buffer 并核对 SHA256，最终为 `530b0f8c9883188e9e88339557370414a3902cef4e84ab29b9778f4ba41482fd`，生产 diff 为零。最终测试 SHA256 为 `c58be5833e86e207eb68b9272ebcb16fdeed0c24bbea981843b291698dbf5987`。

## 集成与复测

独立树最终两版相关回归均 90/90：`test/decisions/*.test.ts`、`test/operations/business-operations.test.ts`、`test/operations-adapter/adapter.test.ts`，0 fail/skip/cancel。类型检查与冻结数据审计通过。

主区目标文件先核对与 HEAD 无用户改动，再仅应用本批 test 补丁；集成快照保护 107 个既有 modified/untracked 文件，其字节均未变。主区相同相关文件在两版本各 **104/104**，额外 14 项为既有用户测试；类型及数据审计也通过。没有将用户生产、其他测试或 scope 工作提交。

本次只有断言补强，未重复运行全仓。此前 [#60–62 完整报告](test-issue-review-60-62-20261016.md) 的默认全量是 #63 之前的冻结输入，不能借作本候选的全量通过：Node22 为 2261 pass／2 fail，Node24 为 2262 pass／1 fail，均 2263 项、0 skip/cancel。provider 的 unknown/on_sale 偶发及打包 parity-probe 的 NaN 输入失败未由本次修改修复；不放宽生产 JSON 校验，也不混入主区已有的其他修正。

原始正文评论、候选、各阶段 TAP、边界、负控、metadata 假红对比与恢复记录保存在本地忽略目录 `artifacts/issue-review-automation20-20261015T2050/issue63/`。本次不声称 Linux/Node24.19、全新安装、线上模型／商家、远端 CI 或桌面验收。继续保留每 60 分钟检查。
