import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { TOOL_DEFINITIONS, validate, failed, type ToolResult, type InvocationContext } from '../../contracts/src/index.ts';
import { executeUI, type UIManager } from './ui.ts';
import { SERVICE_IDENTITY } from './version.ts';
import type { OverviewDto } from '../../contracts/src/overview.ts';
import { SessionViewError, type SessionViewChange } from '../../core/src/views.ts';
export interface StoreLike { get<T = any>(collection: string, id: string): T | undefined; put<T>(collection: string, id: string, value: T): T; list<T = any>(collection: string): T[] }
export interface CoreLike { invoke(name: string, args: Record<string, unknown>, context: InvocationContext): Promise<ToolResult>; refreshDataset(datasetKey: string, context: InvocationContext): Promise<ToolResult>; refreshDatasetBackground?(datasetKey: string): Promise<ToolResult>; listSessionViews?(sessionId:string):unknown; getSessionView?(sessionId:string,viewId:string):unknown; getSessionViewData?(sessionId:string,viewId:string):unknown; manageSessionView?(sessionId:string,viewId:string,change:SessionViewChange):unknown; restoreSessionView?(sessionId:string,spec:import('../../presentation/src/types.ts').ViewSpec):unknown }
export type PresentationLike = UIManager;
export interface ServiceOptions { token: string; core: CoreLike; store: StoreLike; presentation: PresentationLike; health: () => Promise<unknown>; overview?: () => Promise<OverviewDto>; port?: number; allowedOrigins?: string[]; logDirectory?: string }
export function defaultDataDirectory(): string { return resolve(process.env.HALLMARK_APP_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'dsh-hallmark-app')); }
export function getOrCreateToken(directory: string): string {
  mkdirSync(directory, {recursive: true});
  const path = join(directory,'service-key');
  if (!existsSync(path)) {try {writeFileSync(path,randomBytes(32).toString('hex'),{encoding:'utf8',mode:0o600,flag:'wx'});} catch(error) {if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;}}
  const token = readFileSync(path,'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('INVALID_SERVICE_KEY');
  return token;
}
function sameToken(expected: string, actual: string): boolean { const a=Buffer.from(expected), b=Buffer.from(actual); return a.length===b.length && timingSafeEqual(a,b); }
function loopback(address: string | undefined): boolean {return address==='127.0.0.1' || address==='::1' || address==='::ffff:127.0.0.1';}
function send(res: ServerResponse, code: number, value: unknown): void {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}); res.end(JSON.stringify(value));}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw Object.assign(new Error('JSON_CONTENT_TYPE_REQUIRED'),{statusCode:415});
  const chunks: Buffer[]=[]; let size=0;
  for await(const part of req) {size+=part.length; if(size>1024*1024) throw Object.assign(new Error('BODY_TOO_LARGE'),{statusCode:413}); chunks.push(part);}
  let value: unknown; try {value=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Object.assign(new Error('OBJECT_REQUIRED'),{statusCode:400});
  return value as Record<string,unknown>;
}
export function createAppServer(options: ServiceOptions) {
  if (options.token.length<32) throw new Error('SERVICE_KEY_TOO_SHORT');
  const log=(event:Record<string,unknown>)=>{if (!options.logDirectory) return; mkdirSync(options.logDirectory,{recursive:true}); const day=new Date().toISOString().slice(0,10); appendFileSync(join(options.logDirectory,`${day}.jsonl`),JSON.stringify({at:new Date().toISOString(),...event})+'\n'); for(const name of readdirSync(options.logDirectory)) {if(/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && Date.parse(name.slice(0,10))<Date.now()-14*86400000) {const absolute=resolve(options.logDirectory,name); if(absolute.startsWith(resolve(options.logDirectory)+requireSeparator())) unlinkSync(absolute);}}};
  const server=createServer(async(req,res)=>{
    const started=Date.now(); let route='unknown';
    try {
      if(!loopback(req.socket.remoteAddress)) return send(res,403,failed('LOCAL_ONLY','Only loopback connections are accepted'));
      const address=server.address(); const port=address && typeof address==='object' ? address.port : options.port ?? 4180;
      const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`]);
      if(!hosts.has((req.headers.host??'').toLowerCase())) return send(res,403,failed('INVALID_HOST','Host rejected'));
      const origin=req.headers.origin;
      if(origin && !(options.allowedOrigins??[]).includes(origin)) return send(res,403,failed('INVALID_ORIGIN','Origin rejected'));
      if(!sameToken(options.token,(req.headers.authorization??'').replace(/^Bearer /,''))) return send(res,401,failed('UNAUTHORIZED','A local service key is required'));
      if(req.url?.includes('%2f')||req.url?.includes('%2F')||req.url?.includes('..')) return send(res,400,failed('INVALID_PATH','Encoded separators/traversal rejected'));
      const url=new URL(req.url??'/',`http://127.0.0.1:${port}`); route=url.pathname;
      if(req.method==='GET'&&route==='/health') return send(res,200,{status:'ok',...SERVICE_IDENTITY,hallmark:await options.health()});
      if(req.method==='GET'&&route==='/tools') return send(res,200,{tools:TOOL_DEFINITIONS});
      const sourceRoute=route.match(/^\/source-builds\/([a-f0-9]{64})\/(manifest|thumbnail|files\/(.+))$/);
      if(req.method==='GET'&&sourceRoute){
        const sources=options.presentation.sources;
        if(!sources)return send(res,503,failed('SOURCE_RUNTIME_UNAVAILABLE','源码组件运行时不可用。'));
        if(sourceRoute[2]==='manifest'){
          const manifest=sources.manifest(sourceRoute[1]);
          return send(res,manifest?200:404,manifest?{buildId:manifest.buildId,entry:manifest.entry,files:manifest.files}:failed('SOURCE_BUILD_NOT_FOUND','源码构建不存在。'));
        }
        if(sourceRoute[2]==='thumbnail'){
          const bytes=sources.thumbnail(sourceRoute[1]);if(!bytes)return send(res,404,failed('SOURCE_PREVIEW_NOT_FOUND','该构建还没有匹配的预览截图。'));
          res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.end(bytes);return;
        }
        const asset=sources.readFile(sourceRoute[1],decodeURIComponent(sourceRoute[3]));
        if(!asset)return send(res,404,failed('SOURCE_FILE_NOT_FOUND','构建资源不存在。'));
        res.writeHead(200,{'Content-Type':asset.mime,'Content-Length':asset.bytes.length,'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.end(asset.bytes);return;
      }
      if(req.method==='GET'&&route==='/ui/overview') {
        if(url.searchParams.size)return send(res,400,failed('INVALID_INPUT','Overview reads do not accept query parameters'));
        return options.overview ? send(res,200,await options.overview()) : send(res,503,failed('OVERVIEW_UNAVAILABLE','首页数据读取尚未接入'));
      }
      if(route.startsWith('/ui/')) {
        try {const input=req.method==='POST'?await body(req):{}; const output=await executeUI(route,req.method??'GET',input,options.presentation,options.store,options.core.refreshDatasetBackground?.bind(options.core),options.core.restoreSessionView?.bind(options.core)); return send(res,output===undefined?404:200,output??failed('UI_NOT_FOUND','本地展示资源不存在'));}
        catch(error) {const typed=error as Error&{code?:string;statusCode?:number}; return send(res,typed.statusCode??400,failed(typed.code??'INVALID_UI_INPUT',typed.message));}
      }
      const ownedViewRoute=route.match(/^\/sessions\/([^/]+)\/views(?:\/([^/]+)(\/data)?)?$/);
      if((req.method==='GET'||req.method==='POST'&&ownedViewRoute?.[2]&&!ownedViewRoute[3])&&ownedViewRoute) {
        const sessionId=decodeURIComponent(ownedViewRoute[1]);
        const viewId=ownedViewRoute[2]?decodeURIComponent(ownedViewRoute[2]):undefined;
        if(!/^[-a-zA-Z0-9_]{1,160}$/.test(sessionId)||(viewId!==undefined&&!/^[-a-zA-Z0-9_.:]{1,180}$/.test(viewId)))return send(res,400,failed('INVALID_SESSION_VIEW','Invalid session/view identity'));
        if(url.searchParams.size)return send(res,400,failed('INVALID_INPUT','Session view routes do not accept arbitrary query fields'));
        if(req.method==='POST') {
          const input=await body(req);
          if(typeof input.action!=='string'||!['rename','remove'].includes(input.action)||Object.keys(input).some(key=>!['action',...(input.action==='rename'?['title']:[])].includes(key))||input.action==='rename'&&(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>200))return send(res,400,failed('INVALID_INPUT','仅支持有效名称的重命名或从本会话移除。'));
          if(!options.core.manageSessionView)return send(res,503,failed('SESSION_VIEW_MANAGEMENT_UNAVAILABLE','当前服务尚不支持会话组件管理。'));
          try{return send(res,200,await options.core.manageSessionView(sessionId,viewId!,input as SessionViewChange));}
          catch(error){if(error instanceof SessionViewError)return send(res,error.code==='INVALID_INPUT'?400:404,failed(error.code,error.message));throw error;}
        }
        // Owned read authority is independent of active chat capability. Never dispatch a business tool.
        const value=await (viewId===undefined?options.core.listSessionViews?.(sessionId):ownedViewRoute[3]?options.core.getSessionViewData?.(sessionId,viewId):options.core.getSessionView?.(sessionId,viewId));
        return send(res,value===undefined?404:200,value??failed('SESSION_VIEW_NOT_FOUND','组件不属于本会话或临时视图已失效。'));
      }
      const sessionRoute=route.match(/^\/sessions\/([^/]+)\/app$/);
      if(sessionRoute) {
        const sessionId=decodeURIComponent(sessionRoute[1]);
        if(!/^[-a-zA-Z0-9_]{1,160}$/.test(sessionId)) return send(res,400,failed('INVALID_SESSION','Invalid session id'));
        if(req.method==='GET') return send(res,200,{sessionId,appId:'hallmark',active:false,...options.store.get<Record<string,unknown>>('session_apps',sessionId)});
        if(req.method==='POST') {const input=await body(req); if(typeof input.active!=='boolean'||Object.keys(input).some(k=>k!=='active')) return send(res,400,failed('INVALID_INPUT','Only active:boolean is accepted')); return send(res,200,options.store.put('session_apps',sessionId,{sessionId,appId:'hallmark',active:input.active,activatedAt:new Date().toISOString()}));}
      }
      const toolRoute=route.match(/^\/tools\/(hallmark_[a-z_]+)$/);
      if(req.method==='POST'&&toolRoute) {
        const definition=TOOL_DEFINITIONS.find(t=>t.name===toolRoute[1]); if(!definition) return send(res,404,failed('TOOL_NOT_FOUND','Unknown tool'));
        const input=await body(req); const args=input.arguments;
        const sessionId=input.sessionId;
        if(typeof sessionId!=='string'||!/^[-a-zA-Z0-9_]{1,160}$/.test(sessionId)||Object.keys(input).some(k=>!['arguments','sessionId','userRequest'].includes(k))) return send(res,400,failed('INVALID_INPUT','Trusted sessionId and arguments are required'));
        if(!options.store.get('session_apps',sessionId)?.active) return send(res,200,failed('APP_NOT_ACTIVE','请先在当前会话选择 Hallmark 应用或输入 /hallmark'));
        const errors=validate(definition.parameters,args);
        if(errors.length) return send(res,400,failed('INVALID_INPUT',errors.join('; ')));
        const abort=new AbortController(); req.once('aborted',()=>abort.abort());
        const result=await options.core.invoke(definition.name,args as Record<string,unknown>,{sessionId,signal:abort.signal,...(typeof input.userRequest==='string'?{userRequest:input.userRequest}:{})});
        return send(res,200,result);
      }
      if(req.method==='POST'&&route==='/refresh') {
        const input=await body(req); if(Object.keys(input).some(k=>!['datasetKey','sessionId'].includes(k))||typeof input.datasetKey!=='string'||typeof input.sessionId!=='string') return send(res,400,failed('INVALID_INPUT','datasetKey and sessionId required'));
        const localReceipt=input.datasetKey.startsWith('operation:');
        if(localReceipt) {const record=options.store.get('operations',input.datasetKey.slice('operation:'.length));if(!record||record.sessionId!==input.sessionId)return send(res,404,failed('OPERATION_RECEIPT_NOT_FOUND','此会话没有可读取的操作回执'));}
        else if(!options.store.get('session_apps',input.sessionId)?.active) return send(res,200,failed('APP_NOT_ACTIVE','请先激活应用'));
        return send(res,200,await options.core.refreshDataset(input.datasetKey,{sessionId:input.sessionId}));
      }
      const viewRoute=route.match(/^\/views\/([^/]+)(\/data)?$/);
      if(req.method==='GET'&&viewRoute) {const sessionId=url.searchParams.get('sessionId'); if(!sessionId||!options.store.get('session_apps',sessionId)?.active) return send(res,403,failed('APP_NOT_ACTIVE','请先在当前会话激活应用')); const value=viewRoute[2]?options.presentation.getViewData(decodeURIComponent(viewRoute[1])):options.presentation.getView(decodeURIComponent(viewRoute[1])); return send(res,value?200:404,value??failed('VIEW_NOT_FOUND','View missing'));}
      const operationRoute=route.match(/^\/operations\/([^/]+)$/);
      if(req.method==='GET'&&operationRoute) {const operation=options.store.get('operations',decodeURIComponent(operationRoute[1])); const sessionId=url.searchParams.get('sessionId'); if(!sessionId||!options.store.get('session_apps',sessionId)?.active) return send(res,403,failed('APP_NOT_ACTIVE','请先激活应用')); if(operation?.sessionId!==sessionId) return send(res,404,failed('OPERATION_NOT_FOUND','Operation not in session')); return send(res,200,operation);}
      return send(res,404,failed('ROUTE_NOT_FOUND','No such route; native tools are primary, MCP is not enabled'));
    } catch(error) {const typed=error as Error & {statusCode?:number}; log({event:'request-error',route,code:typed.statusCode??500,message:typed.message}); if(!res.headersSent) send(res,typed.statusCode??500,failed('SERVICE_ERROR',typed.statusCode?typed.message:'请求处理失败，详见本地日志')); else res.end();}
    finally {log({event:'request',route,method:req.method,status:res.statusCode,durationMs:Date.now()-started});}
  });
  server.requestTimeout=80_000; server.headersTimeout=10_000;
  return server;
}
function requireSeparator(): string {return process.platform==='win32'?'\\':'/';}
export async function listenAppServer(options: ServiceOptions) {
  const server=createAppServer(options);
  await new Promise<void>((ok,reject)=>{server.once('error',reject); server.listen(options.port??4180,'127.0.0.1',()=>{server.off('error',reject);ok();});});
  return server;
}
