import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
export function repositoryIdentity(root){
 const run=args=>{const result=spawnSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},maxBuffer:4*1024*1024});if(result.status!==0)throw Error('BENCH_GIT_IDENTITY_UNAVAILABLE: '+root+' '+args.join(' '));return result.stdout.trim();};
 const repositoryRoot=run(['rev-parse','--show-toplevel']);if(resolve(repositoryRoot)!==resolve(root))throw Error('BENCH_ROOT_IS_NOT_ITS_OWN_CHECKOUT: '+root);
 return {repositoryRoot:resolve(repositoryRoot),head:run(['rev-parse','HEAD']),branch:run(['rev-parse','--abbrev-ref','HEAD']),trackedStatus:run(['status','--porcelain=v1','--untracked-files=no']),unmerged:run(['diff','--name-only','--diff-filter=U']).split(/\r?\n/).filter(Boolean)};
}
