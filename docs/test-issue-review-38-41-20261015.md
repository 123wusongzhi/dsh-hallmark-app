# 定时检查：测试 Issue #38–#41

Automation 20 延续本聊天的检查。四项实际 created_at 分别为 UTC 2026-10-15 15:32:25、15:41:45、15:42:38、15:43:27，均晚于限定的 15:02:44。已读正文与评论；#38 有一条评论，其发布分支与本任务分支不同，不直接移植提交。独立验证基线为 `d653938e06ff8b85794bebcbd07285330b108e28`，Windows / Node 24.12.0。

## 价值与独立对照

| Issue | 用户路径与最小实现 | 复现、变异和恢复 |
| --- | --- | --- |
| [#38](https://github.com/123wusongzhi/dsh-hallmark-app/issues/38) 热 Host 跨 Runtime 目录换代 | 当前生产正确。新增同一 Host 经真实 HTTP 连接两代 Runtime 的测试，验证旧能力描述缓存失效、退役版本拒绝派发、新版本恢复与持久化身份一致 | 旧 15 文件 135/135；删除 handshake 的 descriptions.clear 后旧 135/135，新 0/1；原字节恢复后组合 136/136，零跳过 |
| [#39](https://github.com/123wusongzhi/dsh-hallmark-app/issues/39) 原生附件拒绝后的手动重试 | 当前生产正确。实际组件、原目录 hook/SDK、sourceSelection、SelectionInputBridge、真实 File，验证拒绝后清理草稿、保留既有附件与选中项、反馈错误并解锁；只有用户第二次点击才重试 | 旧 32/32，包括 #35；删除 finally 的 setAttaching(false) 后旧仍绿，新准确报按钮未解锁；恢复组合 33/33，仓库外 cwd 新测 1/1 |
| [#40](https://github.com/123wusongzhi/dsh-hallmark-app/issues/40) 限流 delay 到模型的恢复链 | 当前生产正确。真实 Provider→Runtime→HTTP→Host renderer JSON 保留 retryAfterMs，显式读取返回 4200→1→成功；仅虚拟 Date，不自动重发或业务写入 | 旧 18 文件 288/288；移除 Provider delay 透传后旧仍 288/288，新在 expected 4200 / actual undefined 处失败；原字节恢复组合 289/289 |
| [#41](https://github.com/123wusongzhi/dsh-hallmark-app/issues/41) 旧刷新污染较新重读 | **复现当前真实缺陷**：同一 source 组件刷新在途时，用户可点“重试读取”，较晚返回的旧刷新成功覆盖新快照，或旧错误污染新成功。只在现有刷新清理 effect 依赖加入 version，复用已有 AbortController 与身份检查 | 旧 4 文件 17/17；新四场景原实现 2 通过 /2 失败，修复后 4/4。临时恢复原字节再次复现 2 失败，再恢复最终修复、仓库外 cwd 4/4。旧邻居+新测+SDK 并发控制 27/27 |

#38/#40 属显式非业务协议控制，登记 infrastructure；#39 使用两条原样冻结摘要、#41 使用四条原样摘要，登记 recorded。没有改写 corpus、放宽生产校验、删除有效断言或新增 skip。#39 与既有刷新后选择覆盖互补；#41 同时保留合法当前刷新成功更新、当前失败反馈且保留旧快照，避免以禁用刷新掩盖缺陷。

#41 保留 bridge、viewId、owned 与卸载时的原清理，新增 version 与既有数据加载依赖一致；普通 setData 不触发自取消。独立只读复核无阻塞。新增四场景针对同身份重读，没有单独声称覆盖所有在途身份切换或真实桌面行为。

## 兼容性与最终验证

新增测试沿当前项目模式使用 import.meta.url 定位、真实本地链路与有界执行。#38/#40 使用 Fetch 允许的端口范围并限制冲突重试；#40 将测试取消传给实际 Host 请求。#39/#41 用真实 React effect 和可控响应门闩，不依赖固定 sleep；子进程有时间与输出上限，成功临时目录验证在预期根下后清理，失败日志保留。#40 最终仅调整端口和取消信号，断言不变，新测 1/1 与类型检查再次通过；原变异记录保留。

- 独立工作树去重组合：**375/375，零失败、零跳过**；TypeScript noEmit 通过；数据审计 PASS（298 测试文件、159 recorded 条目、154 infrastructure 条目，含 helper，分类数不作为文件总数相加）。
- 主工作区四个新文件：**7/7，零跳过**；TypeScript noEmit 通过。合并前 35 个既有修改/新增文件逐字节 SHA-256 保护，全部未变；scope 单独合并，保留用户已有分类。
- 主工作区同一组合：**371/375，4 失败**。原有用户未提交 Host 扩展新增 session-bindings/connections 查询，以及 apps_delegate、apps_resume、listing_image_manage，旧 gateway.test.ts 一项和 host.test.ts 三项仍按旧请求/工具清单断言。相关生产文件与合并前保护 SHA 一致，本批未修改；未放宽旧断言。失败中止于精确清单，不能据此认定用户新功能已完整验证。
- 主工作区数据审计仍 FAIL：用户新增未提交 `test/business-pricing/purchase-cost.test.ts` 尚未分类。本批四文件已分类；没有代改无关工作。

#40 首轮旧邻居曾出现 provider.test.ts 关联状态 unknown ≠ on_sale，原失败日志保留。未改/跳过该测试；单文件 30/30。独立内存控制发现同 Offer 的 seed 与刷新行同毫秒 created_at 时，id 排序可让旧 unknown 覆盖新 on_sale；seed 早 1ms 时恢复。首失败数据库未留存，故该诊断是强支持原因而非已完整证明的归因。原样受控 288/288、变异 288/288、恢复 289/289 和最终独立组合均通过，仍如实记录偶发风险。

本批未重复运行全仓套件，不把上述定向结果表述成全仓全绿。前一批完整套件 2241 通过 /2 失败 /2 跳过的限制仍在：未构建的 authoring SDK package、helen-margin 子项目缺少 UI 依赖，以及两项既有打包前提 skip。

本地证据在 `artifacts/issue-review-automation20-20261015T1545/`。#38/#39/#40 的临时生产变异均恢复原 SHA；#41 临时原实现复现后恢复最终一行修复。只提交本批四测试、分类、报告和这一行生产修复。离线冻结回放和回环 HTTP 不代表真实平台请求、文件上传、浏览器布局、桌面安装或商家写入验收；本轮均未执行这些动作。
