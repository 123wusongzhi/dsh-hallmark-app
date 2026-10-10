import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';

/** ctime catches same-size writes even when an editor restores mtime. Never use atime. */
export function regularFileIdentity(path:string):string {
  const stat=lstatSync(path,{bigint:true});
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('REGULAR_FILE_REQUIRED');
  return [stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs,stat.birthtimeNs,stat.mode].join(':');
}

/** Successful immutable byte checks only. Path/root authorization remains the caller's responsibility. */
export class FileVerificationCache {
  private entries=new Map<string,{identity:string;bytes:Buffer}>();
  private totalBytes=0;
  readonly maxEntries:number;
  readonly maxBytes:number;
  constructor(maxEntries=128,maxBytes=16*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;}
  read(path:string,sha256:string,length:number):Buffer {
    const identity=regularFileIdentity(path),key=JSON.stringify([path,sha256,length]),cached=this.entries.get(key);
    if(cached?.identity===identity){this.entries.delete(key);this.entries.set(key,cached);return Buffer.from(cached.bytes);}
    if(cached){this.entries.delete(key);this.totalBytes-=cached.bytes.length;}
    const bytes=readFileSync(path);
    if(bytes.length!==length||createHash('sha256').update(bytes).digest('hex')!==sha256||regularFileIdentity(path)!==identity)throw new Error('FILE_HASH_MISMATCH');
    if(bytes.length<=this.maxBytes){
      while(this.entries.size>=this.maxEntries||this.totalBytes+bytes.length>this.maxBytes){const oldest=this.entries.keys().next().value;if(oldest===undefined)break;this.totalBytes-=this.entries.get(oldest)!.bytes.length;this.entries.delete(oldest);}
      this.entries.set(key,{identity,bytes:Buffer.from(bytes)});this.totalBytes+=bytes.length;
    }
    return bytes;
  }
}
