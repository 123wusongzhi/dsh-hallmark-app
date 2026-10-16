import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {attachListingImageJobs,type ListingImageContext} from '../../packages/plugin-apps/src/listing-image-jobs.ts';
test('registered prompt is used verbatim and success is checkpointed before model resumes',async t=>{
  const root=mkdtempSync(join(tmpdir(),'listing-image-host-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'progress.json'),source=join(root,'original');writeFileSync(source,'generated file fixture');
  writeFileSync(path,JSON.stringify({assets:[{assetKey:'cover',sessionId:'images',factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['real-source'],prompt:'制作首图，文案：2P。清新风格，保持主体一致。',stage:'generating'}]}));
  const agent={id:'images'},hooks=new Map<string,Function>();let tool:any;
  const context={agents:{get:(id:string)=>id==='images'?agent:undefined},tools:{register:(value:any)=>{tool=value;return ()=>{};}},on:(name:string,handler:Function)=>{hooks.set(name,handler);return ()=>hooks.delete(name);}};
  const dispose=attachListingImageJobs(context as unknown as ListingImageContext);t.after(dispose);
  const prepared=await tool.execute({progressPath:path,assetKey:'cover'},{agent});
  const execution={agent,name:'codex_image_generate',callId:'call-1',arguments:{prompt:prepared.prompt,referenceImages:[{attachmentId:'actual-source'}]}};
  const pre=hooks.get('tools/pre-execute')!;
  assert.equal((await pre({...execution,arguments:{...execution.arguments,prompt:prepared.prompt+' 主体居中，影棚灯光。'}},async()=>({kind:'allow'}))).kind,'deny');
  assert.equal((await pre(execution,async()=>({kind:'deny',reason:'existing permission denial'}))).reason,'existing permission denial');
  assert.equal((await pre(execution,async()=>({kind:'allow'}))).kind,'allow');
  const result={isError:false,value:'image',content:[{type:'text',text:`Generated image.\nOriginal PNG saved on the DSH host at: "${source.replaceAll('\\','\\\\')}".`}]};
  assert.equal(await hooks.get('tools/execute')!(execution,async()=>result),result);
  const asset=JSON.parse(readFileSync(path,'utf8')).assets[0];
  assert.equal(asset.stage,'generated');assert.equal(asset.sourcePath,source);assert.equal(asset.actualPrompt,prepared.prompt);assert.equal(asset.toolCallId,'call-1');
  assert.equal(JSON.parse(readFileSync(asset.receiptPath,'utf8')).sourcePath,source);
  assert.equal((await pre({...execution,callId:'duplicate'},async()=>({kind:'allow'}))).kind,'deny');
  assert.equal((await pre({...execution,agent:{id:'unrelated'}},async()=>({kind:'allow'}))).kind,'allow');
});
test('failed generation remains retryable; unrecognized success stays successful and prohibits regeneration',async t=>{
  const root=mkdtempSync(join(tmpdir(),'listing-image-receipt-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'progress.json');writeFileSync(path,JSON.stringify({assets:[{assetKey:'image',sessionId:'child',prompt:'短提示词',stage:'generating'}]}));
  const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
  attachListingImageJobs({agents:{get:()=>agent},tools:{register:(value:any)=>{tool=value;return ()=>{};}},on:(name:string,fn:Function)=>{hooks.set(name,fn);return ()=>{};}} as unknown as ListingImageContext);
  await tool.execute({progressPath:path,assetKey:'image'},{agent});
  const execution={agent,name:'codex_image_generate',callId:'call',arguments:{prompt:'短提示词',referenceImages:[{}]}};
  const failed={isError:true,content:[{type:'text',text:'Unsupported size'}]};
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
  assert.equal(await hooks.get('tools/execute')!(execution,async()=>failed),failed);
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
  const result=await hooks.get('tools/execute')!(execution,async()=>({isError:false,content:[{type:'text',text:'Success with a future receipt format'}]}));
  assert.equal(result.isError,false);assert.match(result.content.at(-1).text,/图片已生成/);
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'deny');
});
test('prepare stamps the image session, adopts an abandoned generation and points to an existing success receipt',async t=>{
  const root=mkdtempSync(join(tmpdir(),'listing-image-adopt-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'progress.json'),base={factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['real-source'],prompt:'短提示词',stage:'generating'};
  // The agent registers without a session; the Host supplies it.
  writeFileSync(path,JSON.stringify({assets:[{...base,assetKey:'fresh'},{...base,assetKey:'abandoned',sessionId:'old'},{...base,assetKey:'done',sessionId:'old'}]}));
  const source=join(root,'cache.png');writeFileSync(source,'png');
  writeFileSync(`${path}.abc.receipt.json`,JSON.stringify({assetKey:'done',sessionId:'old',sourcePath:source}));
  const agent={id:'new'},hooks=new Map<string,Function>();let tool:any;
  attachListingImageJobs({agents:{get:()=>agent},tools:{register:(value:any)=>{tool=value;return ()=>{};}},on:(name:string,fn:Function)=>{hooks.set(name,fn);return ()=>{};}} as unknown as ListingImageContext);
  await tool.execute({progressPath:path,assetKey:'fresh'},{agent});
  await tool.execute({progressPath:path,assetKey:'abandoned'},{agent});
  const assets=JSON.parse(readFileSync(path,'utf8')).assets;
  assert.equal(assets[0].sessionId,'new');assert.equal(assets[1].sessionId,'new');assert.equal(assets[1].originSessionId,'old');
  await assert.rejects(tool.execute({progressPath:path,assetKey:'done'},{agent}),/回执中的 sourcePath/);
});

for(const completion of ['ledger','receipt','call'] as const)test(`a ${completion} completion supersedes a previously allowed image generation`,async t=>{
  const root=mkdtempSync(join(tmpdir(),'listing-image-stale-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'progress.json'),source=join(root,'original.png');writeFileSync(source,'local generated fixture');
  const asset={assetKey:'image',sessionId:'child',factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['source'],prompt:'short prompt',stage:'generating'};
  writeFileSync(path,JSON.stringify({assets:[asset]}));
  const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
  t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(value:any)=>{tool=value;return ()=>{};}},on:(name:string,fn:Function)=>{hooks.set(name,fn);return ()=>{};}} as unknown as ListingImageContext));
  await tool.execute({progressPath:path,assetKey:'image'},{agent});
  const execution={agent,name:'codex_image_generate',callId:'queued',arguments:{prompt:asset.prompt,referenceImages:[{}]}};
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
  const result={isError:false,content:[{type:'text',text:`Original PNG saved on the DSH host at: "${source}"`}]};
  if(completion==='ledger')writeFileSync(path,JSON.stringify({assets:[{...asset,stage:'generated',sourcePath:source}]}));
  if(completion==='receipt')writeFileSync(`${path}.finished.receipt.json`,JSON.stringify({assetKey:'image',sessionId:'child',sourcePath:source}));
  if(completion==='call'){
    const first={...execution,callId:'first'};
    assert.equal((await hooks.get('tools/pre-execute')!(first,async()=>({kind:'allow'}))).kind,'allow');
    await hooks.get('tools/execute')!(first,async()=>result);
  }
  let generations=0;
  await assert.rejects(hooks.get('tools/execute')!(execution,async()=>{generations++;return result;}),/已|恢复|生成/);
  assert.equal(generations,0,'an already delivered success must never trigger a second generation');
});

for(const change of ['owner','revision','prompt','references','slots','source'] as const)test(`prepared image jobs recheck ${change} changes without starting generation`,async t=>{
  const root=mkdtempSync(join(tmpdir(),'listing-image-recheck-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'progress.json'),source=join(root,'original.png');writeFileSync(source,'local fixture');
  const asset:any={assetKey:'image',sessionId:'child',factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['source'],prompt:'short prompt',stage:'generating'};
  writeFileSync(path,JSON.stringify({assets:[asset]}));
  const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
  t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(value:any)=>{tool=value;return ()=>{};}},on:(name:string,fn:Function)=>{hooks.set(name,fn);return ()=>{};}} as unknown as ListingImageContext));
  await tool.execute({progressPath:path,assetKey:'image'},{agent});
  const execution={agent,name:'codex_image_generate',callId:'queued',arguments:{prompt:asset.prompt,referenceImages:[{}]}};
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
  if(change==='owner')asset.sessionId='new-owner';
  if(change==='revision')asset.factsRevision=2;
  if(change==='prompt')asset.prompt='changed prompt';
  if(change==='references')asset.references=['different-source'];
  if(change==='slots')asset.slots[0].index=1;
  if(change==='source')asset.sourcePath=source;
  writeFileSync(path,JSON.stringify({assets:[asset]}));
  assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'deny');
  let generations=0;
  await assert.rejects(hooks.get('tools/execute')!(execution,async()=>{generations++;return {isError:false,content:[]};}));
  assert.equal(generations,0);
  if(change==='source')assert.equal((await tool.execute({progressPath:path,assetKey:'image'},{agent})).nextAction,'stage_existing');
});

for(const samePrompt of [false,true])test(`preparing another asset cannot retarget an approved call (same prompt: ${samePrompt})`,async t=>{
 const root=mkdtempSync(join(tmpdir(),'listing-independent-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const path=join(root,'progress.json');const base={sessionId:'child',factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['source'],stage:'generating'};
 writeFileSync(path,JSON.stringify({assets:[{...base,assetKey:'A',prompt:'prompt A'},{...base,assetKey:'B',prompt:samePrompt?'prompt A':'prompt B'}]}));
 const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
 t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(v:any)=>{tool=v;return ()=>{};}},on:(n:string,f:Function)=>{hooks.set(n,f);return ()=>{};}} as unknown as ListingImageContext));
 await tool.execute({progressPath:path,assetKey:'A'},{agent});
 const execution={agent,name:'codex_image_generate',callId:'approved-A',arguments:{prompt:'prompt A',referenceImages:[{}]}};
 assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
 await tool.execute({progressPath:path,assetKey:'B'},{agent});
 let generations=0;
 await assert.rejects(hooks.get('tools/execute')!(execution,async()=>{generations++;return {isError:false,content:[]};}));
 assert.equal(generations,0);
});

for(const change of ['prompt','references','deny'] as const)test(`execution rechecks approved call payload and permission (${change})`,async t=>{
 const root=mkdtempSync(join(tmpdir(),'listing-call-payload-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const path=join(root,'progress.json');writeFileSync(path,JSON.stringify({assets:[{assetKey:'A',sessionId:'child',prompt:'prompt A',stage:'generating'}]}));
 const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
 t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(v:any)=>{tool=v;return ()=>{};}},on:(n:string,f:Function)=>{hooks.set(n,f);return ()=>{};}} as unknown as ListingImageContext));
 await tool.execute({progressPath:path,assetKey:'A'},{agent});
 const execution={agent,name:'codex_image_generate',callId:'approved-A',arguments:{prompt:'prompt A',referenceImages:[{}]}};
 assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
 if(change==='prompt')execution.arguments.prompt='different prompt';
 if(change==='references')execution.arguments.referenceImages=[];
 if(change==='deny')assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'deny'}))).kind,'deny');
 let generations=0;
 await assert.rejects(hooks.get('tools/execute')!(execution,async()=>{generations++;return {isError:false,content:[]};}));
 assert.equal(generations,0);
 const ordinary={...execution,agent:{id:'unarmed'}};
 const result={isError:false,content:[]};
 assert.equal(await hooks.get('tools/execute')!(ordinary,async()=>result),result);
});

test('a preparation change during asynchronous permission checks cannot retarget equal-prompt assets',async t=>{
 const root=mkdtempSync(join(tmpdir(),'listing-approval-race-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const path=join(root,'progress.json'),base={sessionId:'child',prompt:'same prompt',stage:'generating'};
 writeFileSync(path,JSON.stringify({assets:[{...base,assetKey:'A'},{...base,assetKey:'B'}]}));
 const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
 t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(v:any)=>{tool=v;return ()=>{};}},on:(n:string,f:Function)=>{hooks.set(n,f);return ()=>{};}} as unknown as ListingImageContext));
 await tool.execute({progressPath:path,assetKey:'A'},{agent});
 const execution={agent,name:'codex_image_generate',callId:'approved-A',arguments:{prompt:'same prompt',referenceImages:[{}]}};
 const decision=await hooks.get('tools/pre-execute')!(execution,async()=>{
   await tool.execute({progressPath:path,assetKey:'B'},{agent});return {kind:'allow'};
 });
 assert.equal(decision.kind,'deny');
 let generations=0;
 await assert.rejects(hooks.get('tools/execute')!(execution,async()=>{generations++;return {isError:false,content:[]};}));
 assert.equal(generations,0);
 // A fresh complete approval/execution lifecycle for the current task remains valid.
 assert.equal((await hooks.get('tools/pre-execute')!(execution,async()=>({kind:'allow'}))).kind,'allow');
 const failure={isError:true,content:[]};
 assert.equal(await hooks.get('tools/execute')!(execution,async()=>{generations++;return failure;}),failure);
 assert.equal(generations,1);
});

test('two approved calls serialize, failed first can be freshly retried',async t=>{
 const root=mkdtempSync(join(tmpdir(),'listing-independent-concurrency-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const path=join(root,'progress.json');writeFileSync(path,JSON.stringify({assets:[{assetKey:'A',sessionId:'child',factsRevision:1,preparationRevision:'prep',slots:[{saleId:'sale',group:'images',index:0}],references:['source'],stage:'generating',prompt:'prompt'}]}));
 const agent={id:'child'},hooks=new Map<string,Function>();let tool:any;
 t.after(attachListingImageJobs({agents:{get:()=>agent},tools:{register:(v:any)=>{tool=v;return ()=>{};}},on:(n:string,f:Function)=>{hooks.set(n,f);return ()=>{};}} as unknown as ListingImageContext));
 await tool.execute({progressPath:path,assetKey:'A'},{agent});
 const first={agent,name:'codex_image_generate',callId:'first',arguments:{prompt:'prompt',referenceImages:[{}]}},second={...first,callId:'second'};
 const pre=hooks.get('tools/pre-execute')!,execute=hooks.get('tools/execute')!;
 for(const e of [first,second])assert.equal((await pre(e,async()=>({kind:'allow'}))).kind,'allow');
 let release!:Function,generations=0;const pending=execute(first,()=>{generations++;return new Promise(resolve=>release=resolve);});
 await assert.rejects(execute(second,async()=>{generations++;return {isError:true,content:[]};}));assert.equal(generations,1);
 release({isError:true,content:[]});await pending;
 assert.equal((await pre(second,async()=>({kind:'allow'}))).kind,'allow');await execute(second,async()=>{generations++;return {isError:true,content:[]};});assert.equal(generations,2);
});
