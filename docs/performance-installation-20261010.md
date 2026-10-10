# DSH 性能优化包安装记录

安装日期：2026-10-10，Asia/Shanghai。目标：当前正式 DSH Desktop 的原同名应用插件。

## 安装结果

已通过 DSH 官方 CLI `0.2.0-rc.2` 更新原 `dsh-plugin-apps-bundle`，并重启 Desktop 和它使用的 Runtime。版本仍为 `1.0.0-candidate.56`，本轮以完整 SHA256 区分原 candidate56 与性能优化包。

安装包 SHA256：`48844275effae0aca7354376cec3404a5f8356b284b5df3813ee59f4bd428473`。

使用独立冻结路径安装，避免同版本、同目录路径的包缓存混淆：[本次冻结安装包](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/dsh-plugin-apps-bundle-1.0.0-candidate.56-performance-48844275effa.tgz)。

正式 profile 保持 `C:/Users/wubil/.dsh/profiles/desktop`，Runtime 继续使用原数据目录 `E:/project/deepseek_h/dsh-hallmark-app/artifacts/apps-a2-bill-runtime-restored`，数据库仍为 schema4。未切换业务网关或数据目录。

## 实际加载与性能路径

| 检查 | 结果 |
| --- | --- |
| 冻结构建输入 | 221 个输入摘要与此前 1,211 项完整验收清单一致。 |
| 已安装产物 | 57 个产物逐一匹配冻结构建摘要。 |
| Desktop 实际提供的页面脚本 | 内容匹配已安装 `client/client.js`，仅多出宿主生成的 sourcemap 注释。 |
| Host 元数据资源 | apps、materials、dataSources、saved、hostCapabilities 均返回 200。 |
| 实际 Runtime 性能能力 | 已声明 `routedInvocationsV1`、`viewsEtagV1`。 |
| 组件开发协议 | 已声明 `renderReadyV1`、`uiStateV1`、`bindingPagesV1`、`dataTransferV1`。 |
| 实际目录轮询 | 首次 200；其后 10 次条件读取全部 304，正文均为 0 字节。 |
| 身份与会话隔离 | 未认证请求为 401；另一已有会话不能复用前一会话的 ETag。 |
| 原收藏入口 | 已认证只读请求返回 200，保留原有空收藏状态。 |

验证时 Desktop 主进程为 `74808`、Host 为 `35064`（19387）、Runtime 为 `19512`（36994）。两处业务网关 4280/4281 的原进程保持运行。PID 是本次观察值，之后重启会变化。

## 数据保留与恢复

- 安装前确认没有正在执行的业务操作、构建、预览或挂载。
- 原插件包、5 个 profile 配置文件及同名替换回滚脚本已备份。
- Runtime 数据库、连接配置与运行身份文件完成冷备；在备份副本上验证 SQLite 完整性为 `ok`。
- 原有 6 个保存组件、7 个素材、组件版本、连接、会话绑定、视图及工作台配置保持原值。
- Runtime 启动前后 25 个数据表中，24 个的完整记录摘要一致；`legacy_aliases` 仅更新已有默认连接别名的 `updated_at`，行身份、值和连接映射均未变。
- 121 个原有会话文件完成逐字节备份，重启后的逐字节核对全部一致，总计 86,499,933 字节。

回滚脚本：[rollback.ps1](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-apps-rollbacks/20261009T164816Z-4edcff8d086b4938923cee52cf56c24c/rollback.ps1)。使用前应退出 Desktop；脚本通过官方管理器恢复原插件。数据库和会话备份另行保留，插件回滚不自行恢复数据。

最初停机检查遇到 Windows 在进程退出后短暂保留监听记录，尚未开始安装便中止。确认原 Desktop、目标 Runtime 和监听端口均已退出后，继续完成冷备和安装；等待端口释放的检查已补入本次操作脚本。

## 验证边界

本次安装的是先前 **1,211/1,211 通过、0 失败、0 跳过** 的冻结性能优化包，类型检查和构建均通过。其 15 项实现与测量见 [优化报告](performance-optimization-report-20261010.md)。

在安装核验时发现工作目录还有验收后新增的源码开发，包括派发路由和独立审查机制。新改动保持原样，未进入本次冻结包，也未纳入此前 1,211 项验收；当前最新工作目录不能整体表述为与已安装包一致。安装产物核验与冻结源码验收均已通过，当前源码差异在本次安装证据中单独记录。

现场检查覆盖真实进程、认证 Host/Runtime 接口、实际返回的页面脚本、元数据缓存及旧数据。没有将这些检查表述为桌面窗口逐项点击验收。旧组件归档中的 SDK 保持原版本；能力声明证明服务提供新协议，已有组件是否协商分块仍由其 SDK 决定。验收脚本没有执行真实业务能力调用或创建组件展示授权。

## 本机证据

- [冻结构建清单](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/frozen/build-manifest.json)
- [安装产物、冻结输入及当前源码差异](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/installed-package-verification.json)
- [真实 Host 和页面脚本核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/host-readonly-verification.json)
- [现场性能协议、304 及会话文件核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/live-performance-verification.json)
- [Runtime 数据保留核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/runtime-after.json)
- [默认连接别名保留核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/legacy-alias-preservation.json)
- [原插件与 profile 配置回滚清单](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-apps-rollbacks/20261009T164816Z-4edcff8d086b4938923cee52cf56c24c/backup.json)
