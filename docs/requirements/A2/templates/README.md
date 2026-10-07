# 模板的使用与验证边界

这些文件是A.2拟新增契约的结构参考，不是已经实现的SDK、迁移器或验收执行器。

`build-receipt.schema.json`约束构建回执字段；实现方还必须检查真实命令退出码、输入前后哈希、dist与冻结归档的字节、日志文件是否真实存在，并验证各身份一致。JSON结构合法不等于源码确实产生了该dist。

`preview-receipt.schema.json`约束预览回执字段。PASS必须同时符合SPEC：匹配实际冻结build、必要视口及断言、真实截图与sha、运行/网络/bridge错误判定、正确mode与runner身份。报告中的例外必须显式记录原因；不得把fixture或人工原型截图标为原Agent真实视觉消费。跨字段与磁盘证据检查须由实际实现补充，不能只调用JSON Schema validator就放行。

`acceptance-result.json`为尚未执行的结果模板，保持NOT_RUN。执行后为每次run/test/scope建立独立记录，填写实际commit、版本、输入、断言与证据。不能复制历史candidate.5的结果改名为candidate.6，也不能把LOCAL_MODEL改标LIVE_MODEL。

`release-gates.md`区分CORE、AUTHORING、BUSINESS-WRITE和DATA-CUTOVER。某一范围通过不能自动签另外三张放行单；用户承诺的整体范围仍必须全部满足。`change-request.md`用于新增状态、协议、迁移与语义变化的批准记录。
