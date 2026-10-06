import { spawn } from 'node:child_process';
import { isAbsolute, basename } from 'node:path';
import { statSync } from 'node:fs';
import type { PluginConfig } from './types.ts';
export function validateLaunch(config:PluginConfig):{node:string;entry:string;cwd:string} {
  const {nodeExecutable:node,serviceEntry:entry,serviceCwd:cwd}=config;
  if(!node||!entry||!cwd||![node,entry,cwd].every(isAbsolute)||!/^node(?:\.exe)?$/i.test(basename(node)))throw new Error('AUTO_START_REQUIRES_EXPLICIT_NODE_ENTRY_CWD');
  if(!statSync(node).isFile()||!statSync(entry).isFile()||!statSync(cwd).isDirectory())throw new Error('AUTO_START_PATH_INVALID');
  return {node,entry,cwd};
}
/** Opt-in only. Never treats Electron/the DSH executable as a Node command. */
export async function launchService(config:PluginConfig,directory:string):Promise<void> {
  const {node,entry,cwd}=validateLaunch(config);
  const child=spawn(node,[entry],{cwd,detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,HALLMARK_APP_DATA_DIR:directory,HALLMARK_APP_PORT:new URL(config.serviceUrl??'http://127.0.0.1:4180').port||'80'}});
  await new Promise<void>((ok,reject)=>{child.once('error',()=>reject(new Error('SERVICE_START_FAILED')));child.once('spawn',ok);});
  child.unref();
}
