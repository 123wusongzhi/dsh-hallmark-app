# 测试 issue #71 独立复现与最小修复

GitHub 实际 created_at：2026-10-15T23:51:38Z，符合本任务时间范围。基线 88371e41ced9d566e7ba855604c4e77f17830edd；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0。读取全文与评论后独立构造故障与探针，使用已有依赖、内存 SQLite 和本地纯基础设施 provider，不导入作者补丁或运行外部复现脚本。

## 价值与最小修改

当前生产 Workbench admission 顺序正确，原测试缺少拒绝后的账本状态断言。只在原只读 mutation 拒绝及 provider calls 断言后加 operations.length===0，保留全部旧 case、fixture、请求和断言。

该位置使用全新内存 Store，此前只有 query、连接和绑定，不产生 mutation intent，所以期望 0 合法且无需过滤或新增基线。invocations 的 received→settled/WORKBENCH_READ_ONLY 拒绝审计是合法行为，必须保留；不要求所有表零写，不添加生产权限审核或通用框架。

## 真实顺序回归与对照

临时只把完整 Workbench admission 块原字节移动到真实 mutation reservation 之后、首 AbortController 之前。块内条件、语句和错误均不改，不人工 put 假 operation，不 monkeypatch invoke 结果。错误顺序仍拒绝请求，却已创建 queued operation、link 和 received/queued event。

两个版本均完整运行同五文件、44 项，无名称过滤、跳过或取消。固定组为 test/apps-runtime 下 workbench、runtime、workbench-http、workbench-pins-http 四个 .test.ts 文件，以及 test/apps-components/workbench.test.ts：

| 输入 | 实际结果（双版本相同） |
| --- | --- |
| 原生产 + 旧测试 | 44/44 |
| 完整 admission 块后移 + 旧测试 | 44/44，漏检 |
| 同重排 + 新断言 | 43 通过 / 1 精准失败，operations actual 1、expected 0 |
| 原生产恢复 + 新断言 | 44/44 |

Node 22 首次原生产基线另有 pins HTTP fixture 随机端口 50580 的 EACCES，结果为 43/44；当时尚未运行 Node 22 变异，目标 Workbench case 正常。完整日志保留于 attempt1-port-eacces，finally 先恢复源码及测试。只读 netsh 显示本机排除范围 50560–50659 包含该端口；未改系统、端口选择、fixture 或 skip。重跑同一 Node 22 固定组得到上述完整四态，不能称端口环境问题已修复。

另对未修改原 case 使用透明 close observer，仅在真实 RuntimeStore.close 前读表并输出，再调用原 close，不发额外 Runtime 请求、不写账本：
- 原版：mutation invocation 为 settled / WORKBENCH_READ_ONLY，operations / links / events 为 0 / 0 / 0。
- 重排：相同拒绝审计仍存在，但三表为 1 / 1 / 1，同 operationId，operation queued，event received / queued。
- provider 原 case 的累计 calls=1 来自此前合法 query，拒绝 mutation 没有增加；后续合法 query 才到 2，原断言保持。

## 实际消费者及范围

另用纯内存 provider 和真实 invoke/inspect/recover、rollbackBaseline/assessRollback 做原版/重排/恢复探针，双版本 providerCalls 始终为 0：

| 消费者 | 原生产 / 恢复 | 临时重排 |
| --- | --- | --- |
| 同 invocation 缓存重试 | 保持 WORKBENCH_READ_ONLY | 仍保持原拒绝 |
| 同 key、新 invocation 重试 | 再次只读拒绝 | pending |
| inspect | 无 operation | queued operation 返回 pending |
| rollback assessment | A，允许 legacy restore | B，unresolved 包含该 operation，禁止 legacy restore |
| recover 后首次审计 | 保持只读拒绝 | CANCELLED_BEFORE_DISPATCH，operation cancelled |

assessRollback 前后 operation 表不变；没有执行真实 restore/迁移。recover 只作用于该内存 fixture。上述后果仅来自受控故障，不宣称当前生产已有污染。

queued 是账本状态，不能称已获得 ConnectionQueue 锁、已执行业务写或发生权限绕过；真正 queue.acquire 位于更后。普通 mutation 的 unresolved 阻塞筛选也不包含 queued，因此不把这条记录直接解释成业务队列阻塞。相同 idempotency key 的新 invocation 与同一 invocation 缓存重试必须区别。

## 合并与检查

主工作区应用同一单行补丁后，两个 Node 的五文件均 44/44，零失败/跳过/取消。主工作区和隔离树 TypeScript、真实数据审计均通过。保护主工作区 107 个已有未提交/未跟踪文件，所有原文件 SHA 不变，不导入其生产 WIP。

生产 Runtime index.ts 原 Buffer 恢复 SHA-256：423e75983680c8a11b6aca5e95871184996523e5fc6ac77c69e438cd8ceb3a72；候选测试 SHA-256：3d77f853930718201b112933808272543485142172419c752d3f29a119b71779。测试 patch SHA-256：7ab138cf7942b252f7f53fb046a5818551f7e242fce18c477ef68897eba9ed81。

所有源码故障均 finally 从进入时原 Buffer 恢复，冻结 corpus 不改，无真实商家写入、安装、部署或桌面操作。只提交本测试及本报告。

本次定向组不等于全仓/真实浏览器/线上验收，没有机械执行包含 installer 分支的 82 文件集合。前序全仓 Node22 两失败、Node24 一失败记录（association capability 状态、packaged parity 字符串 productId 转 NaN）未在本次修复，本次未重跑全仓。#67 两项未归因间歇失败此前未再现，原因仍未确定。

## 本地证据

独立 runner、固定组 TAP、原 case close 前只读观察、下游探针、输入 SHA 及恢复/合并检查位于 artifacts/issue-review-automation20-20261015T2349/issue71/。

