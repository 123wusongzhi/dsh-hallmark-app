export interface MutationTicket {epoch:number;controller:AbortController}
/** Reject late results after a Session switch, deletion, navigation or superseding request. */
export class MutationGate {
  #epoch=0;#current:MutationTicket|undefined;
  begin():MutationTicket{this.reset();const ticket={epoch:this.#epoch,controller:new AbortController()};this.#current=ticket;return ticket;}
  current(ticket:MutationTicket):boolean{return this.#current===ticket&&ticket.epoch===this.#epoch&&!ticket.controller.signal.aborted;}
  reset():void{this.#epoch++;this.#current?.controller.abort();this.#current=undefined;}
}
