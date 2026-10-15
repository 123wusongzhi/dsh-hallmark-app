# 开发测试准备说明复现与修正

日期：2026-10-15 UTC。源码基线：`f11b810371671a59646e5325ceeccd76e9a97f45`。环境：Linux x64、Node v24.19.0、npm 11.9.0、pnpm 11.25.0。

## 结论与修正范围

根 README 的开发测试入口有两处可复现的误导：

1. 要求在根目录执行 `npm ci`，但根目录仅跟踪 `pnpm-lock.yaml`，没有 `package-lock.json` 或 `npm-shrinkwrap.json`。实际执行退出 1，报 `EUSAGE`：`npm ci` 需要 npm 锁文件。根目录应按现有 pnpm 锁文件安装依赖，不应为此新增 npm 锁文件。
2. 要求另行取得私人快照并设置 `DSH_REAL_CORPUS`，且声称快照不随源码发布；实际默认公开脱敏快照及引用的 134 个文件已经跟踪。`test/real-data/corpus.ts` 在未设置 `DSH_REAL_CORPUS` 时读取这些文件。离线准备与 45 项来源回放通过，无需采集或连接业务服务。

本次仅修正文档：根入口使用 `pnpm install --frozen-lockfile --ignore-scripts`，区分已入库的默认公开脱敏快照、可选的其他完整快照与不入库的生成文件，并指向已有的先构建后全量测试步骤。数据说明中同步清理了将所有输入统称为私人快照的过时文字。

组件子项目 `component-workspace/collected-products`、`component-workspace/helen-margin` 各自有 `package-lock.json`；没有改写其 `npm ci` 指引。没有改动生产代码、测试代码、依赖版本、锁文件或快照。

## 实际执行结果与限制

以下日志名是本次独立验证目录中的证据索引，不是仓库内文件；原日志、依赖及生成产物不随本文提交。下节提供独立复现命令。

| 检查 | 结果 | 本地日志 |
| --- | --- | --- |
| 独立源码树根目录 `npm ci` | 预期失败，exit 1，`EUSAGE`，缺 npm 锁文件 | `root-npm-ci.log` |
| 下节完整隔离复现脚本 | 实际执行通过：确认 npm exit 1、`EUSAGE` 及缺锁提示；关闭更新检查，离线执行 | `documented-npm-ci-repro.log` |
| pnpm 冻结锁文件离线安装 | 未完成；本机镜像缺少 `@deepseek-ai/cosmokit` 元数据，`ERR_PNPM_NO_OFFLINE_META` | `root-pnpm-offline-install.log` |
| `node scripts/prepare-real-test-data.mjs` | 完成，离线生成 `test/real-data/browser-data.ts` | `prepare-test-data.log` |
| `npm run test:real` | 审计 PASS：308 个测试文件、0 failures；测试 45 pass、0 fail/skip/cancel | `test-real.log` |
| `npm run typecheck` | 通过 | `typecheck.log` |
| `node scripts/generate-apps-sdk.mjs` | 通过，94 个共享描述符 | `generate-apps-sdk.log` |
| `node scripts/build-apps-bundle.mjs` | 首次因默认 npm cache 目录不可写而失败；仅将本次进程的 npm cache 指向可写临时目录后通过，`installed:false` | `build-apps-default-cache-failed.log`、`build-apps.log` |
| `node scripts/smoke-apps-bundle.mjs` | PASS；隔离验证，5 requests、0 mutations、`installedIntoDSH:false` | `smoke-apps-bundle.log` |

**安装边界：**本次 fresh install 没有完成。正向验证复用了已有 `node_modules`，只能证明这些已具备依赖的命令可运行，不能宣称已验证全新联网安装。离线安装提示锁文件已是最新、跳过解析，随后因环境镜像缺元数据停止；这不是建议修改依赖或锁文件的依据。最初 npm 缺锁失败的日志还记录了 npm 自身更新检查的 DNS 失败，`EUSAGE` 的直接原因仍是缺少锁文件；下节复现显式关闭更新检查并使用离线模式。

本次没有重跑全仓测试，没有进行性能比较，没有全局安装、修改 npm 全局配置、读取凭据、采集私人数据、访问真实商城或安装到 DSH。`capture:test-data` 和 `test:live-real` 未执行；公开脱敏快照不能用于断言当前线上业务状态。

## 自足复现命令

以下使用 POSIX shell，在目标源码根目录执行。先准备 Node ≥22.18 与已有可用 npm/pnpm。命令仅将根清单和 pnpm 锁文件复制到新临时目录，避免 `npm ci` 清理当前工作树依赖；不修改原清单或锁文件，也不执行安装脚本。

```sh
set -eu
test -f package.json
test -f pnpm-lock.yaml
test ! -e package-lock.json
test ! -e npm-shrinkwrap.json
probe=$(mktemp -d)
mkdir "$probe/project" "$probe/home"
cp package.json pnpm-lock.yaml "$probe/project/"
: > "$probe/user.npmrc"
: > "$probe/global.npmrc"
status=0
(
  cd "$probe/project"
  HOME="$probe/home" \
  npm_config_userconfig="$probe/user.npmrc" \
  npm_config_globalconfig="$probe/global.npmrc" \
  npm_config_cache="$probe/cache" \
  npm_config_offline=true \
  npm_config_ignore_scripts=true \
  npm_config_audit=false \
  npm_config_fund=false \
  npm_config_update_notifier=false npm ci
) > "$probe/npm-ci.log" 2>&1 || status=$?
test "$status" -eq 1
grep -q 'EUSAGE' "$probe/npm-ci.log"
grep -q 'package-lock.json' "$probe/npm-ci.log"
printf 'Expected root npm ci failure verified; log: %s/npm-ci.log\n' "$probe"
```

正向准备需要仓库依赖已安装。新机器应在根目录执行下面的 pnpm 安装命令；它需要能取得锁文件指定的包，本次离线环境未完成这一步。已有依赖时无需重复安装。不要通过生成另一种锁文件来修复根 `npm ci` 的失败。

```sh
pnpm install --frozen-lockfile --ignore-scripts
```

在已有依赖的源码根目录，用仓库默认公开脱敏快照执行：

```sh
unset DSH_REAL_CORPUS
npm run prepare:test-data
npm run test:real
```

`test:real` 已包含 `scripts/audit-real-test-data.mjs`，无需另重复跑审计。预期为审计 PASS、20/20/1 来源配额、45 项测试通过；后续提交可能增加测试数量。准备命令显式重建忽略入库的 `browser-data.ts`，缺失时测试审计也会补建，但已有被篡改文件不会被审计静默修复。

完整 Apps/全仓测试继续按根 README 的“Apps V1 开发与验证”顺序，先生成 SDK 和构建 bundle，再做类型检查、测试及隔离 smoke。bundle 构建中的 `npm pack` 需要可写 npm cache；受限环境可仅为当前进程设置 `npm_config_cache` 到自己创建的临时目录，不必更改全局配置。本报告的 45 项来源回放不替代全仓、真实浏览器或原生桌面验收。

如需使用其他快照，设置 `DSH_REAL_CORPUS` 到其 `corpus.json`，同时提供 `.sha256` 与清单引用的响应／图片文件。实时只读验证另需合法私人原始快照及单独授权；不属于普通克隆后的离线测试准备。
