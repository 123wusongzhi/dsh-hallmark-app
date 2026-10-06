import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ToolResult } from '../../contracts/src/index.ts';
export const OUTPUT_SCHEMA:Record<string,unknown>={type:'object',properties:{
  status:{type:'string',enum:['ok','needs_clarification','pending','partial','failed','unknown','unavailable']},
  data:{},provenance:{type:'object'},clarification:{type:'object'},operation:{type:'object'},error:{type:'object'},metricBasis:{type:'string'},
},required:['status'],additionalProperties:false};
export function isToolResult(value:unknown):value is ToolResult {
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&['ok','needs_clarification','pending','partial','failed','unknown','unavailable'].includes((value as ToolResult).status);
}
export function presentationMeta(value:unknown):Record<string,unknown> {
  if(!isToolResult(value))return {};
  const data=value.data as {viewId?:unknown;id?:unknown}|undefined;
  const id=data&&typeof data==='object'?(typeof data.viewId==='string'?data.viewId:undefined):undefined;
  return {hallmark:{status:value.status,...(id?{viewId:id}:{})}};
}
/** Full value remains lossless; model content is budgeted separately. */
export function createRenderer(directory:string,budget=16_384):(args:unknown,value:unknown)=>{type:'text';text:string}[] {
  if(!Number.isInteger(budget)||budget<2048||budget>65536)throw new Error('INVALID_CONTENT_BUDGET');
  return (_args,value)=>{
    const json=JSON.stringify(value);
    if(Buffer.byteLength(json)<=budget)return [{type:'text',text:json}];
    let file:string|undefined;
    try{const spill=join(directory,'spill');mkdirSync(spill,{recursive:true});file=join(spill,`tool-${randomUUID()}.json`);writeFileSync(file,json,{encoding:'utf8',flag:'wx',mode:0o600});}catch{/* Never fall back to an unbounded raw dump. */}
    const result=isToolResult(value)?value:undefined;
    const summary={status:result?.status??'failed',largeResult:true,bytes:Buffer.byteLength(json),...(file?{file}:{fullResultUnavailable:true}),
      ...(result?.operation?{operation:result.operation}:{}),...(result?.provenance?{provenance:result.provenance}:{}),
      instruction:file?'完整结果已保留为本地JSON；优先分页或读取指定字段，不把整表送入上下文。':'结果超过模型预算且本地spill不可写；请使用较小分页。'};
    let text=JSON.stringify(summary);
    if(Buffer.byteLength(text)>budget)text=JSON.stringify({status:summary.status,largeResult:true,...(file?{file}:{}),bytes:summary.bytes});
    return [{type:'text',text}];
  };
}
