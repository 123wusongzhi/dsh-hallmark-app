# SnapshotView 两条字串 guard 删除：独立复核

## 结论

通过本次限定范围的复核。可以采用仅删除两条 snapshot scoped-read 子串断言、增加一行行为测试指引的补丁；不扩大到其他 guard。消除的是等价属性访问的假红，没有性能收益主张。

- 公开基线 `838f601f21720a1196488cbc70625624231513b1`，tree `eacd3d17e5ef8881affc7e5a176bfc4bf94f7a55`。
- 独立 worktree 从该公开基线创建，复用 Git objects；未使用作者候选工作目录执行测试。
- 原样复制最终自足脚本，SHA-256 `aa68aa88d7d03d32134d97abaf792f3c2700f0c91e5b0dda95f3054ee87a3422`；脚本使用内嵌 patch，不依赖作者本地 commit。
- Node 24.19.0、22.18.0 各实际完整执行 43 条命令。最终相关三文件各 11/11，完整 plugin-client 各 129/129；fail / skipped / cancelled 均 0。两 Node 审计、tsc、diff-check 均通过。
- 当前候选逐字节等同本地提交 `e1a7ac19fecc3e73303ec879fe1d576ddb108e62`，tree `8f797b20059f3472d69b279f86577a39ce1ca111`。本次独立复核没有新建提交、推送或发布 issue。

## 独立复跑结果

以下数值为 pass / total，两个 Node 一致；“原行为”始终使用公开基线原四条 lifecycle case，“删除后组合”包含原六条 session-components、原一条 application-surfaces 和原四条 lifecycle case。

| 输入 | 旧 static | 原行为 | 删除后组合 | 红灯原因 |
| --- | --- | --- | --- | --- |
| metadata 访问改为等价中括号写法 | 5/6 | 4/4 | 11/11 | 旧 includes 字串假红 |
| 两处 data 访问改为等价中括号写法 | 5/6 | 4/4 | 11/11 | 旧 includes 字串假红 |
| 两种等价改写同时发生 | 5/6 | 4/4 | 11/11 | 旧 includes 字串假红 |
| metadata 全部改用全局 view | 5/6 | 0/4 | 7/11 | #65 消息缺失断言，带 null / refresh-session |
| data 两处全部改用全局 viewData | 5/6 | 0/4 | 7/11 | 同上，先在初始阶段失败 |
| 仅 initial data 改全局 | 6/6 | 0/4 | 7/11 | 同上，独立检查初始边界 |
| 仅 refresh data 改全局 | 6/6 | 0/4 | 7/11 | 真实 refresh 后 readCount 实际 1 / 期望 2 |
| 仅 version>0 metadata reread 改全局 | 6/6 | 2/4 | 9/11 | 两条 late case 的新数据 ID 精确断言 |
| 仅 version>0 data reread 改全局 | 6/6 | 2/4 | 9/11 | 两条 late case 的 readCount 实际 2 / 期望 3 |

每个变体均通过 tsc；同一变体的旧 static、原行为和新组合绑定相同生产源 hash。总计逐份回查 80 份实际失败子进程 stderr 和对应 bundle 行：48 份初始消息缺失、16 份 refresh readCount、8 份 reread 新数据 ID、8 份 reread readCount，全部为目标 `ERR_ASSERTION`。10 份旧 static 红灯也精确落在源字串断言。没有把 TypeError、模块加载/语法错误、timeout、取消或单纯非零退出算作有效检出。

初始错路由最先触发 fetch 夹具里的 sessionId 断言，其错误被真实组件显示，#65 helper 再明确断言消息不存在并附 alerts。它不是后面的 resource 断言已经执行的证据。全部 data 错路由在初始阶段先失败，因此 refresh 的结论来自独立 refresh-only 控制。旧 includes 只检查文件内存在字串，本来就漏检 initial-only、refresh-only 和保留原字串的两种 reread 分支；不得把四组额外行为负控制说成被删除 static 原有的保护。

## 字节、状态范围和入口

- 全部 1362 个 tracked 文件先与公开 `git archive` 逐字节核对。Node24 finally 完整恢复原基线；Node22 最终只有指定测试文件改变。272 个 packages 文件和 frozen corpus 均未变。
- 生产 snapshot SHA-256 `d7ae2d73235207860d33fe426ad4e81eff5de99ff34a59db735bf5901f046f5b`。
- lifecycle SHA-256 `7564ca636c12e92fcb2031823edadf33edfe92acca17bec81e60f9dc28cb6b54`；#65 helper、四个 current/late × success/error case，以及数据、时间、错误可见性、AbortSignal、按钮、iframe、监听器清理等全部原字节保持。
- 用独立字节转换确认候选恰为删除两个 assert.ok 加一行注释，其他 8 条 source/ownership/native-integration guard 全留；原测试数量不变。
- 依赖复用已有 node_modules，根 `pnpm-lock.yaml` 与该安装的 `.pnpm/lock.yaml` 逐字节一致；esbuild 0.25.0、React/react-test-renderer 18.3.1、TypeScript 5.9.3。未验证 fresh install。
- 默认 `npm test` 发现表达式包含三文件。单跑 session-components 会失去两种完整错路由的静态拦截，至少需一同跑 snapshot lifecycle；考虑 sidebar 既有依赖，建议三文件或完整 plugin-client。
- `test:apps` 原本就不包含 plugin-client，本补丁没有改变它。发现范围核对不等于实际执行全仓。

本轮没有执行全仓 npm test、test:apps、完整构建、真实浏览器/桌面、在线服务、部署或生产验收；不宣称全路径覆盖、其他 guard 可删或速度提升。作者首轮驱动对 esbuild 的 ids2 符号匹配过窄，原失败轮已保留且不计完整通过；本次使用其修正后的冻结脚本独立完整复跑。

## 交付

以下为本地归档索引，未随报告发布。完整自足补丁和脚本见[问题 #64 后续复核](https://github.com/123wusongzhi/dsh-hallmark-app/issues/64#issuecomment-6205793299)；未重复创建同类 issue，原关闭状态保留。

- `ISSUE.zh.md`：可直接发布的中文自足 issue，含完整 patch 和完整复现脚本。
- `candidate.patch`、`reproduce.py`：同上内容的独立文件。
- `node24/manifest.json`、`node22/manifest.json`：43×2 条实际命令、输入 hash、完整 tracked 前后 hash、逐步结果。
- 对应目录中每步 patch/stdout/stderr，以及每个失败子进程 bundle/stdout/stderr。
- `public-base.tar`、`archive-baseline.json`：公开 SHA 归档及完整基线对照。
- `static-independent-review.json`：精确最小差异与保留的八条 guard。
- `verify-independent.py`、`independent-verification.json`：对全部实际输出、具体失败行、状态范围、逐文件恢复和入口的独立交叉核验。
