# 定时检查：测试 Issue #51–#54

Automation 20 于北京时间 2026-10-16 02:39 开始本轮。四项实际 created_at 分别为 UTC 2026-10-15 17:40:28、17:54:24、18:11:34、18:17:12，均晚于限定的 15:02:44。完整正文与评论已读，各有一条评论；另一发布分支仅作参考，未导入其提交或统计。独立树、主工作区和远端原分支基线为 `2b9f7a173605a31a3098cb92f881b5bf314eca9c`，Windows / Node 24.12.0。

## 价值与独立对照

| Issue | 项目价值及最小改进 | 正反控制 |
| --- | --- | --- |
| [#51](https://github.com/123wusongzhi/dsh-hallmark-app/issues/51) CSV EOF 负例被列数错误掩盖 | 原负例同时缺引号和十个列，只要求任意异常。改成保持 11 列的合法 CSV，再只删最后闭引号，精确断言 CSV_INVALID；合法正例用独立字面量预期核对身份、13/20 克、时间和空 skipped，不以解析器自身输出作为唯一 oracle | 旧 19/19；删 EOF guard 后仍 19/19，直接输入诊断确认旧例改报 COLUMNS_INVALID、新隔离输入被接受。改进后同变异 18 通过/1 失败，准确 Missing expected exception；原字节恢复 19/19，全部 ozon-business 44/44 |
| [#52](https://github.com/123wusongzhi/dsh-hallmark-app/issues/52) 长 POST 的真实参数错误保真 | 新增真实 Runtime→HTTP→transport→Host→renderer 回归。短 GET、长 Unicode/转义键 POST 指向同一非业务 JSON，实际消费 continuation；schema-valid 但语义无效的 cursor/path 返回真实 400，原始 failed/INVALID_REQUEST/INVALID_PAGE 或 RESULT_PATH_NOT_FOUND/never 必须保留 | 旧 10 文件 85/85；删除非 404/405 rethrow guard 后旧仍 85/85，新 0/1，真实 HTTP 400 已先验证，模型准确报 unavailable ≠ failed；恢复组合 86/86。显式更正请求仍读原 retained 结果，Provider 始终一次 |
| [#53](https://github.com/123wusongzhi/dsh-hallmark-app/issues/53) literal 定位的 cursor 续页 | 在现有文件追加真实 query→spill→HTTP Host continuation 完整遍历，独立 code-point 偏移 65536/65544/65552；逐页核对 scanned.from 等于实际 cursor，完整收集全部命中，再省略 literal 读取原文上下文逐码点比较 | 旧 12 文件 38/38；locator POST 漏 cursor 后旧仍 38/38，追加文件 1 通过/1 失败，仅新例第二页实际 from=0 ≠ 65536；恢复组合 39/39。最终兼容调整后该文件 2/2 |
| [#54](https://github.com/123wusongzhi/dsh-hallmark-app/issues/54) 两条源码拼写误报 | 只删除 client.test.ts 对 role 拼写、下一页文字所在源码的两条检查，并说明职责；其余 110 个断言及字节顺序保留。现有渲染行为测试已验证 tablist、按钮、第二页 11–20 行图片身份和隐藏标签状态 | 原 24/24。等价 JSX role 写法、导入常量两控制，旧各仅静态例失败，原行为各 7/7，新各 24/24。真实 role→group 导致两项原标签行为失败；nextPage no-op、错误标签各让原 table 行为失败。恢复 24/24，相关 plugin-client+行为组 136/136 |

当前生产实现正确，本批没有永久生产修复。#51 保留原无效证据、改列头、复杂 offerId roundtrip 等断言；原组合负例没有独立证明列数校验，因此以单一错误替换并未删除独有的有效列数保护。冻结销售身份与原数值边界保持，Customer name 只是显式 CSV 协议控制，语料未改。

#52 新文件登记 infrastructure，其他三个是已有已分类文件。#52/#53 都只用非业务传输控制，无商品事实。共享 transport.ts 的两次临时变异顺序进行：#52 固定旧集对照及恢复完成后，才允许 #53 修改现有测试和开启另一变异，避免恢复 Buffer 覆盖别人改动或改变前一旧集。

## 兼容性与最终验证

#53 不固化内部 64 KiB 扫描实现：移除“首窗一定空/必须经历空页”的额外失败条件，保留按 done 遍历、非零 cursor、全部精确命中与原文断言。本机最终实际仍经过空非终页（诊断五页），但未来合法增大扫描窗不会因这个实现细节误报；小改仅该文件再测 2/2，不重复变异。

#54 保持测试职责，不主张提速。正常 npm test 包含静态与行为文件，test:apps 包含上述行为文件；自定义只跑 plugin-client 的窄入口不会运行那两项 UI 行为，应明确其范围。没有新增测试跳过或删掉原行为保护。

#52 使用安全本机端口、请求取消、有限期限和分层清理。初始化拒绝、可取消 Provider 控制均自然退出并清理；忽略取消的 Provider 控制明确报告 Runtime dispose 超时，Host/Server/Store 已关闭，不声称任意外部 Provider 可强制终止。补充 cleanup diagnostic 使原错误与清理失败在 TAP 可读，首轮核对工具因 AggregateError 未展开而失败的日志保留。最终仅诊断适配，不改核心错误断言；新测与外 cwd 各 1/1。

- 最终五文件去重组合：独立树和主区均 **46/46，零跳过**；独立树 TypeScript noEmit 通过。
- 主区 TypeScript noEmit 本次仍失败：用户未提交 `test/app-hallmark/listing-asset-recovery.test.ts:118` 的 `() => void` 不符合 CoreStore.put 的泛型返回 T（TS2322）。本批没有编辑该文件或接口。
- 独立数据审计 PASS：308 测试文件、162 recorded 条目、161 infrastructure 条目（含 helper，不能相加作为文件总数）。
- 主区审计仍 FAIL：用户新增 category-search-coverage、listing-category-grouping、listing-coordination、purchase-cost、related-products 五文件未分类。本批新文件已登记，不代改无关用户工作。
- 合并前 76 个既有修改/新增文件 SHA-256 未变；三既有目标测试先与 HEAD 核对无用户编辑，再应用最小 patch；scope 单独合并保留用户条目。

临时 CSV/transport/renderer/table 变异均恢复原 Buffer 并 SHA 核对；临时标签 helper 删除。生产目录无本批 diff，#41 永久修复保留。本批只提交四个测试差异、分类和报告。没有靠 skip、放宽校验或改冻结语料制造通过。

未重复全仓套件，不宣称全仓全绿；此前主区旧 Host 精确清单冲突、SDK/打包限制也未在本批全仓复验消除。本地完整对照与保护清单位于 `artifacts/issue-review-automation20-20261015T1839/`。全部为离线资料/协议与 React renderer/回环 HTTP 验证，没有真实商家写入、浏览器、桌面安装、下载业务数据、发布或性能结论；未跨 Node 版本实机验证。
