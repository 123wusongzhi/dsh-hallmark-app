/** Bounded LRU + TTL memory of display verifications that passed. Only successes are stored; any lookup that misses or mismatches drops the entry. */
export interface VerifiedDisplay {sessionId:string;viewId:string;publicationId:string;displayId:string;fingerprint:string;verifiedAt:number}
export class VerifiedDisplayCache {
  private entries=new Map<string,VerifiedDisplay>();
  maxEntries:number;
  ttlMs:number;
  constructor(maxEntries=256,ttlMs=10*60_000){this.maxEntries=maxEntries;this.ttlMs=ttlMs;}
  get size():number {return this.entries.size;}
  /** TTL only bounds metadata reuse. The callback MUST check filesystem integrity on every hit, including relocation authorization; an unchanged database alone is not proof. A backwards clock expires the entry. */
  hit(key:string,fingerprint:()=>string|undefined,now:number):boolean {
    const entry=this.entries.get(key);if(!entry)return false;
    this.entries.delete(key);
    if(now<entry.verifiedAt||now-entry.verifiedAt>=this.ttlMs)return false;
    const current=fingerprint();if(current===undefined||current!==entry.fingerprint)return false;
    this.entries.set(key,entry);return true;
  }
  remember(key:string,entry:VerifiedDisplay):void {
    this.entries.delete(key);this.entries.set(key,entry);
    while(this.entries.size>Math.max(1,this.maxEntries)){const oldest=this.entries.keys().next().value;if(oldest===undefined)break;this.entries.delete(oldest);}
  }
  forget(key:string):void {this.entries.delete(key);}
  /** Eager cleanup for known invalidation points; correctness never depends on it because every hit re-checks its fingerprint. */
  invalidate(match?:Partial<Pick<VerifiedDisplay,'sessionId'|'viewId'|'publicationId'|'displayId'>>):number {
    if(!match||!Object.keys(match).length){const count=this.entries.size;this.entries.clear();return count;}
    let count=0;
    for(const [key,entry] of this.entries)if((Object.keys(match) as (keyof typeof match)[]).every(field=>entry[field]===match[field])){this.entries.delete(key);count++;}
    return count;
  }
}
