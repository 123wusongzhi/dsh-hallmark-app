/** Coalesce notifications while preserving each explicit caller's persistence promise. */
export function createLatestStateSaver(write:()=>Promise<void>) {
  type Batch={promise:Promise<void>;resolve:()=>void;reject:(error:unknown)=>void};
  let pending:Batch|undefined,inFlight:Batch|undefined,disposed=false;
  const rejectPending=(error:unknown)=>{const batch=pending;pending=undefined;batch?.reject(error);};
  const pump=async()=>{
    if(inFlight||disposed||!pending)return;
    const batch=pending;pending=undefined;inFlight=batch;
    try{
      await write();batch.resolve();
    }catch(error){
      // An uncertain CAS receipt must not cause an implicit repeat.
      batch.reject(error);rejectPending(error);
    }finally{inFlight=undefined;if(pending&&!disposed)queueMicrotask(()=>void pump());}
  };
  const save=()=>{
    if(disposed)return Promise.reject(new Error('UI状态连接已关闭。'));
    if(!pending){let resolve:()=>void,reject:(error:unknown)=>void;const promise=new Promise<void>((accept,deny)=>{resolve=accept;reject=deny;});pending={promise,resolve:resolve!,reject:reject!};queueMicrotask(()=>void pump());}
    // Same-turn changes share one export; changes during a write share one successor.
    return pending.promise;
  };
  return {save,flush:save,dispose:()=>{disposed=true;const error=new Error('UI状态连接已关闭。');rejectPending(error);inFlight?.reject(error);}};
}
