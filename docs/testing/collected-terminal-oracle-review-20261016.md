# 独立复核结果：通过

基线 268a842bf404356c9f80e0a97b4051696ed83959。作者候选经复核调整为并发安全的 calls multiset oracle 后，最终补丁和最终脚本先冻结，再在独立新 worktree 顺序运行 Node 22.18.0 / 24.19.0。

- 双 Node 四态均为 363绿 → 363假绿 → 362绿+1准确红 → 恢复363绿；八次运行 skip/cancel/todo 全为0；audit、tsc 均exit0。
- 同一 mutant SHA256 70d9e6be566699afb11c1f958554b79241e8afed3b17343508b75c62dc87ad8d。唯一红为既有 collected key/page case，ERR_ASSERTION 清楚显示终页错误 cursor100/101。
- 实际 source seam 为完整三条数组，total3。legacy 正常终页 cursor 省略/undefined；现代 collection 的 nullable total/nextCursor:null 不适用。补丁保留中间页精确 '1'，所有原断言、原fixture、6调用和测试总数不变。
- 真实 WorkbenchLibrary.preview + provider catalog + AppCore 通过内存传输串接，双 Node 原/突变/恢复均实跑：默认页1→2读、offset1尾页1→2读、limit1全遍历3→4读；新增的一次均为空页。UI onPage 对 cursor 的使用另经源码核对，未声称执行浏览器或生产Provider/HTTP整链。
- 全部1370个tracked文件逐Git blob核对，只有 test/core/collected-snapshot.test.ts 不同；所有生产恢复，staged为空，diff --check通过。最终补丁 2963041c5fbb1aa4f2e4acc87cefe2e703e87e1bb46c8fb578a57417255445f6 仅将作者新增 calls 顺序断言调整为不改变原数组的 sorted multiset；其他候选内容不变。
- 消费者harness初次预检的起始cursor被正常默认刷新清除，最终改用公开bindingId/cursor后冻结重跑；失败日志保留，不计入候选四态。

以下为本地证据索引，未随报告发布；完整自足复现见[问题 #75](https://github.com/123wusongzhi/dsh-hallmark-app/issues/75)。

可发布文件：issue.zh-CN.md（完整中文issue、完整补丁、冻结四态脚本、两个消费者脚本）。
证据：final-dual-node-controls/results.json、manifest.json、全部TAP/log；final-consumer-controls/；review-final-checks.json、all-tracked-sha256.json。未发布issue、未push、未真实业务接口调用。

归档说明：只移除了第一版复核临时worktree中的可由公开base+已保存patch重建的隔离源码和离线生成数据。第一版全部TAP/log、manifest、补丁、脚本及逐文件哈希完整保留；Git对象和安装依赖未删除。最终版本所有result均位于final-*目录并绑定新patch，未借用旧版通过。
最终测试Git blob已写入共享对象库：ca9d1e78aa7972432b60f314390deebda9fd52cc。当前唯一工作树保留候选测试，其余tracked与base一致。
本复核未对外操作；由父任务更新已有#75，不新建issue。
