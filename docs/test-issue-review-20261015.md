# 测试 issue 复现与改进（2026-10-15）

审阅范围为 [dsh-hallmark-app](https://github.com/123wusongzhi/dsh-hallmark-app) 当前开放的测试相关 issue #15–#28，正文及评论均已读取（这些 issue 当前均无评论）。复现基线为 `0c2de5cf57667b49ae6a6b20e46ed6350f6da168`，Windows、Node 24.12.0、现有锁定依赖。所有验证使用仓库内脱敏冻结快照和本地隔离服务；没有重新采集、商家写入、桌面安装或远端 issue 状态变更。

## 判断与改动

| Issue | 实际复现 / 原覆盖 | 采用的项目内改进 | 对比结果 |
| --- | --- | --- | --- |
| [#15](https://github.com/123wusongzhi/dsh-hallmark-app/issues/15) 键盘假绿 | 禁用真实键盘处理器，旧测试仍 5/5 | 渲染真实 dock 与 reducer，验证动作、选择、tabIndex、焦点边界、环绕、增删与固定标签保护；保留架构检查 | 新测试准确失败，恢复后 6/6 |
| [#16](https://github.com/123wusongzhi/dsh-hallmark-app/issues/16) 深层漏跑 | Git POSIX sh 的旧入口只执行 1/3，深层故障仍退出 0 | 给既有 glob 加引号，由 Node 发现文件；保留范围和串行 | 执行 3/3 并检出预置故障；Windows cmd 前后都执行 3/3 |
| [#17](https://github.com/123wusongzhi/dsh-hallmark-app/issues/17) 数据分类漏检 | 旧审计 PASS，但 adapter 用冻结销售记录却列为 infrastructure | 在现有循环补反向依赖检查并重分类；没有搬入六文件框架或扩展通用审计 | 负对照只报告该误分类；恢复正确分类后 PASS |
| [#18](https://github.com/123wusongzhi/dsh-hallmark-app/issues/18) 链接清理误报 | Windows 原 23/23；WSL Linux 实际 symlink 上 rmdir 报非目录 | 四处清理链接改 unlinkSync，清理真实目录的 rmdirSync 保留 | Windows 仍 23/23；Linux 语义对照 unlink 后目标保留。没有执行完整 Linux Node 套件 |
| [#19](https://github.com/123wusongzhi/dsh-hallmark-app/issues/19) 规范路径依赖 | 原用例在开发目录可碰巧通过，换至仓库外 cwd 即 ENOENT | 按 import.meta.url 读取仓库内 A.2 规范，独立 oracle 不取生产 schema | 仓库内外均 3/3；规范 SHA-256 与版本清单一致 |
| [#20](https://github.com/123wusongzhi/dsh-hallmark-app/issues/20) 图片清单依赖 | 清洁工作树 source-flow 与 generated-performance 均 ENOENT | 统一使用 realCorpus().imageAssets；同时修同根独立图片浏览器 runner，支持 DSH_REAL_CORPUS 的目录 | source-flow 通过；正式双视口模板门禁通过；独立 Chrome 图片脚本 PASS，首屏未请求隐藏标签图片，前六张网络优先级 High |
| [#21](https://github.com/123wusongzhi/dsh-hallmark-app/issues/21) 版本域自比较 | 清洁工作树缺 ignored Client 产物，0/1 | 临时目录复制限定源码目录内当前未被忽略的输入，调用原构建两次；核对两份 manifest、实际版本与五项产物哈希；隔离 npm cache、关闭更新检查 | 独立对照 1/1，约 12.24 秒；临时 Runtime 标记负对照准确失败；又修复原建议漏掉尚未加入 Git 的新模块的问题 |
| [#22](https://github.com/123wusongzhi/dsh-hallmark-app/issues/22) 时区误报 | UTC 通过，洛杉矶失败 | 测试 UTC、洛杉矶、上海各自独立日期/时间预期，保留源 ISO；finally 恢复 TZ | 三种启动时区各 9/9；产品继续按宿主本地时区显示 |
| [#23](https://github.com/123wusongzhi/dsh-hallmark-app/issues/23) outbox 竞态 | 自然基线 3/3；延迟失败 HTTP 回应可确定复现过早断言 | 使用受控回应放行，等真实 notice 渲染再触发重投；没有增加固定 sleep | 连续 5 次通过；删除生产 notice 的变异被检出 |
| [#24](https://github.com/123wusongzhi/dsh-hallmark-app/issues/24) 目录/导航假绿 | 预选、隐藏 rail、导航 return 三种故障，原静态断言均绿 | 三个真实 React 场景检查初始未选、无 hidden 祖先、准确一次 native openTab；保留静态架构约束 | 每个变异都只使对应子场景失败；恢复 3/3 |
| [#25](https://github.com/123wusongzhi/dsh-hallmark-app/issues/25) SDK 转发缺口 | 丢 options 或只丢 signal，旧邻近各 52/52 | 执行刚生成的 wrapper，检查身份、幂等键、期望 revision 与取消前不派发 | 两种变异均失败，恢复通过 |
| [#26](https://github.com/123wusongzhi/dsh-hallmark-app/issues/26) 复用 SKU 范围 | 提示去掉 skuIds，旧邻近 33/33 | 取冻结样本的单 SKU，原样执行真实 provider 返回的复用 hint | 变异返回多 SKU 被检出，恢复通过 |
| [#27](https://github.com/123wusongzhi/dsh-hallmark-app/issues/27) payload 续页 | 丢 continuation.view，旧邻近 67/67 | 从真实 Runtime/provider/model projection 输出原样执行每个 continuation，对原始输入字段做独立比较 | 第二页丢 payload 被检出，恢复通过 |
| [#28](https://github.com/123wusongzhi/dsh-hallmark-app/issues/28) 长描述续读 | 丢 prepare 输出 cursor，旧邻近 129/129 | 从 prepare 实际预览和 cursor 续读，和冻结原文逐字比较，并检查预算、revision、终止与读取次数 | 1,500/18,958 字符的截断被检出，恢复通过 |

这些建议保护现有用户路径或测试可复现性，不要求产品新增开关、审核步骤或收紧兼容协议。#25–#28 是覆盖补强，生产实现原本正确；所有临时生产变异均恢复原字节，本轮没有新增生产目录或冻结数据差异。#21 的默认测试约多花 12 秒，这是实际双构建的成本，不宣称测试提速。

## 验证边界

- 业务新增四测与去重邻近测试：233/233；五个隔离变异均旧绿、新红、恢复绿。
- UI 五文件合跑：39/39；五种生产变异被检出。React 事件 props 和焦点 stub 不能替代真实浏览器的事件、CSS、焦点与命中测试。
- 路径/链接/source-flow 组合：27/27；分类负对照和恢复通过；TypeScript 检查通过。
- 构建独立对照及 Runtime 泄漏负对照均符合预期。没有独立抓包证明任意 npm 版本都严格零外网。
- Node 22.18 的 API/文档兼容性已核对，未实际运行该版本；未运行完整 Linux/macOS、桌面宿主安装和真实商家流程。

## 完整对比

两轮均从同一基线的独立工作树出发，使用相同 Node、冻结数据、根依赖和串行入口；先执行数据审计，再直接执行 `node --test --test-reporter=tap --test-concurrency=1 "test/**/*.test.ts"`。审计均通过。

| 指标 | 原版 | 改进版 |
| --- | ---: | ---: |
| 测试数 | 2,229 | 2,235 |
| 通过 | 2,196 | 2,206 |
| 失败 | 31 | 27 |
| 跳过 | 2 | 2 |
| 实测耗时 | 412.906 秒 | 435.422 秒 |

没有新增失败；剩余 27 个失败名称完全相同，两个跳过项也相同。确定消除的是两处图片清单 ENOENT 和版本测试缺产物，共三项。另一个原版独有失败是 `preview transfers bind every chunk...` 的首次回环请求 `fetch failed`，改进版通过但相关路径未改，原因未取证，不能归入修复收益。

新增六个顶层测试通过。业务与 UI 变异对照证明覆盖提升，不能把通过数的变化直接当作业务覆盖率。总耗时上升包含实际双构建、更多断言及浏览器运行波动；未做严格计时实验，不能把两轮差额当作稳定性能损失或承诺。

完整套件仍未全绿，保留以下既有问题：

- `test/adapter/ordinary-price-contract.test.ts` 的 22 项及 `test/adapter/ozon-store-read.test.ts` 的 1 项：测试对公开脱敏的 `productId="test-reference-2"` 调用 Number，得到 NaN，与生产要求的正安全整数协议不兼容，业务请求因此在输入校验处停止。应另行设计明确的本地数值身份控制，不能放宽生产校验或改写冻结记录来过测。
- `test/authoring/http.test.ts` 的 1 项：依赖尚未在 checkout 构建的 `bundles/apps/sdk/component-runtime/package.json`。版本用例在临时目录双构建，不会制造共享 SDK 产物掩盖这一前提。
- `test/source-preview/commerce-image-loading.test.ts`、`formatter-sharing-compatibility.test.ts`、`selection-interaction.test.ts` 各 1 项：组件子项目声明的 lucide、Radix、CVA、clsx、tailwind-merge 等依赖尚未就绪。此次没有安装子项目依赖或更改它们的断言。

本轮未出现 Issue 旧记录提到的 SQLite 查询计划失败，不将其他环境结果混入此次统计。

主工作区兼容验证另行执行：指定 12 文件 76/76，类型检查、294 文件的数据审计通过；原有未提交的 30 个文件（合并分类清单除外）哈希保持一致。分类合并保留了用户既有六个新增测试的登记。版本测试首次合并复测发现其仅复制已跟踪文件，会漏掉现有模块引用、尚未加入 Git 的 `image-delivery.mjs`；随后改为相同限定输入根下的 `git ls-files --cached --others --exclude-standard`，保留 ignored 文件排除，不要求先 git add。兼容修正后主区真实双构建 1/1、12.044 秒；Runtime 字节不变，Host/Client 及官方 manifest 检查通过。这是根据当前项目实际开发方式对 Issue 建议作出的兼容性修正。

复现命令、stdout/stderr、mutation 恢复哈希与结果保存在本地 `artifacts/issue-review-20261015/`；业务、UI、构建分别位于 `agent-business`、`agent-ui`、`agent-build`。这些本地取证文件不纳入公开 Git，冻结 corpus 字节保持不变。
