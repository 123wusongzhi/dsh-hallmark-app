import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
test('combined Client owns one Apps entry and cleans up historical component slots',async()=>{
  const compiled=await build({entryPoints:['bundles/apps/client/index.tsx'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2022',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/*'],define:{'process.env.NODE_ENV':'"test"'}});
  const module={exports:{} as {default:{apply(ctx:unknown):void}}};runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require,console,setTimeout,clearTimeout});
  const slots: {name:string;id?:string;key?:string}[]=[],cleanups:(()=>void)[]=[];
  const ctx={get(name:string){return name==='layout'?{selectPanel(){}}:name==='uiWorkspace'?{openSession(){}}:name==='sidebarRightTabs'?{register(){return()=>{};}}:name==='sidebarRight'?{mounted:{getSnapshot(){return 'A';},subscribe(){return()=>{};}}}:undefined;},slots:{register(options:{name:string;id?:string;key?:string},_component:unknown){slots.push(options);return()=>{const index=slots.indexOf(options);if(index>=0)slots.splice(index,1);};},inject(_name:string,effect:()=> (()=>void)|Iterable<()=>void>){const result=effect();if(typeof result==='function')cleanups.push(result);else cleanups.push(...result);}}};
  module.exports.default.apply(ctx);
  assert.equal(slots.filter(slot=>slot.name==='sidebar.panellist').length,1);
  assert.equal(slots.filter(slot=>slot.name==='main').length,1);
  assert.equal(slots.filter(slot=>slot.name==='tool.call.toolview').length,5);
  assert.equal(slots.filter(slot=>slot.name==='tool.call.toolview'&&slot.key==='apps_invoke').length,1);
  assert.equal(slots.filter(slot=>slot.name==='conversation.input.left').length,1);
  cleanups.reverse().forEach(dispose=>dispose());assert.equal(slots.length,0);
});
