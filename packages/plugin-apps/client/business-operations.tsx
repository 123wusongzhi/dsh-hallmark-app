import React, { useEffect, useRef, useState } from 'react';
import type { BusinessAction, BusinessPlan, BusinessRow, BusinessRowInput } from '../../app-hallmark/src/operations/types.ts';
import { BUSINESS_ACTION_LABELS, BUSINESS_FIELD_LABELS, BUSINESS_STATUS_LABELS, businessMoney, businessPriceAction, businessPricingQuote, businessRowInput, businessValue, editableBusinessRow, filterBusinessRows, parseBusinessPayload } from '../../app-presentation/src/materials/business-operations.ts';
import { appsApiError, appsResource, type WorkbenchStores, type WorkbenchStoreOption } from './api.ts';
import type { BusinessPricingConfig } from '../../business-pricing/src/types.ts';

type BusinessOperation = 'create' | 'revise' | 'get' | 'list' | 'submit' | 'inspect' | 'restore' | 'request';
interface PendingRequest { requestId: string; operation: BusinessOperation }
interface RequestResult { settled: boolean; value?: BusinessPlan; operationId?: string; error?: { code?: string; message: string } }
interface Scope { sessionId: string; connectionId: string; storeId: string }
const scopeKey = (scope: Scope) => JSON.stringify([scope.sessionId, scope.connectionId, scope.storeId]);
// A lost mutation receipt remains recoverable when the tab is closed and reopened.
const pendingRequests = new Map<string, PendingRequest>();
const mutations = new Set<BusinessOperation>(['create', 'revise', 'submit', 'restore']);

export async function businessOperation<T>(scope: Scope, operation: BusinessOperation, input: unknown): Promise<T> {
  const key = scopeKey(scope), pending = pendingRequests.get(key);
  if (mutations.has(operation) && pending) throw new Error('原操作结果尚未确认，请先检查原操作。');
  const requestId = globalThis.crypto.randomUUID();
  if (mutations.has(operation)) pendingRequests.set(key, { requestId, operation });
  let response: Response, value: any;
  try {
    response = await fetch('/api/dsh-apps', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'businessOperations', sessionId: scope.sessionId, connectionId: scope.connectionId, operation, input, requestId }) });
    value = await response.json();
  } catch (cause) {
    throw new Error(mutations.has(operation) ? '操作回执尚未确认，请检查原操作；不会自动重发。' : cause instanceof Error ? cause.message : '经营数据读取失败。');
  }
  if (response.ok && ['pending', 'unknown'].includes(value?.status) && value?.operation?.operationId) {
    const result = await businessOperation<T>(scope, 'get', { operationId: value.operation.operationId });
    pendingRequests.delete(key); return result;
  }
  if (!response.ok || ['failed', 'needs_clarification', 'cancelled', 'pending', 'unknown', 'unavailable'].includes(value?.status)) {
    const uncertain = response.status >= 500 || value?.error?.retryPolicy === 'inspect_only' || ['pending', 'unknown', 'unavailable'].includes(value?.status);
    if (mutations.has(operation) && !uncertain) pendingRequests.delete(key);
    throw appsApiError(value, response.status, value?.question ?? '经营操作未完成。');
  }
  if (mutations.has(operation)) pendingRequests.delete(key);
  return (['ok', 'partial'].includes(value?.status) ? value.data : value) as T;
}

export function BusinessOperations({ sessionId, storeId, active = true }: { sessionId?: string; storeId?: string; active?: boolean }) {
  const [stores, setStores] = useState<WorkbenchStoreOption[]>([]), [plans, setPlans] = useState<BusinessPlan[]>([]), [planId, setPlanId] = useState('');
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [selected, setSelected] = useState<string[]>([]), [batchPrice, setBatchPrice] = useState('');
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({}), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [pricingEdits, setPricingEdits] = useState<Record<string, NonNullable<BusinessRowInput['pricing']>>>({}), [pricingConfig, setPricingConfig] = useState<BusinessPricingConfig | null>(null), [pricingError, setPricingError] = useState('');
  const [listError, setListError] = useState(''), [loadingPlans, setLoadingPlans] = useState(false);
  const [pending, setPending] = useState<PendingRequest>(), [refresh, setRefresh] = useState(0), flight = useRef(false);
  const store = stores.find(item => item.id === storeId), scope = sessionId && store ? { sessionId, connectionId: store.connectionId, storeId: store.id } : undefined;
  const identity = scope ? scopeKey(scope) : `${sessionId ?? ''}:${storeId ?? ''}`, owner = useRef(identity); owner.current = identity;
  const editedIds = new Set([...Object.keys(edits), ...Object.keys(pricingEdits)]);
  const plan = plans.find(item => item.planId === planId), visible = filterBusinessRows(plan, query, status), dirty = editedIds.size > 0;
  const accept = (next: BusinessPlan) => { setPlans(rows => [next, ...rows.filter(item => item.planId !== next.planId)]); setPlanId(next.planId); setEdits({}); setPricingEdits({}); setSelected([]); };
  useEffect(() => { const controller = new AbortController(); appsResource<WorkbenchStores>('stores', { appId: 'hallmark' }, controller.signal).then(result => { if (!controller.signal.aborted) setStores(result.stores); }).catch(error => { if (!controller.signal.aborted) setNotice(error.message); }); return () => controller.abort(); }, []);
  useEffect(() => { setPlans([]); setPlanId(''); setEdits({}); setPricingEdits({}); setPricingConfig(null); setPricingError(''); setSelected([]); setQuery(''); setStatus(''); setNotice(''); setListError(''); setPending(scope ? pendingRequests.get(scopeKey(scope)) : undefined); }, [identity]);
  useEffect(() => {
    if (!scope || !active) return; const controller = new AbortController(), target = identity;
    appsResource<{ pricing: BusinessPricingConfig | null }>('businessSettings', { connectionId: scope.connectionId, storeId: scope.storeId }, controller.signal).then(result => {
      if (!controller.signal.aborted && owner.current === target) { setPricingConfig(result.pricing); setPricingError(''); }
    }).catch(error => { if (!controller.signal.aborted && owner.current === target) setPricingError(error instanceof Error ? error.message : '经营规则读取失败。'); });
    return () => controller.abort();
  }, [identity, active, refresh]);
  useEffect(() => {
    if (!scope || !active || dirty) { setLoadingPlans(false); return; } const target = identity; let cancelled = false; setLoadingPlans(true);
    businessOperation<{ plans: BusinessPlan[] } | BusinessPlan[]>(scope, 'list', { storeId: scope.storeId }).then(result => {
      if (cancelled || owner.current !== target) return; const rows = Array.isArray(result) ? result : result.plans;
      setPlans(rows); setPlanId(current => rows.some(row => row.planId === current) ? current : rows[0]?.planId ?? ''); setListError('');
    }).catch(error => { if (!cancelled && owner.current === target) setListError(error.message); })
      .finally(() => { if (!cancelled && owner.current === target) setLoadingPlans(false); });
    return () => { cancelled = true; };
  }, [identity, active, refresh, dirty]);
  const run = async (operation: BusinessOperation, input: unknown, message: string) => {
    if (!scope || flight.current) return; const target = identity; flight.current = true; setBusy(true); setNotice('');
    try { const next = await businessOperation<BusinessPlan>(scope, operation, input); if (owner.current === target) { accept(next); setNotice(message); } }
    catch (error) { if (owner.current === target) setNotice(error instanceof Error ? error.message : String(error)); }
    finally { flight.current = false; if (owner.current === target) { setBusy(false); setPending(pendingRequests.get(scopeKey(scope))); } }
  };
  const recover = async () => {
    if (!scope || !pending || flight.current) return; const target = identity; flight.current = true; setBusy(true);
    try { const result = await businessOperation<RequestResult>(scope, 'request', { requestId: pending.requestId });
      if (!result.settled && result.operationId) { result.value = await businessOperation<BusinessPlan>(scope, 'get', { operationId: result.operationId }); result.settled = true; }
      if (result.settled) pendingRequests.delete(scopeKey(scope));
      if (owner.current !== target) return;
      if (result.value) accept(result.value);
      setNotice(!result.settled ? '原操作仍在处理中，继续保留原请求。' : result.error ? result.error.message : '已取得原操作结果。');
      if (result.settled) setRefresh(value => value + 1);
    } catch (error) { if (owner.current === target) setNotice(error instanceof Error ? error.message : String(error)); }
    finally { flight.current = false; if (owner.current === target) { setBusy(false); setPending(pendingRequests.get(scopeKey(scope))); } }
  };
  const rowPricing = (row: BusinessRow) => { const value = pricingEdits[row.rowId] ?? row.pricing ?? { mode: 'manual' as const }; return pricingConfig?.logisticsSelection === 'automatic' ? { mode: value.mode } : value; };
  const patch = (row: BusinessRow, payload: Record<string, unknown>, priceEdited = false) => {
    if (businessPriceAction(row.action) && (priceEdited || payload.price !== (edits[row.rowId] ?? row.payload).price)) setPricingEdits(previous => ({ ...previous, [row.rowId]: { ...rowPricing(row), mode: 'manual' } }));
    setEdits(previous => ({ ...previous, [row.rowId]: payload }));
  };
  const patchPricing = (row: BusinessRow, pricing: NonNullable<BusinessRowInput['pricing']>) => {
    setPricingEdits(previous => ({ ...previous, [row.rowId]: pricing }));
    if (pricing.mode === 'automatic') setEdits(previous => { const payload = { ...(previous[row.rowId] ?? row.payload) }; delete payload.price; return { ...previous, [row.rowId]: payload }; });
  };
  const disabled = busy || !!pending, restorable = plan?.rows.filter(row => selected.includes(row.rowId) && row.status === 'succeeded' && row.action !== 'stock').map(row => row.rowId) ?? [];
  const selectedPrices = plan?.rows.filter(row => selected.includes(row.rowId) && editableBusinessRow(row) && ['price', 'promotion.enroll', 'promotion.update'].includes(row.action)) ?? [];
  return <section className="apps-business" aria-label="经营操作" aria-busy={busy || loadingPlans}><style>{BUSINESS_STYLES}{BUSINESS_PRICING_STYLES}</style>
    <header className="apps-business-heading"><div><span className="apps-business-eyebrow">OZON · 经营操作</span><h2>{store?.name ?? '经营操作'}</h2><p>查看改前改后、编辑草稿，提交时自动审核并执行。</p></div><button type="button" disabled={!scope || busy || dirty || loadingPlans} onClick={() => setRefresh(value => value + 1)}>{loadingPlans ? '正在读取…' : '刷新批次'}</button></header>
    {!sessionId ? <p className="apps-business-empty">请选择一个聊天，继续使用同一应用连接。</p> : !storeId ? <p className="apps-business-empty">先在工作台选择店铺，再打开经营操作。</p> : !store ? <p className="apps-business-empty">正在读取所选店铺的连接…</p> : <>
      <div className="apps-business-toolbar"><label>操作批次<select aria-label="操作批次" disabled={disabled || dirty} value={planId} onChange={event => { setPlanId(event.target.value); setSelected([]); setEdits({}); setPricingEdits({}); }}><option value="">新建批次</option>{plans.map(item => <option key={item.planId} value={item.planId}>{item.title} · {item.rows.length} 个动作</option>)}</select></label><button type="button" disabled={disabled || dirty} onClick={() => { setPlanId(''); setSelected([]); }}>新建批次</button>{plan ? <span className="apps-business-revision">版本 {plan.revision} · {new Date(plan.updatedAt).toLocaleString('zh-CN')}</span> : null}</div>
      {pending ? <div className="apps-business-alert" role="status"><span>原操作回执待确认。检查原操作即可继续。</span><button type="button" disabled={busy} onClick={() => void recover()}>检查原操作</button></div> : null}
      {listError ? <p className="apps-business-notice" role="alert">{listError}</p> : null}
      {pricingError ? <p className="apps-business-notice" role="alert">经营规则暂时无法读取：{pricingError}</p> : null}
      {notice ? <p className="apps-business-notice" role="status">{notice}</p> : null}
      {plan ? <><div className="apps-business-toolbar"><input aria-label="筛选商品" placeholder="搜索货号、采购 SKU 或问题" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="筛选执行状态" value={status} onChange={event => setStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(BUSINESS_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><span>{visible.length} / {plan.rows.length} 个动作</span></div>
        {selectedPrices.length ? <div className="apps-business-toolbar"><label>批量填写售价<input aria-label="批量填写售价" type="number" min="0" step="any" value={batchPrice} disabled={disabled} onChange={event => setBatchPrice(event.target.value)}/></label><button type="button" disabled={disabled || batchPrice === '' || !Number.isFinite(Number(batchPrice)) || Number(batchPrice) < 0} onClick={() => { setEdits(previous => ({ ...previous, ...Object.fromEntries(selectedPrices.map(row => [row.rowId, { ...(previous[row.rowId] ?? row.payload), price: batchPrice }])) })); setPricingEdits(previous => ({ ...previous, ...Object.fromEntries(selectedPrices.map(row => [row.rowId, { ...rowPricing(row), mode: 'manual' as const }])) })); }}>填入所选 {selectedPrices.length} 行草稿</button><span>按每行原币种填写，切换为手动定价；保存后再提交。</span></div> : null}
        <div className="apps-business-table-wrap"><table className="apps-business-table"><thead><tr><th><input type="checkbox" aria-label="选择当前筛选结果" checked={visible.length > 0 && visible.every(row => selected.includes(row.rowId))} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, ...visible.map(row => row.rowId)])] : previous.filter(id => !visible.some(row => row.rowId === id)))}/></th><th>商品 / 销售货号</th><th>动作</th><th>改前</th><th>改后</th><th>采购关联 / 成本</th><th>物流与定价</th><th>审核与执行</th></tr></thead><tbody>{visible.map(row => <tr key={row.rowId}>
          <td><input type="checkbox" aria-label={`选择 ${row.target.offerId}`} checked={selected.includes(row.rowId)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.rowId] : previous.filter(id => id !== row.rowId))}/></td>
          <td><strong>{String(row.payload.name ?? row.target.offerId)}</strong><small>{row.target.offerId}</small>{row.target.sku ? <small>平台 SKU：{row.target.sku}</small> : null}<ContentDetails row={row} payload={edits[row.rowId] ?? row.payload} disabled={disabled || !editableBusinessRow(row)} onChange={payload => patch(row, payload)}/></td>
          <td>{BUSINESS_ACTION_LABELS[row.action]}</td><td><FieldValues payload={row.before ?? {}}/></td>
          <td>{['price', 'stock', 'promotion.enroll', 'promotion.update'].includes(row.action) ? <label className="apps-business-inline-value">{row.action === 'stock' ? '库存' : '售价'}<input type="number" min="0" step={row.action === 'stock' ? '1' : 'any'} aria-label={`${row.target.offerId} ${row.action === 'stock' ? '库存' : '售价'}`} placeholder={row.action !== 'stock' && rowPricing(row).mode === 'automatic' ? '保存后自动计算' : undefined} value={String((edits[row.rowId] ?? row.payload)[row.action === 'stock' ? 'stock' : 'price'] ?? '')} disabled={disabled || !editableBusinessRow(row)} onChange={event => patch(row, { ...(edits[row.rowId] ?? row.payload), [row.action === 'stock' ? 'stock' : 'price']: row.action === 'stock' && event.target.value !== '' ? Number(event.target.value) : event.target.value }, row.action !== 'stock')}/>{businessValue(row.payload.currency_code)}</label> : <FieldValues payload={edits[row.rowId] ?? row.payload}/>}</td>
          <td>{row.binding?.components.length ? <>{row.binding.components.map(item => <small key={`${item.itemId}:${item.sourceSkuId}`}>{item.sourceSkuId} × {item.quantity}</small>)}<strong>{row.binding.amount === null ? '采购成本待补充' : `${row.binding.amount} ${row.binding.currency ?? ''}`}</strong></> : <span className="apps-business-muted">尚无采购关联</span>}</td>
          <td>{businessPriceAction(row.action) ? <><PricingChoice label={row.target.offerId} config={pricingConfig} value={rowPricing(row)} disabled={disabled || !editableBusinessRow(row)} onChange={value => patchPricing(row, value)}/><PricingQuote row={row} dirty={editedIds.has(row.rowId)}/></> : <span className="apps-business-muted">此动作无需定价</span>}</td>
          <td><span className={`apps-business-status is-${row.status}`}>{BUSINESS_STATUS_LABELS[row.status]}</span>{row.issues.map((issue, index) => <p className="apps-business-issue" key={`${issue.code}:${index}`}>{issue.field ? `${BUSINESS_FIELD_LABELS[issue.field] ?? issue.field}：` : ''}{issue.message}{issue.suggestion ? <small>{issue.suggestion}</small> : null}</p>)}{row.corrections.length ? <details><summary>已自动修正 {row.corrections.length} 项</summary>{row.corrections.map((text, index) => <small key={index}>{text}</small>)}</details> : null}</td>
        </tr>)}</tbody></table>{!visible.length ? <p className="apps-business-empty">当前筛选下没有商品。</p> : null}</div>
        <footer className="apps-business-actions"><span>{dirty ? `${editedIds.size} 行尚未保存` : `已选 ${selected.length} 行 · 提交范围为整批 ${plan.rows.length} 个动作`}</span><button type="button" disabled={disabled || !dirty} onClick={() => void run('revise', { planId: plan.planId, expectedRevision: plan.revision, rows: plan.rows.filter(row => editedIds.has(row.rowId)).map(row => businessRowInput(row, edits[row.rowId] ?? row.payload, businessPriceAction(row.action) ? rowPricing(row) : row.pricing)) }, '草稿已保存，尚未提交。')}>保存草稿</button><button type="button" disabled={disabled || dirty} onClick={() => void run('inspect', { planId: plan.planId }, '已更新平台处理状态。')}>核查平台状态</button><button type="button" disabled={disabled || dirty || !restorable.length} onClick={() => void run('restore', { planId: plan.planId, rowIds: restorable }, '已生成恢复草稿，请查看后提交。')}>恢复所选已完成项</button><button type="button" className="apps-primary" disabled={disabled || dirty || plan.rows.every(row => ['succeeded', 'unknown', 'pending', 'dispatching', 'reviewing'].includes(row.status))} onClick={() => void run('submit', { planId: plan.planId, expectedRevision: plan.revision }, '审核与提交结果已更新，请查看各行状态。')}>提交整批变更</button></footer>
      </> : null}
      <NewBusinessRow key={`${identity}:${plan?.planId ?? 'new'}`} disabled={disabled || dirty} pricingConfig={pricingConfig} onAdd={(title, row) => void run(plan ? 'revise' : 'create', plan ? { planId: plan.planId, expectedRevision: plan.revision, rows: [row] } : { storeId: store.id, title, rows: [row] }, '草稿已保存，尚未提交。')}/>
    </>}
  </section>;
}

function FieldValues({ payload }: { payload: Record<string, unknown> }) {
  const fields = Object.entries(payload).filter(([key]) => !['attributes', 'images', 'primary_image', 'description'].includes(key));
  return <>{fields.length ? fields.slice(0, 5).map(([key, value]) => <small key={key}><span className="apps-business-muted">{BUSINESS_FIELD_LABELS[key] ?? key}：</span>{businessValue(value)}</small>) : <span className="apps-business-muted">—</span>}</>;
}
function PricingChoice({ label, config, value, disabled, onChange }: { label: string; config: BusinessPricingConfig | null; value: NonNullable<BusinessRowInput['pricing']>; disabled: boolean; onChange: (value: NonNullable<BusinessRowInput['pricing']>) => void }) {
  const selected = config?.plans.find(plan => plan.id === value.planId), defaultPlan = config?.plans.find(plan => plan.id === config.defaultPlanId), automaticLogistics = config?.logisticsSelection === 'automatic';
  return <div className="apps-business-pricing-choice">{automaticLogistics ? <small className="apps-business-muted">按售价与重量自动匹配物流；条件重合取总费用较高的方案。</small> : <label>物流方案（固定）<select aria-label={`${label} 物流方案`} value={value.planId ?? ''} disabled={disabled} onChange={event => onChange({ mode: value.mode, ...(event.target.value ? { planId: event.target.value } : {}) })}>
    <option value="">店铺默认{defaultPlan ? ` · ${defaultPlan.name}` : '（尚未配置）'}</option>
    {value.planId && !selected ? <option value={value.planId}>原方案（当前不可用）</option> : null}
    {config?.plans.map(plan => <option key={plan.id} value={plan.id} disabled={!plan.enabled}>{plan.name}{plan.enabled ? '' : '（已停用）'}</option>)}
  </select></label>}<label>定价方式<select aria-label={`${label} 定价方式`} value={value.mode} disabled={disabled} onChange={event => onChange({ ...(automaticLogistics ? {} : value), mode: event.target.value as 'automatic' | 'manual' })}><option value="automatic">按规则自动定价</option><option value="manual">手动填写售价</option></select></label></div>;
}
function PricingQuote({ row, dirty }: { row: BusinessRow; dirty: boolean }) {
  const quote = businessPricingQuote(row);
  if (!quote) return <small className="apps-business-muted">保存后按经营设置计算报价；缺少规则会提示具体问题。</small>;
  const fields: Array<[string, number | null]> = [['成本合计', quote.breakdown.totalCostMinor], ['建议售价', quote.suggestedPriceMinor], ['最低允许售价', quote.minimumAllowedPriceMinor]];
  return <div className="apps-business-quote"><small className="apps-business-muted">{dirty ? '上次保存报价 · 修改后待重算' : '已保存报价'} · 规则修订 {quote.configRevision ?? '未配置'}</small><strong>{quote.planName ?? '暂无匹配的物流方案'}</strong>{quote.selectionReason ? <small>{quote.selectionReason}</small> : null}{quote.suggestedPlanId && quote.suggestedPlanId !== quote.planId ? <small>建议售价适用：{quote.suggestedPlanName ?? quote.suggestedPlanId}</small> : null}
    {fields.map(([name, value]) => <small key={name}>{name}：{businessMoney(value, quote.currency)}</small>)}
    <details><summary>费用与利润明细</summary>{([['采购合计', quote.breakdown.purchaseMinor], ['固定费用', quote.breakdown.fixedMinor], ['物流费用', quote.breakdown.logisticsMinor], ['佣金', quote.breakdown.commissionMinor], ['预计利润', quote.breakdown.profitMinor]] as Array<[string, number | null]>).map(([name, value]) => <small key={name}>{name}：{businessMoney(value, quote.currency)}</small>)}<small>预计利润率：{quote.breakdown.marginPpm === null ? '待补充' : `${(quote.breakdown.marginPpm / 10000).toFixed(2)}%`}</small></details>
    {quote.issues.map((issue, index) => <p key={`${issue.code}:${index}`} className="apps-business-issue">{issue.message}</p>)}{quote.warnings.map((warning, index) => <small className="apps-business-muted" key={index}>{warning}</small>)}
  </div>;
}
const BUSINESS_PRICING_STYLES = `.apps-business-table{min-width:1180px}.apps-business-table th:nth-child(7){width:210px}.apps-business-table th:nth-child(8){width:200px}.apps-business-pricing-choice{display:grid;gap:8px}.apps-business-pricing-choice label{display:grid;gap:4px;font-size:10px;color:var(--apps-muted,#7086a5)}.apps-business-pricing-choice select{box-sizing:border-box;width:100%;min-width:0;padding:6px;font-size:11px;color:var(--apps-text,#233c61)}.apps-business-quote{margin-top:10px;border-top:1px solid var(--apps-line,#e7eef9);padding-top:6px}.apps-business-quote strong{display:block;margin:4px 0}.apps-business-quote details{margin-top:5px}.apps-business-quote summary{font-size:11px;cursor:pointer;color:#3572bb}.apps-business-add .apps-business-pricing-choice{display:flex;flex-wrap:wrap;gap:10px}.apps-business-add .apps-business-pricing-choice label{min-width:155px}`;
function ContentDetails({ row, payload, disabled, onChange }: { row: BusinessRow; payload: Record<string, unknown>; disabled: boolean; onChange: (payload: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(payload, null, 2)), [error, setError] = useState('');
  useEffect(() => { setText(JSON.stringify(payload, null, 2)); setError(''); }, [payload]);
  const images = [...new Set([payload.primary_image, ...(Array.isArray(payload.images) ? payload.images : [])].filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url)))];
  return <details className="apps-business-content"><summary>查看 / 编辑完整内容</summary>{images.length ? <div className="apps-business-images">{images.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${row.target.offerId} 商品图`} loading="lazy"/></a>)}</div> : null}<textarea aria-label={`${row.target.offerId} 完整字段`} value={text} disabled={disabled} onChange={event => { setText(event.target.value); setError(''); }} spellCheck={false}/><button type="button" disabled={disabled} onClick={() => { try { onChange(parseBusinessPayload(text)); setError('已应用到待保存草稿。'); } catch { setError('字段格式有误，请保留完整对象及引号。'); } }}>应用字段修改</button>{error ? <small role="status">{error}</small> : null}</details>;
}
function NewBusinessRow({ disabled, pricingConfig, onAdd }: { disabled: boolean; pricingConfig: BusinessPricingConfig | null; onAdd: (title: string, row: BusinessRowInput) => void }) {
  const [action, setAction] = useState<Exclude<BusinessAction, 'listing'>>('price'), [offerId, setOfferId] = useState(''), [price, setPrice] = useState(''), [stock, setStock] = useState(''), [actionId, setActionId] = useState(''), [warehouseId, setWarehouseId] = useState(''), [error, setError] = useState('');
  const [pricing, setPricing] = useState<NonNullable<BusinessRowInput['pricing']>>({ mode: 'automatic' });
  const promotion = action.startsWith('promotion.'), hasPrice = action === 'price' || action === 'promotion.enroll' || action === 'promotion.update', hasStock = action === 'stock' || action === 'promotion.enroll' || action === 'promotion.update';
  return <details className="apps-business-add"><summary>添加经营动作</summary><p>输入准确的销售货号；商品身份、改前值和已有采购关联由程序读取。自动定价按已保存的物流与利润规则计算，手动定价仍检查经营底线。上品内容可由 Agent 制作后出现在此表。</p><form onSubmit={event => { event.preventDefault(); setError(''); if (!offerId.trim()) { setError('请填写销售货号。'); return; } if (hasPrice && pricing.mode === 'manual' && (!price.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0)) { setError('手动定价需要填写有效售价。'); return; } const payload: Record<string, unknown> = action === 'archive' ? { archived: true } : {}; if (hasPrice && pricing.mode === 'manual') payload.price = price; if (hasStock) payload.stock = Number(stock); if (promotion) payload.action_id = Number(actionId); if (action === 'stock') payload.warehouse_id = Number(warehouseId); onAdd(`${BUSINESS_ACTION_LABELS[action]} · ${offerId.trim()}`, { action, target: { offerId: offerId.trim() }, payload, ...(hasPrice ? { pricing: pricingConfig?.logisticsSelection === 'automatic' ? { mode: pricing.mode } : pricing } : {}) }); }}>
    <label>动作<select aria-label="新增动作" disabled={disabled} value={action} onChange={event => setAction(event.target.value as typeof action)}>{Object.entries(BUSINESS_ACTION_LABELS).filter(([key]) => key !== 'listing').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>销售货号<input required aria-label="新增销售货号" disabled={disabled} value={offerId} onChange={event => setOfferId(event.target.value)}/></label>
    {hasPrice ? <><PricingChoice label="新增" config={pricingConfig} value={pricing} disabled={disabled} onChange={value => { setPricing(value); if (value.mode === 'automatic') setPrice(''); }}/><label>{promotion ? '活动价' : '目标售价'}<input aria-label="新增目标售价" required={pricing.mode === 'manual'} placeholder={pricing.mode === 'automatic' ? '留空，保存后自动计算' : '填写售价'} type="number" min="0" step="any" disabled={disabled} value={price} onChange={event => { setPrice(event.target.value); setPricing(previous => ({ ...previous, mode: 'manual' })); }}/></label></> : null}
    {hasStock ? <label>{promotion ? '活动配额' : '目标库存'}<input aria-label="新增数量" required type="number" min="0" step="1" disabled={disabled} value={stock} onChange={event => setStock(event.target.value)}/></label> : null}
    {promotion ? <label>活动编号<input aria-label="新增活动编号" required type="number" min="1" step="1" disabled={disabled} value={actionId} onChange={event => setActionId(event.target.value)}/></label> : null}
    {action === 'stock' ? <label>仓库编号<input aria-label="新增仓库编号" required type="number" min="1" step="1" disabled={disabled} value={warehouseId} onChange={event => setWarehouseId(event.target.value)}/></label> : null}
    <button type="submit" disabled={disabled}>添加到草稿</button>{error ? <p role="alert">{error}</p> : null}</form></details>;
}

const BUSINESS_STYLES = `.apps-business{color:var(--apps-text,#233c61);background:var(--apps-bg,#fff);padding:22px;min-width:0}.apps-business-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.apps-business-heading h2{font-size:23px;margin:5px 0 8px}.apps-business-heading p,.apps-business-add p{font-size:12px;color:var(--apps-muted,#7086a5);margin:0;line-height:1.6}.apps-business-eyebrow{font-size:10px;font-weight:700;letter-spacing:.13em;color:#3c79c1}.apps-business button,.apps-business input,.apps-business select,.apps-business textarea{font:inherit;font-size:12px;border:1px solid var(--apps-line,#dce7fa);border-radius:6px;background:var(--apps-bg,#fff);color:inherit;padding:8px 10px}.apps-business button{cursor:pointer;white-space:nowrap}.apps-business button:disabled{opacity:.48;cursor:default}.apps-business .apps-primary{background:#2473d5;color:#fff;border-color:#2473d5}.apps-business input:focus,.apps-business select:focus,.apps-business textarea:focus{outline:2px solid #76a9ef;outline-offset:1px}.apps-business-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:10px;padding:12px 0}.apps-business-toolbar label,.apps-business-add label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:600}.apps-business-toolbar>span{font-size:11px;color:var(--apps-muted,#7086a5);align-self:center}.apps-business-toolbar>input{flex:1;min-width:180px}.apps-business-toolbar select{max-width:340px}.apps-business-revision{margin-left:auto}.apps-business-table-wrap{overflow:auto;border:1px solid var(--apps-line,#dce7fa);border-radius:8px}.apps-business-table{border-collapse:collapse;width:100%;min-width:920px;text-align:left;font-size:12px;table-layout:fixed}.apps-business-table th{padding:11px 12px;background:var(--apps-panel,#f4f8fe);color:var(--apps-muted,#7086a5);font-size:11px;font-weight:600;position:sticky;top:0;z-index:1}.apps-business-table th:first-child{width:42px}.apps-business-table input[type=checkbox]{width:16px;min-width:16px;height:16px;margin:0;padding:0;accent-color:#2473d5}.apps-business-table th:nth-child(2){width:180px}.apps-business-table th:nth-child(3){width:90px}.apps-business-table th:nth-child(4){width:110px}.apps-business-table th:nth-child(5){width:130px}.apps-business-table th:nth-child(6){width:140px}.apps-business-table th:nth-child(7){width:200px}.apps-business-table td{padding:14px 12px;border-top:1px solid var(--apps-line,#e7eef9);vertical-align:top;overflow-wrap:anywhere}.apps-business-table td small{display:block;font-size:11px;line-height:1.65;margin-top:3px}.apps-business-table td strong{font-size:12px}.apps-business-table tr:has(input[type=checkbox]:checked){background:var(--apps-panel,#f5f9ff)}.apps-business-inline-value{display:flex;align-items:center;flex-wrap:wrap;gap:5px;font-size:10px}.apps-business-inline-value input{width:92px;font-variant-numeric:tabular-nums}.apps-business-muted{color:var(--apps-muted,#7086a5)}.apps-business-status{display:inline-block;padding:3px 7px;border-radius:4px;background:#edf2f8;color:#5c708b;font-size:11px}.apps-business-status.is-succeeded{background:#e7f4ed;color:#26764a}.apps-business-status.is-blocked,.apps-business-status.is-rejected,.apps-business-status.is-needs_user{background:#fff0e9;color:#a0512e}.apps-business-status.is-unknown,.apps-business-status.is-pending,.apps-business-status.is-dispatching{background:#eef2fd;color:#486abc}.apps-business-issue{font-size:11px;line-height:1.6;margin:7px 0;color:#a0512e}.apps-business-content{margin-top:8px}.apps-business-content summary,.apps-business-add summary{cursor:pointer;font-size:11px;color:#3572bb}.apps-business-content textarea{display:block;box-sizing:border-box;width:100%;min-height:210px;margin:8px 0;font-family:ui-monospace,monospace;font-size:10px;line-height:1.55}.apps-business-images{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.apps-business-images img{display:block;width:64px;height:64px;object-fit:contain;background:#fff;border:1px solid #e3ebf6;border-radius:5px}.apps-business-actions{position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;padding:14px 0;background:var(--apps-bg,#fff)}.apps-business-actions>span{font-size:11px;color:var(--apps-muted,#7086a5);margin-right:auto}.apps-business-add{padding:16px;margin-top:10px;border:1px dashed var(--apps-line,#bfcfe6);border-radius:8px}.apps-business-add>summary{font-size:12px;font-weight:600}.apps-business-add p{margin:10px 0}.apps-business-add form{display:flex;align-items:end;flex-wrap:wrap;gap:10px}.apps-business-add input{width:125px}.apps-business-notice,.apps-business-alert{padding:11px 14px;border-radius:6px;background:var(--apps-panel,#eff5fe);font-size:12px;line-height:1.6}.apps-business-alert{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff5e9;color:#845924}.apps-business-empty{text-align:center;padding:32px 16px;color:var(--apps-muted,#7086a5);font-size:13px}@media(max-width:600px){.apps-business{padding:12px}.apps-business-heading{gap:8px;align-items:start}.apps-business-heading h2{font-size:19px}.apps-business-revision{margin-left:0}.apps-business-actions{justify-content:flex-start}.apps-business-actions>span{width:100%}.apps-business-toolbar select{max-width:240px}}`;
