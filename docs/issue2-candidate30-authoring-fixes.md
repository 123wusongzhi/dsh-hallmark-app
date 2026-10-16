# candidate.30：减少创作检查返工

2026-10-08。基于“商品利润率分页组件（2）”轨迹和 candidate.27 R0 报告实施。保留共享工作区的模板保存修复及“暂不开放附加到聊天”产品决定。

## 已完成

- checkRunner 支持 prepare 请求：从明确 attemptId 的 inspect 一次取得 epoch、sourceRevision、viewId、workspacePath，输出 evidenceRoot 中的完整请求。入口通过 Host guidanceVersion 4 的 prepareRequest 发现，同一 Windows launcher 执行准备和正式检查。
- 商品 starter 输出 `.preview/plan.json`，check 支持 planPath；旧内联计划兼容。计划不再计入源码指纹，旧工作区不自动迁移。已有成功预览改计划仍按原生命周期要求新 attempt，但不再误报源码变动。
- 有效构建 FAIL、预览 FAIL/INCOMPLETE 自动登记。同请求恢复原报告，包括失败报告和丢失登记响应；修改失败构建的源码需新 attempt。构建失败不继续预览，失败预览不发布。
- 正式计划支持 fill.valueFromSelector，从当前可见商品读取搜索词，然后清空搜索、翻页、返回、刷新。模板没有附加按钮或为附加服务的勾选。
- requiredMethods 按 420/1040 视口分别统计并写入该视口断言，不能由另一视口的成功调用抵消。
- SDK refresh 的成功、错误和 loading 清理均受当前请求序号约束，旧刷新不覆盖新页；分页保留 partial 错误，并与首屏保持 fresh/stale/unknown 语义一致。
- 同步更新开发者入口索引、检查流程、商品 README、设计技能、Host 指引和生成器。打包仍使用原有构建脚本，不增加服务、自动 Agent 循环或第二套回执。

## 验证

- `npm run typecheck`、`git diff --check` 通过。
- authoring 全组、分页、实际 SDK Hook 乱序、商品模板、保存模板、原生自动展示与指引共 **95 项测试通过，无跳过**。日志：artifacts/candidate30-tests.log。
- 使用真实隔离 Chromium 验证按视口覆盖、动态搜索、单计划、失败登记及恢复；使用打包后的 PowerShell launcher 验证 prepare→check→重复恢复。未使用 Computer Use。
- `node scripts/verify-apps-sdk.mjs` 通过：解包 SDK JS/类型、普通与商品 starter 构建、脱离仓库的实际 CLI。日志：artifacts/candidate30-package-verification.log。
- 包：artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.30.tgz。
- SHA256：a72e2e4ea0ed1df07ebd108d33a53efab0d82db2a97746c8348bc4d402bb83c7。

## 边界

尚未安装到 DSH、未修改已发布组件、未提交推送。真实 Agent 总耗时改善需安装后观察同类新会话，不能用测试通过代替实测。旧内联计划仍可用，旧源码根目录中的验证 JSON 不自动忽略，应按新入口迁移；不可变历史回执不改写。报告之外的严格 status 筛选、包管理器策略统一不在本轮代码范围内。
