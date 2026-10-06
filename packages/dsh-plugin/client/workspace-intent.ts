export interface OwnedWorkspaceIntent {sessionId:string;viewId:string;title:string}
let pending:OwnedWorkspaceIntent|undefined;const listeners=new Set<()=>void>();
/** A one-shot user navigation intent; metadata only, no Spec/data copied or saved. */
export const ownedWorkspaceIntent={
  open(intent:OwnedWorkspaceIntent){if(typeof intent.sessionId!=='string'||!intent.sessionId||typeof intent.viewId!=='string'||!intent.viewId||typeof intent.title!=='string')return;pending={sessionId:intent.sessionId,viewId:intent.viewId,title:intent.title};for(const listener of listeners)listener();},
  take():OwnedWorkspaceIntent|undefined{const value=pending;pending=undefined;return value;},
  subscribe(listener:()=>void):()=>void{listeners.add(listener);return()=>{listeners.delete(listener);};},
};
