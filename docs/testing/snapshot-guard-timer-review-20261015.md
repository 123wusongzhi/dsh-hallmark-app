# 独立复核：snapshot review 防挂 timer 清理

结论：PASS，可接受候选 `26a24af5d898f8706be7853567db50d54eee84db`。仅修改现有测试文件 3 行新增、2 行删除；未推送、未发布 issue。本次未跑 full suite。

## 身份与边界

- 公开基线：`c877e501a590035caeb0c58f48579f1b3975950e`
- 仓库：`123wusongzhi/dsh-hallmark-app`；分支：`test/cross-module-regression-20261015`
- 独立 detached tree 从该公开基线建立；没有复用作者的运行结果或计时样本
- Linux，Node 22.18.0 与 24.19.0；复用已安装锁定依赖目录，只读使用
- 已读 CONTEXT.md、README 开发要求、真实数据说明和回归入口说明；没有适用 AGENTS.md
- 作者确认停止全部基准和重型命令后，本次才顺序执行全部计时与验证；未并行跑测试、构建或类型检查
- 自建候选的 SHA-256 `8067787f546b951e1aca6f5a7106f879f91e87deab582c556db534eac3737429`，与作者冻结提交中的文件逐字一致

## 补丁审阅

原 `Promise.race` 胜出后，500 ms referenced timeout 仍存活。候选仅保存原 timer handle，并在原 `finally` 最前清理。

原测试名、case 数、status 断言与顺序保留；原 500 ms、防挂错误消息、timer ref 状态、review gate release、await write、Runtime dispose、store.close 都保留。没有新增测试常驻负担，也没有改生产等待、用 unref 或强制退出掩盖挂起。已触发 timeout 的 clear 是安全清理；立即读取失败仍走原 AssertionError。

## 独立 whole-file 计时

无 observer，运行完整原测试文件；包含 Node 启动/进程回收。每个 Node 各三组交替顺序 B/C、C/B、B/C，全部自然 exit 0，1 pass、0 fail/skip/cancel。以下只是本次独立样本，不与作者样本合并，不外推为 full-suite 提速。

| Node | baseline 三次 ms | candidate 三次 ms | baseline 中位 ms | candidate 中位 ms | 中位差 ms |
|---|---|---|---:|---:|---:|
| 22 | 674.2, 689.9, 676.7 | 188.1, 194.6, 175.4 | 676.7 | 188.1 | 488.6 |
| 24 | 716.0, 728.0, 719.7 | 213.5, 223.9, 228.2 | 719.7 | 223.9 | 495.9 |

## 实际行为与负控

下列 observer 仅存在于独立复现运行，不进入候选。记录 public active resources、原 guard handle 的 hasRef() 和 delay、真实 provider.dispose、gate 后 submit 完成、provider stopped 及 SQLite 关闭后实际查询拒绝。

| 场景 | Node 22 baseline/candidate cleanup ms | Node 24 baseline/candidate cleanup ms | 预期与实际 |
|---|---:|---:|---|
| 正常读 | 6.0 / 6.3 | 7.1 / 8.6 | 两版通过；baseline遗留1 Timeout，candidate为0 |
| 真实provider延迟120ms | 128.5 / 127.4 | 128.1 / 128.7 | 两版等待依赖后通过；baseline遗留1 Timeout，candidate为0 |
| 实际连接锁负控 | 509.3 / 509.5 | 508.0 / 509.8 | 两版约500ms以原 snapshot waited on external review 失败；均0 Timeout |
| 立即provider读取错误 | 7.1 / 9.0 | 9.0 / 7.7 | 两版原 ERR_ASSERTION，actual unavailable / expected ok；error envelope保留注入原因 |

- 真实锁负控：临时把生产 Runtime 真实 admission 分支 `independentRead` 设为 false，使读取排在持有连接锁的 gated submit 之后。没有替换 Promise/断言制造失败。两版仍在原 500 ms 边界失败；finally 释放 gate 后在途工作完成，provider 停止，数据库关闭。
- 立即读错：Runtime 正常转换为 `unavailable`，envelope `error.message` 仍为注入的 `INDEPENDENT_READ_FAILURE`；原成功断言自然失败。candidate 清除 guard；没有吞错或换成 timeout 错误。
- 资源 oracle：baseline 在原业务成功断言之后因残留 Timeout 明确失败；candidate 通过。
- 明确删除 clear 的负控：从 candidate 只移除 `clearTimeout(timer);`，保留其 timer 声明和赋值；双 Node 均以 `INDEPENDENT_GUARD_TIMEOUT_RETAINED` 失败，读取仍为 ok，残留1 Timeout。不是把 baseline 当作该独立负控的替代。
- 所有 observer 场景均确认原 guard 为 referenced、delay=500；所有 review 都释放、submit 完成、provider.dispose 执行且状态 stopped、SQLite 实际关闭。除了已确认的旧 guard 外，没有其它残留资源（仅PipeWrap）。锁失败场景两版都没有 Timeout。
- 无跳过、取消、post-test async error、watchdog 触发、unref、force-exit 或手动杀进程；负控全部自然 exit 1。脚本 watchdog 只使验证失败，不把超时当成功。

## 按源版本和 Node 分别验证

相关文件：snapshot-during-review、runtime、connection-config、http，均位于 test/apps-runtime。

| Source | Node | prepare | audit | related | tsc |
|---|---|---|---|---|---|
| baseline | 22.18.0 | exit 0 | PASS / exit 0 | 33 pass / 0 fail, skip, cancel | exit 0 |
| baseline | 24.19.0 | exit 0 | PASS / exit 0 | 33 pass / 0 fail, skip, cancel | exit 0 |
| candidate | 22.18.0 | exit 0 | PASS / exit 0 | 33 pass / 0 fail, skip, cancel | exit 0 |
| candidate | 24.19.0 | exit 0 | PASS / exit 0 | 33 pass / 0 fail, skip, cancel | exit 0 |

先离线 prepare 再 audit/related/tsc，没有把缺失 generated browser-data 的检查跳过。audit 审计公开冻结资料，未重新采集、未访问真实业务平台。

## 恢复与交付

下列文件名为本地证据索引，未随报告发布；自足复现材料见[问题 #69](https://github.com/123wusongzhi/dsh-hallmark-app/issues/69)。

`finally` 已恢复两个暂改文件原字节，1350 个 tracked 输入前后 SHA-256 全一致，包括272个 packages 文件和公开冻结资料。独立 tree 最终 git status 完全干净。未修改 production、case分类、锁文件或 npm入口；没有提交新增测试。

- `candidate.patch`：完整 git patch，SHA-256 dd3a0e52bb15bbb4392ad97a54606701dd44b3700a120b18e36419f7125a0420
- `reproduce.py`：从公开基线自己生成候选并实际完整跑通的独立脚本，参数、输出、恢复和负控都在脚本内，不依赖作者归档
- `ISSUE.md`：可直接发布的自足说明，内嵌上述完整 patch 和已跑通脚本
- `run/results.json`、每次命令日志、`run/timings.json`、`run/hashes-before.json`、`run/hashes-after.json`、`run/restoration.json`、`run/SUCCESS`：完整本次独立证据

范围有限：只证明该测试资源清理和所列相关回归，不声称 full suite、build、浏览器、线上业务或整体性能均已验收。
