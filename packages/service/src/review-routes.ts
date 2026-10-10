import type {ReviewBridge,ReviewCompletion,ReviewOwner} from './review-bridge.ts';
function invalid():never {throw Object.assign(new Error('INVALID_REVIEW_REQUEST'),{statusCode:400});}
function owner(input:Record<string,unknown>):ReviewOwner {
  if(typeof input.invocationId!=='string'||!input.invocationId||input.invocationId.length>2000||typeof input.sessionId!=='string'||!input.sessionId||input.sessionId.length>160)invalid();
  return {invocationId:input.invocationId,sessionId:input.sessionId};
}
/** Called only behind the Apps server's existing loopback and bearer checks. */
export async function reviewRoutes(bridge:ReviewBridge,path:string,input:Record<string,unknown>,signal:AbortSignal):Promise<unknown> {
  if(path==='/v1/review-requests/next'){
    if(Object.keys(input).some(key=>!['invocationId','sessionId'].includes(key)))invalid();
    return {ticket:await bridge.next(owner(input),signal)};
  }
  if(path==='/v1/review-requests/complete'){
    if(Object.keys(input).some(key=>!['invocationId','sessionId','requestId','claimToken','result','error'].includes(key))||typeof input.requestId!=='string'||typeof input.claimToken!=='string'||('result'in input)===('error'in input))invalid();
    bridge.complete(input.requestId,input.claimToken,owner(input),('result'in input?{result:input.result}:{error:String(input.error)}) as ReviewCompletion);
    return {accepted:true};
  }
  return undefined;
}
