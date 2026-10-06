# DSH 用户授权重启检查点

用户当前明确要求：“你先重启dsh”。仅重启原 DSH，不启动/修改原 Hallmark，不进行业务写。

- 正式安装：dsh-plugin-hallmark 0.1.3，官方管理器 restart-required；重启前 app_info 没有 hostPluginVersion、Config Inspect absent，不证明新 Host 已执行。
- 独立服务已受控更新：仅核实并停止旧 PID28172；新 PID69568，127.0.0.1:4180，dataDirectory=C:\Users\wubil\AppData\Local\dsh-hallmark-app，23工具；后台任务 pwsh-84。重启 DSH 时服务可能随旧 Host 的任务管理退出，回来先查端口/PID再启动，不重复启动造成 EADDRINUSE。
- 最新全量：317/317 Node 测试 + root tsc 通过（pwsh-80 已收）；25/25隔离 Chrome + 两张标签/侧栏截图已复核。合成不是真实 GUI/平台验收。
- Core conditional CNY fallback、权威操作回执已接入；P1 Source401前置拒绝、跨会话unknown阻挡泄漏和P2恢复成功旧PROCESS_RESTARTED已修，Core128/128。
- adapter category六模式/归档接口已实现，76/76适配+22/22HTTP；尚未接正式工具/Core，仍23工具。没有真实平台写/原 token 文件读取。
- Team task13/14/15/16/17完成，各队友已返回并 inactive；Lead task4集成未完成。
- 全规格目标 goal-1074da37-e753-4878-a564-f7847de654dc revision10，active，不可宣称完整完成；真实后端4173离线、指定真实测试对象/参数、48h仍待验。
- 原文 E:\project\deepseek_h\DSH应用插件_spec_doc.md 未修改。当前逐项矩阵 docs/spec-status.md；docs/acceptance.md 的旧138统计待更新到317（明确开发测试）；README/docs不得把安装库存当运行证据。

重启后优先：hallmark_app_info.hostPluginVersion=0.1.3；Config Inspect include:hallmark-app 应有八字段的真实Schema；Client Slots检查原 sidebar.right.pane.tab/title 的 hallmark组件与原main/sidebar；真实GUI标签/侧栏是否运行，而非fixture；独立服务若退出先确认再恢复。原service-key只由Host读取，绝不输出密钥。最后再继续文档未完成模块。

桌面主进程核实 PID9464，安装路径 C:\Users\wubil\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe。Windows UIA已确认原“应用”菜单支持ExpandCollapse，展开后原生菜单项“退出”；不使用开发专有Restart菜单、不改ASAR/profile、不强杀其他进程。
