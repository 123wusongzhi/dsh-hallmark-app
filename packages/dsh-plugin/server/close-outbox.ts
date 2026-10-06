import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ServiceFailure } from './service-client.ts';
const SESSION=/^[-a-zA-Z0-9_]{1,160}$/;
interface Intent {sessionId:string;requestedAt:string}
/** User-authorized close delivery journal, NOT a second application state authority. */
export class ClosureOutbox {
  readonly directory:string; readonly file:string; private intents=new Map<string,Intent>();private loadBroken=false;private writeBroken=false;
  constructor(directory:string){
    this.directory=directory;this.file=join(directory,'pending-closures.json');
    try {
      const text=readFileSync(this.file,'utf8');if(Buffer.byteLength(text)>128*1024)throw new Error('too large');
      const journal=JSON.parse(text);if(journal.version!==1||!Array.isArray(journal.intents)||Object.keys(journal).some(key=>!['version','intents'].includes(key)))throw new Error('invalid journal');
      for(const intent of journal.intents){
        if(!intent||typeof intent.sessionId!=='string'||!SESSION.test(intent.sessionId)||typeof intent.requestedAt!=='string'||!Number.isFinite(Date.parse(intent.requestedAt))||Object.keys(intent).some(key=>!['sessionId','requestedAt'].includes(key)))throw new Error('invalid intent');
        this.intents.set(intent.sessionId,{sessionId:intent.sessionId,requestedAt:intent.requestedAt});
      }
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')this.loadBroken=true;}
  }
  assertHealthy():void {
    if(this.loadBroken)throw new ServiceFailure('CLOSE_OUTBOX_UNAVAILABLE');
    if(this.writeBroken)this.persist(this.intents);
  }
  has(id:string):boolean{this.assertHealthy();return this.intents.has(id);}
  request(id:string):void {
    if(!SESSION.test(id))throw new Error('INVALID_SESSION');
    this.assertHealthy();this.intents.set(id,{sessionId:id,requestedAt:new Date().toISOString()});this.persist(this.intents);
  }
  ack(id:string):void {
    this.assertHealthy();if(!this.intents.has(id))return;
    const next=new Map(this.intents);next.delete(id);this.persist(next);this.intents=next;
  }
  private persist(intents:Map<string,Intent>):void {
    const temporary=join(this.directory,`.pending-closures-${randomUUID()}.tmp`);
    try{
      mkdirSync(this.directory,{recursive:true});
      writeFileSync(temporary,JSON.stringify({version:1,intents:[...intents.values()]}),{encoding:'utf8',flag:'wx',mode:0o600});
      renameSync(temporary,this.file);this.writeBroken=false;
    }catch{this.writeBroken=true;throw new ServiceFailure('CLOSE_OUTBOX_UNAVAILABLE');}
  }
}
