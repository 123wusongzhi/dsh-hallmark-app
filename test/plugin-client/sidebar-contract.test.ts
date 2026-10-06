import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS_SIDEBAR_DEFINITION, COMPONENTS_SIDEBAR_ID, COMPONENTS_SIDEBAR_KIND, openSessionComponents, readSidebarNavigation } from '../../packages/dsh-plugin/client/sidebar-contract.ts';
test('native tab has separate provider id/kind and a real per-session guide entry',()=>{
  assert.equal(COMPONENTS_SIDEBAR_DEFINITION.id,COMPONENTS_SIDEBAR_ID);assert.notEqual(COMPONENTS_SIDEBAR_ID,COMPONENTS_SIDEBAR_KIND);assert.equal(COMPONENTS_SIDEBAR_DEFINITION.title('sidebar://page'),'本会话组件');assert.equal(COMPONENTS_SIDEBAR_DEFINITION.guide?.[0].title(),'本会话组件');
});
test('navigation accepts only plain viewId params, not prototype/getter/foreign-session payloads',()=>{
  assert.deepEqual(readSidebarNavigation(undefined),{valid:true});assert.deepEqual(readSidebarNavigation({}),{valid:true});assert.deepEqual(readSidebarNavigation({viewId:'real'}),{valid:true,viewId:'real'});for(const value of [{viewId:''},{viewId:2},{sessionId:'other',viewId:'real'},[],Object.create({viewId:'evil'}),{get viewId(){throw new Error('getter must never run');}}])assert.equal(readSidebarNavigation(value).valid,false);
});
test('toolview opens only the exact currently mounted Session, with no private cross-session navigation',()=>{
  let mounted:string|undefined='a';const calls:unknown[]=[];const sidebar={mounted:{getSnapshot:()=>mounted},openTab:(kind:string,options?:unknown)=>calls.push({kind,options})};assert.equal(openSessionComponents(sidebar,'a','owned').ok,true);assert.deepEqual(calls,[{kind:COMPONENTS_SIDEBAR_KIND,options:{params:{viewId:'owned'}}}]);mounted='b';assert.equal(openSessionComponents(sidebar,'a','owned').ok,false);assert.equal(calls.length,1);mounted=undefined;assert.equal(openSessionComponents(sidebar,'a','owned').ok,false);assert.equal(openSessionComponents(undefined,'a','owned').ok,false);mounted='a';assert.equal(openSessionComponents(sidebar,'a','').ok,false);assert.equal(calls.length,1);
});
