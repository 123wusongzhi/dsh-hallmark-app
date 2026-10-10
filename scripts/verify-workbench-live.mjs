import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createMaterialView} from '../packages/app-presentation/src/materials/catalog.ts';

const [runtimeUrl,keyFile,evidenceDirectory,mode='sources']=process.argv.slice(2);
if(!runtimeUrl||!keyFile||!evidenceDirectory)throw new Error('Usage: node scripts/verify-workbench-live.mjs <runtimeUrl> <keyFile> <evidenceDirectory> [sources|board]');
const token=readFileSync(keyFile,'utf8').trim(),sessionId='workbench-acceptance';
const evidence={at:new Date().toISOString(),runtimeUrl,mode,checks:[]};
mkdirSync(evidenceDirectory,{recursive:true});
const call=async(path,body)=>{
 const response=await fetch(new URL(path,runtimeUrl),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
 const value=await response.json();if(!response.ok)throw new Error(`${path}: ${JSON.stringify(value)}`);return value;
};
const invoke=async(appId,connectionId,capabilityId,input)=>{
 const id=randomUUID(),result=await call('/v1/invocations',{protocolVersion:'1.0',appId,connectionId,capabilityId,capabilityVersion:'1.0.0',invocationId:id,traceId:id,input,source:{kind:'agent',sessionId,nativeCallId:id},deadlineAt:new Date(Date.now()+60000).toISOString(),...(capabilityId==='apps.presentation.register_data_source'?{idempotencyKey:id}:{})});
 if(result.status!=='ok')throw new Error(JSON.stringify(result));return result;
};
const check=(name,passed,detail)=>{evidence.checks.push({name,passed,detail});if(!passed)throw new Error(name);};
try{
 const identity=await call('/v1/runtime');evidence.runtime=identity;
 const initialized=await call('/v1/workbench',{appId:'hallmark',operation:'initialize',params:{},sessionId});
 check('built-in sources verified',initialized.dataSources.length>=4,initialized.dataSources.map(row=>({title:row.title,status:row.validation.status})));
 const productSource=initialized.dataSources.find(source=>source.capabilityId==='hallmark.products.list'),connectionId=productSource.connectionId,storeId=productSource.input.storeId;
 await call('/v1/session-bindings',{sessionId,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
 const catalog=await invoke('apps','presentation','apps.presentation.list_materials',{});
 check('Agent material discovery',catalog.data.materials.some(row=>row.id==='activity-list'),catalog.invocationId);
 const activities=await invoke('hallmark',connectionId,'hallmark.api.actions.list',{storeId});
 check('real platform API sample',Array.isArray(activities.data.response?.result)&&activities.data.response.result.length>0,{invocationId:activities.invocationId,rows:activities.data.response?.result?.length});
 const definition={id:`agent:${connectionId}:${storeId}:activities`,title:'Agent 封装 · 店铺促销活动',description:'平台已有促销活动，名称与起止时间来自真实接口；仅展示。',appId:'hallmark',connectionId,capabilityId:'hallmark.api.actions.list',capabilityMajor:1,input:{storeId},parameters:[{name:'storeId',label:'店铺编号',type:'string',required:true,editable:false,default:storeId}],rowsPath:'response.result',fields:[{role:'activity.id',path:'id',confirmed:true},{role:'activity.name',path:'title',confirmed:true},{role:'activity.startsAt',path:'date_start',confirmed:true},{role:'activity.endsAt',path:'date_end',confirmed:true}],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
 const validated=await invoke('apps','presentation','apps.presentation.validate_data_source',{definition});check('Agent validates source',validated.data.status==='verified',validated.data);
 const sources=await invoke('apps','presentation','apps.presentation.list_data_sources',{appId:'hallmark'}),previous=sources.data.sources.find(source=>source.id===definition.id);
 const registration=previous?{data:previous,invocationId:'reused-existing'}:await invoke('apps','presentation','apps.presentation.register_data_source',{definition});
 check('Agent registers reusable source',registration.data.validation.status==='verified',{sourceId:registration.data.id,revision:registration.data.revision,invocationId:registration.invocationId});
 const listed=await call('/v1/workbench?resource=dataSources&appId=hallmark');check('source visible to UI',listed.dataSources.some(row=>row.id===definition.id),listed.dataSources.length);
 const instance={instanceId:`acceptance-activities-${randomUUID()}`,title:'促销活动 · 验收',materialId:'activity-list',materialVersion:1,design:createMaterialView('activity-list'),dataSources:{activities:{id:registration.data.id,revision:registration.data.revision,params:{}}},position:{order:0,span:2}};
 const preview=await call('/v1/workbench',{appId:'hallmark',operation:'preview',sessionId,params:{instance}});check('registered API source renders reusable material',preview.data.bindings[0].state==='ready',{rows:preview.data.bindings[0].payload.response.result.length});
 if(mode==='board'){
  const board=await call('/v1/workbench?resource=workbench&appId=hallmark');
  const second={...structuredClone(instance),instanceId:`acceptance-second-${randomUUID()}`,title:'同一数据源 · 第二实例',position:{order:board.instances.length+1,span:1}};instance.position.order=board.instances.length;
  const saved=await call('/v1/workbench',{appId:'hallmark',operation:'save',params:{expectedRevision:board.revision,instances:[...board.instances,instance,second]}});
  const data=await call('/v1/workbench',{appId:'hallmark',operation:'read',params:{instanceId:second.instanceId}});
  check('another persistent instance reuses source without chat',data.data.bindings[0].state==='ready',{revision:saved.revision,instanceId:second.instanceId});
 }
}finally{
 writeFileSync(resolve(evidenceDirectory,'live-data-source-evidence.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({checks:evidence.checks.map(row=>({name:row.name,passed:row.passed})),evidence:resolve(evidenceDirectory,'live-data-source-evidence.json')},null,2));
}
