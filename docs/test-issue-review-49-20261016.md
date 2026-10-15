# 定时检查：测试 Issue #49

Automation 20 于北京时间 2026-10-16 01:10 开始本轮检查。[#49](https://github.com/123wusongzhi/dsh-hallmark-app/issues/49) 实际 created_at 为 UTC 2026-10-15 16:56:59，晚于限定的 15:02:44；完整正文与评论已读，无评论。独立树、主工作区和远端原分支基线均为 `22ba49469bbe7326af6f6e9fca625c97ed0a9def`，Windows / Node 24.12.0。

这项建议有实际价值。调用 ID 区分一次尝试，稳定 idempotencyKey 区分同一个意图；Host 若误把后者写成前者，HTTP 丢回应后即便已只读确认成功，调用者再次显式执行相同意图仍会重复执行 Provider。现有 Runtime 去重和 Host 丢回应回查各有覆盖，但没有贯通这一接线。当前生产正确，只需补测试。

新增 `test/apps-host/explicit-intent-retry.test.ts` 使用非业务内存计数 Provider，经真实注册工具、Host、HTTP、Runtime、SQLite 和模型 JSON renderer。首个响应在实际 response.end 边界扣住，独立确认 SQLite 已 settled/ok、执行计数为 1，才销毁连接。Host 必须通过原 invocation 的真实 GET 得到成功；此时仅有一个派发 POST，证明没有自动重放。

第一次返回确定成功后，测试才显式发出新调用 ID、相同意图键的第二次请求：模型仍返回计数 1、operation 相同，Provider 不再执行。第三次使用不同意图键作为正对照：计数到 2、新 operation，原 operation 不变。请求体、Provider 收到的键/ID、原生/模型/持久化结果和最终三 invocation/两 operation 分别独立核对。没有自动重试未知写操作，也没有商家调用或商品事实。

| 独立对照 | 结果 |
| --- | --- |
| 原实现，15 个完整旧文件 | 156/156，零跳过/取消 |
| 原实现，新测试 | 1/1 |
| 只将 Host 的显式 idempotencyKey 误接成 invocationId | 旧仍 156/156；新 0/1，准确报同意图执行计数 2 ≠ 1 |
| 原字节恢复，旧+新 | 157/157，零跳过/取消 |
| 仓库外 cwd 使用绝对测试路径 | 1/1 |
| 主区新测试、两处 TypeScript noEmit | 新测 1/1；类型均通过 |

本机 Chrome 可用，旧浏览器归档测试正常运行；不套用 issue Linux 环境的 155 通过/1 跳过统计，也不改变 skip 条件。未重复全仓测试，不把定向通过表述成全仓全绿。

测试采用 30 秒总期限、5 秒局部界限、可释放响应门闩、取消传播与实际原生 Promise 追踪；清理在构造前登记，关闭 HTTP、等待实际调用、dispose Host/Runtime、关闭 Store，清理错误聚合。早失败与门闩竞争，避免用外层超时假装内部已结束。无需临时目录、子进程、浏览器或安装。不限制工具总数、GET 精确次数或无关元数据请求。

只读兼容性复核确认主区用户已有 session-scoped inspect/resume 扩展不参与该 mutation 回查路径；请求键、SDK 原 invocation GET、Runtime 意图预留与复用语义一致。实际主区新测通过，无需改动用户 Host 或增加边界限制。合并前 42 个既有修改/新增文件 SHA-256 不变，scope 单独合并保留用户条目。

新文件登记 infrastructure。独立数据审计 PASS：306 测试文件、161 recorded 条目、160 infrastructure 条目（含 helper，分类数不作为文件总数相加）。主区审计仍 FAIL：用户新增未提交 `test/business-pricing/purchase-cost.test.ts`、`test/collection/related-products.test.ts` 未分类，本批文件已登记。不代改无关工作；此前旧 Host 清单冲突和构建/打包限制也未在本批全仓复验消除。

唯一临时变异 `packages/plugin-apps/src/index.ts` 已 finally 恢复原字节，SHA-256 `b65fd1e824ca3dc643b5006fe1367f607744f69855bf7167e25d70f5b545f80b`。本轮生产 diff 为空，#41 永久修复保留。只提交新测试、分类、报告；无真实商家写入、桌面安装、发布或冻结语料修改。本地证据位于 `artifacts/issue-review-automation20-20261015T1710/`。
