# candidate36 与 Ozon 工作台的桌面集成

日期：2026-10-09。目标：正式 DSH Desktop，`<USERPROFILE>/.dsh/profiles/desktop`。

## 源码关系

本地 `c36` 工作树是主仓库的干净 detached worktree；它与主仓库 HEAD 均为 `bf5478a1b455f102079c8ba104f7e27d6a91cc25`，tree 均为 `f8733347dd15381fe44c23d8702661ee84d2a0d7`。当前工作台功能在这个 candidate36 基线上增量实现，不存在需要再次合入的另一条分叉，也未用旧构建覆盖新源码。

集成保留 candidate36 的重复保存、CAS 基线、另存目标切换、历史版本恢复能力，同时包含蓝白素材库、调整显示、添加信息、跨接口字段组合、共享数据源与独立店铺选择，以及默认三分钟缓存和手动刷新。

## 正式连接与版本

最终已安装版本为 `1.0.0-candidate.49`，Host、Runtime 和随包 SDK 使用同一版本。candidate48 完成首次桌面安装，candidate49 追加用户要求的限流缓存体验并完成正式桌面替换与重启。

正式桌面此前使用 candidate31 Host，连接共享的 candidate36 Runtime。此次升级同名插件并替换 `36994` 上的 Runtime，复用原数据目录 `artifacts/apps-a2-bill-runtime-restored`。没有删除组件、模板或会话，也不创建第二个应用入口。

正式 Hallmark 连接仍是 `bill-source-board`：

- `baseUrl = http://127.0.0.1:4280`：原业务读取、调价、任务、同步等操作。
- `ozonDataBaseUrl = http://127.0.0.1:4281`：新增的 Ozon 数据查询与包裹实重读取。
- 仅两种数据读取方法选择第二个地址；未配置时沿用原地址。URL 使用同样的回环地址验证。
- Bill、Helen 继续在店铺选择处区分，使用一套数据源定义。网关复用原平台店铺授权，不复制凭据到组件或浏览器。

运行时连接通过带 `expectedConfigRevision` 的正式 API 更新，再同步种子配置。切换连接版本会使旧数据快照标记为过期，后续读取使用新配置。

## 备份与验证范围

安装过程的脚本、日志和证据保存在 `artifacts/desktop-candidate47-install/`。目录名称沿用最初 candidate47 安装预检，最终版本以报告内容为准。

正式插件管理器负责旧插件、profile 配置备份及同名替换，并生成回滚脚本。会话和桌面状态另有逐文件校验备份。Runtime 冷快照保留数据库、源码归档、证据和实际引用的工作区。

严格历史引用备份遇到已有预览证据的长度元数据不一致（SHA 一致），因此另做保持原始字节的冷快照；不更改原历史记录，也不将该冷快照表述为严格 schema4 备份工具验收通过。该快照包含 28,830 文件、1,741,786,075 字节，源和备份的 SHA 全部复核通过，SQLite 验证副本完整性正常。恢复时须保留原路径身份；被省略的 14 个 node_modules 是有记录的可再生工作区依赖缓存。

candidate47 集成基线的类型检查和全部 1022 项测试通过，包含 candidate36 的八项保存回归。candidate48 最终完整回归为 1026/1026，安装的 52 个产物和 192 个源码输入均匹配构建清单。正式桌面提供的客户端与构建完全一致（仅多出 Host 附加的 sourcemap 注释），五项应用资源查询全部 HTTP 200。

## 限流缓存体验

candidate49 在 Runtime、工作台、已保存的原生组件、源码组件 SDK 三层处理缓存：限流时继续显示上次成功内容，不使用错误块替换表格；当前页、数据时间和其他成功绑定保留。没有缓存的辅助字段留空，不伪造零或获取时间。重试遵守平台的 nextRetryAt/retryAfterMs，正常缓存期限仍为三分钟。权限与连接身份变化会清除不再适用的内容。

## 完成记录

2026-10-09 12:13（北京时间）通过官方插件管理器完成 candidate49 同名替换并重启真实 DSH Desktop。安装包 SHA-256 为 `ea5902ff30eb3d8c03652ffc197a19382deff5f300097627ce34465de6bb59e5`。

- 桌面主进程 `27008`，Host `64836`（端口 `19387`），正式 Runtime `17972`（端口 `36994`）。Host、Runtime 均为 candidate49，数据库仍为 schema4。其他 Web/网关实例保留原进程。
- 安装的 52 个产物、193 个源码输入全部匹配构建清单。通过桌面自身登录交换读取五项应用资源，全部 HTTP 200；桌面注册并提供的客户端字节匹配该构建，只有 Host 附加 sourcemap 注释。
- 原有 5 个组件、6 个对用户可见的保存素材，以及组件版本、视图、会话绑定、连接和全部 provider records 在升级前后保持一致。独立验收用临时会话绑定在检查后已禁用。
- 10 个 Ozon 数据源定义、7 个素材、两家授权店铺均可读取。Bill 273 个商品、Helen 76 个商品，各读取 5 行商品/价格/库存组合后重复读取，三类来源均命中缓存且保留真实数据时间；TTL 为 180,000 ms。Bill 再读一次含流量的组合也成功，未使用强制刷新或循环重试。
- 限流行为由确定性测试验证；本次最终实店检查没有人为触发限流。完整回归在最终分页补丁前为 1039/1039；最终补丁另通过 SDK 23/23、UI 14/14、独立分页及隔离探针 14/14，类型检查通过。真实 cursor 产生不同 datasetId 时仍保留原页，跨店铺、筛选、日期、连接、接口版本或权限变化不复用旧页。
- 停机后另做 `cold-state-before49/` 数据库和配置冷快照，SHA 及 SQLite 完整性检查通过。candidate48 插件与 profile 的回滚脚本为 `artifacts/desktop-apps-rollbacks/20261009T041307Z-1bf377ba8aaf4d608e4b2463865aa8be/rollback.ps1`；最初全量冷快照和会话备份继续保留。

证据均位于 `artifacts/desktop-candidate47-install/`：`installed-package49-verification.json`、`host49-readonly-verification.json`、`runtime-before49.json`、`runtime-after49.json`、`candidate49-catalog-verification.json`、`candidate49-data-verification.json`、`candidate49-full-test-summary.json`、`candidate49-final-paging-audit.json`。

本轮桌面确认通过实际进程、Host API 和客户端产物校验；没有将这些检查描述为桌面窗口内逐项点击验收。下方引用的历史 Web 页面交互与截图仍由 [工作台验收记录](cross-source-workbench-acceptance.md) 单独说明。
