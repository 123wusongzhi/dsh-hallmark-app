# 平台经营表：一次选择信息，一次更新预览

## 任务与旧流程

用户任务：在当前店铺的商品经营表中补上「预留库存」「加购次数」「商品详情浏览」，比较后再决定是否保留。

基线为 `fd95bc22929bfbfa850e0312357322578287a10c`。使用生产 `MaterialLibrary`、`InformationPicker`、`WorkbenchInstanceView` 和 `readOzonComposition`，通过隔离 fetch 响应与注入的归一化来源 reader 重放。商品标题、图片和价格来自仓库内已校验的脱敏冻结语料；分页行、零库存、缺失数量和限流是明确的派生测试条件。不访问真实店铺，不执行平台写入。

旧流程：调整显示 → 添加信息 → 勾选三项 → 完成。每一次勾选已立即改变配方并重新读取预览，「完成」只负责关面板，没有取消入口。勾选三项产生 3 次预览请求；想恢复之前的配置，必须重新进入面板并逐项移除，又产生 3 次请求。

这不是只减少界面装饰。用户尚在比较字段时，表格已改变并重新准备数据，原本可查看的内容会被替换。

## 修改后的交互

- 字段面板使用临时选择，显示已选总数、待添加与待移除数量。
- 点击「应用并预览」后一次应用整个选择，再读取一次组合预览。
- 取消、返回、关闭都放弃本次未应用选择，不读取、不改已应用列。
- 添加后又移除、最终字段集合没有变化时，不重复查询。
- 保留已有列的顺序、改名、隐藏状态；保持至少 1 项、最多 30 项限制。
- 面板明确标注当前表格仍为已应用配置，避免把待选字段的示例误认为已查询结果。
- 未修改组合数据的来源、缓存、缺失值或保存就绪判断。

## 对比结果

| 场景 | 原版 | 修改后 |
| --- | --- | --- |
| 连续选择 3 项过程中的预览请求 | 3 | 0 |
| 选择 3 项并确认后的预览请求总数 | 3 | 1 |
| 选择后反悔恢复原配置 | 再移除 3 项；累计 6 次预览请求 | 点取消；累计 0 次预览请求 |
| 未确认期间的表头 | 已随选择改变 | 保留原表头，可继续查看 |
| 字段添加后再移除，净变化为零 | 仍发生查询 | 0 次查询 |

以上是预览查询次数，不是平台接口调用节省。基线的底层来源缓存已经工作：测试中三项选择期间归一化上游读取累计仍为 4 次。勾选三项再确认的操作次数也不变；改进是避免两次中间预览重载，并提供可取消的编辑过程。

## 回归与边界

`test/plugin-apps/cross-source-material-ui.test.ts` 新增任务级回归；同一份期望在准确旧版上先失败（预期无中间读取，实际新增 3 次），在候选版通过。

覆盖：

- 三项批量选择只在应用时读取一次；原表在选择期间继续可用
- 取消、关闭、返回和净零变更不查询；取消同时恢复增加及移除操作
- 1 项下限与 30 项上限
- 保留改名、隐藏状态和顺序；保存后跨店铺重新打开的配置契约
- 通过真实组合模块制造一个来源限流：部分信息、来源读取时间、快照时间及缺失说明保留；未知数量仍显示「暂无数据」；未验证的部分结果仍不能保存

验证命令：

```sh
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
node --test --test-concurrency=1 \
  test/plugin-apps/cross-source-material-ui.test.ts \
  test/plugin-apps/workbench-ui.test.ts \
  test/plugin-apps/workbench-store-context.test.ts \
  test/plugin-apps/workbench-cache-ui.test.ts \
  test/plugin-apps/workbench-cache-fallback.test.ts \
  test/apps-components/data-source-choices.test.ts \
  test/app-hallmark/ozon-compose.test.ts \
  test/app-hallmark/compose-cache-regression.test.ts
```

Node 24.19.0：相关 51 项通过，类型检查与冻结语料审计通过。未运行全仓构建、真实平台读写、桌面安装或原生宿主验收。双版本生产 React 浏览器 fixture 已轻量编译，但截图与 390px 视觉验收因浏览器环境阻塞仍为 NOT_RUN。字段面板的变更计数独占一行，操作按钮允许换行；该布局修改尚未取得浏览器视觉证据，不以 React renderer 断言冒充真实浏览器操作。
