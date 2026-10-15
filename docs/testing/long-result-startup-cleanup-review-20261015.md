# Host 握手失败清理独立复核

结论：通过，未发现阻止接受该最小测试修复的问题。

- 公开基线：`711c01066dd20eb9f2712a6bc5cef55d4292f858`；作者候选：`a7e98750574e8c2100a4f2bbc0feed109c571094`。
- 本次新建隔离树：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015`。
- 冻结复现脚本 SHA-256：`20412a3c012c6e3720df5e3ee4cd8a316cb8cbb2aecaad6ce0ef7035f9c303f5`。
- 双 Node（22.18.0 / 24.19.0）各 6 场景实跑；同一真实协议 mutant。旧版 HTTP/Store 留活、dispose0；候选 HTTP/Store 关闭、dispose1；删除 HTTP close 独立负控准确暴露 HTTP 留活。
- 旧/负控的 observer 只在 after-tests 留活状态已写出后善后；新候选禁止 observer 善后。
- 新候选另有完全无 preload、无 test-timeout / Python timeout / shell timeout 的普通运行：均自然 exit1、0 cancelled，0.431s / 0.359s，原 `INCOMPATIBLE_PROTOCOL` 保留。
- 双 Node 13 文件各 40/40、0 fail/skip/cancel；数据审计与 tsc 均 exit0。只代表专项，未执行全仓 npm test。
- 独立 AST：23 assert 文字/顺序、2 case 标题全同；最小 patch 仅移动启动语句。
- 1349 tracked 输入候选 hash 集合与作者完全一致：`04c43e87cb7d17f88d81549fc4002fd997b31aea55e4f688fa555b0dfb88e580`。最终全部恢复基线，git diff 空；生产无持久改动。
- 复用已有 node_modules，没有 fresh install、push、issue 发布、部署或业务写入。

## 需保持准确的历史表述

最早 20 秒外层终止的旧版历史探针有只观察 preload，并非完全无 hook。已有 observe.mjs 与 JSONL 证实监听/Store 留活、dispose0；该尝试不算自然结束或本轮合格运行。本轮真正完全无 observer/timeout 的自然退出证据对应新候选。作者报告现有“不介入清理的旧版探针”措辞正确。

## 证据与交付

下列绝对路径仅标识本地归档证据，未随报告发布，也不是公开下载入口。完整可复现脚本见[问题 #68](https://github.com/123wusongzhi/dsh-hallmark-app/issues/68)。

- 自足中文 issue 草稿（含完整最小 patch、四份完整脚本、复现步骤与边界）：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/issue-body.md`
- 最小 patch：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/candidate.patch`
- 独立 12 次复现原始 TAP/JSONL/命令/输入 SHA：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015/artifacts/long-result-cleanup-nwfr23yz`
- 对照摘要：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015/artifacts/long-result-cleanup-nwfr23yz/summary.json`
- 正常回归：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/normal-verification/summary.json` 和同目录六份日志。
- 全tracked恢复：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/restoration.json`、`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/regression-restoration.json`。
- AST检查：`/workspace/scratch/69ac72838cc8/dsh-handshake-cleanup-independent-review-20261015-evidence/ast-check.json`。

修复范围只覆盖已证实的 Host.start 真实握手失败窗口，attachApp 静态纳入同一 finally；不推及更早构造/listen 失败或 cleanup 自身抛错/Provider 永不完成。#52 对应另一份 result-read-error-parity 测试，与本次不是同文件重复修复。
