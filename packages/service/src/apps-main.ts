import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppsRuntime, RuntimeStore } from '../../app-runtime/src/index.ts';
import type { AppConnection } from '../../app-runtime/src/index.ts';
import { RuntimeWriterLease } from '../../app-runtime/src/lease.ts';
import { HallmarkProvider, HallmarkStorePort, resolveHallmarkResources, validateHallmarkConnection } from '../../app-hallmark/src/index.ts';
import { NotesProvider, resolveNotesResources } from '../../app-notes/src/index.ts';
import { AppsPresentationService } from '../../app-presentation/src/index.ts';
import { SourceComponentStore } from '../../source-components/src/index.ts';
import { HallmarkClient, TaskBroker } from '../../hallmark-adapter/index.ts';
import { getOrCreateToken } from './http.ts';
import { createAppsServer } from './apps-server.ts';
import {AppsSnapshotScheduler} from './apps-scheduler.ts';
import {AuthoringEvidenceRunner} from '../../source-components/src/authoring-evidence.ts';
import {EvidencePathResolver} from '../../source-components/src/evidence-relocation.ts';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import {cutoverAdmission} from './cutover-admission.ts';
import type { AppProvider, ExecutionContext, ResourceRef, DatasetBinding, CapabilityResult } from '../../app-contracts/src/index.ts';

export interface AppsConfiguration { connections:AppConnection[]; legacyHallmarkConnectionId?:string; }
export function composeAppsRuntime(directory:string,configuration:AppsConfiguration) {
  const admit=cutoverAdmission(directory);admit();
  const lease=new RuntimeWriterLease(directory);let store:RuntimeStore;
  try{store=new RuntimeStore(join(directory,'apps.db'));}catch(error){lease.release();throw error;}
  const signals=new AsyncLocalStorage<AbortSignal>(),clients=new Map<string,HallmarkClient>(),ports=new Map<string,HallmarkStorePort>(),brokers=new Map<string,TaskBroker>();
  const runtime=new AppsRuntime(store,{admit,log(event){mkdirSync(join(directory,'logs'),{recursive:true});appendFileSync(join(directory,'logs',`${new Date().toISOString().slice(0,10)}.jsonl`),JSON.stringify(event)+'\n');}});
  const generation=(id:string,revision?:number)=>{const active=runtime.getConnection('hallmark',id);if(!active||revision!==undefined&&revision!==active.configRevision)throw new Error('CONFIG_REVISION_CONFLICT');return active.configRevision;};
  const cacheKey=(id:string,revision:number)=>canonicalJson([id,revision]);
  const clientFor=(connectionId:string,revision?:number)=>{
    const currentRevision=generation(connectionId,revision),key=cacheKey(connectionId,currentRevision);let client=clients.get(key);if(client)return client;
    const connection=runtime.getConnection('hallmark',connectionId),config=connection?.config as {baseUrl?:string;ozonDataBaseUrl?:string}|undefined;
    if(!config?.baseUrl)throw new Error('EXPLICIT_HALLMARK_BACKEND_REQUIRED');
    client=new HallmarkClient({baseUrl:config.baseUrl,ozonDataBaseUrl:config.ozonDataBaseUrl,spillDirectory:join(directory,'datasets','hallmark-spill',encodeURIComponent(connectionId),String(currentRevision)),...(process.env.HALLMARK_OPERATOR_TOKEN?{operatorToken:process.env.HALLMARK_OPERATOR_TOKEN}:{}),fetchImpl:(url,options)=>{const signal=signals.getStore();return fetch(url,{...options,signal:signal?AbortSignal.any([signal,...(options?.signal?[options.signal]:[])]):options?.signal});}});clients.set(key,client);return client;
  };
  const storeFor=(id:string,revision?:number)=>{const currentRevision=generation(id,revision),key=cacheKey(id,currentRevision);let port=ports.get(key);if(!port){port=new HallmarkStorePort(store,id,currentRevision);ports.set(key,port);}return port;};
  const brokerFor=(id:string,revision?:number)=>{const currentRevision=generation(id,revision),key=cacheKey(id,currentRevision);let broker=brokers.get(key);if(!broker){broker=new TaskBroker(clientFor(id,currentRevision),storeFor(id,currentRevision));brokers.set(key,broker);}return broker;};
  const domain=new HallmarkProvider({store:storeFor,client:clientFor,broker:brokerFor});
  const withSignal=(provider:AppProvider):AppProvider=>({manifest:provider.manifest,descriptors:provider.descriptors,execute:(context:ExecutionContext)=>signals.run(context.signal,()=>provider.execute(context)),...(provider.inspect?{inspect:(id:string,context:ExecutionContext)=>signals.run(context.signal,()=>provider.inspect!(id,context))}:{}),dispose:()=>provider.dispose()});
  // This explicit composition list is the only place that imports specific application implementations.
  runtime.register(withSignal(domain));runtime.register(new NotesProvider({store}));
  runtime.registerConnectionLifecycle('hallmark',{validate:next=>validateHallmarkConnection(next.config),invalidate:(previous,next)=>{domain.invalidateConnection(next.connectionId);for(const cache of [clients,ports,brokers])for(const key of cache.keys())if(JSON.parse(key)[0]===next.connectionId)cache.delete(key);}});
  const sources=new SourceComponentStore(join(directory,'source-components'),join(directory,'component-workspace'));
  let scheduler:AppsSnapshotScheduler;
  const presentation=new AppsPresentationService({store,runtime,sources,scheduledBinding:binding=>{if(!scheduler)throw new Error('SCHEDULER_UNAVAILABLE');scheduler.requireSchedule(binding.refresh.scheduleId!,binding);},resources:(binding:DatasetBinding,result:CapabilityResult):ResourceRef[]=>{
    if(result.status!=='ok'&&result.status!=='partial')return [];
    const resolvers:Record<string,(binding:DatasetBinding,result:CapabilityResult)=>ResourceRef[]>={hallmark:resolveHallmarkResources,notes:resolveNotesResources};
    return resolvers[binding.appId]?.(binding,result)??[];
  }});
  scheduler=new AppsSnapshotScheduler({store,admit,refresh:(binding,source)=>presentation.refreshBinding(binding,source),describe:id=>runtime.describe(id),isConnectionEnabled:(appId,id)=>runtime.getConnection(appId,id)?.enabled===true});
  const paths=new EvidencePathResolver({root:directory,store}),resolveEvidencePath=(path:string)=>paths.resolve(path);
  const evidenceRunner=new AuthoringEvidenceRunner(join(directory,'authoring-evidence'),{resolvePath:resolveEvidencePath});
  const authoring=presentation.configureAuthoring({evidenceRoot:evidenceRunner.root,resolveEvidencePath,withEvidencePathScope:work=>paths.withScope(work),onCancel:(attemptId,epoch)=>evidenceRunner.cancel(attemptId,epoch),validateBuildEvidence:(ref,context)=>evidenceRunner.verifyBuild(ref,context.sources,{allowFailure:true}),validatePreviewEvidence:(ref,context)=>evidenceRunner.verifyPreview(ref,context.sources)});
  runtime.register(presentation.provider());
  try{
    for(const connection of configuration.connections){const existing=runtime.getConnection(connection.appId,connection.connectionId);if(!existing)runtime.addConnection(connection);else if(canonicalJson(existing)!==canonicalJson(connection))console.info(JSON.stringify({event:'apps-config-seed-difference',appId:connection.appId,connectionId:connection.connectionId,activeConfigRevision:existing.configRevision,fileConfigRevision:connection.configRevision,authority:'database',applied:false}));}
    if(!runtime.getConnection('apps','presentation'))runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Shared presentation',config:{backend:'runtime'},configRevision:1,enabled:true});
    if(configuration.legacyHallmarkConnectionId){if(!runtime.getConnection('hallmark',configuration.legacyHallmarkConnectionId))throw new Error('INVALID_LEGACY_CONNECTION_MAPPING');store.put('legacy_aliases','connection:default',{legacyKind:'connection',legacyId:'default',appId:'hallmark',connectionId:configuration.legacyHallmarkConnectionId,status:'resolved'});}
  }catch(error){store.close();lease.release();throw error;}
  authoring.recoverInterrupted();scheduler.start();
  return {runtime,store,presentation,authoring,evidenceRunner,scheduler,lease,health:async()=>{const id=configuration.legacyHallmarkConnectionId;return id?clientFor(id).health():{status:'unavailable',error:{code:'EXPLICIT_HALLMARK_BACKEND_REQUIRED'}};},close:async()=>{await scheduler.stop();await runtime.dispose();store.close();lease.release();}};
}

async function main() {
  if(!process.env.APPS_DATA_DIR||!process.env.APPS_CONNECTIONS_FILE)throw new Error('APPS_DATA_DIR and APPS_CONNECTIONS_FILE must explicitly select the isolated Runtime and backend mappings.');
  const directory=resolve(process.env.APPS_DATA_DIR),configuration=JSON.parse(readFileSync(resolve(process.env.APPS_CONNECTIONS_FILE),'utf8')) as AppsConfiguration;
  const port=Number(process.env.APPS_PORT??4181);if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('INVALID_SERVICE_PORT');
  const instance=composeAppsRuntime(directory,configuration),token=getOrCreateToken(directory);
  const server=createAppsServer({...instance,token,port});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const recovery=instance.runtime.recover();let closing=false;
  console.info(JSON.stringify({event:'apps-runtime-start',...instance.runtime.identity(),pid:process.pid,url:`http://127.0.0.1:${port}`}));
  const close=async()=>{if(closing)return;closing=true;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await recovery;await instance.close();};
  process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
