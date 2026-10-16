# 测试 issue #74 独立复现与预期值隔离

GitHub 实际 created_at：2026-10-16T01:33:47Z，符合本任务时间范围。基线 6b23010e0d4fe1aed458d2c49ed6c5fdb4792718；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0。读取全文与评论后独立构造候选、故障和引用诊断，不导入作者提交或运行其外部脚本。

## 价值与最小修改

原 raw snapshot case 在 invoke 后读取 f.snapshot.products[0] 作为 expected。AppCore.products 冷读只展开外层对象、过滤数组，列表出口的 slice 也复用产品行；actual 与 source 可共享引用，源行原地丢字段时 expected 随之改变。

既有契约要求保留 raw 原始字段。只在调用前 structuredClone 原第一行，保存独立 expected，原 deepEqual 改为比较该值；保留原 case、fixture、行数、provenance dataTime、零业务写和 store.close。expected 不传生产、之后不赋值，保护原有嵌套值预期。夹具是已有可克隆 JSON，没有新依赖。

共享行引用本身是合法现状，不加 notSame/notStrictEqual、冻结或生产复制要求，不永久修改生产。unknownSourceField 是原有测试 marker，不能称其为真实商城字段；没有新增或改写该 marker、冻结 corpus 或 adapter 模式。

## 同一自然故障的独立对照

只在 AppCore.products 现有 payload 过滤后临时删除每条产品的 unknownSourceField，不改返回状态、其他字段或 fixture，不人工抛错。旧/新阶段使用完全相同的故障字节，finally 以原 Buffer 恢复。

两个版本各完整运行同 16 文件、233 项，没有名称过滤、跳过或取消；另有单独的目标精确红灯运行：

| 输入 | 实际结果（双版本相同） |
| --- | --- |
| 原测试 + 原生产 | 233/233 |
| 原测试 + 同一删除故障 | 233/233，漏检 |
| 新测试 + 同故障，仅目标 case | 0 通过 / 1 精准失败 |
| 新测试 + 同故障，完整相关组 | 232 通过 / 1 失败，唯一 raw snapshot case |
| 新测试 + 恢复原生产 | 233/233 |

实际读取完整 TAP 的 expected/actual 块，以现有 PyYAML 独立深比较：expected 21 字段、actual 20 字段，唯一差异为缺失整个 unknownSourceField:{foo:'preserved'}，其余字段及嵌套值完全一致。错误为该原 case 的 ERR_ASSERTION / deepStrictEqual，不以关键词或外层非零退出代替语义验证。

固定组包含现有 11 个 test/core/*.test.ts，以及 integration/http-e2e、integration/ui-http、plugin-server/source-flow、presentation/source-components、app-hallmark/legacy-replay 的 .test.ts。其他旧断言及 233 个 case 保留。

## 引用诊断与边界

独立诊断提取原 fixture 前缀的原字节，不改其数据或 adapter，只记录真实对象关系。双版本原生产、临时故障和恢复均观察到 actual 与 source 行是同一引用；原版/恢复保留 marker，故障时 source 与 actual 同时失去 marker，而调用前 clone 始终保留原值。剔除该 marker 后全行相等。诊断未进入默认测试或生产，也没有额外注入嵌套字段变异。

首轮 Node 24 原组 233/233 后，bundle reference probe 的 import.meta.url 相对路径指向 artifacts/artifacts，产生 corpus ENOENT；这是 runner 路径错误，尚未变异源码。原日志保留于 attempt1-probe-path，finally 恢复原文件。只为诊断子进程显式指定同一默认公开冻结 corpus 路径并记录解析/输入 hash 后，重新完整执行双版本矩阵。正常 16 文件矩阵仍清除 DSH_REAL_CORPUS / NODE_OPTIONS，不使用私人语料，不把该加载错误当产品失败。该语料文件 SHA-256 为 9c45a56450fee1ec58438852bc991046965c8d1d91958094f5b59c038cf85a23。

最终只读元数据校验曾直接比较 Git LF blob 与工作树 CRLF 字节并失败，已保留记录，仅该 Git 内容比较改为 EOL 归一；生产故障恢复仍始终核对进入时原 Buffer 和原字节 SHA，不归一、不放宽恢复要求。

legacy-replay 经过 Runtime/HallmarkProvider/HallmarkDomain 及 HTTP 序列化，saved-query-refresh 直接使用 DatasetRefresher，corrections 的相关检查侧重来源时间、身份或写确认，不能替代该 AppCore.products 冷读原行的调用前独立比较。

## 合并与检查

主工作区应用同一测试补丁后，两个版本同 16 文件各 233/233，零失败/跳过/取消；主工作区和隔离树 TypeScript、真实数据审计均通过。集成保护 107 个既有未提交/未跟踪文件，全部原文件 SHA 不变，不导入用户生产 WIP。

生产 packages/core/src/index.ts 原 Buffer 恢复 SHA-256：1c2d5cb1c3361c2ed50a2dc566951c04269ca7d6f7ac6bbde047bf15644424a7。候选测试 SHA-256：b11820ea3024bc48c28acbe5db4a5f36140f0210e05d875815de308200cab153；测试 patch SHA-256：0981fa8fe108ffabfe21a3def176909a67302933c6eec1b6a7edcae6fe4d697e。所有源码 mutation 均 finally 原字节恢复，生产 git diff 为空。

只提交一个现有测试文件和本报告；无安装、真实商家写入、冻结数据改写、部署或桌面操作。本次定向回归不是全仓行为、真实浏览器或性能基准，未另装作者的 Node24.19/24.21，不拼接版本结果。

前序全仓 association 状态与 packaged parity 字符串 ID 转 NaN 失败未在本次修复，上一轮 Node24 原基线/恢复输入仍有 association 间歇失败记录；#67 其他未归因间歇失败与 #71 端口环境问题也不能算本次修复。本轮不重跑全仓，定向通过不代表全仓全绿。

本地独立 runner、完整 TAP expected/actual 差异、原 fixture 引用诊断、输入 SHA 与恢复/合并检查位于 artifacts/issue-review-automation20-20261016T0144/issue74/ 及其上级目录。

