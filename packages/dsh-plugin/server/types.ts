import type { ToolResult } from '../../contracts/src/index.ts';
/** Structural faces copied from runtime 0.2.0-rc.2 Inspect; no bundled DSH copies. */
export interface AgentRef { readonly id: string }
export interface Execution { readonly name: string; readonly arguments: unknown; readonly agent?: AgentRef; readonly signal: AbortSignal }
export type PreDecision = {kind:'allow'}|{kind:'deny';reason:string;info?:{name:string;code:string;reason?:string}}|{kind:'cancel'}|{kind:'ask';reason?:string};
export interface NativeTool {
  name: string; description: string; parameters: Record<string,unknown>;
  output: {schema: Record<string,unknown>;render(args:unknown,value:unknown):{type:'text';text:string}[];presentationMeta(args:unknown,value:unknown):Record<string,unknown>};
  execute(args:unknown,exec:Execution):Promise<ToolResult>;
  timeoutMs:number; isConcurrencySafe(args:unknown):boolean;
}
export interface PluginContext {
  tools: {register(tool:NativeTool):()=>void};
  commands: {register(command:{name:string;description:string;input?:{hint:string};handler(invocation:{agent:AgentRef;rawInput:string;signal:AbortSignal}):Promise<{kind:'success'|'error';text:string}>}):()=>void};
  systemPrompt: {context(contribution:{name:string;order:number;text(context:{scope?:object;agent?:AgentRef}):string}):()=>void};
  agents: {get(id:string):AgentRef|undefined;list():AgentRef[]};
  sessions?: {get(id:string):{id:string}|undefined};
  sessionQuery?: {readTitleSnapshot(id:string,signal?:AbortSignal):Promise<{session:{id:string}}>};
  connection: {fetch:{register(route:{path:string;methods:readonly ('GET'|'POST')[];requestBody:'buffered';fetch(request:Request):Promise<Response>}):()=>Promise<void>}};
  on(event:'tools/pre-execute',listener:(exec:Execution,next:()=>Promise<PreDecision>)=>Promise<PreDecision>):()=>void;
  on(event:'agent/created',listener:(payload:{agent:AgentRef;source:string;signal?:AbortSignal})=>Promise<undefined>):()=>void;
  effect?(factory:()=>()=>void):unknown;
}
export interface PluginConfig {
  serviceUrl?:string; dataDirectory?:string; autoStart?:boolean;
  nodeExecutable?:string; serviceEntry?:string; serviceCwd?:string;
  requestTimeoutMs?:number; contentBudgetBytes?:number;
}
export interface SessionApp {sessionId:string;appId:'hallmark';active:boolean;activatedAt?:string}
