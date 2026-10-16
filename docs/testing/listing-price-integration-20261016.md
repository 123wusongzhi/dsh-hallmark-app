# Listing 与调价 UX 独立整合审查

基线 `fd95bc22929bfbfa850e0312357322578287a10c`，整合 listing 候选 `7c37b75ddc9b2a129f22456ec64585a751aff27d` 与 price 候选 `8e3474311e96f5021df97ae9033cac6446d93fe3`。独立 worktree，复用现有依赖，无安装、无发布。

## 独立发现与修复

1. 合并后 listing 提交确认只展示价格，遗漏新编辑器修改的标题、说明、图片和包装。加入生产 React 回归先复现失败（`listing confirmation shows the title being submitted`），修复为展示完整已保存 listing payload。图片地址作为文本显示，确认区不会因此加载图片。
2. 高级 JSON 的未应用文本原先不计入 dirty 状态，结构化编辑、刷新与筛选可无声覆盖或卸载文本。现在有明确提示，未应用期间锁住结构化编辑、筛选、切批、刷新、保存和提交，提供“应用字段修改”和“放弃字段修改”。非法 JSON 保留文本。应用后两种编辑器同步，放弃只丢弃明确指定的未应用文本。
3. 保持完整字段序列化按 payload memo，不因选择、搜索、打字重复序列化。更新旧提交按钮测试以符合两阶段确认。

## 实际验证

生产 React 组件 + 生产业务引擎 + 内存 SQLite，封闭 fetch fixture；不连接商家或真实平台。

- 原候选覆盖：隐藏选中只改可见行，混币明确单币种，缺币种/零价不批量填入；整批范围确认；同事件轮双确认仅一个提交；未知回执只查不重发；修复失败行只重发该行。
- 新增整合覆盖：listing 确认展示标题、说明、图片地址、重量、尺寸；确认期间编辑锁定；取消零 review/transport 调用。
- 新增草稿覆盖：高级 JSON ↔ 结构化字段交替同步；非法 JSON 保留且锁住破坏性操作；显式放弃再继续；保存挂起期间禁止提交、编辑；已保存后切换不同批次不会泄漏旧编辑对象。
- listing 测试全程 review=0、transport=0。price 测试仅执行 fixture transport，绝无真实平台写入。

相关回归命令（各指定 Node 可执行文件执行）：

```sh
node --test --test-concurrency=1 test/plugin-apps/business-operations.test.ts test/plugin-apps/business-price-journey.test.ts test/plugin-apps/business-content-lazy.test.ts test/plugin-apps/listing-draft-editor.test.ts test/operations/*.test.ts test/business-pricing/*.test.ts test/operations-adapter/adapter.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
git diff --check
```

Node 24.19.0 初检 131/131。Node 24.21.0 与 Node 22.18.0 相关回归各 131/131，类型检查通过。来源审计 PASS（310 test files / 164 required / 161 infrastructure）。

## 边界

这是隔离 React/引擎回归，不是浏览器、视觉、原生宿主、真实商家或平台验收。未执行全仓库测试。未改变生产引擎、审核、定价规则、适配器或平台写入语义；未 push、打包或部署。未应用草稿在整个组件卸载/切换店铺时的跨页面持久化不在本次承诺范围。
