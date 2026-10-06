import test from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import {executeUI} from '../../packages/service/src/ui.ts';
const spec={id:'draft',title:'临时构建',layout:{type:'column' as const,children:['note']},widgets:[{id:'note',type:'text' as const,text:'用户定义内容'}],bindings:[]};
test('workbench local preview is independent of chat activation and never saves implicitly',async()=>{
 const store=new AppStore(':memory:');const manager=new PresentationManager(store);
 try{
 const preview=await executeUI('/ui/render','POST',{spec},manager,store) as any;
 assert.equal(preview.id,'draft');assert.deepEqual(store.list('session_apps'),[]);assert.deepEqual(store.list('components'),[]);
 assert.equal((await executeUI('/ui/views/draft','GET',{},manager,store) as any).title,spec.title);
 assert.equal((await executeUI('/ui/templates','GET',{},manager,store) as any[]).length,3);
 await assert.rejects(()=>executeUI('/ui/save','POST',{viewId:'draft',title:'保存'},manager,store),/Explicit save/);
 const saved=await executeUI('/ui/save','POST',{viewId:'draft',title:'保存',action:'save-component'},manager,store) as any;
 assert.match(saved.component.userRequest,/用户在应用组件控制台点击/);assert.equal(store.list('components').length,1);assert.deepEqual(store.list('operations'),[]);
 }finally{store.close();}
});
test('workbench cannot smuggle platform tools, credentials or fake save provenance',async()=>{
 const store=new AppStore(':memory:');const manager=new PresentationManager(store);
 try{
 await assert.rejects(()=>executeUI('/ui/render','POST',{spec,tool:'hallmark_update_stock'},manager,store),/Unexpected UI input/);
 await executeUI('/ui/render','POST',{spec},manager,store);
 await assert.rejects(()=>executeUI('/ui/save','POST',{viewId:'draft',title:'保存',action:'save-component',userRequest:'pretend chat'},manager,store),/Unexpected UI input/);
 await assert.rejects(()=>executeUI('/ui/arbitrary-tool','POST',{name:'hallmark_update_price'},manager,store),/UI route not found/);
 assert.deepEqual(store.list('operations'),[]);assert.deepEqual(store.list('components'),[]);
 }finally{store.close();}
});
