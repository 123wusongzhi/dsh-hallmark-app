# 已发布提交 6c67 的完整回归

精确输入：`6c67f76bfeaedf5e4e1f579904811401b1eae7d6`，Git tree `710e0ec5f946a5d20e92814758ac91b6bdfb7435`。包含 116 兼容合并、#41 snapshot 生产修复及 #44–47；不包含后续上游 344、#48 或 SQL 候选修复。

## 结果

Linux、Node 24.19.0。2026-10-15 16:38:40–16:43:14 UTC，独立检出已发布 SHA 后执行 `npm --offline test`。npm 配置通过环境设置 `npm_config_offline=true`、`npm_config_update_notifier=false`；`DSH_REAL_CORPUS` 指向该检出的冻结资料。复用现成依赖，没有安装、浏览器环境覆盖或改写测试配置。

- 2258 tests；2218 pass；2 fail；38 skipped；0 cancelled；0 todo。
- 进程自然结束，退出码 1；墙钟 274.152 秒，Node 报告 270601.738249 毫秒。
- pretest 数据审计 PASS：304 文件，161 required、158 infrastructure，分类有重叠。
- snapshot 四个生命周期用例、实际 Vite 资源加载、只读取消恢复、partial 模型状态保真、空搜索与失败区分，共 8 个新增用例均在此次完整运行中实际通过。
- #38、#39、#40、#42、#43 的五个跨模块用例也逐名称确认通过。

历史 afd55 完整输入为 2250 项、2210 通过、2 失败、38 跳过。本轮增加 8 项通过，无新增失败名称；全部 38 项跳过的名称及日志给出的原因完全一致。两次输入不同，不能据耗时比较声称性能优化。

## 保留的失败

1. `test/acceptance/component-display/read-scale.test.ts:29`：49 MB 记录负载的 scope 查询计划未匹配期望的 irregular 索引。
2. `test/service/apps-scheduler-scope.test.ts:40`：schema 3/4 磁盘库重开后的 scope 查询存在相同计划断言失败。

两者均在 `/provider_records_irregular/` 断言处失败，实际计划包含 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。完整失败信息已保留，没有放宽断言、改生产 SQL 或跳过失败。这不是全套通过结论。

## 执行完整性与边界

- 900 秒、200 MiB 保护均未触发，日志完整 261099 字节。
- 日志 SHA-256：`83043d7025056278f8ad924f257d206d6edfa7d44ac6e7287c28764747c8a61c`。
- 全部 1300 个 tracked 文件前后哈希相同，包括 502 个生产/配置/锁文件、134 个冻结资料、367 个测试相关文件和 310 个文档；分类有重叠。
- 哈希清单 SHA-256 前后均为 `028522b4020a154a59616d2cb2108ea6bff7a0fe2cf76acfa5e7ab9305a30d65`；HEAD 不变。
- 既有 Windows、真实浏览器和缺少打包产物的条件跳过全部保留。此次结果不构成全平台、真实浏览器或线上商家/模型执行证明。
- 后续输入的专项结果需另行记录，此完整结果仅适用于精确的 6c67 输入。
