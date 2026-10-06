// Real SnapshotView/renderer/table/selection bridge; all data and host input are synthetic.
import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapshotView } from '../../packages/dsh-plugin/client/snapshot.tsx';
import { createClientPlugin } from '../../packages/dsh-plugin/client/plugin.ts';
import type { NativeInputActions, NativeInsertion } from '../../packages/dsh-plugin/client/selection.ts';
import type { BindingData, ViewSpec } from '../../packages/presentation/src/types.ts';

const sessionId = 'component-fixture-session';
const initialDraft = '请比较我选择的商品，只分析，不修改店铺。';
const names = [
  '加厚帆布旅行收纳包 Portable Canvas Travel Organizer Large Capacity Foldable Storage Bag with Reinforced Handles for Clothing, Camping Equipment and Everyday Essentials',
  '多功能厨房置物架 Kitchen Countertop Storage Organizer with Adjustable Shelves — 不锈钢落地收纳架，可拆卸组合设计，适用于厨房、浴室与阳台狭窄空间',
  '车载手机支架 Universal Magnetic Smartphone Holder for Dashboard and Air Vent, 360 Degree Rotation, Compatible with Multiple Phone Sizes — 稳固底座与单手操作设计',
  '桌面电线整理盒 Cable Management Storage Box with Detachable Lid for Home Office Computer Accessories — 多孔散热、隐藏插排、便于清洁的桌面整理用品',
  '户外折叠水杯 Collapsible Silicone Travel Cup for Hiking, Camping and Commuting, Lightweight Reusable Design with Dust Cover — 小巧易携带的旅行配件',
];
const rows = Array.from({ length: 50 }, (_, index) => ({
  id: `synthetic-collected-${String(index + 1).padStart(2, '0')}`,
  title: `【合成样例 ${String(index + 1).padStart(2, '0')}】${names[index % names.length]}`,
  collected_at: new Date(Date.UTC(2026, 9, 6, 8, 42, 18) - index * 91_000).toISOString(),
}));
const datasetKey = 'collected:component-visual-fixture';
const spec: ViewSpec = {
  id: 'synthetic-collected-component', title: '采集箱 · 最近采集50件',
  layout: { type: 'column', children: ['products'] },
  bindings: [{ id: 'products', datasetKey, fieldMap: {} }],
  widgets: [{ id: 'products', type: 'table', title: '最近采集商品（按采集时间倒序）', bindingId: 'products',
    // Deliberately no date format hint: reproduce the original screenshot's raw collected_at column.
    columns: [{ field: 'collected_at', label: '采集时间' }, { field: 'title', label: '商品名称' }],
    options: { pageSize: 10, sort: { field: 'collected_at', direction: 'desc' } },
  }],
};
const binding: BindingData = { bindingId: 'products', datasetKey, payload: { items: rows, total: rows.length }, state: 'ready', lastSuccessAt: '2026-10-06T08:43:00Z', provenance: { source: 'app_snapshot', endpoint: '/api/items', fixtureOnly: true } };
const requests: { resource: string; sessionId: string | null; viewId: string | null }[] = [];
const errors: string[] = [], assertions: string[] = [];
let forbiddenCalls = 0, insertions = 0, configuredPageSize = 10;
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const url = new URL(String(input), 'http://fixture.invalid');
  const resource = url.searchParams.get('resource') ?? '';
  if (url.pathname !== '/api/hallmark-app' || init?.method !== 'GET' || !['sessionView', 'sessionViewData'].includes(resource) || url.searchParams.get('sessionId') !== sessionId || url.searchParams.get('viewId') !== spec.id) {
    forbiddenCalls++; throw new Error('Fixture rejected any non-owned read, real network access, or mutation');
  }
  requests.push({ resource, sessionId: url.searchParams.get('sessionId'), viewId: url.searchParams.get('viewId') });
  const responseSpec = { ...spec, widgets: spec.widgets.map(widget => ({ ...widget, options: { ...widget.options, pageSize: configuredPageSize } })) };
  return new Response(JSON.stringify(resource === 'sessionView' ? responseSpec : { status: 'ok', data: { viewId: spec.id, bindings: [binding], missing: [] } }), { headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const Empty = () => null;
const registered = new Map<string, React.ComponentType<any>>();
const faces = { layout: { selectPanel: () => undefined }, uiWorkspace: { openSession: () => { throw new Error('Fixture has no navigation action'); } }, sidebarRight: { mounted: { getSnapshot: () => sessionId }, openTab: () => undefined }, sidebarRightTabs: { register: () => () => undefined } };
createClientPlugin({ sidebarIcon: Empty, main: () => Empty, toolview: Empty, sidebar: { body: () => Empty, title: Empty, input: () => Empty } }).apply({
  get: name => faces[name], slots: { register: (options, component) => { registered.set(`${options.name}:${options.id ?? options.key ?? ''}`, component); return () => undefined; }, inject: (_name, effect) => effect() },
});
const RootObserver = registered.get('sidebar.panellist:hallmark-apps')!;
const NativeInput = registered.get('conversation.input.left:hallmark-session-components')!;
function Fixture() {
  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(draft), revision = useRef(0); draftRef.current = draft;
  const actions = useMemo<NativeInputActions>(() => ({
    captureInsertion: () => ({ start: 0, end: draftRef.current.length, draftRev: revision.current }),
    insertText: (text: string, span: NativeInsertion) => {
      if (span.draftRev !== revision.current) return false;
      insertions++; const next = draftRef.current.slice(0, span.start) + text + draftRef.current.slice(span.end);
      draftRef.current = next; revision.current++; setDraft(next); return true;
    },
  }), []);
  return <>
    <RootObserver usePanelInfo={(select: any) => select({ activePanelId: null })} useSessions={(select: any) => select({ phase: 'ready', byId: { [sessionId]: { id: sessionId, retainedBy: { mainView: 1 } } } })}/>
    <div id="component-region"><SnapshotView sessionId={sessionId} viewId={spec.id} owned/></div>
    <aside className="fixture-host"><strong>隔离合成验证 · 以下输入框模拟公开 native inputActions</strong><p>上方组件使用实际插件代码；50 条商品均为合成数据。未连接 DSH、店铺或模型，没有发送接口。</p><label htmlFor="fixture-input">模拟聊天草稿（不会发送）</label><textarea id="fixture-input" value={draft} onChange={event => { draftRef.current = event.target.value; revision.current++; setDraft(event.target.value); }}/><NativeInput sessionId={sessionId} inputActions={actions}/></aside>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
const pause = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate: () => unknown, label: string) { for (let i = 0; i < 200; i++) { if (predicate()) return; await pause(); } throw new Error(`Timed out: ${label}`); }
const check = (condition: unknown, label: string) => { if (!condition) throw new Error(label); assertions.push(label); };
const productRows = () => [...document.querySelectorAll<HTMLTableRowElement>('#component-region tbody tr')];
const checks = () => [...document.querySelectorAll<HTMLInputElement>('#component-region tbody input[type=checkbox]')];
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('#component-region button')].find(node => node.textContent?.trim() === text);
const labelledButton = (label: string) => document.querySelector<HTMLButtonElement>(`#component-region button[aria-label="${label}"]`);
const input = () => document.querySelector<HTMLInputElement>('#component-region input[aria-label="搜索当前快照"]')!;
async function search(value: string) { const field = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); await pause(80); }
function layout() {
  const region = document.getElementById('component-region')!, snapshot = region.querySelector<HTMLElement>('.hm-snapshot')!, table = region.querySelector<HTMLElement>('.hm-table-scroll')!;
  return { viewport: innerWidth, regionWidth: region.getBoundingClientRect().width, snapshotWidth: snapshot.getBoundingClientRect().width, regionOverflow: region.scrollWidth > region.clientWidth + 1, snapshotOverflow: snapshot.scrollWidth > snapshot.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1, tableClientWidth: table.clientWidth, tableScrollWidth: table.scrollWidth };
}
(window as any).__COMPONENT_FIXTURE__ = {
  async ready() { await wait(() => checks().length === 10 && !checks()[0].disabled && input(), 'real snapshot and native input bridge'); },
  async verifyInitial() {
    await this.ready();
    check(document.querySelector('.hm-snapshot-heading')?.textContent?.includes(spec.title), 'real snapshot renders the exact requested component title');
    check(productRows().length === 10 && productRows()[0].textContent?.includes(rows[0].title), '50 synthetic records render a first page of 10 with long bilingual names and no images');
    check(!document.querySelector('#component-region img') && productRows()[0].querySelectorAll('td').length === 3, 'table preserves only selection, date and product title columns');
    const date = document.querySelector<HTMLTimeElement>('#component-region tbody time.hm-cell-date')!;
    check(!!date && date.title === rows[0].collected_at && !date.textContent?.includes('T08:') && /2026\/10\/06/.test(date.textContent ?? ''), 'raw collected_at ISO is displayed as a readable date while the original timestamp remains available');
    check(date.querySelectorAll('span').length === 2 && /\d{2}:\d{2}:\d{2}/.test(date.textContent ?? ''), 'date and local time are separately readable');
    check(requests.length === 2 && requests.every(request => request.sessionId === sessionId && request.viewId === spec.id), 'snapshot reads are restricted to the exact synthetic session and view');
  },
  async verifySearchAndSelection() {
    checks()[0].click(); await pause();
    const requestCount = requests.length;
    await search('Kitchen');
    check(productRows().length === 10 && productRows().every(row => row.textContent?.includes('Kitchen')), 'local search matches bilingual configured product fields');
    check(requests.length === requestCount, 'local search does not refetch or write to an upstream service');
    check(document.querySelector('.hm-selection-toolbar')?.textContent?.includes('已选 1 个产品') && document.querySelector('.hm-selection-toolbar')?.textContent?.includes('其中 1 个不在当前筛选结果'), 'selected products remain counted when hidden by the local filter');
    checks()[0].click(); await pause(); await search('no-match-synthetic-query');
    check(checks().length === 0 && document.getElementById('component-region')?.textContent?.includes('没有匹配'), 'an unmatched local filter renders an explicit empty result without losing the component');
    await search(''); await wait(() => checks().length === 10, 'search reset');
    check(checks()[0].checked && checks()[1].checked, 'clearing the local search restores the two stable checked products');
    labelledButton('下一页')!.click(); await wait(() => productRows()[0]?.textContent?.includes(rows[10].title), 'second page');
    check(productRows().length === 10 && !checks()[0].checked, 'pagination advances to distinct records without leaking checks to matching row positions');
    checks()[0].click(); await pause();
    button('附加到当前聊天')!.click();
    await wait(() => (document.getElementById('fixture-input') as HTMLTextAreaElement).value.includes('hallmark.product-selection'), 'native input attachment');
    const draft = (document.getElementById('fixture-input') as HTMLTextAreaElement).value;
    const context = JSON.parse(draft.match(/```json\n([\s\S]+?)\n```/)![1]);
    check(draft.startsWith(initialDraft), 'attachment preserves pre-existing highlighted native input');
    check(context.sessionId === sessionId && context.viewId === spec.id && JSON.stringify(context.products.map((product: { itemId: string }) => product.itemId)) === JSON.stringify([rows[0].id, rows[1].id, rows[10].id]), 'cross-filter and cross-page selection attaches exactly the three original stable IDs');
    check(insertions === 1 && forbiddenCalls === 0, 'only one explicit draft insertion occurs; fixture exposes no sending interface or business mutation');
    labelledButton('上一页')!.click(); await wait(() => productRows()[0]?.textContent?.includes(rows[0].title), 'first page restored');
    check(checks()[0].checked && checks()[1].checked, 'returning to the first page preserves its original selection');
  },
  async verifyPageSize() {
    const field = document.querySelector<HTMLSelectElement>('[aria-label="每页记录数"]')!;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(field, '20'); field.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(() => checks().length === 20, 'page size 20'); check(checks().length === 20 && checks()[10].checked, 'page-size changes preserve selected source identities');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(field, '10'); field.dispatchEvent(new Event('change', { bubbles: true })); await wait(() => checks().length === 10, 'page size restored');
  },
  async prepareSelectedPreview() {
    button('清除选择')!.click(); await pause();
    checks()[0].click(); await pause(); checks()[1].click(); await pause();
    labelledButton('下一页')!.click(); await wait(() => productRows()[0]?.textContent?.includes(rows[10].title), 'preview next page');
    checks()[0].click(); await pause();
    labelledButton('上一页')!.click(); await wait(() => productRows()[0]?.textContent?.includes(rows[0].title), 'preview first page');
  },
  async verifyExplicit50() {
    configuredPageSize = 50;
    labelledButton('重试读取')!.click();
    await wait(() => checks().length === 50, 'explicit specification pageSize 50');
    check(checks().length === 50 && document.querySelector<HTMLSelectElement>('[aria-label="每页记录数"]')!.value === '50' && labelledButton('下一页')!.disabled, 'an explicit pageSize 50 specification is respected instead of replaced by the default');
    check(checks().every(box => !box.checked), 'reloading the snapshot does not inherit obsolete checked IDs');
    const scroll = document.querySelector<HTMLElement>('#component-region .hm-table-scroll')!;
    scroll.scrollTop = scroll.scrollHeight;
    check(scroll.scrollTop > 0, 'the explicit 50-row table scrolls inside its own container');
    scroll.scrollTop = 0;
  },
  async verifyLayout(label: string) { await pause(120); const result = layout(); check(!result.regionOverflow && !result.snapshotOverflow && !result.documentOverflow, `${label} keeps the actual component inside its container`); return result; },
  result() { check(errors.length === 0 && forbiddenCalls === 0, 'real components complete the synthetic browser regression with no browser errors or forbidden requests'); return { ok: true, fixtureOnly: true, dataSource: '50 synthetic rows; no real business data', nativeInput: 'simulated public inputActions through actual plugin wrapper', installedDshCovered: false, upstreamServicesCovered: false, sendInterfacePresent: false, insertions, forbiddenCalls, requests, errors, assertions }; },
};
