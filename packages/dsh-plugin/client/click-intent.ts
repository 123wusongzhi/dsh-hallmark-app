/** Disambiguate pointer single/double clicks without unmounting the card too early. */
export function createClickIntent(openWorkbench:()=>void,startChat:()=>void,delay=500,schedule:(fn:()=>void,ms:number)=>unknown=(fn,ms)=>setTimeout(fn,ms),unschedule:(id:unknown)=>void=id=>clearTimeout(id as ReturnType<typeof setTimeout>)){
  let timer:unknown;let pending=false;
  const cancel=()=>{if(pending)unschedule(timer);pending=false;timer=undefined;};
  return {single(detail:number){cancel();if(detail===0){openWorkbench();return;}if(detail>1)return;pending=true;timer=schedule(()=>{pending=false;timer=undefined;openWorkbench();},delay);},double(){cancel();startChat();},cancel};
}
