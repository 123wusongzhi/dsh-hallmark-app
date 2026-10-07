import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
/** Runtime process ownership; SQLite transactions alone do not establish single-writer deployment. */
export class RuntimeWriterLease {
  readonly path:string;
  readonly ownerId=randomUUID();
  #released=false;
  constructor(directory:string){
    mkdirSync(directory,{recursive:true});this.path=join(directory,'runtime-writer.json');
    const owner={ownerId:this.ownerId,pid:process.pid,startedAt:new Date().toISOString()};
    try{writeFileSync(this.path,JSON.stringify(owner),{flag:'wx',mode:0o600});}
    catch(error){
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      const reclaimPath=this.path+'.reclaim';
      try{writeFileSync(reclaimPath,JSON.stringify(owner),{flag:'wx',mode:0o600});}catch(cause){if((cause as NodeJS.ErrnoException).code==='EEXIST')throw new Error('WRITER_LEASE_RECLAIM_REQUIRES_REVIEW');throw cause;}
      try{
        const previous=JSON.parse(readFileSync(this.path,'utf8')) as {pid:number;ownerId:string};
        if(!Number.isSafeInteger(previous.pid)||previous.pid<1||typeof previous.ownerId!=='string'||!previous.ownerId)throw new Error('WRITER_LEASE_REQUIRES_REVIEW');
        let alive=true;try{process.kill(previous.pid,0);}catch(cause){if((cause as NodeJS.ErrnoException).code==='ESRCH')alive=false;}
        if(alive)throw new Error('RUNTIME_WRITER_ALREADY_ACTIVE');
        // Reclaimers serialize the identity re-read and unlink. A fresh claimant can only win the final wx race.
        const current=JSON.parse(readFileSync(this.path,'utf8')) as {ownerId:string;pid:number};if(current.ownerId!==previous.ownerId||current.pid!==previous.pid)throw new Error('WRITER_LEASE_CHANGED');
        unlinkSync(this.path);
        try{writeFileSync(this.path,JSON.stringify(owner),{flag:'wx',mode:0o600});}catch(cause){if((cause as NodeJS.ErrnoException).code==='EEXIST')throw new Error('RUNTIME_WRITER_ALREADY_ACTIVE');throw cause;}
      }finally{
        const reclaim=JSON.parse(readFileSync(reclaimPath,'utf8')) as {ownerId:string};if(reclaim.ownerId!==this.ownerId)throw new Error('WRITER_LEASE_CHANGED');unlinkSync(reclaimPath);
      }
    }
  }
  release():void {if(this.#released)return;const current=JSON.parse(readFileSync(this.path,'utf8')) as {ownerId:string};if(current.ownerId!==this.ownerId)throw new Error('WRITER_LEASE_CHANGED');unlinkSync(this.path);this.#released=true;}
}
