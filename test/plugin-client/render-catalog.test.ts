import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRenderSpec, hallmarkCatalog, toRenderSpec } from '../../packages/dsh-plugin/client/render-catalog.ts';
import type { ViewSpec } from '../../packages/presentation/src/types.ts';
const view:ViewSpec={id:'v',title:'业务界面',layout:{type:'tabs',children:[{type:'grid',columns:2,children:['t','l']},'b']},widgets:[{id:'t',type:'table',bindingId:'data',columns:[{field:'secretSourceField',label:'名称'}]},{id:'l',type:'line_chart',bindingId:'data'},{id:'b',type:'status_badge',bindingId:'data'}],bindings:[{id:'data',datasetKey:'store_products:private-store',fieldMap:{}}]};
test('actual json-render catalog validates deterministic derived tree and never embeds business data or a second saved config',()=>{
  const before=structuredClone(view),tree=toRenderSpec(view);
  assert.deepEqual(toRenderSpec(view),tree);assert.deepEqual(view,before);
  assert.equal(tree.elements[tree.root].type,'Tabs');
  assert.equal(tree.elements['widget:t'].type,'ProductTable');
  assert.equal(tree.elements['widget:l'].type,'LineChart');
  assert.deepEqual(tree.elements['widget:t'].props,{widgetId:'t'});
  assert.equal(hallmarkCatalog.validate(tree).success,true);
  assert.ok(!JSON.stringify(tree).includes('secretSourceField'));assert.ok(!JSON.stringify(tree).includes('private-store'));
});
test('catalog rejects unknown component types and arbitrary actions or query props',()=>{
  for(const props of [{widgetId:'t',endpoint:'/api/write'},{widgetId:'t',onClick:'execute'}]){
    const tree=toRenderSpec(view);Object.assign(tree.elements['widget:t'].props,props);assert.throws(()=>assertRenderSpec(tree),/未注册/);
  }
  const tree=toRenderSpec(view);tree.elements['widget:t'].type='RunScript';assert.throws(()=>assertRenderSpec(tree),/注册表|未注册/);
});
test('adapter refuses missing or duplicate references and preserves tabs/grid sizing',()=>{
  const tree=toRenderSpec(view);const grid=tree.elements[tree.elements[tree.root].children[0]];assert.equal(grid.props.columns,2);assert.equal(grid.props.gap,16);
  assert.throws(()=>toRenderSpec({...view,layout:{type:'column',children:['missing']}}),/不存在/);
  assert.throws(()=>toRenderSpec({...view,layout:{type:'column',children:['t','t']}}),/重复/);
});
