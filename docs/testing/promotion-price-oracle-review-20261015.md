# 活动价格上限测试漏检：独立复核通过

日期：2026-10-15 UTC。复核基线 `3d27e7578bb6faaf0cd30eb56788bcd233229559`，Git tree `08f4664c1008bea3fc8bf2f90df44f2ab1439c54`。独立 detached worktree，未共用作者的源码工作树。GitHub 分支接口另行核实 `test/cross-module-regression-20261015` 当时仍指向该基线；不将旧 main 分支作为工作基线。

## 可提交结论

当前生产 `maxActionPrice:max.amount` 正确。确认的是测试防回归缺口：将其临时改为邻近的 `price.amount` 后，旧测试仍全绿；只加独立字面断言 `assert.equal(result.items[0].maxActionPrice,13);` 即准确检出错误。

候选 `1618e95d4e01ad4c8d1272a938c8f90b544746ce` 的父提交为基线，只修改 `test/app-hallmark/ozon-data.test.ts` 原活动 case。一句断言以外的全部文件字节、既有断言和原非对称 12/13 fixture 均不变。补丁实际应用后，新测试 SHA-256 与候选 commit blob 完全一致；应用及回退均通过 `git diff --check`。

## 独立实跑

| 环境 | 原生产/旧测试 | 变异/旧测试 | 同变异/补强 | 恢复/补强 |
|---|---:|---:|---:|---:|
| Node 24.19.0 | 183/0 | 183/0 | 182/1 | 183/0 |
| Node 22.18.0 | 183/0 | 183/0 | 182/1 | 183/0 |

数字为 pass/fail。每阶段执行相同15个相关测试文件的全部183项测试，无测试名过滤，全部零 skip/cancel/todo。唯一失败是原活动 case，`ERR_ASSERTION`、`strictEqual`、actual 12 / expected 13。双版本恢复后的 `audit-real-test-data.mjs` 均 PASS，TypeScript `tsc --noEmit` 均 exit 0。

另独立实跑真实 `readOzonComposition` 默认 reader：未传第五个注入 reader，只在 `storeDataRead` 接口边界提供受控离线响应。双版本的真实 monetary/normalized/关联/aggregate 链得到 maxActionPrice **13 → 12 → 13**；actionPrice 始终12、币种始终CNY。输出字段 metadata 始终为“活动价格上限”。这是实际组合输出的证据，没有将静态契约或注入已归一化行冒充下游执行。

## 审查要点与边界

- 13 来自既有 `max_action_price.amount='13'` 输入，与既有 `action_price.amount='12'` 不同；不从被测输出或生产 helper 反算。
- 单点故障仅为 [ozon-data.ts:237](https://github.com/123wusongzhi/dsh-hallmark-app/blob/3d27e7578bb6faaf0cd30eb56788bcd233229559/packages/app-hallmark/src/ozon-data.ts#L237) 的邻字段复制。当前实现返回13；未发现当前线上商家价格错误。
- [字段定义](https://github.com/123wusongzhi/dsh-hallmark-app/blob/3d27e7578bb6faaf0cd30eb56788bcd233229559/packages/app-hallmark/src/ozon-fields.ts#L15)、公开能力 schema、生成 SDK 和组合字段目录公开同一独立上限语义。
- 1339个 tracked 文件（含272个 packages 文件）完整 SHA-256 清单，双版本四阶段和 composer probe 均恢复零差异。最终 tracked diff 为空，仅未跟踪的复用依赖链接存在。
- 只复用既有依赖与官方 Node22，无下载、fresh install、真实商城、真实业务写、安装或部署。audit 可生成仓库忽略的本地测试派生文件；未改变跟踪输入。
- 这是15文件定向回归，不是全仓穷尽、性能比较、UI浏览器、实时Ozon协议或真实商家验收。活动接口自身保留2026-10-13切换警告。

## 证据与交付

本次本地独立证据目录（未随报告发布）中的 `node24/`、`node22/` 各有四阶段完整TAP、audit/tsc输出、before/after完整清单及summary；`compose-probe/` 有双版本六阶段日志；`patch-validation.json` 和 `final-integrity.json` 记录最终字节核对。[问题 #67](https://github.com/123wusongzhi/dsh-hallmark-app/issues/67) 包含中文问题说明、完整最小补丁、完整实际复现脚本及composer probe两文件，可在不取得本地证据目录的情况下复现。

复核不发布 issue、不 push、不新增提交。候选本地测试提交由作者提供。
