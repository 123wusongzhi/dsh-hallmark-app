import {writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import type {AgentRef, NativeGatewayTool, NativeAssembleContext} from './index.ts';
// Standalone helper ships with the skill and is bundled into the Host as well.
// @ts-ignore standalone skill distribution has no declaration file
import {record, recover} from '../../../skills/ozon-listing/scripts/handoff.mjs';

interface Execution {name:string;callId:string;arguments:unknown;agent?:AgentRef}
interface Result {isError:boolean;content:{type:string;text?:string}[];[key:string]:unknown}
interface Decision {kind:'allow'|'deny'|'ask';reason?:string}
export interface ListingImageContext {
  tools:{register(tool:NativeGatewayTool):()=>void};
  agents:{get(id:string):AgentRef|undefined};
  systemPrompt?:{context(value:{name:string;order:number;text(context:unknown):string}):()=>void};
  on(event:'tools/pre-execute',listener:(execution:Execution,next:()=>Promise<Decision>)=>Promise<Decision>):()=>void;
  on(event:'tools/execute',listener:(execution:Execution,next:()=>Promise<Result>)=>Promise<Result>):()=>void;
}
interface Job {progressPath:string;assetKey:string;prompt:string;stage:string;sessionId:string;snapshot:string;approvedCalls:Set<string>}
function generationSnapshot(asset:Record<string,unknown>):string {
  return JSON.stringify([asset.prompt,asset.factsRevision,asset.preparationRevision,asset.salesRevision,asset.references,asset.slots]);
}
function argumentBlock(job:Job,args:{prompt?:unknown;referenceImages?:unknown[]}):string|undefined {
  if(args.prompt!==job.prompt)return '提示词与登记任务不一致。原样使用 listing_image_prepare 返回的 prompt，不追加背景、灯光、位置或结构描述。';
  if(!Array.isArray(args.referenceImages)||!args.referenceImages.length)return '上品生图须附该商品的真实参考图。';
}
/** Explicitly armed listing jobs only; ordinary image generation is unaffected. */
export function attachListingImageJobs(ctx:ListingImageContext,isSelected:(context:NativeAssembleContext)=>boolean=()=>false):()=>void {
  const jobs=new Map<string,Job>(),calls=new Map<string,Job>();
  const disposers:(()=>void)[]=[];
  const generationBlock = (job:Job):string|undefined => {
    if(job.stage==='superseded')return '该图已由恢复会话接管，本会话不再生成。';
    if(job.stage!=='generating')return '该图已有成功结果，读取进度继续归档或发布，禁止重生成。';
    const asset=recover(job.progressPath).find((row:{assetKey:string})=>row.assetKey===job.assetKey);
    if(!asset||asset.sessionId!==job.sessionId||generationSnapshot(asset)!==job.snapshot)return '图片任务身份或版本已变化，请重新调用 listing_image_prepare。';
    if(asset.stage!=='generating'||asset.nextAction!=='generate')return '该图已有成功结果或回执，请按恢复动作继续，禁止重生成。';
  };
  if(ctx.systemPrompt)disposers.push(ctx.systemPrompt.context({name:'listing-image-handoff',order:516,text:context=>!isSelected(context as NativeAssembleContext)?'':
    '进行 Ozon 上品图片制作时：每张图登记 image-progress.json 后，必须先调用 listing_image_prepare；把它返回的 prompt 原样传给 codex_image_generate，不能再次扩写设计限制。程序立即保存成功回执和路径；已有成功图按恢复动作处理，不重复生成。普通非上品生图不受此流程影响。'}));
  disposers.push(ctx.tools.register({
    name:'listing_image_prepare',
    description:'上品生图前读取已登记的单张任务。返回唯一最终 prompt，原样传给 codex_image_generate；程序核对调用一致性并立即登记成功路径。已生成的图返回恢复动作，不能重新生成。',
    parameters:{type:'object',properties:{progressPath:{type:'string',minLength:1},assetKey:{type:'string',minLength:1}},required:['progressPath','assetKey'],additionalProperties:false},
    output:{schema:{},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}],presentationMeta:()=>({})},
    timeoutMs:10000,isConcurrencySafe:()=>false,
    execute:async(input,execution)=>{
      const agent=execution.agent;
      if(!agent||ctx.agents.get(agent.id)!==agent)throw Error('真实图片代理会话身份缺失');
      const {progressPath,assetKey}=input as {progressPath:string;assetKey:string};
      if(!isAbsolute(progressPath))throw Error('进度文件必须使用绝对路径');
      const asset=recover(progressPath).find((row:{assetKey:string})=>row.assetKey===assetKey);
      if(!asset||typeof asset.prompt!=='string'||!asset.prompt.trim())throw Error('先按图片 skill 登记该 assetKey 的简短 prompt');
      if(asset.nextAction==='adopt_receipt')throw Error(`该图已生成：用回执中的 sourcePath 登记 generated 后继续，不重生成。回执：${asset.receipt.receiptPath}`);
      const active=jobs.get(agent.id);
      if(active&&[...calls.values()].includes(active))throw Error('当前图片调用尚未完成');
      let sessionId=asset.sessionId;
      if(asset.nextAction==='generate'&&sessionId!==agent.id){
        // No success receipt exists, so an unfinished generation is adopted unless it is still running here.
        if([...calls.values()].some(job=>job.progressPath===progressPath&&job.assetKey===assetKey))throw Error('原会话仍在生成这张图；等待它完成');
        for(const job of jobs.values())if(job.progressPath===progressPath&&job.assetKey===assetKey)job.stage='superseded';
        record(progressPath,{assetKey,stage:'generating',sessionId:agent.id});sessionId=agent.id;
      }
      const job={progressPath,assetKey,prompt:asset.prompt,stage:asset.stage,sessionId,snapshot:generationSnapshot(asset),approvedCalls:new Set<string>()};
      jobs.set(agent.id,job);
      return {assetKey,prompt:asset.prompt,stage:asset.stage,nextAction:asset.nextAction==='generate'?'generate_exact_prompt':asset.nextAction,sourcePath:asset.sourcePath??null,path:asset.path??null,url:asset.url??null};
    },
  }));
  disposers.push(ctx.on('tools/pre-execute',async(execution,next)=>{
    const prepared=execution.agent&&jobs.get(execution.agent.id);
    if(execution.name==='codex_image_generate')prepared?.approvedCalls.delete(execution.callId);
    const decision=await next();
    if(decision.kind!=='allow'||execution.name!=='codex_image_generate')return decision;
    const job=execution.agent&&jobs.get(execution.agent.id);
    if(job!==prepared)return {kind:'deny',reason:'图片任务在权限检查期间发生变化，请重新准备并检查。'};
    if(!job)return decision;
    let reason:string|undefined;
    try {reason=generationBlock(job);}catch {reason='图片进度无法核实，请恢复进度文件后再生成。';}
    if(reason)return {kind:'deny',reason};
    const args=execution.arguments as {prompt?:unknown;referenceImages?:unknown[]};
    reason=argumentBlock(job,args);if(reason)return {kind:'deny',reason};
    job.approvedCalls.add(execution.callId);
    return decision;
  }));
  disposers.push(ctx.on('tools/execute',async(execution,next)=>{
    const job=execution.name==='codex_image_generate'&&execution.agent?jobs.get(execution.agent.id):undefined;
    if(!job)return next();
    if(!job.approvedCalls.delete(execution.callId))throw Error('图片调用未获当前任务批准；请重新准备并检查后再生成。');
    if([...calls.values()].includes(job))throw Error('同一图片任务不能并行生成');
    // Approval and execution can be separated by another completed call or a recovery write.
    // Recheck the durable result and owner/version immediately before starting costly work.
    const reason=generationBlock(job)??argumentBlock(job,execution.arguments as {prompt?:unknown;referenceImages?:unknown[]});if(reason)throw Error(reason);
    calls.set(execution.callId,job);
    try {
      const result=await next();
      if(result.isError)return result;
      // Preserve the complete successful receipt before dependent staging/upload work.
      const text=result.content.filter(block=>block.type==='text').map(block=>block.text??'').join('\n');
      const match=/Original PNG saved on the DSH host at:\s*"([^"]+)"/.exec(text);
      const sourcePath=match?.[1].replace(/\\\\/g,'\\');
      job.stage='generated';
      const receipt={assetKey:job.assetKey,sessionId:job.sessionId,toolCallId:execution.callId,prompt:job.prompt,sourcePath:sourcePath??null,text,at:new Date().toISOString()};
      const suffix=createHash('sha256').update(execution.callId).digest('hex').slice(0,16);
      const receiptPath=`${job.progressPath}.${suffix}.receipt.json`;
      try {
        writeFileSync(receiptPath,JSON.stringify(receipt,null,2));
        if(!sourcePath)throw Error('成功回执格式变化，请从回执恢复路径');
        record(job.progressPath,{assetKey:job.assetKey,stage:'generated',sourcePath,toolCallId:execution.callId,actualPrompt:job.prompt,receiptPath});
      } catch(error) {
        // Never turn a successfully generated image into a retryable generation failure.
        return {...result,content:[...result.content,{type:'text',text:`图片已生成；进度登记需恢复：${String(error)}。保留本工具成功回执，禁止重生成。回执路径：${receiptPath}`} ]};
      }
      return result;
    } finally {calls.delete(execution.callId);}
  }));
  return ()=>{disposers.reverse().forEach(dispose=>dispose());jobs.clear();calls.clear();};
}
