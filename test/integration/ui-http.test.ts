import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, priceArgs } from './harness.ts';

const spec = { id: 'ui-review-view', title: '独立UI组件', layout: { type: 'column', children: ['note'] }, widgets: [{ id: 'note', type: 'text', text: '本地展示' }], bindings: [] };

test('UI reopens saved component and uses optimistic revisions without source writes',async()=>{
  const h=await setup();try{
    await h.request('/ui/render',{spec});
    const saved=(await h.request('/ui/save',{viewId:spec.id,title:spec.title,action:'save-component'})).body;
    const a=(await h.request('/ui/open-component',{componentId:spec.id})).body;
    const b=(await h.request('/ui/open-component',{componentId:spec.id})).body;
    assert.notEqual(a.spec.id,b.spec.id);
    await h.request('/ui/update',{viewId:a.spec.id,patch:[{op:'replace',path:'/title',value:'第一位编辑者'}]});
    const result=await h.request('/ui/save',{viewId:a.spec.id,title:'第一位编辑者',action:'save-component',mode:'update',componentId:spec.id,expectedRevision:a.baseRevision});
    assert.equal(result.body.component.revision,2);
    const conflict=await h.request('/ui/save',{viewId:b.spec.id,title:'旧版覆盖',action:'save-component',mode:'update',componentId:spec.id,expectedRevision:b.baseRevision});
    assert.equal(conflict.body.error.code,'COMPONENT_CONFLICT');
    await h.request('/ui/manage',{kind:'entry',id:saved.entry.id,action:'pin',pinned:true});
    const list=(await h.request('/ui/saved')).body;
    assert.equal(list.entries[0].pinned,true);assert.equal(list.components[0].title,'第一位编辑者');
    assert.equal(h.state.platformWrites.length,0);assert.equal(h.state.events.length,0);
  }finally{await h.close();}
});

test('authenticated UI builder/render/update/save/open never auto-activates chat or calls business tools', async () => {
  const h = await setup();
  try {
    const templates = await h.request('/ui/templates'); assert.equal(templates.httpStatus, 200); assert.ok(templates.body.length > 0);
    assert.equal((await h.request('/ui/render', { spec })).body.id, spec.id); assert.equal(h.store.list('entries').length, 0);
    const unsaved = await h.request('/ui/save', { viewId: spec.id, title: '未明确保存' }); assert.equal(unsaved.httpStatus, 400); assert.equal(h.store.list('entries').length, 0);
    assert.equal((await h.request('/ui/update', { viewId: spec.id, patch: [{ op: 'replace', path: '/title', value: 'UI显式调整' }] })).body.title, 'UI显式调整');
    const saved = await h.request('/ui/save', { viewId: spec.id, title: 'UI保存标题', action: 'save-component' }); assert.equal(saved.httpStatus, 200); assert.equal(saved.body.component.id, spec.id);
    const component = h.store.get<any>('components', spec.id); assert.match(component.userRequest, /点击“保存组件”/);
    assert.equal(h.store.list('session_apps').length, 0); assert.equal(h.state.events.length, 0);
    const opened = await h.request('/ui/open-entry', { entryId: saved.body.entry.id }); assert.equal(opened.httpStatus, 200);
    await h.restart(); const reloaded = await h.request(`/ui/views/${spec.id}`); assert.equal(reloaded.httpStatus, 200); assert.equal(reloaded.body.title, 'UI保存标题');
    assert.equal(h.store.list('session_apps').length, 0); assert.equal(h.state.platformWrites.length, 0);
    assert.equal((await h.tool('hallmark_list_stores')).error.code, 'APP_NOT_ACTIVE');
  } finally { await h.close(); }
});

test('UI cannot inject tools, write queries, credential fields or prototype patches', async () => {
  const h = await setup();
  try {
    await h.request('/ui/render', { spec });
    const maliciousCalls = [
      ['/ui/render', { spec, tool: 'hallmark_update_price', arguments: priceArgs }],
      ['/ui/render', { spec: { ...spec, bindings: [{ id: 'data', query: { tool: 'hallmark_update_price', params: priceArgs }, fieldMap: {} }] } }],
      ['/ui/update', { viewId: spec.id, patch: [{ op: 'add', path: '/__proto__/polluted', value: true }] }],
      ['/ui/render', { spec: { ...spec, apiKey: 'not-a-real-secret' } }],
      ['/ui/tools', { tool: 'hallmark_update_price', arguments: priceArgs }],
    ] as const;
    for (const [path, body] of maliciousCalls) { const result = await h.request(path, body); assert.equal(result.httpStatus, 400, path); assert.equal(result.body.status, 'failed', path); }
    assert.equal(({} as any).polluted, undefined); assert.equal(h.store.list('entries').length, 0);
    assert.equal(h.store.list('session_apps').length, 0); assert.equal(h.state.platformWrites.length, 0); assert.equal(h.state.events.length, 0);
  } finally { await h.close(); }
});

test('UI refresh remains isolated read synchronization while chat stays inactive', async () => {
  const h = await setup();
  try {
    const refresh = await h.request('/ui/refresh', { datasetKey: 'store_products:store-A' }); assert.equal(refresh.httpStatus, 200); assert.equal(refresh.body.status, 'ok');
    assert.equal(h.store.list('session_apps').length, 0); assert.ok(h.state.events.some(event => event.path === '/api/store-products/sync'));
    h.store.put('queries', 'unsafe-write', { tool: 'hallmark_update_price', params: priceArgs });
    const denied = await h.request('/ui/refresh', { datasetKey: 'query:unsafe-write' }); assert.equal(denied.body.error.code, 'DATASET_NOT_SUPPORTED');
    const origin = await h.request('/ui/saved', undefined, 'session-main', { Origin: 'https://evil.invalid' }); assert.equal(origin.httpStatus, 403);
    assert.equal(h.state.platformWrites.length, 0); assert.equal(h.store.list('session_apps').length, 0);
  } finally { await h.close(); }
});
