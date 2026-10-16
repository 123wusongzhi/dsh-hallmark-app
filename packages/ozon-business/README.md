# Ozon 经营直连

`src/index.ts` 暴露后端 `OzonBusinessGateway`。它不注册 Agent 工具；审核、发送意图及未知结果恢复仍由经营引擎负责。每次 `request` 最多发送一次，不自动重试写请求。

公开店铺目录为 `stores.json`，只含名称、状态、来源关联和版本。凭据在 `private/credentials.enc.json` 以 AES-256-GCM 保存；Windows 下主密钥受当前系统用户 DPAPI 保护，其他系统私有文件使用 0600 权限。不要把 `private` 目录暴露给组件、技能、HTTP 静态文件或日志。不同操作系统用户无法直接解密 Windows 的凭据，需要重新导入。

保存店铺要求 `expectedRevision`。同一店铺只允许同一 Client-Id 轮换 Api-Key；改变账号要新增店铺。历史凭据版本保留在加密存储，用于原请求核查。写请求可带 `credentialRevision`，版本改变时拒绝；读取原回执则可继续指定原版本。禁用店铺阻止新写入，保留只读核查。

`importLegacyStore` 按 `sourceConnectionId + legacyStoreId` 确认同一来源，首次优先保留原店铺 ID；跨来源 ID 冲突时生成带稳定来源散列的 ID。重复导入不覆盖用户已保存的设置。导入脚本只读取原平台公开店铺和私有凭据，不修改旧平台、不调用 Ozon。

`getProducts` 返回 `AdapterResponse`，`raw.response.items` 为原生 Ozon 商品列表。列表查询使用明确目标，或完整分页产品目录后读取详情；不以部分结果冒充全量。`checkStore` 只读调用 `seller/info`。

接口精确白名单沿用已验证合同：促销变更 `/v1/actions/products/update` 的 `action_price` 应为 `{amount,currency}`，退出使用 `/v2/actions/products/deactivate`。不做 Ozon 字段规则的全量本地复刻。平台错误保留已脱敏的原生结果；经营适配器负责转换为字段修正提示。
