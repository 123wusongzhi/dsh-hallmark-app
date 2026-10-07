import test from 'node:test';
import assert from 'node:assert/strict';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
const identity={protocolVersion:'2.0' as const,sessionId:'s',viewId:'v',buildId:'b',frameInstanceId:'f'};
test('optional extensions negotiate an intersection and preserve the original eight-method list',async()=>{
 let calls=0;const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({})},{extensionHandlers:{renderReadyV1:()=>{calls++;return {ready:true};}}});try{const hello=await host.handle({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'document',clientFeatures:['renderReadyV1','unknown-feature']});assert.deepEqual((hello as any).features,['renderReadyV1']);assert.deepEqual((hello as any).supportedMethods,['getData','getContext']);const request={...identity,channel:'dsh.apps.component.v2',type:'extension',feature:'renderReadyV1',action:'ready',requestId:'ready',params:{}};assert.equal((await host.handle(request) as any).result.ready,true);assert.equal(calls,1);assert.equal((await host.handle({...request,feature:'uiStateV1'}) as any).error.code,'UNSUPPORTED_HOST_CAPABILITY');assert.equal(await host.handle({...request,sessionId:'foreign'}),undefined);host.dispose();assert.equal(await host.handle(request),undefined);}finally{host.dispose();}
});
