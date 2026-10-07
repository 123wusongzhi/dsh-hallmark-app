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
      const previous=JSON.parse(readFileSync(this.path,'utf8')) as {pid:number;ownerId:string};
      if(!Number.isSafeInteger(previous.pid)||previous.pid<1)throw new Error('WRITER_LEASE_REQUIRES_REVIEW');
      let alive=true;try{process.kill(previous.pid,0);}catch(cause){if((cause as NodeJS.ErrnoException).code==='ESRCH')alive=false;}
      if(alive)throw new Error('RUNTIME_WRITER_ALREADY_ACTIVE');
      // A stale owner is removed only after its exact identity is re-read and its process is absent.
      const current=JSON.parse(readFileSync(this.path,'utf8')) as {ownerId:string};if(current.ownerId!==previous.ownerId)throw new Error('WRITER_LEASE_CHANGED');
      unlinkSync(this.path);writeFileSync(this.path,JSON.stringify(owner),{flag:'wx',mode:0o600});
    }
  }
  release():void {if(this.#released)return;const current=JSON.parse(readFileSync(this.path,'utf8')) as {ownerId:string};if(current.ownerId!==this.ownerId)throw new Error('WRITER_LEASE_CHANGED');unlinkSync(this.path);this.#released=true;}
}
