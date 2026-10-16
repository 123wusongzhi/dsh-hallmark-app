# #77 补充：返回经营操作时核对原提交确认

基线：`c4742a4c66bcdd304c0c9b5fb39ce274d257cd6a`。这是整批范围确认的跨功能边界修复，不计为新增 UX 项。

## 实际复现与风险边界

真实 `BusinessOperations` React 探针：打开版本 1 / 售价 20 的整批确认，隐藏经营操作，隔离读取 fixture 将同批次改为版本 2 / 售价 25，再返回。主表更新为版本 2，确认仍显示版本 1；确认按钮可点但无请求、无反馈。手动返回检查再开确认能恢复。

原有 planId/revision 检查已经阻止了旧快照提交。因此这不是误写、重复提交或审核绕过；缺陷是旧确认与新版主表不一致且操作无反馈。

## 最小修复

- 返回后的 list 正在核对期间禁用最终确认，文案为“正在核对最新批次…”，不会误称正在提交；仍可返回检查。
- 最新读取与确认的批次/版本不符（包括批次消失），清除旧确认并明确要求重新检查。
- 最新读取失败时也撤销原确认，并说明无法核对。
- 相同批次/版本核对成功，保留原确认，不强迫再次确认范围。
- 保留原 CAS guard，另在确认回调检查 active、loading、读取验证状态和读取错误。失效/取消本身不发 submit，也不自动替换旧快照后提交新版数据。

## 验证

专项 `test/plugin-apps/business-confirmation-revalidation.test.ts` 使用记录来源的 uiStore/uiProduct 标签，版本、价格和延迟/缺失/拒绝响应为明确的本地场景控制。所有 fetch 都被封闭 fixture 接管，仅接受 stores/businessSettings/list；全程累计请求检查无 mutation。真实 React 渲染与事件调用覆盖：

1. 核对在途按钮禁用，直接调用其当前 handler 也无提交，文案不是提交中。
2. 同版本返回保留确认，仍可取消。
3. 新版本关闭旧确认并提示，重新打开显示新版本。
4. 在途取消后读取返回不会复活确认。
5. 批次消失/拒绝读取使确认失效。

修复前专项真实运行失败（在途核对按钮不存在），修复后通过；最初独立探针另证明旧版版本冲突时零请求、零反馈的原行为。未使用静态推测冒充红测。

Node24.21.0 与 Node22.18.0 分别运行以下六文件小回归（每版 7 tests），另运行完整 `tsc --noEmit` 与 `scripts/audit-real-test-data.mjs`：

- business-confirmation-revalidation.test.ts
- business-price-journey.test.ts
- listing-draft-editor.test.ts
- business-draft-recovery.test.ts
- business-store-read-recovery.test.ts
- business-operations.test.ts

真实 React 专项不等于浏览器/真实商家端到端验收。本轮没有重跑全仓、安装依赖、全量构建、发布或真实商家操作；既有依赖仅复用。

本地证据位于 `/workspace/shared/ux-cross-review/` 的 red.log、result.log、final-regression24.log、final-regression22.log、final-tsc24.log、final-tsc22.log、final-audit24.log、final-audit22.log。该位置不是公共下载链接。

最终结果：双 Node 每版均为 7 pass / 0 fail / 0 skip；两版 tsc exit 0；两版来源分类审计 PASS（321 files、170 required、166 infrastructure，来源 20/20/1，0 failures）。独立审查另复跑 4 个相关文件 5/5 通过，并在内存分别 bundle 基线与当前组件，验证旧版静默卡住和新版失效提示；未发现阻断项。

独审注明边界：专项同版本恢复验证按钮可用，没有在该场景发送 mocked submit 检查 expectedRevision；此前改价完整链小回归继续通过。旧 list 晚到与连续隐藏/返回未在本专项新增枚举，不据此声称所有调度顺序均已验证。
