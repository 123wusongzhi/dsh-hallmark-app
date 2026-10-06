import Schema from '@deepseek-ai/schemastery';
import { isAbsolute, basename } from 'node:path';
import { validateServiceUrl } from './service-client.ts';
import type { PluginConfig } from './types.ts';

export const CONFIG_APPLIES_NOTICE='通过官方配置文档修改，插件重载/重启生效；不生成 live 设置表单，当前连接和在途修改不会热迁移。';
// Use only declarative metadata: callbacks with external closures cannot safely round-trip in the native GUI.
const loopback=/^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?\/?$/i;
const fields={
  serviceUrl:Schema.string().pattern(loopback).default('http://127.0.0.1:4180').description('独立接入服务地址：仅 HTTP 字面回环 IP；不是原 Hallmark Control 地址。'+CONFIG_APPLIES_NOTICE),
  dataDirectory:Schema.string().default('').description('绝对应用数据目录；留空使用 HALLMARK_APP_DATA_DIR / LOCALAPPDATA 默认目录。密钥仅由 Host 从此目录读取，不进入前端。'+CONFIG_APPLIES_NOTICE),
  autoStart:Schema.boolean().default(false).description('明确选择才按您提供的接入服务入口托管启动；默认关闭。需完整 Node、入口和工作目录；不会猜路径或自动启动原 Hallmark Control，服务与 DSH 生命周期独立。'+CONFIG_APPLIES_NOTICE),
  nodeExecutable:Schema.string().default('').description('显式 Node 可执行文件绝对路径（node/node.exe）；不是 Electron 或 DSH executable。'+CONFIG_APPLIES_NOTICE),
  serviceEntry:Schema.string().default('').description('独立接入服务入口文件绝对路径；autoStart 启用时必填。'+CONFIG_APPLIES_NOTICE),
  serviceCwd:Schema.string().default('').description('独立接入服务工作目录绝对路径；autoStart 启用时必填。'+CONFIG_APPLIES_NOTICE),
  requestTimeoutMs:Schema.natural().min(100).max(90_000).default(75_000).description('服务请求超时（毫秒）；100–90000。'+CONFIG_APPLIES_NOTICE),
  contentBudgetBytes:Schema.natural().min(2048).max(65_536).default(16_384).description('模型工具正文 UTF-8 字节预算；完整大结果仅保留本机 spill，不把整表送进上下文。'+CONFIG_APPLIES_NOTICE),
};
/** Static native plugin Config. No Volatile refs or misleading auto-generated live form. */
export const Config=Schema.object(fields).description(CONFIG_APPLIES_NOTICE);

/** Validate raw/parsed configuration and omit undefined fields; never put schema objects in headers. */
export function snapshotPluginConfig(raw:unknown):PluginConfig {
  if(raw===undefined)raw={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))throw new TypeError('INVALID_PLUGIN_CONFIG_OBJECT');
  const input:Record<string,unknown>={};
  for(const key of Reflect.ownKeys(raw)){
    if(typeof key!=='string'||!Object.hasOwn(fields,key))throw new TypeError('UNKNOWN_PLUGIN_CONFIG_FIELD');
    const property=Object.getOwnPropertyDescriptor(raw,key)!;
    if(!property.enumerable||!Object.hasOwn(property,'value'))throw new TypeError('INVALID_PLUGIN_CONFIG_FIELD');
    const value=property.value;
    if(value!==undefined)input[key]=value;
  }
  const result=Config(input) as PluginConfig;
  // Omitted optional paths are omitted, never own properties containing undefined.
  for(const key of ['dataDirectory','nodeExecutable','serviceEntry','serviceCwd'] as const){
    const value=result[key];if(value===''){delete result[key];continue;}
    if(value!==undefined&&!isAbsolute(value))throw new TypeError('PLUGIN_CONFIG_PATH_MUST_BE_ABSOLUTE');
  }
  result.serviceUrl=validateServiceUrl(result.serviceUrl!);
  if(result.autoStart&&(!result.nodeExecutable||!result.serviceEntry||!result.serviceCwd||!/^node(?:\.exe)?$/i.test(basename(result.nodeExecutable))))throw new TypeError('AUTO_START_REQUIRES_EXPLICIT_NODE_ENTRY_CWD');
  return result;
}
