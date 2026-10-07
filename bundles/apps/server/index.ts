import {readFileSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import Schema from '@deepseek-ai/schemastery';
import {HallmarkPlugin} from '../../../packages/dsh-plugin/server/index.ts';
import {snapshotPluginConfig} from '../../../packages/dsh-plugin/server/config.ts';
import {validateServiceUrl, ServiceFailure} from '../../../packages/dsh-plugin/server/service-client.ts';
import type {PluginContext, PluginConfig} from '../../../packages/dsh-plugin/server/types.ts';
import type {JsonValue} from '../../../packages/app-contracts/src/index.ts';
import {AppsHost, HttpAppsHostTransport, type AppsPluginContext, type AppsHostTransport} from '../../../packages/plugin-apps/src/index.ts';
import {apply as attachHallmark} from '../../../packages/plugin-hallmark/src/index.ts';
import {apply as attachNotes} from '../../../packages/plugin-notes/src/index.ts';
import type {NativeSessionAdapterMode} from '../../../packages/dsh-compat/src/index.ts';
export const name = 'dsh-plugin-apps-bundle';
export const version = '1.0.0-candidate.6';
export const inject = ['tools', 'commands', 'systemPrompt', 'connection', 'agents', 'sessionQuery'];
export const Config = Schema.object({
  serviceUrl: Schema.string().default('http://127.0.0.1:4181').description('显式Apps Runtime回环地址；候选包不启动或重启运行服务。'),
  dataDirectory: Schema.string().default('').description('隔离Apps Runtime绝对数据目录；留空仅使用明确APPS_DATA_DIR，不能复用旧库。'),
  requestTimeoutMs: Schema.natural().min(100).max(90000).default(75000),
  contentBudgetBytes: Schema.natural().min(2048).max(16384).default(16384),
  legacyToolProjection: Schema.boolean().default(false).description('兼容模式才显式注册旧26工具Schema；默认仅固定发现网关，旧别名/HTTP/bridge解释器仍保留。'),
  nativeSessionAdapter: Schema.union(['disabled','dsh-0.2.0-rc.2']).default('disabled').description('显式选择已核实的DSH正式会话适配。默认关闭；缺正式服务时降级。'),
});
/** Compatibility names keep their old Host implementation/renderer and dispatch into P2 exactly once. */
export class RuntimeLegacyHallmarkPlugin extends HallmarkPlugin {
  readonly runtimeTransport: AppsHostTransport;
  constructor(ctx: PluginContext, config: PluginConfig, transport: AppsHostTransport) {
    super(ctx,config);this.runtimeTransport = transport;
    const request = this.client.request.bind(this.client);
    // Decorate the transport so original rendering, source-asset registration and session guard stay intact.
    this.client.request = async (path,body,signal,timeoutMs) => {
      const match = /^\/tools\/(hallmark_[a-z_]+)$/.exec(path);
      if (!match || body === undefined) return request(path,body,signal,timeoutMs);
      const input = body as {arguments: JsonValue;sessionId: string};
      try {return await transport.legacyInvoke({name: match[1],arguments: input.arguments,sessionId: input.sessionId,invocationId: randomUUID(),traceId: randomUUID(),deadlineAt: new Date(Date.now()+Math.min(timeoutMs??90000,90000)).toISOString()},signal);}
      catch {signal?.throwIfAborted();throw new ServiceFailure('RUNTIME_RESPONSE_UNAVAILABLE',true);}
    };
  }
}
export interface AppsBundleHandle {host: AppsHost;legacy: RuntimeLegacyHallmarkPlugin;dispose(): Promise<void>}
/** Explicit assembly owns 1+N logical modules; no Provider is imported into the Host. */
export async function createAppsBundle(ctx: PluginContext & AppsPluginContext, config: PluginConfig, transport: AppsHostTransport, options: {legacyToolProjection?: boolean;nativeSessionAdapter?: NativeSessionAdapterMode} = {}): Promise<AppsBundleHandle> {
  let sessions:AppsPluginContext['sessions'];try{sessions=(typeof ctx.get==='function'?ctx.get('sessions'):ctx.sessions) as AppsPluginContext['sessions'];}catch{sessions=undefined;}
  const legacyContext: PluginContext = {
    agents: ctx.agents, sessions, sessionQuery: ctx.sessionQuery, commands: ctx.commands, connection: ctx.connection,
    tools: {register: tool => options.legacyToolProjection ? ctx.tools.register(tool) : () => {}},
    // An unregistered legacy tool must not be advertised as available in the model's instructions.
    systemPrompt: {context: contribution => options.legacyToolProjection ? ctx.systemPrompt.context(contribution) : () => {}},
    on: ctx.on.bind(ctx), ...(ctx.effect ? {effect: ctx.effect.bind(ctx)} : {}),
  };
  const legacy = new RuntimeLegacyHallmarkPlugin(legacyContext,config,transport);
  // Reuse the single legacy asset-route owner; new Apps views do not create a second registration set.
  const host = new AppsHost(ctx,transport,undefined,{nativeSessionAdapter:options.nativeSessionAdapter,prepareView:async(view,sessionId,signal)=>{
    if(!view||typeof view!=='object'||Array.isArray(view)||!view.source)return;
    const response=await legacy.ui(new Request(`http://dsh.invalid/api/hallmark-app?resource=sessionView&sessionId=${encodeURIComponent(sessionId)}&viewId=${encodeURIComponent(String(view.viewId))}`,{signal}));
    if(!response.ok)throw new Error('SOURCE_ASSET_REGISTRATION_FAILED');
  }});
  const attachments: (() => void)[] = [];
  let disposed = false;
  const dispose = async () => {if (disposed) return;disposed = true;attachments.splice(0).reverse().forEach(remove => remove());await Promise.allSettled([legacy.dispose(),host.dispose()]);};
  try {await host.start();attachments.push(host.attachApp('apps'),attachHallmark(host),attachNotes(host));await legacy.start();} catch (error) {await dispose();throw error;}
  ctx.effect?.(() => () => {void dispose();});
  return {host,legacy,dispose};
}
export async function apply(ctx: PluginContext & AppsPluginContext, raw: unknown = {}): Promise<void> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['serviceUrl','dataDirectory','requestTimeoutMs','contentBudgetBytes','legacyToolProjection','nativeSessionAdapter'].includes(key))) throw new Error('INVALID_APPS_BUNDLE_CONFIG');
  const parsed = Config(raw) as {serviceUrl: string;dataDirectory: string;requestTimeoutMs: number;contentBudgetBytes: number;legacyToolProjection: boolean;nativeSessionAdapter:NativeSessionAdapterMode};
  const directory = parsed.dataDirectory || process.env.APPS_DATA_DIR;
  if (!directory || !isAbsolute(directory)) throw new Error('APPS_DATA_DIRECTORY_REQUIRED');
  const serviceUrl = validateServiceUrl(parsed.serviceUrl);
  const token = readFileSync(join(directory,'service-key'),'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('SERVICE_KEY_INVALID');
  const config = snapshotPluginConfig({serviceUrl,dataDirectory:directory,autoStart:false,requestTimeoutMs:parsed.requestTimeoutMs,contentBudgetBytes:parsed.contentBudgetBytes});
  await createAppsBundle(ctx,config,new HttpAppsHostTransport(serviceUrl,token),{legacyToolProjection:parsed.legacyToolProjection,nativeSessionAdapter:parsed.nativeSessionAdapter});
}
export default {name, inject, Config, apply};
