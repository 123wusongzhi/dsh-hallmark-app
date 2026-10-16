# I2-01：当前基线与实际问题定位

日期：2026-10-08。参考 DSH_Issue2_Prioritized_Solution.md R0；本次只执行第一项。

## 基线差异与已做部分

参考文档基线为 candidate.22 / 18e2682；当前安装为 candidate.24。
仓库 HEAD 为 a51b3b995971b2f7589ea0faffebb749f1d95c55，另有尚未提交的 candidate.24 修复。
部署身份以 candidate.24 的 package/build manifest 为准，不能把 HEAD 当作部署源码的完整身份。

已完成且本次跳过：binding.query 与精确版本、SDK 调用助手、正式 live_readonly 预览、真实选择验证、去除强制修改重建指引、结果样本与读取器、自动回执登记、预览摘要、商品 fields。
本次未重做这些修复，也未新增分页协议或放宽选择验证。

## 现场只读记录

2026-10-08 12:42（北京时间）通过运行中的 Runtime HTTP 接口读取：

- Runtime：1.0.0-candidate.24，schema 4。
- 安装 SDK：1.0.0-candidate.24；这不证明旧归档组件重新构建过。
- Host 内存版本：未独立核实，不能以安装目录版本代替。
- 会话：session-abbe0cd1-4888-4b06-8d55-99e2f6e435d8。
- viewId：2abf5929-50af-4f67-8421-3c4a1e96bd76。
- activeBuildId：0ac3cfdc0aecfcfd7d84b8d7c8332813882bdbb469b30820339686bbe765f10a。
- inspect 最近保存的 display 为 ready，但其 readyAt 早于本次升级，不能据此宣称新版完整桌面验收通过。
- getData 包含 query，能力 hallmark.products.list@1.0.0，初始 limit=60。
- payload 的字段为 cursor/products/stores/total，商品 60 条，total=338，cursor="60"。
- resources 60 条，revision="32"，state=ready。
- 该能力的 cursor 为下一批偏移；组件将结果预先加载后每 20 条做本地展示分页。因此一次下一页不必产生新 Runtime 查询。

证据在 artifacts/issue2-i2-01：baseline.json、getData.redacted.json、capability.json、regression.log。
去敏样例仅替换字符串值；对象键、数组长度、原始类型与 null 均逐项校对一致，没有补造字段。数值保留以便核对分页与单位语义。

## 用户验证与结论修正

用户回复：“没有问题是成功的最大的问题就是agent一直再反复做才成功”。

据此记录：用户本次下一页、选择和附加操作成功，不再要求重复相同操作，不宣称现场存在已复现的分页失败。
本次没有逐一关联点击、frame 请求及 invocation，也没有核对所选商品是否超过首批 60 条。因此不将这一成功扩大为“任意后续页附加均通过”。

当前组件归档源码仍对无 ResourceRef 的后续加载行显示不可附加提示。这是已知实现边界，与用户本次操作成功不矛盾；本次不将它提升为当前首要问题。

## 当前优先问题：达到成功前反复操作

此前两条会话收到的 Host 创作指引（归一化 sessionId 后）及设计技能内容分别完全相同，但推进路径不同：

- 两者都因大结果只有引用而再次缩小查询、搜索结果读取入口。
- DeepSeek 会话移植旧工程，查内部源码和数据库，手工搬运回执，编写预览包装脚本，并发生参数和路径错误。
- Astra 会话使用 binding.query，推进较直接，但额外设计流程和问答增加等待；旧助手和过大分页仍带来风险。
- 上述已定位的机械操作缺口已在 candidate.24 修复。旧会话在升级前的重复不能作为 candidate.24 仍有同样问题的证据。

下一轮有效验证应观察一次 candidate.24 新会话创作：是否使用结果样本/读取器、autoRecord、生成的 previewRequestPath、summaryPath 和 fields；是否只对具体失败修改源码。记录重复行为的触发错误，不预设需要更多校验或新框架。

## 本项交付范围

复用了已有生产转换回归及真实 Runtime 预览回归，13 项通过，包括 query 可用/不可用、真实 getData 结构、首批选择成功及未归属资源被拒绝。没有为旧问题重复新增测试。

I2-01 当前基线整理及用户本次操作反馈已记录；原计划要求的完整逐点击因果证据未声称完成。根据用户反馈，本次没有额外修改业务行为、重新部署或开展 I2-02/03。


## 现场纠正与本次最小修复（2026-10-08）

用户补充：第 4 页以后无法附加。前 60 件有绑定资源引用，组件每页展示 20 件；后续 invokeCapability 结果只有展示数据，没有进入绑定快照。这不是一次成功的下一页验证能覆盖的边界。

candidate.25 增加 bindingPagesV1 / useApps.readBindingPage(bindingId,cursor)。分页沿用绑定路由、查询条件及页大小，当前页数据和资源引用在同一个 iframe 范围内一起更新；独立窗口、初始绑定和保存内容不受影响。旧响应和已退出 frame 的请求不再提交为当前页。预览复用同一路径，视口重载重置其独立分页状态。

当前商品组件工作区已改为每页 20 件的绑定分页，取消全店预取，翻页清空勾选。搜索、筛选、排序和统计针对当前页，界面明确显示此范围。源码备份在 artifacts/issue2-page-fix/original；尚未发布到原会话，不应宣称 DSH 桌面已完成验收。

实测：通过现有 Runtime 只读读取真实商品，使用新版独立预览服务，在 420/1040 两个宽度点击到第 4 页，勾选附加；再到第 17 页（18 件）勾选附加，两种宽度全部 PASS。预览只验证附件，不写聊天输入框。结果：artifacts/issue2-page-fix/component-preview-result.json。


2026-10-08 更新：candidate.25 已安装，修复组件已发布；用户确认“没问题了”。确认范围为后续页附加恢复正常，不扩大为 Agent 已消费附件的完整 C5 验收。下一项执行 I2-06。
