import React from 'react';
import { createRoot } from 'react-dom/client';
import { HallmarkWorkbench, type WorkbenchBridge } from '../../packages/dsh-plugin/client/workbench.tsx';
import type { OverviewDto } from '../../packages/contracts/src/overview.ts';

const checks: string[] = [], errors: string[] = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
globalThis.fetch = (async () => { throw new Error('No network permitted in this isolated fixture'); }) as typeof fetch;
const check = (condition: unknown, label: string) => { if (!condition) throw new Error(label); checks.push(label); };
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
async function wait(predicate: () => unknown, label: string) { for (let i = 0; i < 500; i++) { if (predicate()) return; await pause(); } throw new Error(`Timed out: ${label}`); }
function deferred(signal?: AbortSignal) { let resolve!: (value: any) => void, reject!: (error: Error) => void; const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; }); return { signal, promise, resolve, reject }; }
function controlled() {
  const requests = { saved: [] as ReturnType<typeof deferred>[], templates: [] as ReturnType<typeof deferred>[], datasets: [] as ReturnType<typeof deferred>[], overview: [] as ReturnType<typeof deferred>[] };
  const read = (resource: keyof typeof requests) => (signal?: AbortSignal) => { const request = deferred(signal); requests[resource].push(request); return request.promise; };
  const forbidden = async () => { throw new Error('No actions should be invoked'); };
  const bridge: WorkbenchBridge = { saved: read('saved'), templates: read('templates'), datasets: read('datasets'), overview: read('overview'),
    preview: forbidden, viewData: forbidden, saveComponent: forbidden, saveTemplate: forbidden, openEntry: forbidden, manage: forbidden };
  const configuration = (index: number) => { requests.saved[index].resolve({ components: [], entries: [], templates: [] }); requests.templates[index].resolve([]); requests.datasets[index].resolve([]); };
  return { bridge, requests, configuration };
}
function overview(count: number): OverviewDto { return { fetchedAt: `2026-10-06T01:${String(count).padStart(2, '0')}:00Z`, collected: { status: 'ok', count }, products: { status: 'ok', count: count * 2, lastSuccessAt: '2026-10-05T01:00:00Z' }, stores: { status: 'ok', count: 1, rows: [{ id: 'shop-a', name: `测试店铺 ${count}`, productCount: count * 2, lastSuccessAt: '2026-10-05T01:00:00Z', status: 'ok' }] } }; }
const values = () => [...document.querySelectorAll('.hm-metric-value')].map(node => node.textContent).join(',');
const text = () => document.getElementById('root')?.textContent ?? '';
const busy = () => document.querySelector('.hm-overview-grid')?.getAttribute('aria-busy') === 'true';
const refresh = () => window.dispatchEvent(new CustomEvent('hallmark:workspace-refresh'));
const root = createRoot(document.getElementById('root')!);
async function run() {
  const a = controlled(), b = controlled();
  root.render(<HallmarkWorkbench bridge={a.bridge}/>);
  await wait(() => a.requests.overview.length === 1 && a.requests.saved.length === 1, 'initial requests');
  a.requests.overview[0].resolve(overview(11));
  await wait(() => values() === '11,22,1', 'independent overview commit');
  check(!busy(), 'overview settles while saved/template/dataset reads remain pending');
  a.requests.saved[0].reject(new Error('synthetic configuration unavailable')); a.requests.templates[0].resolve([]); a.requests.datasets[0].resolve([]);
  await wait(() => text().includes('synthetic configuration unavailable'), 'configuration error');
  check(values() === '11,22,1', 'configuration failure cannot discard a successful overview');
  const previousReadTime = document.querySelector('.hm-panel-footnote')?.textContent;

  refresh(); await wait(() => a.requests.overview.length === 2, 'refresh request');
  check(values() === '11,22,1' && busy(), 'refresh keeps the last values while visibly loading');
  a.configuration(1); a.requests.overview[1].reject(new Error('synthetic overview unavailable'));
  await wait(() => text().includes('概览未更新，当前显示上次读取的数据。'), 'refresh error notice');
  check(values() === '11,22,1' && !busy(), 'failed refresh retains old counts and explicitly reports not updated');
  check(document.querySelector('.hm-store-table')?.textContent?.includes('测试店铺 11'), 'failed refresh retains the old store snapshot');
  check(document.querySelector('.hm-panel-footnote')?.textContent === previousReadTime, 'failed refresh never advances the displayed successful read time');

  refresh(); await wait(() => a.requests.overview.length === 3, 'recovery request');
  a.requests.overview[2].resolve(overview(12)); a.configuration(2);
  await wait(() => values() === '12,24,1', 'successful recovery');
  check(!text().includes('概览未更新'), 'successful overview refresh replaces the snapshot and clears the failure notice');

  refresh(); await wait(() => a.requests.overview.length === 4, 'old bridge pending');
  root.render(<HallmarkWorkbench bridge={b.bridge}/>);
  await wait(() => b.requests.overview.length === 1, 'new bridge request');
  check(values() === '—,—,—', 'bridge replacement clears old overview before the new response');
  check(a.requests.overview[3].signal?.aborted, 'bridge replacement aborts the previous overview request');
  a.requests.overview[3].resolve(overview(59)); a.requests.saved[3].reject(new Error('late old bridge error')); a.requests.templates[3].resolve([]); a.requests.datasets[3].resolve([]);
  await pause(); await pause();
  check(values() === '—,—,—' && !text().includes('late old bridge error'), 'late old-bridge data and errors cannot cross into the new bridge');
  b.configuration(0); b.requests.overview[0].resolve(overview(21));
  await wait(() => values() === '21,42,1', 'new bridge overview');

  refresh(); await wait(() => b.requests.overview.length === 2, 'first overlapping refresh');
  refresh(); await wait(() => b.requests.overview.length === 3, 'second overlapping refresh');
  b.configuration(2); b.requests.overview[2].resolve(overview(22));
  await wait(() => values() === '22,44,1', 'latest refresh');
  b.configuration(1); b.requests.overview[1].resolve(overview(58)); await pause(); await pause();
  check(values() === '22,44,1' && b.requests.overview[1].signal?.aborted, 'an older refresh cannot overwrite a newer completed snapshot');
  refresh(); await wait(() => b.requests.overview.length === 4, 'unmount pending'); root.unmount();
  check(b.requests.overview[3].signal?.aborted, 'unmount aborts active overview reads');
  b.configuration(3); b.requests.overview[3].resolve(overview(57)); await pause();
  check(errors.length === 0, 'the cancellation and rejection paths create no unhandled browser errors');
}
run().then(() => finish({ ok: true, assertions: checks, errors })).catch(error => finish({ ok: false, assertions: checks, errors, message: String(error) }));
function finish(result: unknown) { const output = document.createElement('pre'); output.id = 'workbench-refresh-result'; output.textContent = JSON.stringify(result); document.body.append(output); }
