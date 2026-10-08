import {existsSync,readFileSync} from 'node:fs';
import {dirname,isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
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
import type {AppsAuthoringGuidance} from '../../../packages/plugin-apps/src/authoring-guidance.ts';
export const name = 'dsh-plugin-apps-bundle';
export const version = '1.0.0-candidate.22';
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
  const cliPath=join(dirname(process.execPath),'resources','runtime','cli','bin','dsh.cmd'),electron=Boolean(process.versions.electron);
  const dataDirectory=config.dataDirectory??process.env.APPS_DATA_DIR,serviceUrl=config.serviceUrl;
  const authoringGuidance:AppsAuthoringGuidance|undefined=dataDirectory&&serviceUrl?{cliPath:existsSync(cliPath)?cliPath:null,nodeExecutable:process.execPath,nodeArgs:electron?['--expose-internals']:[],nodeEnvironment:electron?{ELECTRON_RUN_AS_NODE:'1'}:{},starterPath:fileURLToPath(new URL('../source-starter/create-apps-source.mjs',import.meta.url)),sdkDirectory:fileURLToPath(new URL('../sdk/component-runtime',import.meta.url)),buildRunnerPath:fileURLToPath(new URL('./apps-authoring-build.js',import.meta.url)),previewRunnerPath:fileURLToPath(new URL('./apps-authoring-preview.js',import.meta.url)),runtime:{url:serviceUrl,keyFile:join(dataDirectory,'service-key'),archiveRoot:join(dataDirectory,'source-components'),evidenceRoot:join(dataDirectory,'authoring-evidence')}}:undefined;
  const host = new AppsHost(ctx,transport,undefined,{nativeSessionAdapter:options.nativeSessionAdapter,authoringGuidance,prepareView:async(view,sessionId,signal)=>{
    if(!view||typeof view!=='object'||Array.isArray(view))return;
    if(view.ownerSessionId!==sessionId)throw new Error('VIEW_NOT_OWNED');
    if(view.source)await legacy.prepareSource({kind:'source',source:view.source});
    let publication=view.publication;
    if(publication===undefined&&typeof view.pendingPublicationId==='string'&&transport.authoringAction){
      const inspected=await transport.authoringAction('inspect',sessionId,{publicationId:view.pendingPublicationId},signal);
      if(!inspected||typeof inspected!=='object'||Array.isArray(inspected))throw new Error('INVALID_PUBLICATION');
      publication=inspected.publication;
      if(!publication||typeof publication!=='object'||Array.isArray(publication)||publication.publicationId!==view.pendingPublicationId)throw new Error('INVALID_PUBLICATION');
    }
    if(publication!==undefined){
      if(!publication||typeof publication!=='object'||Array.isArray(publication)||publication.ownerSessionId!==sessionId||publication.viewId!==view.viewId||typeof publication.publicationId!=='string'||!['prepared','mounting','mounted','failed_mount','interrupted'].includes(String(publication.state))||!publication.source||typeof publication.source!=='object'||Array.isArray(publication.source)||publication.source.buildId!==publication.candidateBuildId)throw new Error('INVALID_PUBLICATION');
      await legacy.prepareSource({kind:'source',source:publication.source});
    }
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
