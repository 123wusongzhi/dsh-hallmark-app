# 定时检查：测试 Issue #33–#37

Automation 20 在 2026-10-15 23:24（北京时间）执行。五项 issue 的实际创建时间为 UTC 15:09:05、15:09:25、15:17:18、15:19:23、15:20:44，均晚于本任务限定的 UTC 15:02:44；读取正文和评论时均开放、无评论。基线为原开发分支 `ad7595fc4c207def69e8a831e3d487080ad77f78`，Windows、Node 24.12.0。

## 价值与复现对照

| Issue | 现有缺口与改进 | 独立对照 |
| --- | --- | --- |
| [#33](https://github.com/123wusongzhi/dsh-hallmark-app/issues/33) 并发 inspect 迟到结果 | 生产实现正确；新增 Runtime→HTTP→Host 的异步结果一致性回归。Promise 门闩使先发 pending 后到、后发成功先到，对比模型、invocation 和持久终态；不依赖固定 sleep | 旧邻近 119/119；返回入口快照的变异旧测仍绿，新测准确报 pending ≠ ok；恢复后通过 |
| [#34](https://github.com/123wusongzhi/dsh-hallmark-app/issues/34) 详情失败后的跨能力恢复 | 生产实现正确；同一 Provider 持有的 CollectionService 经 collection.read 失败，再显式 listing.prepare(refresh:true) 必须重新读取。额外验证普通读仍保留有效旧缓存、输出 continuation 实际可执行 | 旧邻近 146/146；漏清理 inflight 的变异旧测仍绿，新测失败；恢复后通过；与 #33 去重组合 267/267 |
| [#35](https://github.com/123wusongzhi/dsh-hallmark-app/issues/35) 刷新后选择与附件链 | 生产实现正确；实际组件→目录内原 hook/SDK→sourceSelection→SelectionInputBridge→真实 File。验证移除失效选择、保留有效选择、使用刷新后的 revision，精确核对原生 JSON 附件及已有附件保留 | 旧 29/29；禁用选择清理后旧绿、新 1/2；SDK 保留旧 revision 后旧绿、新 0/2；恢复组合 31/31，仓库外 cwd 新测 2/2 |
| [#36](https://github.com/123wusongzhi/dsh-hallmark-app/issues/36) 业务投影保真 | 生产实现正确；真实业务引擎、Runtime、HTTP、Host 输出保留 0、false、null，并完整交付非 listing 调价报价。金额/minor/ppm 预期独立给出，不调用待测报价函数生成 oracle | 旧邻近 81/81；truthy 过滤变异旧绿、新 0/2；误用 listing 报价白名单变异旧绿、新 1/2；恢复组合 83/83 |
| [#37](https://github.com/123wusongzhi/dsh-hallmark-app/issues/37) 脱敏 ID 破坏协议测试 | 当前输入校验正确；两测试的 Number(recorded.productId) 得到 NaN，令认证/回执/重试/路由断言提前失败。请求改用明确本地数字协议控制 101，保留录制的 offer、price、store；新增两类独立身份错配回归 | 原 28 项 5 通过/23 失败；改进 30/30。分别移除 results/products、receipt/request 的 ID 比较：旧 28/28 仍绿，新各 29/30、仅对应项失败；恢复 30/30 |

以上都有现有用户路径或测试可复现性的价值，无需新增产品审核、依赖或生产功能。#37 的 101 仅为本地请求控制，不是记录的真实平台 ID 或已验证身份映射；模拟回执也不证明实际改价成功。原 28 个测试名称、有效断言、认证及不重试约束保留，未放宽生产校验或改写冻结记录。

## 环境、兼容性与验证

新增文件为 inspection-race（infrastructure）及 listing-detail-recovery、business-value-projection、selection-refresh-chain（recorded）。已有数据依赖分类算法与 corpus 完整性校验保持；数据审计 294 文件、157 recorded 条目、152 infrastructure 条目 PASS。条目含 helper，不将分类数相加作为测试文件总数。

#35 复用主工作区已存在的组件依赖，通过 ignored junction 在独立树只读引用；八项安装版本与组件 manifest 一致。没有安装、修改依赖清单/锁文件或 skip。先前缺少这些组件依赖的全套结果不能直接当成本轮同环境性能基线。React props/postMessage 边界回放不代表真实浏览器事件、原生桌面或真实文件上传验收。

类型检查通过，主工作区本轮六文件 **36/36**、数据审计通过。合并保留了用户原有未提交修改，30 个保护文件 SHA-256 一致，分类清单单独合并。所有临时生产 mutation 都恢复原字节，生产目录与冻结数据无本轮 diff。Node 22.18 API 文档兼容性已核对，未实机验证该版本或完整 Linux/macOS。

## 完整套件复测

串行执行 `node --test --test-reporter=tap --test-concurrency=1 "test/**/*.test.ts"`：**2,245 tests /2,241 pass /2 fail /2 skip**，434.627 秒。本次新增测试全部通过。两项跳过仍因缺少预先构建的打包产物，没有增加 skip。

按完整测试名称比对，#37 原先的 23 个失败在定向 30/30 和完整套件中都通过。先前 `formatter-sharing-compatibility` 和 `selection-interaction` 两项也因复用已就绪的 collected-products 依赖通过；这两项属于环境前提就绪，不归因于生产优化。此前完整报告 2,235 项及本次新增 10 项（含上一批 #29/#31 的两项）不能直接比较成性能提速，耗时受更多断言、构建与浏览器运行影响。

仍保留两项既有失败，不宣称全套全绿：

- `test/authoring/http.test.ts` 的 prepared product template：checkout 未构建 `bundles/apps/sdk/component-runtime/package.json`，报 ENOENT。
- `test/source-preview/commerce-image-loading.test.ts`：仍导入 helen-margin 子项目，该子项目缺少五个已声明 UI 依赖；本轮未安装或改写它们。

这两项均不是新测试引入的生产问题，未以放宽断言、跳过或制造共享构建产物掩盖它们。

本地原始 TAP、mutation 恢复哈希、依赖版本、组合命令和主区保护清单位于 `artifacts/issue-review-automation20-20261015T1524/`。本轮仅离线冻结数据与隔离回环服务；没有真实商家请求、平台写入、桌面安装或私人业务状态提交。
