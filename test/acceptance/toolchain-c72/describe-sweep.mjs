import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
const root=resolve(process.argv[2]),out=process.argv[3];
const {composeAppsRuntime}=await import(pathToFileURL(join(root,'packages/service/src/apps-main.ts')));
const {AppsHost}=await import(pathToFileURL(join(root,'packages/plugin-apps/src/index.ts')));
const directory=mkdtempSync(join(tmpdir(),'toolchain-describe-'));
const instance=composeAppsRuntime(directory,{connections:[]}),runtime=instance.runtime;
const tools=new Map(),agent={id:'fixture-agent'};
const transport={async identity(){return runtime.identity();},async listApps(){return runtime.listApps();},async describe(id,v){return runtime.describe(id,v);},async discover(o){return runtime.discover(o);},async legacyInvoke(){throw Error('NO BUSINESS');}};
const guidance={cliPath:'/fixture/bin/cli.js',nodeExecutable:process.execPath,nodeArgs:[],nodeEnvironment:{},starterPath:'/fixture/source-starter/create-apps-source.mjs',sdkDirectory:'/fixture/sdk',buildRunnerPath:'/fixture/apps-authoring-build.js',previewRunnerPath:'/fixture/apps-authoring-preview.js',runtime:{url:'http://127.0.0.1:1',keyFile:'/fixture/key-not-read',archiveRoot:'/fixture/archive',evidenceRoot:'/fixture/evidence'}};
const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>{};}}},transport,undefined,{authoringGuidance:guidance});
try{
 await host.start();const tool=tools.get('apps_describe');let cursor;const descriptors=[];
 do{const page=runtime.discover({limit:100,...cursor?{cursor}:{}});descriptors.push(...page.items);cursor=page.nextCursor;}while(cursor);
 const rows=[];
 for(const d of descriptors){const args={capabilityId:d.capabilityId,version:d.version},value=await tool.execute(args,{agent,signal:new AbortController().signal}),rendered=tool.output.render(args,value)[0].text,model=JSON.parse(rendered);rows.push({capabilityId:d.capabilityId,rawBytes:Buffer.byteLength(JSON.stringify(value)),modelBytes:Buffer.byteLength(rendered),modelStatus:model.status,error:model.error??null,hasInputSchema:!!model.descriptor?.inputSchema,hasOutputSchema:!!model.descriptor?.outputSchema,hasGuidance:!!model.authoringGuidance});}
 const report={scope:'DETERMINISTIC_REGISTERED_TOOL_RENDER',externalModel:false,externalBusiness:false,total:rows.length,unusable:rows.filter(r=>!r.hasInputSchema),totalModelBytes:rows.reduce((s,r)=>s+r.modelBytes,0),rows};
 if(out)writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
}finally{await host.dispose();await instance.close();rmSync(directory,{recursive:true,force:true});}
