# 经营语义审核接口

`packages/service/src/decision-review.ts` 只处理需要理解内容的题。商品身份、采购关联、价格计算、执行范围和重复请求由经营操作引擎处理。制作 Agent 不提交“已审阅”声明。

`createDecisionReviewer(options).review(request, signal?)` 使用 `packages/app-contracts/src/business-review.ts` 的 `SemanticReviewer` 接口。来源、待提交版本和题目版本由 Host 构造；结果原样保留来源／草稿／策略版本。持久化与按依赖缓存由操作引擎负责。

## 指定模型和密钥

- 请求地址：`POST https://openrouter.ai/api/alpha/decisions`，不是 `/api/v1/decisions`。
- 默认模型：`openai/gpt-6-luna-decisions`。
- 密钥优先使用环境变量 `openrouter`；Windows 桌面进程未继承时读取用户、系统环境；兼容备用 `OPENROUTER_API_KEY`。测试和服务装配也可注入 `key`。
- 密钥仅进入请求 Authorization，异常不返回网络错误原文或响应正文。返回证据只包含问题、实际模型、版本、用量和固定原因码。

## 审核和独立子代理

文字题继续使用 OpenRouter `state` 与 `noul` 问题。每题独立判断，默认每次最多 24 题；输入、输出版本绑定由上层控制。默认通过阈值 0.95、退回阈值 0.05 均可由 Host 配置，它们是初始路由阈值，不代表已校准的实际正确率。标题、属性和共享详情的原有文字审核标准保留。

图片题使用应用提供的 `choices`，由程序将选项映射为通过、退回或待审核。所选选项的概率和 `confidence` 都达到 0.95 才采用结论；明确的证据不足选项始终待审核。N/A 记录为 `choice: no_spec_text/no_text`、`applicable: false`、`reasonCode: not_applicable`；兼容状态为 `passed`，表示该条件不适用，不表示审核确认了规格或文字内容。

漏答、错误类型、越界概率、拒答、超时、服务故障和低信心均不会直接放行，自动调用注入的 `IndependentReviewFallback`。Host 开真正的独立审核子会话，且不提供平台写工具。子会话接收同一冻结来源、实际成品、相关图片、应用固定的问题和版本，结果须含真实子会话 ID、模型、同一版本及逐题结论；选择题只能返回应用提供的选项。版本错、题目版本错、缺答或明确表示不确定，保留待审核。两个审核渠道都无法完成时，结果为待审核，不当成审核通过，也不计入内容修正轮次。

`imageIds` 指定题目依赖的图片；省略时依赖全部图片，空数组显式表示纯文字题。Decisions 和独立视觉审核都必须接收实际图片，不能把 URL 文字本身视作看过图片。

## 应用固定的图片问题

`packages/app-hallmark/src/listing-image-review.ts` 定义版本化模板，制作 Agent 不能出题或提交审核通过声明。三个模板分别为：

1. 主图实际印出的规格文字与真实来源 SKU 和销售组成是否一致。没有规格文字为 N/A；主图缺失或无法查看为证据不足。禁止从外观推断尺寸、比例、长度，禁止数格子、孔位或重复纹理来推算规格。
2. 指定成图实际可见的文字是否清晰可读。没有文字为 N/A，不要求图片必须带字，也不在此题核验文案事实。
3. 指定成图主体与来源图指定主体的商品类型、颜色和主要形态是否一致。允许背景、角度、陈列方式和使用道具变化；不比较精确格数、孔数或重复纹理数量，不从外观推断尺寸、重量或长度。

规格文字题只针对主图；文字清晰度和主体一致性模板按成图分别生成题目，因此多图时实际题数可能超过三题。所有问题及版本参与审核依赖指纹。

`referenceSubjects: [{sourceImageUrl, subject}]` 仅用于定位真实来源图里的比较对象，例如“左侧银色贴片”。程序验证图片属于本行关联来源商品；主体描述不是审核声明，也不能作为商品事实。未指定时只能采用明确对应当前 SKU 的唯一主体；多个主体无法确定时保持待审核。

## 默认图片协议

`packages/service/src/apps-main.ts` 默认注入 `createDecisionImageProtocol()`。图片题先请求 `openai/gpt-6-luna-decisions`，低信心或协议、下载、服务不可用时沿用独立子代理回退。

按 [OpenRouter 官方多模态 Decisions 文档](https://openrouter.ai/docs/guides/community/multimodal-decisions)，图片必须直接位于顶层 `state` 数组，文字为普通字符串，图片项为：

```json
{"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}
```

程序下载 HTTP(S) 图片并转成 PNG、JPEG 或 WebP 的 base64 data URL，附上图片 ID 与来源／成图角色标签。远程 URL 不由 Decisions 自动下载；嵌套在消息对象内的图片及 `input_image` 不是此接口的原生图片格式。GIF 等不支持格式交给回退流程。

图片准备和 POST 共用有界超时及取消信号。默认限制为每张 10 MiB、每次请求 32 MiB 图片原始字节及最多 128 张；成功下载采用 60 秒、32 条、32 MiB 原始字节的有界缓存，不长期缓存下载错误。Host 控制协议接入，普通 Agent 输入不能启用或替换协议。

## 2026-10-10 验证记录及边界

candidate69 已安装，65 个构建文件及运行中的 Host 校验通过。[安装后证据](../artifacts/desktop-collection-20261010/candidate69-image-review-installed.json) 确认实际 Runtime 版本、描述符的 `referenceSubjects` 两个字段、原生图片协议和三题标记，以及 DSH 实际技能文件的内容与 hash 均匹配。另一次安装后就绪检查确认数据库完整且服务空闲。相关回归为 **161/161**，见 [最终测试日志](../artifacts/desktop-collection-20261010/image-review-final-tests.log)。这覆盖安装、程序与协议回归，不等同于所有真实商品审核都通过。

[原生图片只读探针](../artifacts/desktop-collection-20261010/image-review-native-probe.json) 经程序读取实际图片字节，完成一次真实 OpenRouter POST，包含 2 个原生图片项。返回模型为 `openai/gpt-6-luna-decisions-20261006`，输入 5249 tokens，成本 $0.0005249：

| 模板 | 返回选项 | 所选概率 / 信心 | 程序结论 |
|---|---|---|---|
| 主图规格文字 | `no_spec_text` | 0.97 / 0.96 | N/A，`applicable: false` |
| 成图文字清晰度 | `no_text` | 1 / 1 | N/A，`applicable: false` |
| 成图主体一致性 | `different_subject` | 0.66 / 0.49 | 低信心，待审核 |

本探针未配置独立子代理回退，整体结果为 `pending`。它验证了真实原生图片请求及低信心分流，不能据此声称真实回退已完成、三题全通过或完成新上品验收。探针对 Ozon 的写入次数为 **0**。

历史上两次数字图片探针使用了嵌套的 `role:user/input_image` 或 `role:user/image_url` 结构，虽返回 HTTP 200 和 unreadable，但格式不符合现在核实的原生协议。它们只说明当时的错误输入格式，不能据此判断模型不支持图片或继续将默认图片审核描述为全部交给独立子代理。

此前文字请求的实际调用仍有效：来源为红色单个杯子，草稿颜色仍为红色、数量故意改成 2，`color` 返回 1 并通过，`quantity` 返回 0 并退回；输入 431 tokens，成本 $0.0000431，未操作 Ozon 商品。
