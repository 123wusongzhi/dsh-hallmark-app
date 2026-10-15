// Acceptance-only adapter: real AppsHost/tools/review bridge, explicit bill authorization.
// This plugin is mounted only by the isolated headless acceptance profile.
import {readFileSync, appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {AppsHost, HttpAppsHostTransport} from '../packages/plugin-apps/src/index.ts';
import {attachListingImageJobs} from '../packages/plugin-apps/src/listing-image-jobs.ts';
export const name = 'listing-headless-acceptance';
export const inject = ['tools','agents','systemPrompt'];
export async function apply(ctx) {
  const data = process.env.LISTING_ACCEPTANCE_DATA;
  const evidence = process.env.LISTING_ACCEPTANCE_EVIDENCE;
  if (!data || !evidence || process.env.LISTING_ACCEPTANCE_AUTHORIZE_BILL !== 'yes') throw Error('Explicit acceptance authorization required');
  const transport = new HttpAppsHostTransport('http://127.0.0.1:4297',readFileSync(join(data,'service-key'),'utf8').trim());
  const bindings = new Map();
  async function bind(agent) {
    if (!agent || ctx.agents.get(agent.id) !== agent) throw Error('Real headless session required');
    if (!bindings.has(agent.id)) bindings.set(agent.id,transport.bind({sessionId:agent.id,appId:'hallmark',connectionId:'bill-source-board',enabled:true,boundAt:new Date().toISOString()}).then(receipt=>{
      appendFileSync(join(evidence,'bindings.jsonl'),JSON.stringify(receipt)+'\n');
    }));
    await bindings.get(agent.id);
  }
  const facade = {
    tools:{register(tool) {return ctx.tools.register({...tool,execute:async(args,execution)=>{await bind(execution.agent);return tool.execute(args,execution);}});}},
    agents:ctx.agents, systemPrompt:ctx.systemPrompt,
    get:ctx.get.bind(ctx), on:ctx.on.bind(ctx), effect:ctx.effect.bind(ctx),
  };
  const host = new AppsHost(facade,transport);
  const disposeImages = attachListingImageJobs({tools:ctx.tools,agents:ctx.agents,on:ctx.on.bind(ctx),systemPrompt:{context:contribution=>host.registerContext(contribution)}},context=>host.isAppSelected(context,'hallmark'));
  await host.start();host.attachApp('hallmark');host.attachApp('apps');
  host.registerContext({name:'hallmark-business-operations',order:515,text:context=>!host.isAppSelected(context,'hallmark')?'':
    '当前验收会话及其子代理已获用户授权使用 bill 店铺的 Hallmark 连接 bill-source-board；通过 Apps 网关使用。上品任务加载 ozon-listing skill。保存草稿不触发模型审核，提交确定版本时程序自动审核；程序绑定 SKU、采购成本并组装富文本。'});
  ctx.effect(()=>()=>{disposeImages();void host.dispose();});
}
