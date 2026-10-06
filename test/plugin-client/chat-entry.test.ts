import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatEntryIntent } from '../../packages/dsh-plugin/client/chat-entry.ts';
import { COMPONENTS_SIDEBAR_KIND } from '../../packages/dsh-plugin/client/sidebar-contract.ts';
import type { NativeSidebarRight } from '../../packages/dsh-plugin/client/sidebar-contract.ts';

function nativeSidebar(){
  let mounted:string|undefined;const listeners=new Set<()=>void>();const opens:{kind:string;options:unknown}[]=[];
  const sidebar:NativeSidebarRight={mounted:{getSnapshot:()=>mounted,subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};}},openTab:(kind,options)=>{opens.push({kind,options});}};
  return {sidebar,opens,subscribers:()=>listeners.size,show(sessionId:string|undefined){mounted=sessionId;for(const listener of [...listeners])listener();}};
}
const committed=async(intent:ChatEntryIntent,sessionId:string,sidebar:NativeSidebarRight)=>{intent.inputCommitted(sessionId,sidebar);await Promise.resolve();};

test('explicit app entry navigates only the exact existing session and opens the list after input commit',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();const navigated:string[]=[];intent.observeSession('a');
  intent.enter('a',sessionId=>{navigated.push(sessionId);host.show(sessionId);},host.sidebar);
  assert.deepEqual(navigated,['a']);assert.equal(host.opens.length,0,'navigation call stack cannot open a sidebar');
  const dispose=intent.inputCommitted('a',host.sidebar);assert.equal(host.opens.length,0,'React effect must finish before opening');await Promise.resolve();
  assert.deepEqual(host.opens,[{kind:COMPONENTS_SIDEBAR_KIND,options:{params:{}}}],'empty params explicitly replace any previously opened detail');
  assert.equal(host.subscribers(),0);dispose();intent.reset();
});

test('ordinary mounts leave existing file tabs alone; repeated explicit entry to the same session opens again',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');host.show('a');
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);
  for(let i=0;i<2;i++){intent.enter('a',()=>{},host.sidebar);await committed(intent,'a',host.sidebar);}
  assert.equal(host.opens.length,2);await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,2);intent.reset();
});

test('StrictMode cleanup/remount and duplicate native input seats consume one intent once',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);
  const abandoned=intent.inputCommitted('a',host.sidebar);abandoned();
  intent.inputCommitted('a',host.sidebar);intent.inputCommitted('a',host.sidebar);await Promise.resolve();
  assert.equal(host.opens.length,1);intent.reset();
});

test('input committing before mounted is published waits for the public signal instead of losing the intent',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',()=>{},host.sidebar);
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);assert.equal(host.subscribers(),1);assert.equal(intent.notice('a'),undefined);
  const before=intent.getSnapshot();host.show('a');assert.ok(intent.getSnapshot()>before,'mounted notification wakes the committed input effect');
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,1);assert.equal(host.subscribers(),0);intent.reset();
});

test('unmounted input and plugin disposal cannot perform a late sidebar open',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);
  const dispose=intent.inputCommitted('a',host.sidebar);dispose();await Promise.resolve();assert.equal(host.opens.length,0);
  intent.inputCommitted('a',host.sidebar);intent.reset();await Promise.resolve();assert.equal(host.opens.length,0);assert.equal(host.subscribers(),0);
});

test('changing session after navigation cancels rather than opening into another or later-returned session',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);
  intent.inputCommitted('a',host.sidebar);host.show('b');intent.observeSession('b');await Promise.resolve();
  host.show('a');intent.observeSession('a');await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);assert.equal(host.subscribers(),0);intent.reset();
});

test('leaving native chat before React commit cancels even when the main session identity remains unchanged',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);
  intent.inputCommitted('a',host.sidebar);host.show(undefined);await Promise.resolve();host.show('a');
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);intent.reset();
});

test('both the live main-session observer and mounted session are required, including hosts without subscribe',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();const noSubscription={mounted:{getSnapshot:host.sidebar.mounted.getSnapshot},openTab:host.sidebar.openTab};
  intent.observeSession('a');intent.enter('a',host.show,noSubscription);intent.inputCommitted('a',noSubscription);host.show('b');await Promise.resolve();assert.equal(host.opens.length,0);
  host.show('a');intent.enter('a',()=>{},noSubscription);intent.observeSession('b');await committed(intent,'a',noSubscription);assert.equal(host.opens.length,0);intent.reset();
});

test('a newer entry supersedes queued work even when the target session is unchanged',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);intent.inputCommitted('a',host.sidebar);
  intent.enter('a',host.show,host.sidebar);await Promise.resolve();assert.equal(host.opens.length,0,'old commit cannot consume the new request');
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,1);intent.reset();
});

test('navigation failure cancels its intent and propagates to the existing application error UI',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();intent.observeSession('a');
  assert.throws(()=>intent.enter('a',()=>{host.show('a');throw new Error('native navigation failed');},host.sidebar),/native navigation failed/);
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);assert.equal(host.subscribers(),0);intent.reset();
});

test('expired navigation is not revived by a later input and exposes a manual-retry notice',async()=>{
  let now=100;const intent=new ChatEntryIntent(()=>now);const host=nativeSidebar();intent.observeSession('a');intent.enter('a',host.show,host.sidebar);now+=10_000;
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0);assert.match(intent.notice('a')!,/超时.*本会话组件/);assert.equal(host.subscribers(),0);intent.reset();
});

test('sidebar failure is visible and consumed; a new explicit entry can retry successfully',async()=>{
  const intent=new ChatEntryIntent();const host=nativeSidebar();const unavailable={...host.sidebar,openTab:()=>{throw new Error('store not adopted');}};
  intent.observeSession('a');intent.enter('a',host.show,unavailable);await committed(intent,'a',unavailable);assert.match(intent.notice('a')!,/本会话组件.*重试/);
  await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,0,'rerender must not repeatedly steal focus');
  intent.enter('a',host.show,host.sidebar);await committed(intent,'a',host.sidebar);assert.equal(host.opens.length,1);assert.equal(intent.notice('a'),undefined);intent.reset();
});
