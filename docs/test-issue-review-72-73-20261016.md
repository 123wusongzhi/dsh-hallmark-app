# 测试 issue #72–73 独立复现与兼容性补强

基线 bd23131b1b1cfd7b6db5a7c1c6e69b9eb7d05422；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0。实际 GitHub created_at：#72 为 2026-10-16T00:20:12Z，#73 为 2026-10-16T00:39:06Z，均符合任务起点。读取全文与评论后独立构造 runner/故障，不导入作者提交或执行外部复现脚本。

## #72：给 warnings 增加独立内容预期

原测试只比较缓存 hit 与 first 的 warnings；首次和缓存同时变空仍相等。上游实重 warnings 说明单 SKU 单件实重的覆盖范围和被排除记录，实际 composedData 会接收并供组件展示，有业务含义。

只加 first.data.warnings.includes('retained warning') 的明确断言，原 fixture、case、hit-vs-first 深等值、零 archive write、缺失/分歧修复、失败与重启断言全保留。与 issue 建议的全数组 deepEqual 相比，包含断言允许合法新增说明；双版本各一次临时额外合法 warning 控制均 1/1，随后原 fixture 字节恢复，不修改冻结数据。

临时只将源 checkpoint 的 warnings:[...sourceWarnings] 改为 warnings:[]，不改 items、total、status、时间和组合层其他警告。两个版本均在固定八文件 108 项完整组执行：

| 输入 | 实际结果（双版本相同） |
| --- | --- |
| 原生产 + 旧测试 | 108/108 |
| 同一丢警告故障 + 旧测试 | 108/108，漏检 |
| 同故障 + 新断言 | 107 通过 / 1 精准失败，明确 first response must retain the upstream warning |
| 恢复原生产 + 新断言 | 108/108 |

全阶段零 skip/cancel/todo，108 名称不变。八文件为 app-hallmark 下 ozon-data、ozon-compose、compose-index-regression、compose-cache-regression、snapshot-cache，以及 adapter/ozon-store-read、apps-runtime/ozon-routing、apps-host/ozon-pagination-evidence 的 .test.ts。

独立 probe 使用真实 RuntimeStore/HallmarkStorePort、默认 reader/composer、公开冻结产品及真实 composedData，仅在离线端口提供单件 310g 与 multi_sku skipped 条件。双版本原/故障/恢复中，两条 weights 说明在首次、缓存和消费者均为保留→全部丢失→恢复；310g、ok、total1、cursor null、stale false 和首次三次端口调用不变，缓存没有新增读取。不是浏览器或真实平台取证。

## #73：验证 CollectionService 的跨连接结果

原 namespace case 只检查 products snapshot 的持久缓存，尚未调用 d 的 collection。Provider collection 缓存整个服务，client/store/sourceId/listingStates 闭包和实例 indexCache 均绑定连接；仅删除 key 的 connectionId 可让 d 复用 c 实例。

在原 case 中增加 c→d→c collection.search，使用公开冻结 summary[0]/[20]，调用前直接投影输入的 id/title/source 构造独立 expected。可选 fixture 参数按 connectionId 返回输入 clone，不按调用次数分配；未传参数仍向 Provider 传原 client 对象，保留其他 case 的动态方法替换。原 products.list→finally 的 785 字节后缀完全保留，原 273 个 assert 调用文本/顺序均保留，增加 3 个调用点，30 个 case 名不变。

临时只将 collection 方法 key canonicalJson([connectionId,revision]) 改为 [revision]，不改其他 key。完整 provider 文件四态（pass/fail）：

| 阶段 | Node 22 | Node 24 有限重试的四态 |
| --- | --- | --- |
| 原生产 + 旧测试 | 30/0 | 30/0 |
| 同一 key 故障 + 旧测试 | 30/0，漏检 | 30/0，漏检 |
| 同故障 + 新测试 | 29/1，唯一目标错误 | 29/1，唯一目标错误 |
| 恢复原生产 + 新测试 | 30/0 | 29/1，仅既有 association 状态失败，目标通过 |

Node 24 最初未变异的旧基线也为 29/1，失败同为 exact association capability 的 actual unknown / expected on_sale。只做一次原输入有限重试，恢复阶段该既有失败仍出现；全部非零退出和日志保留，不选择性宣称文件全绿，不改它的 fixture/时钟/断言，根因未在本次确定或修复。

双版本目标 focused 四态各为 1/1→1/1→0 通过 1 精准失败→恢复 1/1。目标红灯是 collection rows must belong to connection d 的 deepStrictEqual，实际 c 的淘宝行，预期 d 的阿里行。之后两个版本固定六文件均 81/81，无失败/skip/cancel，六文件为 provider、listing-provider-revision、collection/collection、collection/source-reads、apps-runtime/connection-config、apps-host/collected-empty-search。

另用透明 probe 仅包装 execute 记录并转调原实现，再只读实际 services map/indexCache。两版原/故障/恢复均记录 context c/d/c、revision1、session s；服务数 2→1→2，源读取 [c,d]→[c]→[c,d]，返回 c/d/c→c/c/c→c/d/c，provider stopped、Store closed。不替换 collection、服务或返回值。

第三次 c 与 reads=[c,d] 证明 c 复用缓存，没有第二次 d 请求，不声称已测 d 的第二次命中或 revision 切换。未断言非 card 输出字段 sourceUrl；未证明磁盘隔离、线上泄露或真实平台接口成功。当前生产 key 正确，仅修测试。

## 合并、检查与恢复

主工作区合入两份补丁后，14 个相关文件双版本各 191/191，零失败/跳过/取消，含用户已有额外测试。主工作区和隔离树 TypeScript、脱敏真实数据审计均通过。集成前保护 107 个已有未提交/未跟踪文件，全部原文件 SHA 不变，不导入用户生产 WIP。提交只包含两个测试与本报告。

所有临时生产故障均 finally 原 Buffer 恢复；最终 SHA-256：

- ozon-compose.ts：f488c98ce58bd8d6228d267f5936da4b227d6ad03cf477c87d9d4f0e715314d5
- Provider index.ts：a51200dd3bdb35fbf9fe8c934e094ca3a40684cbf1ae34c59ff9f93e59cd7c86
- cache 测试：e2c4b99dfba2413d290e2301bf3bdf4dd09bfe6923d045910450d32722356853
- Provider 测试：bfc30351d18f57f3b9e4487ba6e9ef997ca41901e833bdc972ba446213e07bfa

本次无安装、真实商家写入、冻结 corpus 改写、桌面/浏览器/线上验收或全仓重跑。前序全仓 Node22 两失败、Node24 一失败记录涉及 association 状态和 packaged parity 字符串 productId 转 NaN；本次 association 还在 Node24 原基线及恢复输入出现，不能称已修复或全仓全绿。#67 其他两项未归因间歇失败、#71 端口环境问题也不算本次修复。

本地 runner、完整 TAP、透明 probe、兼容性控制、全部失败和输入/恢复/合并 SHA 位于 artifacts/issue-review-automation20-20261016T0046/issue72、issue73 及该目录根下。
