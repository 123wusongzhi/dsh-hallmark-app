import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { createWorkspaceState, workspaceReducer } from '../../packages/dsh-plugin/client/workspace-tabs.ts';
test('workbench is pinned, cannot close and missing active targets are ignored',()=>{
  const state=createWorkspaceState();assert.equal(state.tabs.length,1);assert.equal(state.tabs[0].kind,'workbench');assert.equal(state.tabs[0].pinned,true);assert.equal(workspaceReducer(state,{type:'close',id:state.activeId}),state);assert.equal(workspaceReducer(state,{type:'activate',id:'missing'}),state);
});
test('opening existing view deduplicates by app/view ID and selects its real title',()=>{
  let state=createWorkspaceState();state=workspaceReducer(state,{type:'open-view',appId:'hallmark',viewId:'real-view-7',title:'利润筛选'});assert.equal(state.tabs.length,2);const id=state.activeId;state=workspaceReducer(state,{type:'activate',id:state.tabs[0].id});state=workspaceReducer(state,{type:'open-view',appId:'hallmark',viewId:'real-view-7',title:'利润筛选更新'});assert.equal(state.tabs.length,2);assert.equal(state.activeId,id);assert.equal(state.tabs[1].title,'利润筛选更新');assert.equal(state.tabs[1].viewId,'real-view-7');
});
test('closing inactive preserves selection; closing active falls back to workbench, not another view',()=>{
  let state=createWorkspaceState();const pinned=state.activeId;state=workspaceReducer(state,{type:'open-view',appId:'hallmark',viewId:'a',title:'商品'});const inactive=state.activeId;state=workspaceReducer(state,{type:'open-view',appId:'hallmark',viewId:'b',title:'利润'});const active=state.activeId;state=workspaceReducer(state,{type:'close',id:inactive});assert.equal(state.activeId,active);assert.equal(state.tabs.length,2);state=workspaceReducer(state,{type:'close',id:active});assert.equal(state.activeId,pinned);assert.equal(state.tabs.length,1);
});
test('drafts are unique temporary tabs and metadata for unsupported apps grants no workspace authority',()=>{
  let state=createWorkspaceState();state=workspaceReducer(state,{type:'new-draft',appId:'hallmark'});const first=state.activeId;state=workspaceReducer(state,{type:'new-draft',appId:'hallmark'});assert.notEqual(state.activeId,first);state=workspaceReducer(state,{type:'close',id:first});state=workspaceReducer(state,{type:'new-draft',appId:'hallmark'});assert.equal(state.draftSequence,3);assert.equal(new Set(state.tabs.map(tab=>tab.id)).size,state.tabs.length);assert.equal(workspaceReducer(state,{type:'new-draft',appId:'other-app'}),state);assert.equal(workspaceReducer(state,{type:'open-view',appId:'other-app',viewId:'x',title:'Not Hallmark'}),state);const other=createWorkspaceState('other-app');assert.equal(other.tabs.length,0);assert.equal(workspaceReducer(other,{type:'new-draft',appId:'other-app'}),other);
});
test('rendered dock handles keyboard navigation, deletion and focus', { timeout: 30000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  const directory = mkdtempSync(join(root, 'artifacts', 'workspace-dock-interaction-'));
  const entry = join(directory, 'fixture.mjs');
  try {
    await build({
      stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React, {useReducer} from 'react';
        import {create, act} from 'react-test-renderer';
        import assert from 'node:assert/strict';
        import {WorkspaceDockTabs} from './packages/dsh-plugin/client/workspace-dock.tsx';
        import {workspaceReducer} from './packages/dsh-plugin/client/workspace-tabs.ts';

        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        globalThis.fetch = () => { throw new Error('Dock interaction must not perform network requests'); };
        const home = 'workbench:hallmark', view = 'view:hallmark:first', draft = 'draft:hallmark:1';
        const domIds = {
          [home]: 'fixture-tab-workbench%3Ahallmark',
          [view]: 'fixture-tab-view%3Ahallmark%3Afirst',
          [draft]: 'fixture-tab-draft%3Ahallmark%3A1',
        };
        const panelIds = {
          [home]: 'fixture-panel-workbench%3Ahallmark',
          [view]: 'fixture-panel-view%3Ahallmark%3Afirst',
          [draft]: 'fixture-panel-draft%3Ahallmark%3A1',
        };
        const initial = {
          appId: 'hallmark', activeId: home, draftSequence: 1,
          tabs: [
            {id: home, appId: 'hallmark', kind: 'workbench', title: '工作台', pinned: true},
            {id: view, appId: 'hallmark', kind: 'view', title: '商品', pinned: false, viewId: 'first'},
            {id: draft, appId: 'hallmark', kind: 'draft', title: '新建组件 1', pinned: false},
          ],
        };
        const actions = [], focused = [];
        let tree;
        function Harness() {
          const [state, dispatch] = useReducer(workspaceReducer, initial);
          return <WorkspaceDockTabs state={state} idPrefix='fixture' onAction={action => {
            actions.push(action);
            dispatch(action);
          }}/>;
        }
        const tabs = () => tree.root.findAll(node => node.type === 'button' && node.props.role === 'tab');
        const tab = id => {
          const found = tabs().find(node => node.props.id === domIds[id]);
          assert.ok(found, 'Expected rendered tab: ' + id);
          return found;
        };
        const button = label => tree.root.findAll(node => node.type === 'button' && node.props['aria-label'] === label)[0];
        // Only the browser focus boundary is replaced. Every target must exist in
        // the rendered production component; no keyboard logic is reimplemented.
        globalThis.document = { getElementById(id) {
          assert.ok(tabs().some(node => node.props.id === id), 'Focus target must be a mounted tab: ' + id);
          return { focus() { focused.push(id); } };
        }};
        const selected = id => {
          assert.deepEqual(tabs().filter(node => node.props['aria-selected']).map(node => node.props.id), [domIds[id]]);
          assert.deepEqual(tabs().filter(node => node.props.tabIndex === 0).map(node => node.props.id), [domIds[id]]);
          for (const node of tabs()) assert.equal(node.props.tabIndex, node.props['aria-selected'] ? 0 : -1);
        };
        const reset = () => { actions.length = 0; focused.length = 0; };
        const key = async (from, name) => {
          reset();
          let prevented = 0;
          await act(async () => { tab(from).props.onKeyDown({key: name, preventDefault() { prevented++; }}); });
          return prevented;
        };
        const navigate = async (from, name, target) => {
          assert.equal(await key(from, name), 1, name + ' must prevent the browser default');
          assert.deepEqual(actions, [{type: 'activate', id: target}], name + ' must dispatch the exact target once');
          assert.deepEqual(focused, [domIds[target]], name + ' must focus the selected rendered tab once');
          selected(target);
        };
        try {
          await act(async () => { tree = create(<Harness/>); });
          assert.equal(tree.root.findByProps({role: 'tablist'}).props['aria-label'], '工作区标签');
          assert.equal(tabs().length, 3);
          for (const id of [home, view, draft]) assert.equal(tab(id).props['aria-controls'], panelIds[id]);
          assert.equal(button('关闭 工作台 标签'), undefined, 'pinned workbench has no close action');
          assert.ok(button('关闭 商品 标签'));
          assert.ok(button('关闭 新建组件 1 标签'));
          assert.ok(button('新建组件设计标签'));
          selected(home);

          await navigate(home, 'ArrowRight', view);
          await navigate(view, 'ArrowRight', draft);
          await navigate(draft, 'ArrowRight', home);
          await navigate(home, 'ArrowLeft', draft);
          await navigate(draft, 'ArrowLeft', view);
          await navigate(view, 'Home', home);
          await navigate(home, 'End', draft);

          assert.equal(await key(draft, 'Escape'), 0);
          assert.deepEqual(actions, []);
          assert.deepEqual(focused, []);
          selected(draft);

          assert.equal(await key(draft, 'Delete'), 1);
          assert.deepEqual(actions, [{type: 'close', id: draft}]);
          assert.deepEqual(focused, [domIds[home]]);
          assert.equal(tabs().length, 2);
          assert.equal(button('关闭 新建组件 1 标签'), undefined);
          selected(home);

          assert.equal(await key(home, 'Delete'), 0, 'Delete cannot close the pinned workbench');
          assert.deepEqual(actions, []);
          assert.deepEqual(focused, []);
          assert.equal(tabs().length, 2);
          selected(home);

          reset();
          await act(async () => { button('关闭 商品 标签').props.onClick(); });
          assert.deepEqual(actions, [{type: 'close', id: view}]);
          assert.deepEqual(focused, [domIds[home]], 'closing an inactive tab preserves focus on the active tab');
          assert.equal(tabs().length, 1);
          selected(home);
          for (const name of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) await navigate(home, name, home);

          reset();
          await act(async () => { button('新建组件设计标签').props.onClick(); });
          assert.deepEqual(actions, [{type: 'new-draft', appId: 'hallmark'}]);
          assert.deepEqual(focused, []);
          assert.equal(tabs().length, 2);
          assert.ok(button('关闭 新建组件 2 标签'));
          reset();
          await act(async () => { button('关闭 新建组件 2 标签').props.onClick(); });
          assert.deepEqual(actions, [{type: 'close', id: 'draft:hallmark:2'}]);
          assert.deepEqual(focused, [domIds[home]], 'closing the active draft returns focus to the workbench');
          assert.equal(tabs().length, 1);
          selected(home);
          console.log('WORKSPACE_DOCK_INTERACTION_PASS');
        } finally {
          if (tree) await act(async () => { tree.unmount(); });
        }
      ` },
      outfile: entry, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
      external: ['react', 'react/jsx-runtime', 'react-test-renderer'],
    });
    const result = spawnSync(process.execPath, [entry], { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n'));
    assert.match(result.stdout, /WORKSPACE_DOCK_INTERACTION_PASS/);
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('source architecture guards keep the dock before the page header and the reducer display-only',()=>{
  const page=readFileSync(new URL('../../packages/dsh-plugin/client/page.tsx',import.meta.url),'utf8');const workbench=readFileSync(new URL('../../packages/dsh-plugin/client/workbench.tsx',import.meta.url),'utf8');const reducer=readFileSync(new URL('../../packages/dsh-plugin/client/workspace-tabs.ts',import.meta.url),'utf8');const dockIndex=page.indexOf('<WorkspaceDockTabs'),headerIndex=page.indexOf('<header className="hm-page-header">');assert.ok(dockIndex>=0);assert.ok(headerIndex>=0);assert.ok(dockIndex<headerIndex);assert.ok(page.includes("hidden={tab.id!==workspace.activeId"));assert.ok(page.includes("initialTab={tab.kind==='draft'?'builder':'common'}"));assert.ok(workbench.includes('const prefix=useId()'));assert.ok(workbench.includes('onOpenView({viewId:opened.id,title:opened.title})'));assert.ok(!workbench.includes("from './index.tsx'"));assert.ok(!reducer.includes('fetch('));assert.ok(!reducer.includes('saveComponent('));
});
