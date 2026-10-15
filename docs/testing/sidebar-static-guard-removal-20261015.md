# 独立复核结论：通过单项 sidebar 源码断言删除

建议提交给定候选，范围只含 `test/plugin-client/session-components.test.ts`：删除 `assert.ok(sidebar.includes('bridge.sessionViews'));`，补一行指向既有行为测试的说明。两个 snapshot 调用断言及其余所有权、原生集成、架构 guards 均保留。不改生产代码，不新增测试框架，不主张速度收益。

## 冻结、独立性与实际运行

- 冻结公开基线：`f2ad9beb0c7edd1183679dd11cb95eaa89bf67b5`。
- 全新独立 Git clone、独立工作树与证据目录；未修改作者树，未 push、未发布 issue。
- Node `v24.19.0`；复用已有锁定依赖，仓库 lockfile 与已安装 `.pnpm/lock.yaml` 的 SHA-256 同为 `6dfa707c589d59ad4442cc26ff1b4cb1441ff0c1453c1e952bdbd1e85376840b`，未安装依赖。
- 实际执行整合后的 `reproduce.py`，22 步完成。它从冻结源码自构造候选与所有 mutants，不依赖作者未发布 commit 或另一脚本；原有行为测试始终未被改写。
- `run1/manifest.json` 保存每步命令、输入哈希、退出码、摘要和 1335 个跟踪文件的前后哈希；原始输出与子进程语义失败日志均留存。

## 结果

1. 基线相关组合 11/11。
2. 仅 sidebar 局部变量 `bridge` → `sessionBridge`：旧源码 guard 精确 `ERR_ASSERTION`；原有 React 行为 5/5；同一等价改名加候选后相关组合 11/11、tsc 通过。
3. 同一 UI 调用改为 `new HallmarkBridge('foreign-session').sessionViews(controller.signal)`：旧源码 guard 精确 `ERR_ASSERTION`；候选组合 10/11，唯一失败来自保留 ready-card 行为的 `ERR_ASSERTION`（期望 1 张卡、实际 0 张），其子进程另 2 项通过。候选单独 session-components 6/6，mutant tsc 通过。
4. API list 资源改为 `saved`：直接 Bridge 行为精确 `INVALID_SESSION_VIEWS` 契约错误，调用栈在 `HallmarkBridge.sessionViews`；原 UI ready-card 行为另以 `ERR_ASSERTION: 0 !== 1` 失败，mutant tsc 通过。不能把此直接 Bridge 错误写成 `ERR_ASSERTION`。原静态断言本就不检查 API 内部，这一项是保留的补充保护。
5. API list params 改为 `{sessionId:'foreign-session'}`，保留合法响应形状：直接 Bridge 的 every-URL sessionId 断言精确 `ERR_ASSERTION`；mutant tsc 通过。
6. 所有有效负例均排除 TypeError、SyntaxError、ReferenceError、timeout 和取消；UI 日志检查具体内层断言，没有只凭外层退出码判红。没有改 mock 来迎合负例。
7. 恢复生产代码，仅保留候选：相关组合 11/11、完整 plugin-client 129/129（0 失败/取消/跳过）、真实数据 audit PASS、tsc PASS；另实跑 `git diff --check` PASS。
8. 1335 个跟踪文件中最终只有目标测试文件变化，全部生产文件哈希恢复原值。

## 必须随提交披露的边界

- 默认 `npm test` 从 `test/**/*.test.ts` 收集 308 个文件，包含本文件及既有 `application-surfaces.test.ts`、`snapshot-refresh-lifecycle.test.ts`。入口审计不是全仓执行结果。
- `test:apps` 原本只收集 8 个目录、136 个文件，不含 plugin-client；本修改没有赋予它此保护。
- 单独跑 session-components 会失去对这个 UI 调用点错误的旧静态拦截，至少应与 application-surfaces 一起跑；默认 npm test 包含二者。
- 本轮未跑完整 npm test、test:apps、Node 22、真实浏览器/桌面、远端服务或生产部署。实际保护来自生产 React + 实际 HallmarkBridge 的离线控制夹具，不等同于浏览器交互验收。
- 收益仅为减少等价变量重命名的误报，未证明提速；也未证明可删除两个 snapshot guards。

## 指纹与可发布材料

- `author-candidate.patch` 与 `run1/candidate.patch` 完全一致，SHA-256 `c4814d0380c2a4d9cb7d866ea7ccb22ba3918f6279aac1b2bada3865978ce337`。
- 实跑整合脚本 SHA-256 `3cb19b5005ffa7205099bfb9fdb087641f3d4a26c144ca855b89a92b9608f3f7`。
- 新测试文件 SHA-256 `338fac5d8d03f18119147ab0df523c5fe819e913063047ee87d76a96d847332e`。
- 同一 UI mutant SHA-256 `970049e1a30281b80efa1f32347110528c632fb1c6a191c10772e568cdcf6676`。
- 恢复 sidebar SHA-256 `34408fe1a1a50a77e9d66ff40bee91cff7502605ea967dd57eca2e7a7d7c2057`。
- 恢复 snapshot SHA-256 `d7ae2d73235207860d33fe426ad4e81eff5de99ff34a59db735bf5901f046f5b`。
- 恢复 api SHA-256 `54f6c8ed791eee6f335bc0e56e01781806ecef8e1ae85b1a739e75895a91554b`。
- [问题 #64](https://github.com/123wusongzhi/dsh-hallmark-app/issues/64) 内含完整补丁与这次实际执行的完整 Python 脚本。
