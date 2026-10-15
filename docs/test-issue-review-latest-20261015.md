# 新一轮测试 Issue 复现（#29–#32）

2026-10-15，基于原开发分支已发布提交 `e0a40cde0d85b771b16d836143a602aecc2a5d79`，Windows、Node 24.12.0、现有依赖及完整性校验后的公开冻结 corpus。四项正文及评论均已读取，读取时均无评论。上一轮 #15–#28 已推送原开发分支并在 GitHub 标为 completed；完整历史对比见 [上一轮报告](test-issue-review-20261015.md)。

| Issue | 独立复现 | 本项目采用的修复 | 复测与判断 |
| --- | --- | --- | --- |
| [#29](https://github.com/123wusongzhi/dsh-hallmark-app/issues/29) 临时类目错误被缓存 | 仅缓存失败结果的变异下，旧邻近 194/194 仍绿，新测失败 | 新增真实 Runtime/provider/model projection 集成回归；三次相同普通请求均不传 refresh，检查错误→恢复→成功缓存，上游调用 1→2→2；limit:1 实际跟随三页约束 | 当前生产实现正确。恢复后通过；不要求记录的全部必填属性恰好一页，不强迫用户手动 refresh |
| [#30](https://github.com/123wusongzhi/dsh-hallmark-app/issues/30) 首次工作区固定等待 | 只延迟首次目录回应 120ms，原 40ms 等待在标签未渲染时失败 | 复用已有 3 秒有界 waitForUI，等待两个实际标签；保留全部 60 个 assert，不增加固定睡眠 | 同延迟通过，实际目标连续 5/5。持续空目录负控在超时后明确失败，没有吞掉产品故障 |
| [#31](https://github.com/123wusongzhi/dsh-hallmark-app/issues/31) Provider 来源版本转发缺口 | 仅去掉 Provider 回调的变异下，旧邻近 101/101 仍绿，新测因过期引用被接受而失败 | 新增真实 preparation→draft 集成回归；先验证有效引用成功，再只变更本地快照生命周期元数据，验证 LISTING_SOURCE_REVISION_CHANGED 且草稿数不增加 | 当前生产实现正确。恢复后通过；不改写来源事实，不扩大为实时上游刷新保证，无外网或上品操作 |
| [#32](https://github.com/123wusongzhi/dsh-hallmark-app/issues/32) deferred 行被误标完整 | 去掉明确 partial 覆盖，旧 16 文件 76/76 仍绿；增强后准确失败 complete ≠ partial | 在现有 create/revise/submit 的超预算恢复测试补三行断言，验证 partial、零已交付项、无普通 cursor 且存在一条 deferred；原完整恢复链全部保留 | 当前生产实现正确。原字节恢复后相同 16 文件仍 76/76；只保护这一具体边界，不添加新分页协议 |

四项都改善已有用户路径的回归保护或测试稳定性，只修改测试和两个新文件的数据分类，没有新增产品审核步骤、依赖或生产逻辑。所有生产 mutation 已按原字节恢复，生产目录与冻结数据无本轮差异。

## 组合及兼容性验证

- 合并去重 29 文件：**317 tests /317 pass /0 fail /0 skip**，包含四项最新用例和相关 Runtime、provider、结果读取及旧业务测试。
- 主工作区四项：**4/4**，数据审计通过；原有 30 个未提交文件（合并分类清单除外）的 SHA-256 保持不变。
- 独立工作树数据审计：290 个测试文件、154 个 recorded 条目、151 个 infrastructure 条目，PASS；主工作区含用户既有新增测试，审计同样 PASS。
- TypeScript `--noEmit` 和 `git diff --check` 通过。生产 mutation 复原 SHA 与原字节一致。
- 本轮没有重新执行整个仓库或浏览器套件；上一轮完整结果 2,235 项、2,206 通过、27 项既有失败、2 跳过保留，不把本轮 317 项定向通过描述为全仓全绿。未验证 Node 22.18 实机、完整 Linux/macOS、桌面安装或真实商家流程。

本地原始日志、受控回应负例、mutation 恢复哈希及组合命令位于 `artifacts/issue-review-latest-20261015/`；不把这些 ignored 证据或业务状态作为源码提交。新测试使用冻结数据的正常映射和明确本地控制值，未修改 corpus 或放宽生产校验。
