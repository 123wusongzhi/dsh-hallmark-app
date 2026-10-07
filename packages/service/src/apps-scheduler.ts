import {randomUUID} from 'node:crypto';
import {canonicalJson,compileSchema,datasetId} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,DatasetBinding,InvocationSource} from '../../app-contracts/src/index.ts';
import type {DatasetSnapshot,PresentationStore} from '../../app-presentation/src/types.ts';
import {SnapshotTickWorker} from './scheduler.ts';

export interface AppsScheduleInput {scheduleId:string;binding:DatasetBinding;timeZone:string;times:string[];enabled?:boolean;misfirePolicy?:'coalesce_once'}
export interface AppsSchedule extends AppsScheduleInput {
  enabled:boolean;misfirePolicy:'coalesce_once';revision:number;nextRunAt:string|null;createdAt:string;updatedAt:string;
  lastScheduledAt?:string;lastRunAt?:string;lastRunId?:string;lastResult?:{state:'ready'|'failed'|'unavailable'|'skipped';code?:string;datasetRevision?:string};lastSlot?:string;
  executionState?:'running'|'settled';lastWorkerId?:string;
}
interface PlanRecord {appId:'apps';connectionId:'presentation';namespace:'apps_schedules';recordId:string;value:AppsSchedule}
export interface AppsSchedulerOptions {store:PresentationStore;refresh:(binding:DatasetBinding,source:InvocationSource)=>Promise<DatasetSnapshot>;describe:(capabilityId:string)=>CapabilityDescriptor|undefined;isConnectionEnabled:(appId:string,connectionId:string)=>boolean;admit?:()=>void;now?:()=>Date;report?:(error:unknown)=>void;intervalMs?:number}
const id=(scheduleId:string)=>canonicalJson(['apps','presentation','apps_schedules',scheduleId]);
const error=(code:string):never=>{throw new Error(code);};
const nonempty=(value:unknown):value is string=>typeof value==='string'&&!!value.trim();
const formatters=new Map<string,Intl.DateTimeFormat>();
function formatter(timeZone:string):Intl.DateTimeFormat {let value=formatters.get(timeZone);if(!value){value=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});formatters.set(timeZone,value);}return value;}
function slot(at:Date,timeZone:string):{minute:string;key:string} {const parts=Object.fromEntries(formatter(timeZone).formatToParts(at).map(part=>[part.type,part.value]));const minute=`${parts.hour}:${parts.minute}`;return {minute,key:`${parts.year}-${parts.month}-${parts.day}:${minute}`};}
/** UTC search handles DST gaps and repeated wall-clock minutes without inventing a timezone offset. */
export function nextScheduleRun(now:Date,timeZone:string,times:string[],lastSlot?:string):string {
  if(!Number.isFinite(now.getTime()))error('INVALID_SCHEDULE_CLOCK');formatter(timeZone);
  for(let at=Math.floor(now.getTime()/60000)*60000+60000,end=at+3*86400000;at<end;at+=60000){const current=slot(new Date(at),timeZone);if(times.includes(current.minute)&&current.key!==lastSlot)return new Date(at).toISOString();}
  return error('SCHEDULE_HAS_NO_NEXT_RUN');
}

/** Persistent plans use the Runtime's sole database writer and the existing snapshot tick mechanism. */
export class AppsSnapshotScheduler {
  readonly workerId=randomUUID();
  private worker:SnapshotTickWorker;
  private options:AppsSchedulerOptions;
  private startedAt:string|null=null;
  constructor(options:AppsSchedulerOptions){this.options=options;this.worker=new SnapshotTickWorker({tick:now=>this.run(now),now:options.now,report:options.report,intervalMs:options.intervalMs});}
  start():void {if(!this.worker.online)this.startedAt=(this.options.now?.()??new Date()).toISOString();this.worker.start();}
  async stop():Promise<void>{this.worker.stop();await this.worker.idle();}
  idle():Promise<void>{return this.worker.idle();}
  status(){return {workerId:this.workerId,processId:process.pid,startedAt:this.startedAt,state:this.worker.online?'running' as const:'stopped' as const,executing:this.worker.running,missedExecutionPolicy:'coalesce_once' as const,plans:this.list().map(plan=>({scheduleId:plan.scheduleId,revision:plan.revision,enabled:plan.enabled,timeZone:plan.timeZone,nextRunAt:plan.nextRunAt,lastRunAt:plan.lastRunAt??null,lastRunId:plan.lastRunId??null,lastWorkerId:plan.lastWorkerId??null,executionState:plan.executionState??'settled',lastResult:plan.lastResult??null}))};}
  get(scheduleId:string):AppsSchedule|undefined{return this.options.store.get<PlanRecord>('provider_records',id(scheduleId))?.value;}
  list():AppsSchedule[]{return this.options.store.list<PlanRecord>('provider_records').filter(row=>row.appId==='apps'&&row.connectionId==='presentation'&&row.namespace==='apps_schedules').map(row=>row.value).sort((a,b)=>a.scheduleId.localeCompare(b.scheduleId));}
  private validate(input:AppsScheduleInput):AppsScheduleInput {
    canonicalJson(input);
    if(Object.keys(input).some(name=>!['scheduleId','binding','timeZone','times','enabled','misfirePolicy'].includes(name)))error('INVALID_SCHEDULE');
    if(!nonempty(input.scheduleId)||!nonempty(input.timeZone)||!Array.isArray(input.times)||!input.times.length||input.times.some(time=>typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||new Set(input.times).size!==input.times.length||input.enabled!==undefined&&typeof input.enabled!=='boolean'||input.misfirePolicy!==undefined&&input.misfirePolicy!=='coalesce_once')error('INVALID_SCHEDULE');
    try{formatter(input.timeZone);}catch{error('INVALID_SCHEDULE_TIMEZONE');}
    const binding=input.binding;if(!binding||!nonempty(binding.bindingId)||!nonempty(binding.appId)||!nonempty(binding.connectionId)||!nonempty(binding.capabilityId)||!Number.isSafeInteger(binding.capabilityMajor)||binding.capabilityMajor<1||!Array.isArray(binding.projection)||binding.projection.some(field=>typeof field!=='string'||!field)||new Set(binding.projection).size!==binding.projection.length||Object.keys(binding).some(name=>!['bindingId','appId','connectionId','capabilityId','capabilityMajor','input','projection','datasetId','refresh'].includes(name))||!binding.refresh||!['manual','scheduled'].includes(binding.refresh.mode)||Object.keys(binding.refresh).some(name=>!['mode','scheduleId'].includes(name)))error('INVALID_SCHEDULE_BINDING');
    if(binding.refresh.mode==='scheduled'&&binding.refresh.scheduleId!==input.scheduleId)error('SCHEDULE_BINDING_MISMATCH');
    const descriptor=this.options.describe(binding.capabilityId)??error('CAPABILITY_UNAVAILABLE');
    if(!['query','compute'].includes(descriptor.effect)||descriptor.capabilityId.startsWith('apps.presentation.'))error('QUERY_NOT_READ_ONLY');
    if(!descriptor.capabilityId.startsWith(`${binding.appId}.`))error('INVALID_SCHEDULE_BINDING');
    if(Number(descriptor.version.split('.')[0])!==binding.capabilityMajor)error('INCOMPATIBLE_CAPABILITY');
    if(compileSchema(descriptor.inputSchema)(binding.input).length)error('INVALID_SCHEDULE_BINDING');
    const dataset=datasetId(binding);if(binding.datasetId!==undefined&&binding.datasetId!==dataset)error('DATASET_ID_MISMATCH');
    return {...structuredClone(input),times:[...input.times].sort(),binding:{...structuredClone(binding),refresh:{mode:'scheduled',scheduleId:input.scheduleId}}};
  }
  private save(plan:AppsSchedule):AppsSchedule {this.options.store.put('provider_records',id(plan.scheduleId),{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',recordId:plan.scheduleId,value:plan} satisfies PlanRecord);return structuredClone(plan);}
  create(raw:AppsScheduleInput):AppsSchedule {
    if(!this.worker.online&&raw.enabled!==false)error('SCHEDULER_UNAVAILABLE');
    const input=this.validate(raw),now=this.options.now?.()??new Date();
    return this.options.store.transaction(()=>{if(this.get(input.scheduleId))error('SCHEDULE_ALREADY_EXISTS');return this.save({...input,enabled:input.enabled??true,misfirePolicy:'coalesce_once',revision:1,nextRunAt:input.enabled===false?null:nextScheduleRun(now,input.timeZone,input.times),createdAt:now.toISOString(),updatedAt:now.toISOString()});});
  }
  update(scheduleId:string,input:Partial<Omit<AppsScheduleInput,'scheduleId'>>&{expectedRevision:number}):AppsSchedule {
    if(!this.worker.online&&input.enabled!==false)error('SCHEDULER_UNAVAILABLE');
    if(Object.keys(input).some(name=>!['expectedRevision','binding','timeZone','times','enabled','misfirePolicy'].includes(name)))error('INVALID_SCHEDULE');
    return this.options.store.transaction(()=>{const previous=this.get(scheduleId)??error('SCHEDULE_NOT_FOUND');if(input.expectedRevision!==previous.revision)error('SCHEDULE_REVISION_CONFLICT');const checked=this.validate({scheduleId,binding:input.binding??previous.binding,timeZone:input.timeZone??previous.timeZone,times:input.times??previous.times,enabled:input.enabled??previous.enabled,misfirePolicy:input.misfirePolicy??previous.misfirePolicy}),now=this.options.now?.()??new Date();const changedBinding=datasetId(checked.binding)!==datasetId(previous.binding),{lastResult,lastRunId,lastRunAt,lastScheduledAt,lastWorkerId,lastSlot,...identity}=previous,base=changedBinding?identity:previous;return this.save({...base,...checked,executionState:'settled',enabled:checked.enabled!,revision:previous.revision+1,nextRunAt:checked.enabled?nextScheduleRun(now,checked.timeZone,checked.times,changedBinding?undefined:previous.lastSlot):null,updatedAt:now.toISOString()});});
  }
  delete(scheduleId:string,expectedRevision:number):AppsSchedule {
    return this.options.store.transaction(()=>{const removed=this.update(scheduleId,{expectedRevision,enabled:false}),historyId=`${scheduleId}:${removed.revision}:${randomUUID()}`;this.options.store.put('provider_records',canonicalJson(['apps','presentation','apps_schedule_history',historyId]),{appId:'apps',connectionId:'presentation',namespace:'apps_schedule_history',recordId:historyId,value:{event:'deleted',plan:removed}});this.options.store.delete('provider_records',id(scheduleId));return removed;});
  }
  requireSchedule(scheduleId:string,binding:DatasetBinding):void {
    if(!this.worker.online)error('SCHEDULER_UNAVAILABLE');const plan=this.get(scheduleId)??error('SCHEDULE_NOT_FOUND');if(!plan.enabled)error('SCHEDULE_DISABLED');if(datasetId(plan.binding)!==datasetId(binding))error('SCHEDULE_BINDING_MISMATCH');
  }
  async tick(now=this.options.now?.()??new Date()):Promise<void>{if(!this.worker.online)error('SCHEDULER_UNAVAILABLE');await this.worker.tick(now);}
  private async run(now:Date):Promise<void> {
    if(!Number.isFinite(now.getTime()))error('INVALID_SCHEDULE_CLOCK');
    try{this.options.admit?.();}catch{return;}
    const groups=new Map<string,AppsSchedule[]>();
    for(const plan of this.list())if(plan.enabled&&plan.nextRunAt&&(Date.parse(plan.nextRunAt)<=now.getTime()||plan.executionState==='running'&&plan.lastWorkerId!==this.workerId)){
      const dataset=datasetId(plan.binding),plans=groups.get(dataset)??[];plans.push(plan);groups.set(dataset,plans);
    }
    await Promise.all([...groups.values()].map(async plans=>{
      if(!this.worker.online)return;
      const runId=randomUUID(),started=now.toISOString(),reserved:AppsSchedule[]=[];
      this.options.store.transaction(()=>{for(const plan of plans){const current=this.get(plan.scheduleId);if(!current?.enabled||current.revision!==plan.revision||current.nextRunAt!==plan.nextRunAt)continue;const recovery=plan.executionState==='running'&&plan.lastWorkerId!==this.workerId,lastScheduledAt=recovery?plan.lastScheduledAt??plan.nextRunAt!:plan.nextRunAt!,lastSlot=slot(new Date(lastScheduledAt),plan.timeZone).key;reserved.push(this.save({...current,lastSlot,lastScheduledAt,lastRunAt:started,lastRunId:runId,lastWorkerId:this.workerId,executionState:'running',nextRunAt:nextScheduleRun(now,plan.timeZone,plan.times,lastSlot),updatedAt:started}));}});
      if(!reserved.length)return;
      const binding=reserved[0].binding;
      let result:AppsSchedule['lastResult'];
      if(!this.options.isConnectionEnabled(binding.appId,binding.connectionId))result={state:'skipped',code:'CONNECTION_DISABLED'};
      else try{const snapshot=await this.options.refresh(binding,{kind:'scheduler',scheduleId:reserved[0].scheduleId,runId});result={state:snapshot.state,datasetRevision:snapshot.revision,...(snapshot.error?{code:snapshot.error.code}:{})};}
      catch(cause){const code=cause instanceof Error?cause.message:'SCHEDULE_REFRESH_FAILED';result={state:'unavailable',code};const dataset=datasetId(binding),old=this.options.store.get<DatasetSnapshot>('datasets',dataset);if(old)this.options.store.put('datasets',dataset,{...old,state:'unavailable',freshness:'stale',error:{code,message:code,retryPolicy:'read_retry'}});}
      this.options.store.transaction(()=>{for(const plan of reserved){const current=this.get(plan.scheduleId);if(current?.lastRunId===runId&&current.revision===plan.revision)this.save({...current,executionState:'settled',lastResult:result});}});
    }));
  }
}
