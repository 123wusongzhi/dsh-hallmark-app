export interface SessionSnapshot {phase?:'pending'|'ready';byId:Record<string,{id:string;title?:string;retainedBy?:Record<string,number>}>}
/** Remember only an explicitly observed unique mainView Session, never the first store row. */
export class SessionSelection {
  #last:string|undefined;
  observe(snapshot:SessionSnapshot,activePanelId:string|null='hallmark-apps'):string|undefined {
    const rows=Object.values(snapshot?.byId??{});const selected=rows.filter(session=>(session.retainedBy?.mainView??0)>0);
    if(selected.length>1){this.#last=undefined;return undefined;}
    if(selected.length===1)this.#last=selected[0].id;
    else if(activePanelId!=='hallmark-apps'){this.#last=undefined;return undefined;}
    if(this.#last&&!Object.hasOwn(snapshot.byId,this.#last)){if(snapshot.phase!=='pending')this.#last=undefined;return undefined;}
    return this.#last;
  }
}
export const mainSessionSelection=new SessionSelection();
export const observeCurrentSession=(snapshot:SessionSnapshot)=>mainSessionSelection.observe(snapshot);
