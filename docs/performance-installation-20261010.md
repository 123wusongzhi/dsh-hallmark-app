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

## 下次安装：可选 Runtime 托管（2026-10-15 源码新增，尚未安装）

这部分不是上文已安装产物的现场结论。本轮只修改源码、执行临时进程测试和 PowerShell 语法解析，没有执行安装器，也没有启停正式 DSH 或 Runtime。

- 默认仍由外部管理 Runtime。只有明确决定由本插件管理的实例，才使用 `scripts/install-desktop-apps.ps1 -ManageRuntime`。安装器不自动推断现有进程归属，不接管服务管理器/任务计划启动的实例；先由操作者停用重复的外部启动机制。
- 同时显式传入绝对路径参数 `-RuntimeNodeExecutable`（真实 `node.exe`，不是 Electron）、`-RuntimeDataDirectory`、`-RuntimeWorkingDirectory`、`-RuntimeServiceUrl`（与插件配置相同的 `http://127.0.0.1:<port>`）、`-RuntimeOperatorTokenFile`。连接文件默认是数据目录下的 `connections.json`，可以用 `-RuntimeConnectionsFile` 覆盖。
- 令牌文件若是既有 `{ "token": "…" }` 格式，增加 `-RuntimeOperatorTokenJson`；否则读取既有纯文本令牌文件。路由 key 只引用环境变量名：`-RuntimeRouterKeyEnvironment` 默认 `openrouter`，启动时映射到 Runtime 的 `openrouter`。Host 在每次启动前读取来源，不把值写入清单、Host 日志或安装输出。
- 环境变量必须由启动 DSH 的父进程传入。与旧现场 PowerShell 脚本不同，Host 不自行查询 Windows User/Machine 环境变量；修改持久环境变量后需确认新的 DSH/Host 进程实际继承。若不能继承，可在清单中将该凭据改为引用已有纯文本文件。缺失或空凭据会拒绝启动，不回退到未知来源。
- 缺少参数时明确跳过写清单；错误路径会在安装前拒绝。`-ValidateOnly` 不写清单。已有清单不会因省略 `-ManageRuntime` 或缺参而删除；撤销托管需操作者移除清单并重启 Host，不能把“未重写”误当作“已禁用”。

清单位于 **插件配置指向的 Apps 数据目录下 `runtime-launch.json`**，不放进安装包，不含凭据值。schema v1 的完整键为：

```json
{
  "schemaVersion": 1,
  "managedBy": "dsh-plugin-apps-bundle",
  "serviceUrl": "http://127.0.0.1:4181",
  "nodeExecutable": "C:/Program Files/nodejs/node.exe",
  "entry": "C:/path/to/desktop/node_modules/dsh-plugin-apps-bundle/lib/runtime.js",
  "cwd": "C:/path/to/runtime-working-directory",
  "env": {
    "APPS_DATA_DIR": "C:/path/to/apps-data",
    "APPS_CONNECTIONS_FILE": "C:/path/to/apps-data/connections.json",
    "APPS_PORT": "4181"
  },
  "credentials": [
    {"name": "HALLMARK_OPERATOR_TOKEN", "fromFile": "C:/path/to/existing/operator.json", "jsonField": "token"},
    {"name": "openrouter", "fromEnv": "openrouter"}
  ]
}
```

Host 严格拒绝未知键、内联 secret、注入型环境项（如 `NODE_OPTIONS`）、非绝对/不存在路径、非 node 可执行文件、错误管理者、entry 非本插件已安装 `lib/runtime.js`、与插件不一致的数据目录/服务地址/端口。`APPS_PORT` 是环境变量字符串，但必须是 1–65535 的规范整数，且与 URL 端口相同。清单、所引用文件与安装目录属于本地执行信任边界，应限制写权限，不加载来路不明的清单。已有清单被重写前备份为本次安装回滚目录中的 `runtime-launch.previous.json`；包回滚脚本不会自动恢复该数据目录文件，需要操作者核对后处理。

监控每 5 秒浅检查，连续 3 次失败进入 down。仅有效清单启用重启；等待退避时仍是 `RUNTIME_DOWN`，真正启动到健康确认期间才是 `RUNTIME_RESTARTING`。启动前再次浅检查，收到真实 HTTP 回答（包括 503、无效 JSON）则不启动；TCP connect 不能证明端口空闲也不启动。不会杀任何占端口进程，也不会因健康检查慢而强杀旧实例。多 Host 用数据目录 `runtime-launch.lock` 串行化启动；超时但子进程仍存活且未确认健康时继续持锁，只有确认健康或子进程退出才释放。Host 在启动尚未完成时卸载/异常退出会保守保留锁文件，避免另一个 Host 启动副本；操作者确认没有活着的未就绪子进程、没有启动在途且端口空闲后，才可手动移除遗留锁。

退避为 5、10、20、40、60 秒封顶（实际时机还受 5 秒采样间隔影响）。每次启动等健康约 30 秒（在后续采样时检查截止），10 分钟窗口内连续 5 次失败停止尝试并报告 `RESTART_LIMIT_REACHED`；仅连续健康 5 分钟重置。超时但自建子进程仍存活时，只记录 `OWNED_CHILD_STILL_RUNNING`，不杀它、不再启动副本；故仍需人工诊断挂死进程。Host 卸载/退出只停监控和待启动任务，已启动 Runtime 作为独立进程继续服务，不因插件卸载被杀。

子进程 stdout/stderr 追加到数据目录 `logs/runtime-child.log`（未做轮转，需运维控制大小，勿在 Runtime 自己的输出中打印密钥）；每个重启决策写既有 `logs/host-YYYY-MM-DD.jsonl`。没有有效清单时 `restart.enabled=false`，只显示未连接/等待外部恢复，不声称自动恢复。Runtime 离线不再阻断插件注册：工具和资源返回 `RUNTIME_DOWN`/`RUNTIME_RESTARTING` 与只读 `read_retry`；恢复健康后重新加载初始目录/协议能力，并且仅挂载一次原生应用投影。原有变更请求不自动重发；无效 service-key/URL/协议仍报配置错误。

## 本机证据

- [冻结构建清单](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/frozen/build-manifest.json)
- [安装产物、冻结输入及当前源码差异](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/installed-package-verification.json)
- [真实 Host 和页面脚本核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/host-readonly-verification.json)
- [现场性能协议、304 及会话文件核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/live-performance-verification.json)
- [Runtime 数据保留核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/runtime-after.json)
- [默认连接别名保留核对](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-performance-20261010/legacy-alias-preservation.json)
- [原插件与 profile 配置回滚清单](E:/project/deepseek_h/dsh-hallmark-app/artifacts/desktop-apps-rollbacks/20261009T164816Z-4edcff8d086b4938923cee52cf56c24c/backup.json)
