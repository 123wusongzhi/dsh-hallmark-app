// An isolated deployment supervisor around the real v2 service, not a production admission API.
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {AppStore} from '../../../packages/store/index.ts';
import {AppCore} from '../../../packages/core/src/index.ts';
import {PresentationManager} from '../../../packages/presentation/src/index.ts';
import {HallmarkClient,TaskBroker} from '../../../packages/hallmark-adapter/index.ts';
import {createAppServer} from '../../../packages/service/src/server.ts';
import {RuntimeWriterLease} from '../../../packages/app-runtime/src/lease.ts';
const [directoryArg,backend,tokenFile]=process.argv.slice(2),directory=resolve(directoryArg??'');
if(!directory.startsWith(resolve(tmpdir())+sep)||!directory.includes('dsh-apps-cutover-')||new URL(backend).hostname!=='127.0.0.1')throw new Error('ISOLATED_COPY_AND_LOOPBACK_FIXTURE_REQUIRED');
let lease;
try{if(existsSync(join(directory,'writer-freeze.json')))throw new Error('ROLLBACK_INCREMENTAL_RECONCILIATION_REQUIRED');lease=new RuntimeWriterLease(directory);}
catch(error){process.send?.({event:'writer-rejected',pid:process.pid,code:error.message,databaseOpened:false});process.exitCode=3;process.disconnect?.();}
if(lease){
 const store=new AppStore(join(directory,'app.db')),token=readFileSync(tokenFile,'utf8').trim(),client=new HallmarkClient({baseUrl:backend,spillDirectory:join(directory,'data','spill')}),broker=new TaskBroker(client,store),presentation=new PresentationManager(store,{sourceDirectory:join(directory,'source-components'),sourceWorkspace:join(directory,'component-workspace')}),core=new AppCore({store,client,broker,presentation});
 const service=createAppServer({token,store,core,presentation,health:()=>client.health()});await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));
 const sourceUrl=`http://127.0.0.1:${service.address().port}`;let accepting=true,active=0,drainWaiters=[],closing=false;
 const admission=createServer(async(req,res)=>{
  if(!accepting){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({status:'failed',error:{code:'COPY_WRITER_FROZEN'}}));return;}
  active++;
  try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),response=await fetch(new URL(req.url??'/',sourceUrl),{method:req.method,headers:{authorization:`Bearer ${token}`,...(body.length?{'content-type':'application/json'}:{})},...(body.length?{body}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));}
  catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
  finally{active--;if(active===0){for(const resolve of drainWaiters)resolve();drainWaiters=[];}}
 });await new Promise(resolve=>admission.listen(0,'127.0.0.1',resolve));
 const ready={event:'ready',pid:process.pid,url:`http://127.0.0.1:${admission.address().port}`,serviceUrl:sourceUrl,schemaVersion:2,writerLease:lease.path,serviceImplementation:'AppStore + AppCore + createAppServer'};process.send?.(ready);
 const drain=async()=>{if(active)await new Promise(resolve=>drainWaiters.push(resolve));await core.waitForIdle();};
 const stop=async()=>{if(closing)return;closing=true;accepting=false;await drain();admission.closeAllConnections();service.closeAllConnections();await Promise.all([new Promise(resolve=>admission.close(resolve)),new Promise(resolve=>service.close(resolve))]);store.close();lease.release();process.send?.({event:'stopped',pid:process.pid,activeRequests:active,writerLeaseReleased:true});process.disconnect?.();};
 process.on('message',async message=>{if(message?.action==='freeze'){accepting=false;process.send?.({event:'frozen',pid:process.pid,activeRequests:active});await drain();process.send?.({event:'drained',pid:process.pid,activeRequests:active});}else if(message?.action==='stop')await stop();});
 process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
}
