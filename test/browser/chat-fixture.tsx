// Isolated layout fixture: real Hallmark panel/renderer, simulated host chrome and inputActions.
import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionComponentsButton, SessionComponentsPane, SessionComponentsTitle } from '../../packages/dsh-plugin/client/sidebar.tsx';
import { createClientPlugin } from '../../packages/dsh-plugin/client/plugin.ts';
import { chatEntryIntent } from '../../packages/dsh-plugin/client/chat-entry.ts';
import { COMPONENTS_SIDEBAR_KIND } from '../../packages/dsh-plugin/client/sidebar-contract.ts';
import type { SidebarNavigationParams } from '../../packages/dsh-plugin/client/sidebar-contract.ts';
import type { NativeInputActions, NativeInsertion } from '../../packages/dsh-plugin/client/selection.ts';
import type { BindingData, ViewSpec } from '../../packages/presentation/src/types.ts';

const sessionId = 'chat-fixture-session';
const initialDraft = '请先比较这些产品的差异，暂时不修改店铺。';
const names = ['合成样例 · 收纳袋', '合成样例 · 保温杯', '合成样例 · 整理架', '合成样例 · 手机支架', '合成样例 · 洗漱包', '合成样例 · 隔热垫'];
const rows = names.map((title, index) => ({ id: `fixture-item-${index + 1}`, title, sourceLabel: '合成采集记录' }));
const datasetKey = 'collected:chat-fixture';
const products: ViewSpec = { id: 'fixture-products', title: '采集产品 · 合成验证', layout: { type: 'column', children: ['items'] }, bindings: [{ id: 'items', datasetKey, fieldMap: {} }], widgets: [{ id: 'items', type: 'table', title: '产品列表（合成数据）', bindingId: 'items', columns: [{ field: 'title', label: '产品名称' }, { field: 'sourceLabel', label: '来源' }], options: { pageSize: 10 } }] };
const note: ViewSpec = { id: 'fixture-note', title: '产品分析说明 · 合成验证', layout: { type: 'column', children: ['note'] }, bindings: [], widgets: [{ id: 'note', type: 'text', text: '这是用于验证组件排版的合成说明，不包含真实经营指标。' }] };
const binding: BindingData = { bindingId: 'items', datasetKey, payload: { items: rows, total: rows.length }, state: 'ready', lastSuccessAt: '2026-10-06T06:00:00Z', provenance: { source: 'app_snapshot', endpoint: '/api/items' } };
const summaries = [products, note].map((spec, index) => ({ viewId: spec.id, title: spec.title, createdAt: '2026-10-06T05:00:00Z', updatedAt: `2026-10-06T06:0${index}:00Z`, state: 'ready' }));
summaries.push({ viewId: 'fixture-expired', title: '历史组件 · 合成验证', createdAt: '2026-10-06T04:00:00Z', updatedAt: '2026-10-06T04:00:00Z', state: 'expired' });
type Mode = 'empty' | 'list' | 'detail';
let mode: Mode = 'empty', insertions = 0, forbiddenCalls = 0, submissions = 0;
const requests: { resource: string; sessionId: string | null; viewId: string | null }[] = [];
const errors: string[] = [], assertions: string[] = [], workspaceOpens: unknown[] = [], nativeOpens: unknown[] = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const url = new URL(String(input), 'http://fixture.invalid'), resource = url.searchParams.get('resource') ?? '';
  if (url.pathname !== '/api/hallmark-app' || init?.method !== 'GET' || !['sessionViews', 'sessionView', 'sessionViewData'].includes(resource) || url.searchParams.get('sessionId') !== sessionId) {
    forbiddenCalls++; throw new Error('Fixture denied a non-owned read or a business request');
  }
  const viewId = url.searchParams.get('viewId'); requests.push({ resource, sessionId: url.searchParams.get('sessionId'), viewId });
  let value: unknown;
  if (resource === 'sessionViews') value = { sessionId, views: mode === 'empty' ? [] : summaries };
  else {
    const spec = [products, note].find(item => item.id === viewId);
    if (!spec || mode === 'empty') throw new Error('Fixture view is not available');
    value = resource === 'sessionView' ? spec : { status: 'ok', data: { viewId, bindings: spec.id === products.id ? [binding] : [], missing: [] } };
  }
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

let navigate: ((params: SidebarNavigationParams) => void) | undefined;
let mountedSession: string | undefined = sessionId;
const mountedListeners = new Set<() => void>();
const setMounted = (value: string | undefined) => { mountedSession = value; for (const listener of mountedListeners) listener(); };
const sidebar = { mounted: { getSnapshot: () => mountedSession, subscribe: (listener: () => void) => { mountedListeners.add(listener); return () => { mountedListeners.delete(listener); }; } }, openTab: (kind: string, options?: { params?: SidebarNavigationParams }) => {
  if (kind !== COMPONENTS_SIDEBAR_KIND) throw new Error('Unexpected fixture tab kind');
  nativeOpens.push({ kind, params: options?.params ?? {} }); navigate?.(options?.params ?? {});
} };
const Empty = () => null;
const registered = new Map<string, React.ComponentType<any>>();
const faces = { layout: { selectPanel: () => undefined }, uiWorkspace: { openSession: (id: string) => { if (id !== sessionId) throw new Error('Unexpected fixture chat'); } }, sidebarRight: sidebar, sidebarRightTabs: { register: () => () => undefined } };
createClientPlugin({ sidebarIcon: Empty, main: () => Empty, toolview: Empty, sidebar: { body: () => Empty, title: SessionComponentsTitle, input: right => props => <SessionComponentsButton {...props} sidebarRight={right}/> } }).apply({
  get: name => faces[name], slots: { register: (options, component) => { registered.set(`${options.name}:${options.id ?? options.key ?? ''}`, component); return () => undefined; }, inject: (_name, effect) => effect() },
});
const RootObserver = registered.get('sidebar.panellist:hallmark-apps')!;
const NativeInput = registered.get('conversation.input.left:hallmark-session-components')!;
let changeScenario: ((value: Mode) => void) | undefined, changeWidth: ((width: number) => void) | undefined, resetDraft: (() => void) | undefined, mountInput: ((value: boolean) => void) | undefined;
function Fixture() {
  const [navigation, setNavigation] = useState({ params: {} as SidebarNavigationParams, revision: 0 });
  const [rightWidth, setRightWidth] = useState(420); const [draft, setDraft] = useState(initialDraft); const [opened, setOpened] = useState(false);
  const [inputMounted, setInputMounted] = useState(true); mountInput = setInputMounted;
  const draftRef = useRef(draft), revisionRef = useRef(0); draftRef.current = draft;
  navigate = params => setNavigation(previous => ({ params, revision: previous.revision + 1 }));
  changeScenario = value => { mode = value; setOpened(false); navigate?.(value === 'detail' ? { viewId: products.id } : {}); };
  changeWidth = setRightWidth; resetDraft = () => { setDraft(initialDraft); draftRef.current = initialDraft; revisionRef.current++; };
  const inputActions = useMemo<NativeInputActions>(() => ({
    captureInsertion: () => ({ start: 0, end: draftRef.current.length, draftRev: revisionRef.current }),
    insertText: (text: string, span: NativeInsertion) => { if (span.draftRev !== revisionRef.current) return false; insertions++; const next = draftRef.current.slice(0, span.start) + text + draftRef.current.slice(span.end); draftRef.current = next; revisionRef.current++; setDraft(next); return true; },
  }), []);
  const signal = useMemo(() => new AbortController().signal, []);
  const actions = useMemo(() => ({ openTab: sidebar.openTab }), []);
  const useTabInfo = () => ({ tab: { navigation, signal, visible: true, actions } });
  return <>
    <RootObserver usePanelInfo={(select: any) => select({ activePanelId: null })} useSessions={(select: any) => select({ phase: 'ready', byId: { [sessionId]: { id: sessionId, retainedBy: { mainView: 1 } } } })}/>
    <div className="fixture-disclosure">隔离合成预览 · 左侧导航、中间聊天和右侧宿主标签为模拟 · 右侧组件面板与选择交互使用实际插件代码 · 不连接店铺，不发送消息</div>
    <div className="fixture-shell" style={{ '--fixture-right-width': `${rightWidth}px` } as React.CSSProperties}>
      <aside className="fixture-left"><div className="fixture-brand"><span>H</span><div><strong>Hallmark</strong><small>DSH 布局示意</small></div></div><div className="fixture-nav-row">＋ 新会话（示意）</div><div className="fixture-nav-group"><span>工作区（模拟）</span><div>◇ 插件</div><div>▦ 应用</div></div><div className="fixture-nav-group"><span>当前聊天（模拟）</span><div className="fixture-current-chat">Hallmark 组件协作</div></div><div className="fixture-left-note">左侧仅演示区域比例。<br/>不会读取或修改用户会话。</div></aside>
      <main className="fixture-conversation"><header className="fixture-conversation-header"><div><h1>Hallmark 组件协作</h1><p>中间保留原聊天区域 · 此处为隔离示意</p></div><span className="fixture-simulation-tag">模拟聊天</span></header>
        <div className="fixture-chat-scroll"><div className="fixture-chat-width"><div className="fixture-message fixture-user-message"><span>用户消息 · 合成示意</span><p>把采集的产品整理成可勾选的列表。</p></div><div className="fixture-assistant-message"><span className="fixture-agent-mark">H</span><div><strong>Agent 回复 · 示意文案</strong><p>右侧组件与聊天放在同一个工作空间。</p><p>你可以勾选产品，把选择附加到输入框，再补充希望 Agent 完成的任务。</p><div className="fixture-flow-note"><span>选择产品</span><b>→</b><span>附加到聊天</span><b>→</b><span>补充要求</span></div></div></div><div className="fixture-clarity-note">本页没有调用模型，产品记录均为合成测试数据。</div></div></div>
        <div className="fixture-composer-area"><div className="fixture-composer"><label htmlFor="fixture-native-draft">原生输入接口模拟 · 保留已有输入</label><textarea id="fixture-native-draft" value={draft} spellCheck={false} onChange={event => { draftRef.current = event.target.value; revisionRef.current++; setDraft(event.target.value); }}/><div className="fixture-composer-tools">{inputMounted?<NativeInput sessionId={sessionId} inputActions={inputActions}/>:null}<span>未发送消息</span></div></div>{opened ? <p className="fixture-callback-notice" role="status">已接收“在工作台打开”的导航回调（模拟，不打开真实工作区）。</p> : <p className="fixture-input-footnote">此输入框仅模拟公开 inputActions；没有发送接口。</p>}</div>
      </main>
      <aside className="fixture-right" aria-label="模拟宿主右侧栏"><div className="fixture-native-tabs"><div role="tab" aria-selected="true"><SessionComponentsTitle/></div><span>宿主标签（模拟）</span></div><div className="fixture-real-pane"><SessionComponentsPane sessionId={sessionId} useTabInfo={useTabInfo} onOpenWorkspace={view => { workspaceOpens.push(view); setOpened(true); }}/></div></aside>
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
const delay = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate: () => unknown, label: string) { for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(); } throw new Error(`Timed out: ${label}`); }
const check = (condition: unknown, label: string) => { if (!condition) throw new Error(label); assertions.push(label); };
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.fixture-real-pane button')].find(node => node.textContent?.trim() === text);
const draft = () => (document.getElementById('fixture-native-draft') as HTMLTextAreaElement)?.value;
const checkboxes = () => [...document.querySelectorAll<HTMLInputElement>('.fixture-real-pane tbody input[type=checkbox]')];
const ready = async (scenario: Mode) => { await wait(() => changeScenario, 'fixture setup'); changeScenario?.(scenario); await wait(() => document.querySelector('.hm-session-components')?.getAttribute('aria-busy') === 'false', 'pane read'); await wait(() => scenario === 'empty' ? document.querySelector('.hm-chat-empty') : scenario === 'list' ? document.querySelector('.hm-session-view-list') : checkboxes().length === rows.length && !checkboxes()[0].disabled, scenario); await delay(); };
(window as any).__CHAT_FIXTURE__ = {
  async show(scenario: Mode) { await ready(scenario); },
  async width(value: number) { changeWidth?.(value); await delay(120); },
  async verifyDelayedEntry() {
    await wait(()=>mountInput&&document.querySelector('[aria-label="查看本会话组件"]'),'native input mounted');
    await delay(); check(nativeOpens.length===0,'an ordinary native input mount does not open the component tab');
    mountInput?.(false); await wait(()=>!document.querySelector('[aria-label="查看本会话组件"]'),'native input unmounted');
    const before=nativeOpens.length,targets:string[]=[];
    chatEntryIntent.enter(sessionId,target=>{targets.push(target);setMounted(undefined);},sidebar);
    await delay(); check(nativeOpens.length===before,'explicit chat entry waits through simulated host navigation without an input slot');
    setMounted(sessionId); await delay(); check(nativeOpens.length===before,'publishing mounted session alone does not bypass the input commit');
    mountInput?.(true); await wait(()=>nativeOpens.length===before+1,'delayed real input wrapper opens tab');
    const last=nativeOpens[nativeOpens.length-1] as {kind:string;params:unknown};
    check(targets.length===1&&targets[0]===sessionId&&last.kind===COMPONENTS_SIDEBAR_KIND&&JSON.stringify(last.params)==='{}','actual chat-entry coordinator and React input wrapper open the component list for the exact session');
    changeWidth?.(421); await delay(); changeWidth?.(420); await delay();
    check(nativeOpens.length===before+1&&mountedListeners.size===0,'consumed entry cannot reopen on rerender and releases its mounted subscription');
  },
  async verifyEmpty() { await ready('empty'); check(document.querySelector('.hm-chat-empty')?.textContent?.includes('在聊天中让 Agent 创建表格或图表'), 'empty pane gives actionable plain-language guidance'); check(!document.querySelector('.hm-chat-empty button'), 'empty pane contains no pretend creation or insertion action'); },
  async verifyList() { await ready('list'); check(document.querySelectorAll('.hm-chat-component-card').length === 3, 'list renders only the three synthetic session-owned summaries'); check(document.querySelector<HTMLButtonElement>('.hm-chat-component-card[disabled]')?.textContent?.includes('已过期'), 'expired component stays explicitly unavailable'); check(!requests.some(request => request.resource !== 'sessionViews'), 'opening list does not automatically select or read the latest component'); },
  async verifyDetail() { button(products.title)?.click(); // The actual card has metadata, so match its real heading when necessary.
    if (!document.querySelector('.hm-chat-detail')) ([...document.querySelectorAll<HTMLButtonElement>('.hm-chat-component-card')].find(node => node.querySelector('strong')?.textContent === products.title))?.click();
    await wait(() => checkboxes().length === rows.length && !checkboxes()[0].disabled, 'selected detail');
    check(!!button('组件列表') && !!button('在标签页打开'), 'selected detail keeps explicit return-list and workspace actions');
    check(requests.some(request => request.resource === 'sessionViewData' && request.viewId === products.id), 'detail loads the exact owned snapshot rather than a global view');
  },
  async verifySelection() { resetDraft?.(); checkboxes()[0].click(); await delay(); checkboxes()[1].click(); await delay(); button('附加到当前聊天')?.click(); await wait(() => draft()?.includes('hallmark.product-selection'), 'native input attachment'); const value = draft(), context = JSON.parse(value.match(/```json\n([\s\S]+?)\n```/)![1]); check(value.startsWith(initialDraft), 'selection attachment preserves the existing highlighted input'); check(context.sessionId === sessionId && context.viewId === products.id && context.products.length === 2 && context.products[0].itemId === rows[0].id && context.products[1].itemId === rows[1].id, 'selected products arrive through the public native input interface with exact stable IDs'); check(insertions === 1 && submissions === 0, 'one explicit attachment occurs and no message is submitted'); },
  async verifyNavigation() { button('在标签页打开')?.click(); await wait(() => workspaceOpens.length === 1, 'workspace callback'); const open = workspaceOpens[0] as any; check(open.sessionId === sessionId && open.viewId === products.id && open.title === products.title, 'workspace action carries the unchanged session/view/title metadata'); button('组件列表')?.click(); await wait(() => document.querySelector('.hm-session-view-list'), 'return list'); check(!!document.querySelector('.hm-session-view-list'), 'return-list action uses the real pane navigation'); document.querySelector<HTMLButtonElement>('[aria-label="查看本会话组件"]')?.click(); await delay(); check(nativeOpens.length > 0, 'native input button opens the actual session component tab'); },
  result() { check(forbiddenCalls === 0 && errors.length === 0, 'fixture makes only synthetic owned reads and has no browser errors'); return { ok: true, fixtureOnly: true, nativeHost: 'simulated', activationServiceCovered: false, actualChatEntryCoordinatorCovered: true, assertions, errors, requests, insertions, submissions, forbiddenCalls, workspaceOpens }; },
};
