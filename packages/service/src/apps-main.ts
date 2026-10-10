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
import {createDecisionReviewer} from './decision-review.ts';
import {createDecisionImageProtocol} from './decision-image-protocol.ts';
import {ReviewBridge} from './review-bridge.ts';
import {BusinessOperationPoller} from './business-poller.ts';
import {StableHallmarkBusinessStore} from '../../app-hallmark/src/store.ts';
import {OzonBusinessGateway} from '../../ozon-business/src/index.ts';
import {BusinessPricingRepository} from '../../business-pricing/src/index.ts';
import {BusinessSettingsService} from './business-settings.ts';
import {CollectionService} from '../../collection/src/index.ts';
import {BusinessPackagingRepository} from '../../business-packaging/src/index.ts';
import {collectionListingStates} from '../../app-hallmark/src/listing-prepare.ts';
import {applyExistingPackaging} from '../../app-hallmark/src/packaging-evidence.ts';
import {ListingAssetPublisher} from '../../app-hallmark/src/listing-assets.ts';
import {randomUUID} from 'node:crypto';
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
  const signals=new AsyncLocalStorage<ExecutionContext>(),clients=new Map<string,HallmarkClient>(),ports=new Map<string,HallmarkStorePort>(),brokers=new Map<string,TaskBroker>();
  const reviewBridge=new ReviewBridge(),reviewer=createDecisionReviewer({imageProtocol:createDecisionImageProtocol(),fallback:(input,signal)=>{const context=signals.getStore();if(!context)throw new Error('REVIEW_HOST_CONTEXT_REQUIRED');return reviewBridge.request(input,{invocationId:context.request.invocationId,sessionId:'sessionId'in context.request.source?context.request.source.sessionId:undefined},signal);}});
  const runtime=new AppsRuntime(store,{admit,log(event){mkdirSync(join(directory,'logs'),{recursive:true});appendFileSync(join(directory,'logs',`${new Date().toISOString().slice(0,10)}.jsonl`),JSON.stringify(event)+'\n');}});
  const generation=(id:string,revision?:number)=>{const active=runtime.getConnection('hallmark',id);if(!active||revision!==undefined&&revision!==active.configRevision)throw new Error('CONFIG_REVISION_CONFLICT');return active.configRevision;};
  const cacheKey=(id:string,revision:number)=>canonicalJson([id,revision]);
  const clientFor=(connectionId:string,revision?:number)=>{
    const currentRevision=generation(connectionId,revision),key=cacheKey(connectionId,currentRevision);let client=clients.get(key);if(client)return client;
    const connection=runtime.getConnection('hallmark',connectionId),config=connection?.config as {baseUrl?:string;ozonDataBaseUrl?:string}|undefined;
    if(!config?.baseUrl)throw new Error('EXPLICIT_HALLMARK_BACKEND_REQUIRED');
    client=new HallmarkClient({baseUrl:config.baseUrl,ozonDataBaseUrl:config.ozonDataBaseUrl,spillDirectory:join(directory,'datasets','hallmark-spill',encodeURIComponent(connectionId),String(currentRevision)),...(process.env.HALLMARK_OPERATOR_TOKEN?{operatorToken:process.env.HALLMARK_OPERATOR_TOKEN}:{}),fetchImpl:(url,options)=>{const signal=signals.getStore()?.signal;return fetch(url,{...options,signal:signal?AbortSignal.any([signal,...(options?.signal?[options.signal]:[])]):options?.signal});}});clients.set(key,client);return client;
  };
  const storeFor=(id:string,revision?:number)=>{const currentRevision=generation(id,revision),key=cacheKey(id,currentRevision);let port=ports.get(key);if(!port){port=new HallmarkStorePort(store,id,currentRevision);ports.set(key,port);}return port;};
  const businessGateway=new OzonBusinessGateway(join(directory,'ozon-business'));
  const businessPorts=new Map<string,StableHallmarkBusinessStore>(),pricingRepositories=new Map<string,BusinessPricingRepository>();
  const sourceOrigin=(id:string)=>{const config=runtime.getConnection('hallmark',id)?.config as {baseUrl?:string}|undefined;return config?.baseUrl?new URL(config.baseUrl).href.replace(/\/$/,''):null;};
  const businessIdentity=(id:string)=>{
    generation(id);const key=canonicalJson(['hallmark',id,'business_scope','identity']);
    let record=store.get<{value:{scopeId:string;sourceOrigin:string|null;legacyConfigRevision:number}}>('provider_records',key);
    if(!record){record={value:{scopeId:randomUUID(),sourceOrigin:sourceOrigin(id),legacyConfigRevision:generation(id)}};store.put('provider_records',key,{appId:'hallmark',connectionId:id,namespace:'business_scope',recordId:'identity',...record});}
    return record.value;
  };
  const businessStoreFor=(id:string,revision?:number)=>{generation(id,revision);const identity=businessIdentity(id);let port=businessPorts.get(identity.scopeId);if(!port){port=new StableHallmarkBusinessStore(store,{connectionId:id,scopeId:identity.scopeId,legacyConfigRevision:identity.legacyConfigRevision});businessPorts.set(identity.scopeId,port);}return port;};
  const pricingFor=(id:string)=>{const port=businessStoreFor(id);let pricing=pricingRepositories.get(id);if(!pricing){pricing=new BusinessPricingRepository(port);pricingRepositories.set(id,pricing);}return pricing;};
  // A provider may move hosts while preserving its explicitly configured collection identity.
  // With no mapping, changing an old backend URL still cannot attach unrelated source SKUs.
  const collectionIdentity=(id:string)=>{const identity=businessIdentity(id),config=runtime.getConnection('hallmark',id)?.config as {collectionSourceId?:string}|undefined;return config?.collectionSourceId??(identity.sourceOrigin===sourceOrigin(id)?identity.scopeId:`unmapped:${sourceOrigin(id)}`);};
  const collectionSourceMatches=(id:string)=>{const identity=businessIdentity(id),port=businessStoreFor(id),saved=port.get<{id:string}>('business_collection_identity','active');if(!saved&&identity.sourceOrigin===sourceOrigin(id)){port.put('business_collection_identity','active',{id:collectionIdentity(id)});return true;}return saved?.id===collectionIdentity(id);};
  const collections=new Map<string,CollectionService>(),packages=new Map<string,BusinessPackagingRepository>();
  const assetPublisherFor=(id:string,revision?:number)=>{generation(id,revision);const config=runtime.getConnection('hallmark',id)?.config as {baseUrl:string};return new ListingAssetPublisher({baseUrl:config.baseUrl,operatorToken:process.env.HALLMARK_OPERATOR_TOKEN,store:businessStoreFor(id)});};
  const packagingFor=(id:string)=>{const sourceId=collectionIdentity(id),key=canonicalJson([id,sourceId]);let repository=packages.get(key);if(!repository){repository=new BusinessPackagingRepository(businessStoreFor(id),sourceId);packages.set(key,repository);}return repository;};
  const collectionFor=(id:string,revision?:number)=>{const current=generation(id,revision),key=cacheKey(id,current);let service=collections.get(key);if(!service){const port=businessStoreFor(id),identity=businessIdentity(id);service=new CollectionService({client:clientFor(id,current),store:{get:(namespace,key)=>port.get(`business_collection_${namespace}`,key),put:(namespace,key,value)=>port.put(`business_collection_${namespace}`,key,value)},sourceId:collectionIdentity(id),cacheDir:join(directory,'collection-assets',identity.scopeId),listingStates:async (itemIds,summaries)=>collectionSourceMatches(id)?collectionListingStates(port,businessGateway.listStores().filter(s=>!s.sourceConnectionId||s.sourceConnectionId===id).map(s=>s.id),itemIds,summaries):{}});collections.set(key,service);}return service;};
  const brokerFor=(id:string,revision?:number)=>{const currentRevision=generation(id,revision),key=cacheKey(id,currentRevision);let broker=brokers.get(key);if(!broker){broker=new TaskBroker(clientFor(id,currentRevision),storeFor(id,currentRevision));brokers.set(key,broker);}return broker;};
  const domain=new HallmarkProvider({store:storeFor,client:clientFor,broker:brokerFor,businessStore:businessStoreFor,businessGateway,pricing:pricingFor,collection:collectionFor,packaging:packagingFor,assetPublisher:assetPublisherFor,collectionSourceMatches,reviewer,inspectOperation:(operationId,signal)=>runtime.inspect(operationId,signal)});
  const withSignal=(provider:AppProvider):AppProvider=>({manifest:provider.manifest,descriptors:provider.descriptors,execute:(context:ExecutionContext)=>signals.run(context,()=>provider.execute(context)),...(provider.mutationScope?{mutationScope:(request,revision)=>provider.mutationScope!(request,revision)}:{}),...(provider.inspect?{inspect:(id:string,context:ExecutionContext)=>signals.run(context,()=>provider.inspect!(id,context))}:{}),...(provider.continueOperation?{continueOperation:(id:string,context:ExecutionContext)=>signals.run(context,()=>provider.continueOperation!(id,context))}:{}),dispose:()=>provider.dispose()});
  // This explicit composition list is the only place that imports specific application implementations.
  runtime.register(withSignal(domain));runtime.register(new NotesProvider({store}));
  runtime.registerConnectionLifecycle('hallmark',{validate:next=>validateHallmarkConnection(next.config),invalidate:(previous,next)=>{domain.invalidateConnection(next.connectionId);for(const cache of [clients,ports,brokers,collections])for(const key of cache.keys())if(JSON.parse(key)[0]===next.connectionId)cache.delete(key);}});
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
  const businessPoller=new BusinessOperationPoller(runtime);businessPoller.start();
  const businessSettings=new BusinessSettingsService(runtime,businessGateway,pricingFor,{packagingFor,collectionFor,prepareProducts:async(id,products)=>collectionSourceMatches(id)?applyExistingPackaging(products,businessStoreFor(id),({storeId,path,body})=>businessGateway.request(storeId,{path,body}),{storeIds:businessGateway.listStores().filter(s=>!s.sourceConnectionId||s.sourceConnectionId===id).map(s=>s.id)}):products});
  return {runtime,store,presentation,authoring,evidenceRunner,scheduler,reviewBridge,businessPoller,businessSettings,businessGateway,businessStoreFor,pricingFor,lease,health:async()=>{const id=configuration.legacyHallmarkConnectionId;return id?clientFor(id).health():{status:'unavailable',error:{code:'EXPLICIT_HALLMARK_BACKEND_REQUIRED'}};},close:async()=>{reviewBridge.dispose();await businessPoller.stop();await scheduler.stop();await runtime.dispose();store.close();lease.release();}};
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
