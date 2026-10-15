# SKU列式字段对应回归 #50

精确基线 `956324e1af54da6ac58318267c51400eb86ee474`；只新增测试与required分类登记，生产和冻结资料保持原字节。

实际HallmarkClient、CollectionService、Provider、Runtime HTTP、Host模型输出连通，从冻结资料原属性/原图URL/null包装独立构造期望。再通过真实collection.resource.read解析imageRef，验证对应原图片URL；这里只读详情和资源元数据，不声称下载/解码了图片或完成商家上品。

自然单点变异把行尾imageRef与package值交换、列头不变：旧12文件145/145仍通过，新测试因imageRef读成null而失败；恢复146/146。属性排序想法因冻结资料没有可区分顺序而排除，没有伪造新的商品事实。此项也不声称0/false原类型保真，属性按协议可规范为字符串。

## 最终整合与独立验证

- 新测试1/1、仓库外cwd1/1、12邻近加新测146/146；全部0跳过。
- 数据审计PASS：307文件，162 required、160 infrastructure，分类允许重叠。
- 全仓TypeScript、diff检查通过；1309输入文件前后哈希一致，汇总 `9d0d50aae237cc1c7d3aa930b5cff874560281598145fce4c25dee526543683b`。
- 独立审核覆盖初始化异常、监听后异常、局部未完成调用及真实Provider读取中的可释放源故障；均保留原失败自然退出，并检查Runtime退场、Host工具释放、Store和端口关闭。
- 从956补丁SHA-256：`b24889907dfb13973cb0d848b8e97a49ee0f30bfcafa99d9b87186dd357b16fd`，实际clean-apply树 `c07544307ac3dbfc08b6561b00659947376a2eb1`。

本输入未跑完整全套。另附回归入口说明，明确窄入口不可替代常规全套、环境skip不计pass、所有结果绑定精确输入。没有真实浏览器、线上模型或商家请求，未合入SQL生产候选，也未修改默认测试并发。
