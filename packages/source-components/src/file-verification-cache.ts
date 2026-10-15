import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

/** Fresh per-batch directory checks: no symlink ancestors, including junctions; unrelated directory writes do not invalidate a file. */
export function directoryPathIdentity(path:string,checked=new Map<string,string>()):string {
  const absolute=resolve(path),cached=checked.get(absolute);if(cached)return cached;
  const stat=lstatSync(absolute,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('DIRECTORY_REQUIRED');
  const parent=dirname(absolute),identity=(parent===absolute?'':directoryPathIdentity(parent,checked)+'\n')+JSON.stringify([absolute,realpathSync(absolute),[stat.dev,stat.ino,stat.birthtimeNs,stat.mode].join(':')]);
  checked.set(absolute,identity);return identity;
}
export function regularFilePathIdentity(path:string,checked=new Map<string,string>()):string {
  const absolute=resolve(path);return JSON.stringify([absolute,realpathSync(absolute),regularFileIdentity(absolute),directoryPathIdentity(dirname(absolute),checked)]);
}

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
  private proofs=new Map<string,string>();
  readonly verification={checks:0,hashes:0,hashedBytes:0};
  readonly maxEntries:number;
  readonly maxBytes:number;
  constructor(maxEntries=128,maxBytes=16*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;}
  /** Identity-only successful proofs also cover files too large for the byte cache. Every call rechecks path/stat identity; no TTL. */
  verify(path:string,sha256:string,length:number):void {
    const key=JSON.stringify([path,sha256,length]);this.verification.checks++;
    const previous=this.proofs.get(key);this.proofs.delete(key);
    const identity=regularFilePathIdentity(path);
    if(previous===identity){this.proofs.set(key,identity);return;}
    this.read(path,sha256,length);if(regularFilePathIdentity(path)!==identity)throw new Error('FILE_HASH_MISMATCH');
    while(this.proofs.size>=Math.max(1,this.maxEntries))this.proofs.delete(this.proofs.keys().next().value!);
    this.proofs.set(key,identity);
  }
  read(path:string,sha256:string,length:number):Buffer {
    this.verification.checks++;
    const identity=regularFilePathIdentity(path),key=JSON.stringify([path,sha256,length]),cached=this.entries.get(key);
    if(cached?.identity===identity){this.entries.delete(key);this.entries.set(key,cached);return Buffer.from(cached.bytes);}
    if(cached){this.entries.delete(key);this.totalBytes-=cached.bytes.length;}
    const bytes=readFileSync(path);this.verification.hashes++;this.verification.hashedBytes+=bytes.length;
    if(bytes.length!==length||createHash('sha256').update(bytes).digest('hex')!==sha256||regularFilePathIdentity(path)!==identity)throw new Error('FILE_HASH_MISMATCH');
    if(bytes.length<=this.maxBytes){
      while(this.entries.size>=this.maxEntries||this.totalBytes+bytes.length>this.maxBytes){const oldest=this.entries.keys().next().value;if(oldest===undefined)break;this.totalBytes-=this.entries.get(oldest)!.bytes.length;this.entries.delete(oldest);}
      this.entries.set(key,{identity,bytes:Buffer.from(bytes)});this.totalBytes+=bytes.length;
    }
    return bytes;
  }
}
