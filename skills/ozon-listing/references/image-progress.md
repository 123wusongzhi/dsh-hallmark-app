# 图片进度与恢复

image-progress.json 由图片代理独占写入，主 Agent 只读。它记录每张图走到了哪一步；最终交付仍以 images.json 为准。

## 每张图一条记录

为每张需要生成的图起一个稳定的 assetKey。同一张图被多个销售行复用时，只建一条记录，在 slots 里列出所有位置。

```json
{
  "assetKey": "sale-a-main",
  "factsRevision": 1, "salesRevision": "…", "preparationRevision": "…",
  "slots": [{"saleId": "sale-a", "group": "images", "index": 0}],
  "references": [{"imageId": "img-1", "path": "/abs/img-1.jpg"}],
  "prompt": "最终使用的简短提示词",
  "stage": "generating"
}
```

- 三个版本号从 production.json 原样抄写。
- `group` 取 `images`（index 0–6，0 为首图）或 `richContentImages`（index 0–7）。
- `references` 填 product.json 中的来源图 id 和路径。
- 会话 ID 不用填，由程序自动记录。

登记命令：`node <本 skill 目录>/scripts/handoff.mjs record <image-progress.json> <记录.json>`。之后各阶段的记录只需写 assetKey、stage 和新增字段，已有字段会保留。

## 阶段

| stage | 何时登记 | 要补的字段 |
| --- | --- | --- |
| generating | 生图之前 | 上面的完整记录 |
| generated | 生图成功后，由程序自动登记 | sourcePath |
| staged | 复制和格式处理完成后 | path（归档文件的绝对路径） |
| published | 发布成功后 | url（https） |

阶段只能前进，不能回退。

## 恢复：按 nextAction 处理

运行 `node <本 skill 目录>/scripts/handoff.mjs recover <image-progress.json>`，对每张图按它的 nextAction 处理：

| nextAction | 处理 |
| --- | --- |
| reuse_published | 直接写进 images.json |
| publish | 调用 assets.publish，然后登记 published |
| stage_existing | 从 sourcePath 归档并查看，然后登记 staged |
| adopt_receipt | 图已经生成：用 `receipt.sourcePath` 登记 generated；sourcePath 为空时，从回执文件文本里取路径。不重新生成 |
| generate | 没有成功回执：调用 listing_image_prepare，用原 prompt 生成；程序会把这条记录转到当前会话 |
| regenerate_new_key | 成图文件已丢失：换一个新 assetKey 重新制作，旧记录保留 |

几条规则：
- 恢复沿用原 assetKey。只有 `regenerate_new_key` 和修图才用新的 assetKey。
- factsRevision、salesRevision 不变时，已有的图继续有效；preparationRevision 变化不影响已有图片。
- 恢复由新的图片代理执行。主 Agent 只运行 recover，并把 assetKey 和 nextAction 交给它。
