# 已发布提交 afd55 的完整回归

精确输入：`afd55e4c82c1b66a7d7d13c8b94d4445159a9a80`，Git tree `4c286439e0bce9ac3f4da8d5dda44f8012f84d1b`。本轮不包含之后的 Vite 用例或未发布候选。

## 结果

Linux、Node 24.19.0。2026-10-15 16:04:20–16:09:10 UTC，运行 `npm --offline test`。环境仅设置 `npm_config_offline=true` 与 `npm_config_update_notifier=false`，复用已安装锁定依赖，没有安装步骤。

- 2250 tests；2210 pass；2 fail；38 skipped；0 cancelled；0 todo。
- 进程自然结束，退出码 1；墙钟 290.224 秒，Node 测试报告 286512.570096 毫秒。
- pretest 数据审计 PASS：299 文件，159 required、155 infrastructure，分类有重叠。
- 与上一完整输入逐名称比较：无新增失败，无消失失败，38 项跳过名称及原因完全一致。

前一完整输入有 2245 项、2205 通过、2 失败、38 跳过。本轮输入不同，增加了测试及上游断言，不能拿两次耗时声称性能优化。

## 保留的失败

1. `test/acceptance/component-display/read-scale.test.ts:29`：49 MB 记录负载的 scope 查询计划未使用期望的 irregular 索引。
2. `test/service/apps-scheduler-scope.test.ts:40`：schema 3/4 磁盘库重开后的 scope 查询存在相同计划问题。

两者均在 `/provider_records_irregular/` 断言处失败，计划出现 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。没有放宽断言或跳过。独立诊断也观察到 JSON 求值随无关数据增长，不能只称为索引名称变化。生产 SQL 修复仍未包含在测试分支。

## 执行完整性与边界

- 900 秒、200 MiB 外层界限均未触发，日志完整 260276 字节。
- 日志 SHA-256：`0546d7f9b2ce0a78bd37127bf9ffef572b359383fa99dc215b508da119476530`。
- 全部 1289 个 tracked 文件逐一验证前后哈希相同，包括 502 个生产/配置/锁文件、134 个冻结资料、362 个测试相关文件和 304 个文档；分类重叠，不相加。
- 汇总哈希前后均为 `fe35438c3ff967329db63216d4ecc8665778f8eba49db8ede0db0535db4ef20e`。
- 这不是全平台或真实浏览器通过证明；既有 Windows、浏览器和缺少打包产物条件跳过仍保留。没有真实商家写入或真实模型任务评测。

后续提交若追加用例，其专项结果需单独记录，不能把此结果当成后续输入的完整回归。
