import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppStore } from '../../store/index.ts';
import { HallmarkClient, TaskBroker } from '../../hallmark-adapter/index.ts';
import { PresentationManager } from '../../presentation/src/index.ts';
import { AppCore } from '../../core/src/index.ts';
import { defaultDataDirectory, getOrCreateToken, listenAppServer } from './server.ts';
import { SnapshotScheduler } from './scheduler.ts';
import { SERVICE_IDENTITY } from './version.ts';
import { readOverview } from './overview.ts';
const directory=defaultDataDirectory();
const store=new AppStore(join(directory,'app.db'));
const client=new HallmarkClient({spillDirectory:join(directory,'data','spill')});
const broker=new TaskBroker(client,store,{audit(event){const operationId=randomUUID();store.put('operations',operationId,{operationId,kind:event.kind,sessionId:null,storeId:event.storeId,targets:event.skuScope??[],input:event,state:'succeeded',hallmarkRefs:[{taskId:event.taskId}],result:{created:event.created},createdAt:event.at,updatedAt:event.at});}});
const presentation=new PresentationManager(store);
const core=new AppCore({store,client,broker,presentation});
const port=Number(process.env.HALLMARK_APP_PORT??4180);
if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('INVALID_SERVICE_PORT');
const token=getOrCreateToken(directory);
const server=await listenAppServer({token,store,core,presentation,health:()=>client.health(),overview:()=>readOverview(client),port,logDirectory:join(directory,'logs')});
// Read-only recovery must not hold the service offline while many old operations await the platform.
const recovery=core.recoverOperations().catch(error=>{console.error(JSON.stringify({event:'recovery-error',message:error instanceof Error?error.message:'Operation recovery unavailable'}));});
const scheduler=new SnapshotScheduler(core,store,{times:process.env.HALLMARK_APP_SCHEDULE?.split(','),report(error){console.error(JSON.stringify({event:'scheduler-error',message:error instanceof Error?error.message:String(error)}));}});
scheduler.start();
console.info(JSON.stringify({event:'service-start',...SERVICE_IDENTITY,pid:process.pid,url:`http://127.0.0.1:${port}`,dataDirectory:directory}));
let closing=false;
async function close(){if(closing)return;closing=true;scheduler.stop();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await recovery;await core.waitForIdle();store.close();process.exitCode=0;}
process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
