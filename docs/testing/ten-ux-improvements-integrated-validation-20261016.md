# 十项交互优化：整合索引与完整验证

优化代码以 `fd95bc22929bfbfa850e0312357322578287a10c` 为起点；本次累计完整测试的本地提交为 `069817a535769add648295f88086132768e39b00`，tree `dc1d83ca4fb241c113356cd27a69a9b264a98627`。本索引在测试结束后补入，公开提交父链可能不同，已测生产代码与测试未改变。

## 十项交付

1. [上品内容直接编辑、未应用 JSON 保护与完整确认（#76）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/76)
2. [批量调价可见范围、币种与整批提交确认（#77）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/77)
3. [字段先选择、后应用、可取消（#78）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/78)
4. [工作台数据任务有界保活与隐藏暂停（#79）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/79)
5. [Agent 准确阶段与回执、上下文身份隔离（#80）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/80)
6. [原身份、原批次修订确认后的未保存草稿恢复（#81）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/81)
7. [未选店铺的明确继续入口和一次性安全返回（#82）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/82)
8. [店铺读取错误/空列表/失效/挂起恢复（#83）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/83)
9. [关联总览无新请求时结束遗留加载（#84）](https://github.com/123wusongzhi/dsh-hallmark-app/issues/84)
10. [经营规则重新读取前的内联放弃确认](../pricing-rules-reload-confirmation-20261016.md)：取消零查询/写入，继续编辑或切换身份会使旧确认失效，不使用阻塞整页的同步对话框。

## 可以证明的改善

- 同一已选3行/可见1行改价任务：误改隐藏行2→0。
- 补选3个经营表字段：组合预览请求3→1；选择后反悔恢复累计6→0。不是平台API请求节省。
- 已打开的数据任务返回后保留搜索/分页/选中，隐藏时不继续数据刷新。
- 选店继续：3个React导航/change事件→2个，不等同浏览器点击或真实用户时间。
- 未保存规则重新读取：原版静默丢输入；现在先局部确认，取消不查询、不写入，也不锁住整个页面。

没有测量真实留存率、真实商家上品成功率或线上p95。生成图片是蓝图，不是运行截图。草稿恢复有4身份/1MiB/单项256KiB/30分钟上限，且不覆盖真正卸载、刷新、新增未添加动作。完整边界见各问题和报告。

两版完整默认测试均无新增失败：Node22为2252通过/0失败/38跳过；Node24为2250通过/2既有失败/38跳过。Node24不是全绿，原[SQL查询问题#7](https://github.com/123wusongzhi/dsh-hallmark-app/issues/7#issuecomment-6207889537)未在本轮修复；跳过项未冒充通过。以下保留完整实测、差集、环境及复现命令。

---

# 累计十项 UX：最终精确源码双 Node 全仓验证

日期：2026-10-16 UTC。验证提交 `069817a535769add648295f88086132768e39b00`，tree `dc1d83ca4fb241c113356cd27a69a9b264a98627`。

## 实测结论

本轮在最终冻结源码上真实执行两版原样 `npm test`（包括原 pretest 和默认测试发现范围），每版结束后执行 `npm run typecheck`。两版串行，未筛选、跳过或放宽断言。

| 运行时 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24.21.0 / npm11.19.0 | 2290 | 2250 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22.18.0 / npm10.9.3 | 2290 | 2252 | 0 | 38 | 0 | 0 | 0 | 0 |

两版 pretest 审计均 PASS：320 个测试文件，169 required、166 infrastructure，冻结来源数20/20/1，0审计失败。原生汇总与逐用例解析完全一致。**Node22非skip全部通过；Node24保留两项既知SQLite planner/index失败，不能称双版全绿。**

## 与两组既有全仓实测对照

原基线e4eb077：2263项；Node24.21为2223pass/2fail/38skip，Node22为2225pass/0fail/38skip。第一批03aec8b：2273项；Node24为2233pass/2fail/38skip，Node22为2235pass/0fail/38skip。对照读取保留的outcomes证据，未重新执行或改写旧结果。

- Node24.21 相对原2263项基线：新增用例名称次数 27，移除 0；新增失败 0，移除失败 0；新增skip 0，移除skip 0。
- Node24.21 相对第一批2273项：新增用例名称次数 17，移除 0；新增失败 0，移除失败 0；新增skip 0，移除skip 0。
- Node22.18 相对原2263项基线：新增用例名称次数 27，移除 0；新增失败 0，移除失败 0；新增skip 0，移除skip 0。
- Node22.18 相对第一批2273项：新增用例名称次数 17，移除 0；新增失败 0，移除失败 0；新增skip 0，移除skip 0。

两组对照新增的27项／17项名称在两版完全相同，新增用例全部在两版通过；added-case-checks.json保存交叉核验。

逐名称多重集保留同名次数，不以总数近似替代。详细all/pass/fail/skip/cancelled/todo差集均在每版outcomes.json。

### 保留的Node24失败

- C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded
- scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen

两项原断言期待 `/provider_records_irregular/`，实际irregular分支仍为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`；完整原始诊断另存node24.21-failure-details.txt。未修正SQL、删测试、放宽索引断言或将失败改成skip。Node22对应两项通过。

### 相比第一批新增用例

- association loading lifecycle: empty connection
- association loading lifecycle: failed connection and explicit retry
- association loading lifecycle: late success while replacement pending
- association loading lifecycle: late failure while replacement pending
- association loading lifecycle: normal refresh
- association loading lifecycle: inactive and resume
- private recovery cache bounds owner count, exact byte sizes and lifetime, with explicit loss reasons
- cache snapshots are isolated copies and new oversized edits cannot leave a stale recoverable snapshot
- workspace business drafts recover only under reverified original owners and revisions
- reload asks before discarding pricing edits; cancellation preserves inputs without reading or writing
- failed pricing save retains edits and cancellation still performs no reads
- discard reload keeps newer edits and store choices isolated from late reads
- inline discard intent expires on new edits, identity changes and leaving the active panel
- new identity and newer refresh reject older settings responses
- business store entry returns only after its explicit selection save and cancels stale intents
- business store reads expose recoverable terminal states and isolate cancelled owners
- workbench retries failed stores independently and retains the successful board cache

### 相比原2263项基线累计新增用例

- agent feedback invalidates failed publications and isolates changing component identities
- agent controls show in-flight stages and original receipt state without repeating or globally blocking requests
- association loading lifecycle: empty connection
- association loading lifecycle: failed connection and explicit retry
- association loading lifecycle: late success while replacement pending
- association loading lifecycle: late failure while replacement pending
- association loading lifecycle: normal refresh
- association loading lifecycle: inactive and resume
- private recovery cache bounds owner count, exact byte sizes and lifetime, with explicit loss reasons
- cache snapshots are isolated copies and new oversized edits cannot leave a stale recoverable snapshot
- workspace business drafts recover only under reverified original owners and revisions
- price journey scopes batch edits and explicitly reviews the complete submission through the production business engine
- reload asks before discarding pricing edits; cancellation preserves inputs without reading or writing
- failed pricing save retains edits and cancellation still performs no reads
- discard reload keeps newer edits and store choices isolated from late reads
- inline discard intent expires on new edits, identity changes and leaving the active panel
- new identity and newer refresh reject older settings responses
- business store entry returns only after its explicit selection save and cancels stale intents
- business store reads expose recoverable terminal states and isolate cancelled owners
- choosing several information fields is one reversible edit and one composed preview read
- real information editor discards pending choices across store and session owners and ignores late closed previews
- hidden production board rejects refresh and changed owner reads until reactivated
- listing corrections survive interruptions and save through the real draft engine without submitting
- workbench retries failed stores independently and retains the successful board cache
- workspace returns to a bounded, paused full data task with its real React search and page intact
- workspace returns to a bounded, paused loaded data task with its real React search and page intact
- paused data tasks cancel timers and reads, preserve selection, resume the same query and reject stale owners

## 输入完整性与运行时

1406个tracked文件逐Git blob匹配提交，测试和typecheck各阶段前后及整轮SHA256字节清单均不变。聚合清单SHA256：`395184a972bdfd87ebd2ce31b3d7ab35bb1fce89af24b6dc38f982b3a15aca1f`。根和两个组件复用已有依赖symlink；两组件锁文件与依赖来源锁文件逐字节匹配。

- Node24.21：实际execPath `/opt/codex/cua_node/bin/node`；PATH解析node `/opt/codex/cua_node/bin/node`；npm CLI `/opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js`；npm 11.19.0；SQLite 3.53.4。
- Node22.18：实际execPath `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`；PATH解析node `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`；npm CLI `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js`；npm 10.9.3；SQLite 3.50.2。

仅对子进程PATH前置对应bin，未改全局环境或package定义。NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH均未设置。原测试命令保持 `node --test --test-concurrency=1 "test/**/*.test.ts"`。

## 自然终结与复现

| Node | 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | --- | ---: |
| 24.21 | test | 2026-10-16T05:14:24.615072+00:00 | 2026-10-16T05:18:31.615589+00:00 | 1 |
| 24.21 | typecheck | 2026-10-16T05:18:31.748600+00:00 | 2026-10-16T05:18:46.947230+00:00 | 0 |
| 22.18 | test | 2026-10-16T05:18:47.265236+00:00 | 2026-10-16T05:23:15.187146+00:00 | 0 |
| 22.18 | typecheck | 2026-10-16T05:23:15.326150+00:00 | 2026-10-16T05:23:32.787699+00:00 | 0 |

全部阶段自然终结，未中断或人工kill。时间仅证明执行顺序，不作为性能收益对比。复现需准确checkout、准备好的测试数据和匹配依赖；依次为每个版本设置NODE/NPMCLI：

```sh
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" test
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" run typecheck
```

## 明确边界

本验证器没有修改源码、安装依赖、执行额外全量build、发布、真实商家操作或更改测试断言。默认测试内部必要构建和fixture产物正常生成。既有依赖复用不证明干净环境安装。38项skip不是pass。独立非默认.mjs入口、真实浏览器/已安装桌面Host、Windows/macOS与真实商家集成未运行，不据本次自动测试宣称这些端到端场景已验收。

旧的部分worktree大fixture已由父任务归档；本次对照只读取保留原始日志和outcomes，不把已归档文件误报为遗失。本轮全部输入在开始时就绪。

## 证据索引

- node24.21-test.log、node22.18-test.log：完整原npm lifecycle/pretest/test输出
- node*-typecheck.log：完整类型检查输出
- node*-outcomes.json：原生汇总、每项结果、两组引用路径和所有状态多重集差异
- metadata.json、node*-metadata.json：精确运行时、阶段时间、自然退出、源码hash
- source-integrity.json：逐文件Git对象匹配、组件锁匹配、相关环境
- tracked-before/after及各阶段清单：逐字节SHA256
- final-checks.json：汇总核验
- EVIDENCE-SHA256.json：本报告及全部证据校验和

以上均为本地独立验证证据，不是公开下载链接；本验证器没有发布它们。
