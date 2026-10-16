# 定时检查：测试 Issue #50

Automation 20 完成 #49 后复查发现 [#50](https://github.com/123wusongzhi/dsh-hallmark-app/issues/50)，实际 created_at 为 UTC 2026-10-15 17:16:11（北京时间 10 月 16 日 01:16:11），晚于限定的 15:02:44。完整正文与评论已读，无评论。独立验证基线为原分支 `deaa494d111ad4afeece14c1540c7d5ca4839339`，Windows / Node 24.12.0，不导入对方基线提交或其他分支历史。

建议有实际价值：SKU 列头与行值脱节会让图片引用和包装字段对应错误；现有规范化深比未贯通最终列式输出。当前生产实现正确，本批只补测试。

新增 `test/apps-host/collection-column-fidelity.test.ts` 使用第 4 份未改动、hash 校验的冻结详情中原有三个 SKU，独立由原始 properties 与图片 URL 构造预期，并核对 SKU 专属包装与 sourceSellingPrice 缺失条件。真实 HallmarkClient→CollectionService→HallmarkProvider→Runtime HTTP→注册 Host 工具→模型 JSON，按实际声明列名重建单元格；再用正式 collection.resource.read 的 images 元数据将 imageRef 解析回原图。逐 SKU 深比属性、图片及显式 null 的 package/sourceDisplayPrice，不调用生产 normalize/列转换函数生成 oracle，不下载图片。

| 独立对照 | 结果 |
| --- | --- |
| 原实现，12 个完整旧文件 | 145/145，零跳过/取消 |
| 原实现，新测试 | 1/1 |
| 只将 CollectionService.project 行尾 imageRef/package 值互换，列头保持 | 旧仍 145/145；新 0/1，准确发现 imageRef 为 null 而非图片引用字符串 |
| 原字节恢复，旧+新 | 146/146，零跳过/取消 |
| 仓库外 cwd 使用绝对测试路径、主区新增测试 | 均 1/1 |
| 两处 TypeScript noEmit | 均通过 |

这三条记录来自 taobao_tmall，两个 SKU 合法共用图片；测试不要求三个独立 asset，不限制完整 skuIds/无关 metadata。使用 read 本次返回的 revision 续读，不冻结版本/hash。主区用户的 filterRelatedProducts 对非 alibaba_com 不改变输入，images 分支也只读元数据；collection-4 对 revision 的合法变化不影响预期。只读兼容复核及实际主区新测通过，无需修改用户实现。

测试有 30 秒总期限、5 秒局部界限、取消传播、安全本机端口有界重试与构造前登记的清理。核对两次显式能力读取、一次原始详情读取、零业务 operation，前后深比冻结资料未变。没有人为扩大响应制造 spill，也不冒充大结果续读测试。

登记 recorded。独立数据审计 PASS：307 测试文件、162 recorded 条目、160 infrastructure 条目（含 helper）；主区审计仍 FAIL：用户未提交的 purchase-cost.test.ts、related-products.test.ts 未分类，本批文件已分类。合并前 42 个既有修改/新增文件 SHA-256 全部保持，scope 单独合并保留用户条目。

唯一临时变异在独立树 `packages/collection/src/index.ts`，已 finally 恢复原 Buffer 并核对 SHA，生产 diff 为空；恢复证据见 `artifacts/issue-review-automation20-20261015T1720/agent-column-fidelity/restoration.json`。最终仅提交新测试、分类、报告，#41 永久修复保留，没有修改旧断言、skip、生产校验或冻结数据。

本批未重跑全仓，不宣称全仓全绿；此前主区 Host 精确清单冲突和构建/打包限制未在本批消除。全部本地证据在 `artifacts/issue-review-automation20-20261015T1720/`。仅冻结资料与本地 HTTP，无商家写入、图片下载、浏览器、桌面安装或发布；未跨 Node 版本实机验证。
