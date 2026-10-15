import {spawn} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync,statSync,unlinkSync} from 'node:fs';
import {basename,isAbsolute,join,resolve} from 'node:path';
import {createConnection} from 'node:net';
import {RuntimeHealthMonitor} from './runtime-health.ts';
import {validateServiceUrl} from '../../dsh-plugin/server/service-client.ts';

export interface RuntimeLaunchManifest {
  schemaVersion:1;managedBy:'dsh-plugin-apps-bundle';serviceUrl:string;nodeExecutable:string;entry:string;cwd:string;
  env:{APPS_DATA_DIR:string;APPS_CONNECTIONS_FILE:string;APPS_PORT:string};
  credentials:({name:string;fromFile:string;jsonField?:'token'}|{name:string;fromEnv:string})[];
}
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_LAUNCH_SPEC');return value as Record<string,unknown>;};
function keys(value:Record<string,unknown>,allowed:string[]):void {if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('INVALID_LAUNCH_SPEC');}
function path(value:unknown,directory=false):string {
  if(typeof value!=='string'||!isAbsolute(value)||value.includes('\0'))throw new Error('INVALID_LAUNCH_PATH');
  try{const info=statSync(value);if(directory?!info.isDirectory():!info.isFile())throw new Error();}catch{throw new Error('LAUNCH_PATH_UNAVAILABLE');}return resolve(value);
}
/** Only installer opt-in manifests are accepted; env cannot smuggle secrets or Node injection flags. */
export function validateRuntimeLaunchManifest(value:unknown,expected:{serviceUrl:string;dataDirectory:string;entry?:string}):RuntimeLaunchManifest {
  const item=object(value);keys(item,['schemaVersion','managedBy','serviceUrl','nodeExecutable','entry','cwd','env','credentials']);
  if(item.schemaVersion!==1||item.managedBy!=='dsh-plugin-apps-bundle')throw new Error('UNMANAGED_RUNTIME');
  if(typeof item.serviceUrl!=='string'||validateServiceUrl(item.serviceUrl)!==validateServiceUrl(expected.serviceUrl))throw new Error('LAUNCH_SERVICE_MISMATCH');
  const nodeExecutable=path(item.nodeExecutable),entry=path(item.entry),cwd=path(item.cwd,true),env=object(item.env);
  if(!/^node(?:\.exe)?$/i.test(basename(nodeExecutable)))throw new Error('NODE_EXECUTABLE_REQUIRED');
  if(expected.entry&&entry!==resolve(expected.entry))throw new Error('LAUNCH_ENTRY_MISMATCH');
  keys(env,['APPS_DATA_DIR','APPS_CONNECTIONS_FILE','APPS_PORT']);
  const data=path(env.APPS_DATA_DIR,true),connections=path(env.APPS_CONNECTIONS_FILE),url=new URL(item.serviceUrl);
  if(data!==resolve(expected.dataDirectory))throw new Error('LAUNCH_DATA_MISMATCH');
  if(typeof env.APPS_PORT!=='string'||! /^[1-9][0-9]{0,4}$/.test(env.APPS_PORT)||Number(env.APPS_PORT)>65535||Number(env.APPS_PORT)!==Number(url.port||80))throw new Error('LAUNCH_PORT_MISMATCH');
  if(!Array.isArray(item.credentials)||item.credentials.length>8)throw new Error('INVALID_CREDENTIAL_SOURCES');
  const names=new Set<string>(),credentials:RuntimeLaunchManifest['credentials']=[];
  for(const raw of item.credentials){
    const source=object(raw);keys(source,['name','fromFile','fromEnv','jsonField']);
    if(typeof source.name!=='string'||!['HALLMARK_OPERATOR_TOKEN','openrouter','OPENROUTER_API_KEY'].includes(source.name)||names.has(source.name))throw new Error('INVALID_CREDENTIAL_SOURCE');
    names.add(source.name);
    if(typeof source.fromFile==='string'&&!Object.hasOwn(source,'fromEnv')){
      if(source.jsonField!==undefined&&source.jsonField!=='token')throw new Error('INVALID_CREDENTIAL_SOURCE');
      credentials.push({name:source.name,fromFile:path(source.fromFile),...(source.jsonField?{jsonField:'token'}:{})});
    }else if(typeof source.fromEnv==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(source.fromEnv)&&!Object.hasOwn(source,'fromFile')&&!Object.hasOwn(source,'jsonField'))credentials.push({name:source.name,fromEnv:source.fromEnv});
    else throw new Error('INVALID_CREDENTIAL_SOURCE');
  }
  return {schemaVersion:1,managedBy:'dsh-plugin-apps-bundle',serviceUrl:url.origin,nodeExecutable,entry,cwd,env:{APPS_DATA_DIR:data,APPS_CONNECTIONS_FILE:connections,APPS_PORT:env.APPS_PORT},credentials};
}
export function loadRuntimeLaunchManifest(dataDirectory:string,serviceUrl:string,entry?:string):{manifest?:RuntimeLaunchManifest;reason?:string} {
  try{return {manifest:validateRuntimeLaunchManifest(JSON.parse(readFileSync(join(dataDirectory,'runtime-launch.json'),'utf8').replace(/^﻿/,'')),{dataDirectory,serviceUrl,entry})};}
  catch(error){return {reason:(error as NodeJS.ErrnoException).code==='ENOENT'?'NO_LAUNCH_SPEC':'INVALID_LAUNCH_SPEC'};}
}
/** Resolve at spawn time. Do not inherit Electron/Node flags or unrelated credentials. */
export function runtimeChildEnvironment(manifest:RuntimeLaunchManifest,inherited:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv {
  const env:NodeJS.ProcessEnv={};
  for(const name of ['SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','PATH','LOCALAPPDATA','APPDATA'])if(inherited[name])env[name]=inherited[name];
  Object.assign(env,manifest.env);
  for(const source of manifest.credentials){
    let value:unknown;
    try{if('fromEnv'in source)value=inherited[source.fromEnv];else {if(statSync(source.fromFile).size>65536)throw new Error();const text=readFileSync(source.fromFile,'utf8').replace(/^﻿/,'');value=source.jsonField?object(JSON.parse(text))[source.jsonField]:text;}}catch{throw new Error('CREDENTIAL_SOURCE_UNAVAILABLE');}
    if(typeof value!=='string'||!value.trim()||value.length>65536||value.includes('\0'))throw new Error('CREDENTIAL_SOURCE_UNAVAILABLE');
    env[source.name]=value.trim();
  }
  return env;
}
/** A timeout/unknown network error is NOT proof of a free port. Never kill its owner. */
export function runtimePortFree(serviceUrl:string):Promise<boolean> {
  const url=new URL(serviceUrl);return new Promise(resolve=>{
    const socket=createConnection({host:url.hostname.replace(/^\[|\]$/g,''),port:Number(url.port||80)});let settled=false;
    const done=(free:boolean)=>{if(settled)return;settled=true;socket.destroy();resolve(free);};
    socket.setTimeout(1000,()=>done(false));socket.once('connect',()=>done(false));socket.once('error',(error:NodeJS.ErrnoException)=>done(error.code==='ECONNREFUSED'));
  });
}
export interface RuntimeChild {pid?:number;hasExited():boolean}
export async function spawnRuntime(manifest:RuntimeLaunchManifest,env:NodeJS.ProcessEnv):Promise<RuntimeChild> {
  const logs=join(manifest.env.APPS_DATA_DIR,'logs');mkdirSync(logs,{recursive:true});
  const fd=openSync(join(logs,'runtime-child.log'),'a',0o600);
  try{
    const child=spawn(manifest.nodeExecutable,[manifest.entry],{cwd:manifest.cwd,env,detached:true,windowsHide:true,stdio:['ignore',fd,fd],shell:false});
    await new Promise<void>((accept,reject)=>{child.once('spawn',accept);child.once('error',reject);});child.unref();
    return {pid:child.pid,hasExited:()=>child.exitCode!==null||child.signalCode!==null};
  }finally{closeSync(fd);}
}
export const RUNTIME_RESTART_POLICY={initialBackoffMs:5000,maxBackoffMs:60000,attemptTimeoutMs:30000,failureLimit:5,failureWindowMs:600000,healthyResetMs:300000} as const;
export interface RuntimeRestarterOptions {
  monitor:RuntimeHealthMonitor;manifest:RuntimeLaunchManifest;log?:(row:Record<string,unknown>)=>void;now?:()=>number;
  portFree?:()=>Promise<boolean>;spawn?:(manifest:RuntimeLaunchManifest,env:NodeJS.ProcessEnv)=>Promise<RuntimeChild>;environment?:()=>NodeJS.ProcessEnv;
  policy?:Partial<{[K in keyof typeof RUNTIME_RESTART_POLICY]:number}>;
  /** Test seam; production serializes launch decisions across Host instances with an exclusive file. */
  acquire?:()=>(remove?:boolean)=>void;
}
/** Tick on every health sample, not only transitions: retries must continue while state remains down. */
export class RuntimeRestarter {
  #options:RuntimeRestarterOptions;#policy;#now:()=>number;#remove?:()=>void;#stopped=true;#flight?:Promise<void>;#due?:number;#attemptAt?:number;#child?:RuntimeChild;#ownedChild?:RuntimeChild;#release?:(remove?:boolean)=>void;
  #manual?:Promise<void>;
  #backoff:number;#failed:number[]=[];#healthySince?:number;#gaveUp=false;
  constructor(options:RuntimeRestarterOptions){this.#options=options;this.#policy={...RUNTIME_RESTART_POLICY,...options.policy};this.#now=options.now??(()=>performance.now());this.#backoff=this.#policy.initialBackoffMs;}
  /** Explicit repair shares the supervisor; it never kills an unknown port owner. */
  restart(stop:()=>Promise<void>):Promise<void> {
    if(this.#manual)return this.#manual;
    this.#manual=this.#restart(stop).finally(()=>{this.#manual=undefined;});
    return this.#manual;
  }
  async #restart(stop:()=>Promise<void>):Promise<void> {
    if(this.#stopped)throw new Error('重启监控未启动。');
    await this.#flight;
    const monitor=this.#options.monitor,fresh=await monitor.check();
    if(fresh.lastError?.code!=='RUNTIME_CONNECTION_LOST')await stop();
    this.#gaveUp=false;this.#failed=[];this.#due=this.#now();
    const deadline=Date.now()+45000;let observedDown=fresh.lastError?.code==='RUNTIME_CONNECTION_LOST';
    while(!this.#stopped&&Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,500));
      const snapshot=await monitor.check();
      if(snapshot.consecutiveFailures>0)observedDown=true;
      if(observedDown&&snapshot.state==='healthy')return;
      await this.tick();
    }
    throw new Error('重启后尚未恢复连接，请检查节点状态。');
  }
  start():void {if(!this.#stopped)return;this.#stopped=false;this.#options.monitor.markRestarting(false);this.#remove=this.#options.monitor.onCheck(()=>{void this.tick().catch(()=>{this.#record('RESTART_CHECK_FAILED');});});void this.tick();}
  stop():void {this.#stopped=true;this.#remove?.();this.#remove=undefined;const live=this.#options.monitor.state!=='healthy'&&(this.#attemptAt!==undefined&&!this.#child||this.#ownedChild&&!this.#ownedChild.hasExited());this.#release?.(!live);this.#release=undefined;this.#options.monitor.markRestarting(false);if(live)this.#record('STOPPED_WITH_LIVE_CHILD');}
  tick():Promise<void> {if(this.#flight)return this.#flight;this.#flight=this.#tick().finally(()=>{this.#flight=undefined;});return this.#flight;}
  #record(reason:string,extra:Record<string,unknown>={}):void {this.#options.monitor.restartStatus(reason,this.#due);try{this.#options.log?.({ts:new Date().toISOString(),event:'runtime_restart',reason,...extra});}catch{}}
  #finish(keepLock=false):void {this.#attemptAt=undefined;this.#child=undefined;if(!keepLock){this.#release?.();this.#release=undefined;}this.#options.monitor.markRestarting(false);}
  #failure(reason:string):void {
    this.#finish(reason==='RESTART_TIMEOUT'&&!!this.#ownedChild&&!this.#ownedChild.hasExited());const now=this.#now();this.#failed=this.#failed.filter(at=>now-at<this.#policy.failureWindowMs);this.#failed.push(now);
    this.#backoff=Math.min(this.#backoff*2,this.#policy.maxBackoffMs);this.#due=now+this.#backoff;
    if(this.#failed.length>=this.#policy.failureLimit){this.#gaveUp=true;this.#due=undefined;this.#record('RESTART_LIMIT_REACHED',{failures:this.#failed.length});}else this.#record(reason,{failures:this.#failed.length,backoffMs:this.#due-now});
  }
  async #tick():Promise<void> {
    if(this.#stopped)return;const {monitor,manifest}=this.#options,now=this.#now(),snapshot=monitor.snapshot();
    if(snapshot.state==='healthy'){
      this.#due=undefined;
      if(this.#attemptAt!==undefined||this.#release){this.#finish();this.#due=undefined;this.#record('RESTART_HEALTHY');}
      this.#healthySince??=now;
      if(now-this.#healthySince>=this.#policy.healthyResetMs&&(this.#failed.length||this.#gaveUp||this.#backoff!==this.#policy.initialBackoffMs)){this.#failed=[];this.#gaveUp=false;this.#backoff=this.#policy.initialBackoffMs;this.#due=undefined;this.#record('HEALTHY_RESET');}return;
    }
    this.#healthySince=undefined;
    if(this.#ownedChild?.hasExited()&&this.#release){this.#release();this.#release=undefined;}
    if(this.#attemptAt!==undefined){if(this.#child?.hasExited())this.#failure('CHILD_EXITED');else if(now-this.#attemptAt>=this.#policy.attemptTimeoutMs)this.#failure('RESTART_TIMEOUT');return;}
    if(snapshot.state!=='down'||this.#gaveUp)return;
    if(this.#due===undefined){this.#due=now+this.#backoff;this.#record('BACKOFF',{backoffMs:this.#backoff});return;}
    if(now<this.#due)return;
    if(this.#ownedChild&&!this.#ownedChild.hasExited()){this.#due=now+this.#policy.maxBackoffMs;this.#record('OWNED_CHILD_STILL_RUNNING');return;}
    try{
      // Hold the cross-Host lock across the final probes: a delayed free-port answer must never outlive another launch.
      this.#release=this.#options.acquire?.()??this.#acquire();
      const fresh=await monitor.check();if(this.#stopped){this.#finish();return;}
      // Any real HTTP response, even 503 or malformed JSON, forbids a duplicate launch.
      if(fresh.state!=='down'||fresh.lastError?.code!=='RUNTIME_CONNECTION_LOST'&&fresh.lastError?.code!=='RUNTIME_REQUEST_TIMEOUT'){this.#finish();this.#due=now+this.#policy.maxBackoffMs;this.#record('RUNTIME_ANSWERED');return;}
      if(!await (this.#options.portFree?.()??runtimePortFree(manifest.serviceUrl))){this.#finish();this.#due=now+this.#policy.maxBackoffMs;this.#record('PORT_IN_USE_OR_UNKNOWN');return;}
      if(this.#stopped){this.#finish();return;}
      const env=this.#options.environment?.()??runtimeChildEnvironment(manifest);
      if(this.#stopped){this.#finish();return;}
      this.#attemptAt=this.#now();monitor.markRestarting(true);this.#record('SPAWNING');
      this.#child=await (this.#options.spawn??spawnRuntime)(manifest,env);this.#ownedChild=this.#child;
      if(this.#stopped){this.#finish();return;}this.#record('WAITING_FOR_HEALTH',{pid:this.#child.pid});
    }catch{this.#failure('LAUNCH_FAILED');}
  }
  #acquire():(remove?:boolean)=>void {
    const file=join(this.#options.manifest.env.APPS_DATA_DIR,'runtime-launch.lock'),fd=openSync(file,'wx',0o600);
    return (remove=true)=>{try{closeSync(fd);}catch{}if(remove)try{unlinkSync(file);}catch{}};
  }
}
