import {ProcurementIssueDetails} from './procurement-issue-details.tsx';
import {businessRecoveryAction, businessRecoveryMessage, businessSubmissionScope, businessRecoveryDeadline, businessConfirmationFingerprint} from '../../app-presentation/src/materials/business-recovery.ts';
import { BusinessDraftRecovery, type BusinessDraftSnapshot, type DraftCacheNotice } from './business-draft-recovery.ts';
import {ListingDraftEditor} from './listing-draft-editor.tsx';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BusinessAction, BusinessPlan, BusinessRow, BusinessRowInput } from '../../app-hallmark/src/operations/types.ts';
import { BUSINESS_ACTION_LABELS, BUSINESS_FIELD_LABELS, BUSINESS_STATUS_LABELS, businessMoney, businessPriceAction, businessPricingQuote, businessRowInput, businessValue, editableBusinessRow, filterBusinessRows, parseBusinessPayload } from '../../app-presentation/src/materials/business-operations.ts';
import { appsApiError, appsResource, type WorkbenchStores, type WorkbenchStoreOption } from './api.ts';
import type { BusinessPricingConfig } from '../../business-pricing/src/types.ts';

type BusinessOperation = 'create' | 'revise' | 'get' | 'list' | 'submit' | 'inspect' | 'restore' | 'request';
interface PendingRequest { requestId: string; operation: BusinessOperation }
interface RequestResult { settled: boolean; value?: BusinessPlan; operationId?: string; error?: { code?: string; message: string } }
interface Scope { sessionId: string; connectionId: string; storeId: string }
type StoreRead = { owner: string; attempt: number; status: 'loading' | 'ready' | 'error'; stores: WorkbenchStoreOption[]; error?: string };
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

export function BusinessOperations({ sessionId, storeId, active = true, onChooseStore }: { sessionId?: string; storeId?: string; active?: boolean; onChooseStore?: () => void }) {
  const storeOwner = JSON.stringify([sessionId, storeId]);
  const [storeRead, setStoreRead] = useState<StoreRead>(), [storeAttempt, setStoreAttempt] = useState(0);
  const storeController = useRef<AbortController>(), retryQueued = useRef(false), currentStoreOwner = useRef(storeOwner);
  currentStoreOwner.current = storeOwner;
  const retryStores = () => {
    if (retryQueued.current || !active) return;
    // Coalesce repeated handlers before React starts this explicit replacement read.
    retryQueued.current = true;
    storeController.current?.abort(); setStoreAttempt(value => value + 1);
  };
  const [drafts] = useState(() => new BusinessDraftRecovery()), [cacheNotice, setCacheNotice] = useState<DraftCacheNotice>(), [, refreshCache] = useState(0);
  useEffect(() => {
    // Successful reads survive ordinary tab hiding; do not remount a dirty editor.
    if (!active || (storeRead?.owner === storeOwner && storeRead.attempt === storeAttempt && storeRead.status === 'ready')) return;
    const controller = new AbortController(); storeController.current = controller; retryQueued.current = false;
    setStoreRead({ owner: storeOwner, attempt: storeAttempt, status: 'loading', stores: [] });
    appsResource<WorkbenchStores>('stores', { appId: 'hallmark' }, controller.signal).then(result => {
      if (!controller.signal.aborted && currentStoreOwner.current === storeOwner) setStoreRead({ owner: storeOwner, attempt: storeAttempt, status: 'ready', stores: result.stores });
    }).catch(error => {
      if (!controller.signal.aborted && currentStoreOwner.current === storeOwner) setStoreRead({ owner: storeOwner, attempt: storeAttempt, status: 'error', stores: [], error: error instanceof Error ? error.message : '店铺连接读取失败。' });
    });
    return () => controller.abort();
  }, [storeOwner, active, storeAttempt]);
  useEffect(() => { const timer = setInterval(() => { if (drafts.prune()) { setCacheNotice('expired'); refreshCache(value => value + 1); } }, 60_000); return () => { clearInterval(timer); drafts.clear(); }; }, [drafts]);
  const currentStoreRead = storeRead?.owner === storeOwner && storeRead.attempt === storeAttempt ? storeRead : undefined;
  const store = currentStoreRead?.status === 'ready' ? currentStoreRead.stores.find(item => item.id === storeId) : undefined, scope = sessionId && store ? { sessionId, connectionId: store.connectionId, storeId: store.id } : undefined;
  const identity = scope ? scopeKey(scope) : JSON.stringify([sessionId, storeId]);
  return <>
    {cacheNotice ? <p role="status" className="apps-business-notice">{cacheNotice === 'retained' ? '离开的未保存修改已按原聊天和店铺暂存，当前页面不会使用这些修改。' : cacheNotice === 'too_large' ? '未保存修改超过暂存容量，未能保留。' : cacheNotice === 'evicted' ? '较早的未保存修改已因暂存容量上限清除。' : '超过 30 分钟的未保存暂存已清除。'}暂存不等于保存，最多保留 30 分钟；关闭工作区或刷新后清除。请及时保存草稿。<button type="button" onClick={() => setCacheNotice(undefined)}>知道了</button></p> : null}
    <BusinessOperationsEditor key={identity} sessionId={sessionId} storeId={storeId} store={store} scope={scope} identity={identity} active={active} drafts={drafts} onCacheNotice={setCacheNotice} onRecoveryResolved={() => setCacheNotice(previous => previous === 'retained' ? undefined : previous)} storeRead={currentStoreRead} onRetryStores={retryStores} onChooseStore={onChooseStore}/>
  </>;
}

function BusinessOperationsEditor({ sessionId, storeId, store, scope, identity, active, drafts, onCacheNotice, onRecoveryResolved, storeRead, onRetryStores, onChooseStore }: { sessionId?: string; storeId?: string; store?: WorkbenchStoreOption; scope?: Scope; identity: string; active: boolean; drafts: BusinessDraftRecovery; onCacheNotice: (notice: DraftCacheNotice) => void; onRecoveryResolved: () => void; storeRead?: StoreRead; onRetryStores: () => void; onChooseStore?: () => void }) {
  const [plans, setPlans] = useState<BusinessPlan[]>([]), [planId, setPlanId] = useState('');
  const [newRowState, setNewRowState] = useState({ snapshot: '', dirty: false });
  // Read the latest committed form state when a list response settles, without
  // restarting list reads on every keystroke or capturing a stale clean form.
  const newRowDirty = useRef(false);
  const [navigation, setNavigation] = useState<{ identity: string; from: string; target: string; snapshot: string }>();
  const navigationPermit = useRef<typeof navigation>();
  const reportNewRow = useCallback((snapshot: string, dirty: boolean) => {
    newRowDirty.current = dirty;
    setNewRowState(previous => previous.snapshot === snapshot && previous.dirty === dirty ? previous : { snapshot, dirty });
  }, []);
  const [editingListingId, setEditingListingId] = useState('');
  const [rawEdits, setRawEdits] = useState<Record<string, string>>({}), rawEditedIds = Object.keys(rawEdits), rawDirty = rawEditedIds.length > 0;
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [selected, setSelected] = useState<string[]>([]), [batchPrice, setBatchPrice] = useState(''), [batchCurrency, setBatchCurrency] = useState('');
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({}), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [pricingEdits, setPricingEdits] = useState<Record<string, NonNullable<BusinessRowInput['pricing']>>>({}), [pricingConfig, setPricingConfig] = useState<BusinessPricingConfig | null>(null), [pricingError, setPricingError] = useState('');
  const [listError, setListError] = useState(''), [loadingPlans, setLoadingPlans] = useState(false);
  const [recoveryNow, setRecoveryNow] = useState(() => Date.now());
  const [discardConfirmation, setDiscardConfirmation] = useState<object>(), [discardReloadPlanId, setDiscardReloadPlanId] = useState<string>();
  const discardPermit = useRef<object>(), confirmationPermit = useRef<BusinessPlan>();
  const [confirmation, setConfirmation] = useState<BusinessPlan>(), [busyOperation, setBusyOperation] = useState<BusinessOperation>();
  const [pending, setPending] = useState<PendingRequest | undefined>(() => scope ? pendingRequests.get(scopeKey(scope)) : undefined), [refresh, setRefresh] = useState(0), flight = useRef(false);
  const owner = useRef(identity);
  useLayoutEffect(() => { owner.current = identity; return () => { owner.current = ''; }; }, [identity]);
  const [listVerified, setListVerified] = useState(false), [, refreshRecovery] = useState(0);
  const editedIds = new Set([...Object.keys(edits), ...Object.keys(pricingEdits)]);
  useLayoutEffect(() => { setDiscardConfirmation(undefined); }, [active, identity, planId, edits, rawEdits, pricingEdits, batchPrice, batchCurrency, busy, pending]);
  useLayoutEffect(() => { discardPermit.current = active && !busy && !pending ? discardConfirmation : undefined; return () => { discardPermit.current = undefined; }; });
  const plan = plans.find(item => item.planId === planId), visible = filterBusinessRows(plan, query, status), dirty = editedIds.size > 0 || rawDirty;
  useEffect(() => { setEditingListingId(''); }, [identity, planId]);
  const listingRows = plan?.rows.filter(row => row.action === 'listing') ?? [], editingListing = listingRows.find(row => row.rowId === editingListingId) ?? listingRows[0];
  useEffect(() => {
    if (!active || !plan) return;
    let timer: ReturnType<typeof setTimeout> | undefined, cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const now = Date.now(); setRecoveryNow(now);
      const deadline = businessRecoveryDeadline(plan.rows, now);
      // Browsers clamp oversized delays to ~1ms. Chunk only genuinely distant deadlines.
      if (deadline !== undefined) timer = setTimeout(schedule, Math.min(deadline - now, 2_147_483_647));
    };
    schedule();
    return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
  }, [active, plan]);
  const currentDecision = useMemo(() => confirmation ? businessConfirmationFingerprint(plan) : '', [plan, !!confirmation]);
  const confirmedDecision = useMemo(() => businessConfirmationFingerprint(confirmation), [confirmation]);
  useLayoutEffect(() => { confirmationPermit.current = active && !busy && !pending && !dirty && listVerified && !loadingPlans && !listError ? confirmation : undefined; return () => { confirmationPermit.current = undefined; }; });
  const actionableRows = plan?.rows.filter(row => businessRecoveryAction(row, recoveryNow) === 'submit') ?? [];
  const editedRows = plan?.rows.filter(row => editedIds.has(row.rowId)) ?? [];
  const saveLabel = editedRows.length > 0 && editedRows.every(row => ['price', 'promotion.enroll', 'promotion.update'].includes(row.action)) ? '保存改价草稿' : '保存草稿';
  // Inspection refreshes server outcomes without discarding local selection or unapplied batch inputs.
  const accept = (next: BusinessPlan, preserveSelection = false) => { drafts.drop(identity); setPlans(rows => [next, ...rows.filter(item => item.planId !== next.planId)]); setPlanId(next.planId); setEdits({}); setRawEdits({}); setPricingEdits({}); setSelected(previous => preserveSelection ? previous.filter(id => next.rows.some(row => row.rowId === id)) : []); setConfirmation(undefined); setDiscardConfirmation(undefined); setDiscardReloadPlanId(undefined); if (!preserveSelection) { setBatchPrice(''); setBatchCurrency(''); } };
  useEffect(() => { setBatchPrice(''); setBatchCurrency(''); }, [planId]);
  // The keyed editor never renders a previous owner's state, even before effects run.
  // Capture committed state only; interrupted renders must not overwrite the recovery snapshot.
  const latestDraft = useRef<BusinessDraftSnapshot>();
  useLayoutEffect(() => { latestDraft.current = scope && plan && dirty ? { planId: plan.planId, revision: plan.revision, edits, pricingEdits, rawEdits } : undefined; });
  useLayoutEffect(() => () => {
    if (latestDraft.current) { const result = drafts.put(identity, latestDraft.current); onCacheNotice(result.notice ?? 'retained'); }
  }, [drafts, identity]);
  const recoveryDraft = listVerified && !listError ? drafts.peek(identity) : undefined;
  const recoveryPlan = recoveryDraft ? plans.find(item => item.planId === recoveryDraft.planId && item.storeId === scope?.storeId && item.revision === recoveryDraft.revision) : undefined;
  const restoreDraft = () => {
    const snapshot = listVerified && !listError && !loadingPlans ? drafts.peek(identity) : undefined;
    const verified = snapshot && plans.find(item => item.planId === snapshot.planId && item.storeId === scope?.storeId && item.revision === snapshot.revision);
    if (!snapshot || !verified || busy || pending || dirty) return;
    setPlanId(snapshot.planId); setQuery(''); setStatus(''); setEdits(snapshot.edits); setPricingEdits(snapshot.pricingEdits); setRawEdits(snapshot.rawEdits); drafts.drop(identity); onRecoveryResolved(); refreshRecovery(value => value + 1); setNotice('已恢复未保存修改，请检查后保存草稿；尚未提交。');
  };
  useEffect(() => {
    if (!scope || !active) return; const controller = new AbortController(), target = identity;
    appsResource<{ pricing: BusinessPricingConfig | null }>('businessSettings', { connectionId: scope.connectionId, storeId: scope.storeId }, controller.signal).then(result => {
      if (!controller.signal.aborted && owner.current === target) { setPricingConfig(result.pricing); setPricingError(''); }
    }).catch(error => { if (!controller.signal.aborted && owner.current === target) setPricingError(error instanceof Error ? error.message : '经营规则读取失败。'); });
    return () => controller.abort();
  }, [identity, active, refresh]);
  useEffect(() => {
    if (!scope || !active || dirty) { setLoadingPlans(false); return; } const target = identity; let cancelled = false; setLoadingPlans(true); setListVerified(false);
    businessOperation<{ plans: BusinessPlan[] } | BusinessPlan[]>(scope, 'list', { storeId: scope.storeId }).then(result => {
      if (cancelled || owner.current !== target) return; const rows = Array.isArray(result) ? result : result.plans;
      if (discardReloadPlanId) setNotice('已放弃未保存修改；已完成最新批次读取，尚未提交任何经营动作。');
      setListVerified(true); setPlans(rows); setPlanId(current => discardReloadPlanId ?? (newRowDirty.current || rows.some(row => row.planId === current) ? current : rows[0]?.planId ?? '')); setListError(discardReloadPlanId && !rows.some(row => row.planId === discardReloadPlanId) ? '原批次已不可读取，未切换到其他批次。请刷新重试，或明确选择其他批次。' : '');
    }).catch(error => { if (!cancelled && owner.current === target) { setListVerified(false); setPlans([]); setListError(error.message); if (discardReloadPlanId) setNotice('未保存修改已放弃，但最新批次读取失败。请点击刷新批次重试。'); } })
      .finally(() => { if (!cancelled && owner.current === target) setLoadingPlans(false); });
    return () => { cancelled = true; };
    // Discard requests a read via refresh. Clearing its target on explicit navigation must not start another read.
  }, [identity, active, refresh, dirty]);
  useEffect(() => {
    if (!confirmation || !active || loadingPlans) return;
    if (listError || (listVerified && (currentDecision !== confirmedDecision))) {
      setConfirmation(undefined);
      setNotice(listError ? '无法核对最新批次，已取消原提交确认。请重新检查后再确认。' : '批次已变化，已取消原提交确认。请重新检查最新内容后再确认。');
    }
  }, [confirmation, active, loadingPlans, listVerified, listError, currentDecision, confirmedDecision]);
  const run = async (operation: BusinessOperation, input: unknown, message: string) => {
    if (!scope || flight.current) return; const target = identity; flight.current = true; setBusy(true); setBusyOperation(operation); setNotice('');
    try { const next = await businessOperation<BusinessPlan>(scope, operation, input); if (owner.current === target) { accept(next, operation === 'inspect'); setNotice(operation === 'submit' || operation === 'inspect' ? `${message} ${businessOutcome(next)} ${businessSubmissionScope(next.rows).replace('本次可推进', '下一步可推进')}` : operation === 'revise' && next.rows.some(row => row.issues.some(issue => issue.code === 'PACKAGING_DRAFT_INVALID')) ? `草稿已保留，但包装填写仍有问题；请按字段提示修正后再提交。${message}` : message); } }
    catch (error) { if (owner.current === target) setNotice(error instanceof Error ? error.message : String(error)); }
    finally { flight.current = false; if (owner.current === target) { setBusy(false); setBusyOperation(undefined); setPending(pendingRequests.get(scopeKey(scope))); } }
  };
  const recover = async () => {
    if (!scope || !pending || flight.current) return; const target = identity; flight.current = true; setBusy(true); setBusyOperation('request');
    try { const result = await businessOperation<RequestResult>(scope, 'request', { requestId: pending.requestId });
      if (!result.settled && result.operationId) { result.value = await businessOperation<BusinessPlan>(scope, 'get', { operationId: result.operationId }); result.settled = true; }
      if (result.settled) pendingRequests.delete(scopeKey(scope));
      if (owner.current !== target) return;
      if (result.value) accept(result.value);
      setNotice(!result.settled ? '原操作仍在处理中，继续保留原请求。' : result.error ? result.error.message : result.value ? `已取得原操作结果。${businessOutcome(result.value)}` : '已取得原操作结果。');
      if (result.settled) setRefresh(value => value + 1);
    } catch (error) { if (owner.current === target) setNotice(error instanceof Error ? error.message : String(error)); }
    finally { flight.current = false; if (owner.current === target) { setBusy(false); setBusyOperation(undefined); setPending(pendingRequests.get(scopeKey(scope))); } }
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
  const disabled = busy || loadingPlans || !!pending || !!confirmation || !!recoveryDraft, restorable = plan?.rows.filter(row => selected.includes(row.rowId) && row.status === 'succeeded' && row.action !== 'stock').map(row => row.rowId) ?? [];
  const newRowDisabled = disabled || dirty || !!planId && (!listVerified || !plan || !!listError);
  const newRowAddPermit = useRef<object>(), newRowAddToken = {};
  useLayoutEffect(() => {
    newRowAddPermit.current = active && scope && !newRowDisabled ? newRowAddToken : undefined;
    return () => { newRowAddPermit.current = undefined; };
  });
  // Only explicit local navigation is interceptable. Owner changes still retire this editor.
  useLayoutEffect(() => { setNavigation(undefined); }, [identity, planId, newRowState.snapshot, active, disabled, dirty, plans]);
  useLayoutEffect(() => {
    navigationPermit.current = active && !disabled && !dirty ? navigation : undefined;
    return () => { navigationPermit.current = undefined; };
  });
  const navigate = (target: string) => {
    setNavigation(undefined); setDiscardReloadPlanId(undefined); setPlanId(target);
    setSelected([]); setEdits({}); setRawEdits({}); setPricingEdits({});
  };
  const requestNavigation = (target: string) => {
    if (!active || disabled || flight.current || dirty || (target && !plans.some(item => item.planId === target))) return;
    if (target === planId) { navigationPermit.current = undefined; setNavigation(undefined); return; }
    if (newRowState.dirty) setNavigation({ identity, from: planId, target, snapshot: newRowState.snapshot });
    else navigate(target);
  };
  const selectedPrices = visible.filter(row => selected.includes(row.rowId) && editableBusinessRow(row) && ['price', 'promotion.enroll', 'promotion.update'].includes(row.action));
  const batchCurrencies = [...new Set(selectedPrices.map(row => priceCurrency(edits[row.rowId] ?? row.payload)).filter((value): value is string => !!value))];
  const chosenCurrency = batchCurrencies.includes(batchCurrency) ? batchCurrency : batchCurrencies.length === 1 ? batchCurrencies[0] : '';
  const batchRows = selectedPrices.filter(row => chosenCurrency && priceCurrency(edits[row.rowId] ?? row.payload) === chosenCurrency);
  const hiddenSelected = selected.filter(id => !visible.some(row => row.rowId === id)).length;
  return <section className="apps-business" aria-label="经营操作" aria-busy={busy || loadingPlans}><style>{BUSINESS_STYLES}{BUSINESS_PRICING_STYLES}</style>
    <header className="apps-business-heading"><div><span className="apps-business-eyebrow">OZON · 经营操作</span><h2>{store?.name ?? '经营操作'}</h2><p>查看改前改后、编辑草稿，确认整批范围后审核并执行。</p></div><button type="button" disabled={!scope || disabled || dirty || loadingPlans} onClick={() => setRefresh(value => value + 1)}>{loadingPlans ? '正在读取…' : '刷新批次'}</button></header>
    {!sessionId ? <p className="apps-business-empty">请选择一个聊天，继续使用同一应用连接。</p> : !storeId ? <div className="apps-business-empty"><p>选择店铺后继续经营操作。</p>{onChooseStore ? <button type="button" onClick={onChooseStore}>选择店铺并继续</button> : <p>先在工作台选择店铺，再打开经营操作。</p>}</div> : !store ? <div className="apps-business-empty">
      {!storeRead || storeRead.status === 'loading' ? <p role="status">正在读取所选店铺的连接…</p> : storeRead.status === 'error' ? <p role="alert">店铺连接读取失败：{storeRead.error}</p> : <p role="status">{storeRead.stores.length ? '所选店铺已不可用或不在当前可用列表，请重新选择店铺。' : '当前没有可用店铺，请检查连接后重新读取。'}</p>}
      <button type="button" disabled={!active} onClick={onRetryStores}>{!storeRead || storeRead.status === 'loading' ? '取消并重新读取' : '重新读取店铺'}</button>
      {onChooseStore ? <button type="button" onClick={onChooseStore}>重新选择店铺</button> : <p>请返回工作台选择店铺，再打开经营操作。</p>}
    </div> : <>
      <div className="apps-business-toolbar"><label>操作批次<select aria-label="操作批次" disabled={disabled || dirty} value={planId} onChange={event => requestNavigation(event.target.value)}><option value="">新建批次</option>{planId && !plan ? <option value={planId}>原批次暂不可读取</option> : null}{plans.map(item => <option key={item.planId} value={item.planId}>{item.title} · {item.rows.length} 个动作</option>)}</select></label><button type="button" disabled={disabled || dirty} onClick={() => requestNavigation('')}>新建批次</button>{plan ? <span className="apps-business-revision">版本 {plan.revision} · {new Date(plan.updatedAt).toLocaleString('zh-CN')}</span> : null}</div>
      {navigation ? <section aria-label="放弃新增输入确认" className="apps-business-notice"><p>尚未添加的经营动作包含未保存输入。切换批次会放弃这些输入，此操作不能撤销。</p><button type="button" onClick={() => { navigationPermit.current = undefined; setNavigation(undefined); }}>继续编辑</button><button type="button" disabled={!active || disabled || dirty} onClick={() => {
        if (navigationPermit.current !== navigation || owner.current !== navigation.identity || planId !== navigation.from || newRowState.snapshot !== navigation.snapshot || !active || disabled || flight.current || dirty || (navigation.target && !plans.some(item => item.planId === navigation.target))) return;
        navigationPermit.current = undefined; navigate(navigation.target);
      }}>放弃新增输入并切换</button></section> : null}
      {pending ? <div className="apps-business-alert" role="status"><span>原操作回执待确认。检查原操作即可继续。</span><button type="button" disabled={busy} onClick={() => void recover()}>检查原操作</button></div> : null}
      {recoveryDraft ? <section aria-label="恢复未保存修改" className="apps-business-notice"><p>{recoveryPlan ? '发现此聊天和店铺下的未保存修改，原批次版本已核对。' : '暂存对应的批次已变化或不可读取，不能直接恢复旧修改。'}暂存不等于保存，仅在当前工作区保留最多 30 分钟；关闭工作区或刷新后会清除。</p>{recoveryPlan ? <button type="button" disabled={busy || !!pending || dirty || loadingPlans} onClick={restoreDraft}>恢复修改</button> : null}<button type="button" disabled={busy} onClick={() => { drafts.drop(identity); onRecoveryResolved(); refreshRecovery(value => value + 1); }}>放弃暂存</button></section> : null}
      {planId && !plan && newRowState.dirty ? <p className="apps-business-notice" role="status">原批次暂不可读取，新增输入已保留，尚未保存。请刷新批次重试；原批次恢复后可继续添加，或明确放弃新增输入并切换批次。</p> : null}
      {listError ? <p className="apps-business-notice" role="alert">{listError}</p> : null}
      {pricingError ? <p className="apps-business-notice" role="alert">经营规则暂时无法读取：{pricingError}</p> : null}
      {busy ? <p className="apps-business-notice" role="status">{busyOperation === 'submit' ? '正在审核并提交整批变更，请等待处理结果。' : busyOperation === 'request' ? '正在检查原操作结果，不会重发变更。' : '正在处理，请等待结果。'}</p> : null}
      {rawDirty ? <p className="apps-business-notice" role="status">完整字段有尚未应用的文本。请先应用或放弃字段修改，再继续编辑、筛选、保存或提交。</p> : null}
      {discardConfirmation ? <section aria-label="放弃未保存修改确认" className="apps-business-notice"><p>放弃当前批次所有未保存的字段、定价和批量输入，并重新读取最新批次？此操作不能撤销。下方尚未添加的经营动作表单会保留。</p><button type="button" onClick={() => { discardPermit.current = undefined; setDiscardConfirmation(undefined); }}>保留修改</button><button type="button" disabled={!active || busy || !!pending} onClick={() => { if (discardPermit.current !== discardConfirmation || owner.current !== identity || !active || busy || pending || !plan) return; discardPermit.current = undefined; confirmationPermit.current = undefined; drafts.drop(identity); latestDraft.current = undefined; setDiscardConfirmation(undefined); setConfirmation(undefined); setDiscardReloadPlanId(plan.planId); setEdits({}); setRawEdits({}); setPricingEdits({}); setBatchPrice(''); setBatchCurrency(''); setSelected([]); setQuery(''); setStatus(''); setListVerified(false); setNotice('已放弃当前批次未保存修改，正在重新读取最新批次。'); setRefresh(value => value + 1); }}>确认放弃并重新读取</button></section> : null}
      {notice ? <p className="apps-business-notice" role="status">{notice}</p> : null}
      {plan ? <><div className="apps-business-toolbar"><input aria-label="筛选商品" disabled={!!confirmation || rawDirty} placeholder="搜索货号、采购 SKU 或问题" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="筛选执行状态" disabled={!!confirmation || rawDirty} value={status} onChange={event => setStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(BUSINESS_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><span>{visible.length} / {plan.rows.length} 个动作</span></div>
        {selected.length ? <div className="apps-business-selection" role="status"><span>已选 {selected.length} 行，当前可见 {selected.length - hiddenSelected} 行{hiddenSelected ? `，隐藏 ${hiddenSelected} 行（不参与批量填价）` : ''}。勾选用于编辑或恢复；提交仍为整批。</span><button type="button" disabled={disabled} onClick={() => setSelected([])}>清空选择</button>{hiddenSelected ? <button type="button" disabled={disabled || rawDirty} onClick={() => { if (rawDirty) return; setQuery(''); setStatus(''); }}>查看隐藏选择</button> : null}</div> : null}
        {selectedPrices.length ? <div className="apps-business-toolbar"><label>批量填写售价<input aria-label="批量填写售价" type="number" min="0" step="any" value={batchPrice} disabled={disabled} onChange={event => setBatchPrice(event.target.value)}/></label><label>售价币种<select aria-label="批量售价币种" value={chosenCurrency} disabled={disabled} onChange={event => setBatchCurrency(event.target.value)}><option value="">请选择币种</option>{batchCurrencies.map(currency => <option key={currency} value={currency}>{currency} · {selectedPrices.filter(row => priceCurrency(edits[row.rowId] ?? row.payload) === currency).length} 行</option>)}</select></label><button type="button" disabled={disabled || rawDirty || !batchRows.length || batchPrice.trim() === '' || !Number.isFinite(Number(batchPrice)) || Number(batchPrice) <= 0} onClick={() => { if (disabled || rawDirty || !batchRows.length || !Number.isFinite(Number(batchPrice)) || Number(batchPrice) <= 0) return; setEdits(previous => ({ ...previous, ...Object.fromEntries(batchRows.map(row => [row.rowId, { ...(previous[row.rowId] ?? row.payload), price: batchPrice }])) })); setPricingEdits(previous => ({ ...previous, ...Object.fromEntries(batchRows.map(row => [row.rowId, { ...rowPricing(row), mode: 'manual' as const }])) })); }}>填入可见所选 {batchRows.length} 行草稿</button><span>{chosenCurrency ? `仅改当前可见所选的 ${chosenCurrency} 行，不换算币种。${selectedPrices.length > batchRows.length ? `另外 ${selectedPrices.length - batchRows.length} 行因其他或缺失币种不会修改。` : ''}` : '请先选币种，避免把相同数值填入不同币种。'}切换为手动定价；保存后重算利润，再确认提交。{selectedPrices.some(row => !priceCurrency(edits[row.rowId] ?? row.payload)) ? ' 币种缺失的行不能批量填价，请先核实商品币种。' : ''}</span></div> : null}
        {plan.rows.some(row => ['rejected', 'needs_user', 'unknown', 'pending', 'dispatching'].includes(row.status) || row.status === 'blocked' && row.issues.some(issue => issue.code === 'PROCUREMENT_SKU_NOT_UNIQUE')) ? <section className="apps-business-notice" aria-label="下一步操作"><p>{businessSubmissionScope(plan.rows, recoveryNow)}</p>{plan.rows.filter(row => ['rejected', 'needs_user', 'unknown', 'pending', 'dispatching'].includes(row.status) || row.status === 'blocked' && row.issues.some(issue => issue.code === 'PROCUREMENT_SKU_NOT_UNIQUE')).map(row => <div key={row.rowId}><p><strong>{row.target.offerId}</strong>：{businessRecoveryMessage(row, recoveryNow)}</p>{row.action === 'listing' && ['edit_save', 'resolve_decision'].includes(businessRecoveryAction(row, recoveryNow)) ? <button type="button" disabled={disabled || rawDirty} onClick={() => setEditingListingId(row.rowId)}>编辑 {row.target.offerId} 上品内容</button> : null}</div>)}</section> : null}
        {editingListing ? <ListingDraftEditor rows={listingRows} row={editingListing} payload={edits[editingListing.rowId] ?? editingListing.payload} editedIds={editedIds} disabled={disabled || rawDirty} onSelect={setEditingListingId} onChange={payload => patch(editingListing, payload)} packagingUpdateDisabled={dirty} onUpdatePackaging={() => {
          if (disabled || dirty || !editableBusinessRow(editingListing)) return;
          const previous = editingListing.payload;
          void run('revise', {planId: plan.planId, expectedRevision: plan.revision, rows: [businessRowInput(editingListing, previous, editingListing.pricing)]}, `已按当前包装规则保存草稿，并重新解析定价等经营字段；未提交商品。更新前重量：${previous.weight ?? '未填'} ${previous.weight_unit ?? ''}；尺寸：${previous.depth ?? '未填'} × ${previous.width ?? '未填'} × ${previous.height ?? '未填'} ${previous.dimension_unit ?? ''}。更新后值及来源见包装区；规则未变时数值保持不变。`);
        }}/> : null}
        <div className="apps-business-table-wrap"><table className="apps-business-table"><thead><tr><th><input type="checkbox" aria-label="选择当前筛选结果" disabled={disabled} checked={visible.length > 0 && visible.every(row => selected.includes(row.rowId))} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, ...visible.map(row => row.rowId)])] : previous.filter(id => !visible.some(row => row.rowId === id)))}/></th><th>商品 / 销售货号</th><th>动作</th><th>改前</th><th>改后</th><th>采购关联 / 成本</th><th>物流与定价</th><th>审核与执行</th></tr></thead><tbody>{visible.map(row => <tr key={row.rowId}>
          <td><input type="checkbox" aria-label={`选择 ${row.target.offerId}`} disabled={disabled} checked={selected.includes(row.rowId)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.rowId] : previous.filter(id => id !== row.rowId))}/></td>
          <td><strong>{String(row.payload.name ?? row.target.offerId)}</strong><small>{row.target.offerId}</small>{row.target.sku ? <small>平台 SKU：{row.target.sku}</small> : null}<ContentDetails row={row} payload={edits[row.rowId] ?? row.payload} disabled={disabled || !editableBusinessRow(row)} rawText={rawEdits[row.rowId]} onRawChange={value => setRawEdits(previous => { const next = { ...previous }; if (value === undefined) delete next[row.rowId]; else next[row.rowId] = value; return next; })} onChange={payload => patch(row, payload)}/></td>
          <td>{BUSINESS_ACTION_LABELS[row.action]}</td><td><FieldValues payload={row.before ?? {}}/></td>
          <td>{['price', 'stock', 'promotion.enroll', 'promotion.update'].includes(row.action) ? <label className="apps-business-inline-value">{row.action === 'stock' ? '库存' : '售价'}<input type="number" min="0" step={row.action === 'stock' ? '1' : 'any'} aria-label={`${row.target.offerId} ${row.action === 'stock' ? '库存' : '售价'}`} placeholder={row.action !== 'stock' && rowPricing(row).mode === 'automatic' ? '保存后自动计算' : undefined} value={String((edits[row.rowId] ?? row.payload)[row.action === 'stock' ? 'stock' : 'price'] ?? '')} disabled={disabled || rawDirty || !editableBusinessRow(row)} onChange={event => patch(row, { ...(edits[row.rowId] ?? row.payload), [row.action === 'stock' ? 'stock' : 'price']: row.action === 'stock' && event.target.value !== '' ? Number(event.target.value) : event.target.value }, row.action !== 'stock')}/>{businessValue((edits[row.rowId] ?? row.payload).currency_code)}</label> : <FieldValues payload={edits[row.rowId] ?? row.payload}/>}</td>
          <td>{row.binding?.components.length && !row.issues.some(issue => issue.code === 'PROCUREMENT_SKU_NOT_UNIQUE') ? <>{row.binding.components.map(item => <small key={`${item.itemId}:${item.sourceSkuId}`}>{item.sourceSkuId} × {item.quantity}</small>)}<strong>{row.binding.amount === null ? '采购成本待补充' : `${row.binding.amount} ${row.binding.currency ?? ''}`}</strong></> : row.procurement?.length ? <>{row.procurement.map((item, index) => <small key={index}>来源商品 {item.itemId} · {item.sourceSkuId} × {item.quantity}</small>)}<span className="apps-business-muted">采购关联及成本尚未核实，请处理本行提示。</span></> : <span className="apps-business-muted">尚无采购关联</span>}</td>
          <td>{businessPriceAction(row.action) ? <><PricingChoice label={row.target.offerId} config={pricingConfig} value={rowPricing(row)} disabled={disabled || rawDirty || !editableBusinessRow(row)} onChange={value => patchPricing(row, value)}/><PricingQuote row={row} dirty={editedIds.has(row.rowId)}/></> : <span className="apps-business-muted">此动作无需定价</span>}</td>
          <td><span className={`apps-business-status is-${row.status}`}>{BUSINESS_STATUS_LABELS[row.status]}</span>{row.issues.map((issue, index) => <p className="apps-business-issue" key={`${issue.code}:${index}`}>{issue.field ? `${BUSINESS_FIELD_LABELS[issue.field] ?? issue.field}：` : ''}{issue.message}{issue.suggestion ? <small>{issue.suggestion}</small> : null}<ProcurementIssueDetails row={row} issue={issue} verified={active && listVerified && !loadingPlans && !listError && !editedIds.has(row.rowId) && !rawEditedIds.includes(row.rowId)}/></p>)}{row.corrections.length ? <details><summary>已自动修正 {row.corrections.length} 项</summary>{row.corrections.map((text, index) => <small key={index}>{text}</small>)}</details> : null}</td>
        </tr>)}</tbody></table>{!visible.length ? <p className="apps-business-empty">当前筛选下没有商品。{query || status ? <button type="button" disabled={disabled || rawDirty} onClick={() => { if (rawDirty) return; setQuery(''); setStatus(''); }}>清除筛选</button> : null}</p> : null}</div>
        <footer className="apps-business-actions">{dirty ? <button type="button" disabled={disabled || !active} onClick={() => { if (!disabled && active) setDiscardConfirmation({}); }}>放弃未保存修改</button> : null}<span>{dirty ? `${new Set([...editedIds, ...rawEditedIds]).size} 行尚未保存` : `已选 ${selected.length} 行 · 提交范围为整批 ${plan.rows.length} 个动作`}</span><button type="button" disabled={disabled || !dirty || rawDirty} onClick={() => void run('revise', { planId: plan.planId, expectedRevision: plan.revision, rows: editedRows.map(row => businessRowInput(row, edits[row.rowId] ?? row.payload, businessPriceAction(row.action) ? rowPricing(row) : row.pricing)) }, '草稿已保存，尚未提交。')}>{saveLabel}</button><button type="button" disabled={disabled || dirty} onClick={() => void run('inspect', { planId: plan.planId }, '已更新平台处理状态。')}>核查平台状态</button><button type="button" disabled={disabled || dirty || !restorable.length} onClick={() => void run('restore', { planId: plan.planId, rowIds: restorable }, '已生成恢复草稿，请查看后提交。')}>恢复所选已完成项</button><button type="button" className="apps-primary" disabled={disabled || dirty || !actionableRows.length} onClick={() => setConfirmation(structuredClone(plan))}>确认整批范围后提交</button></footer>
      </> : null}
      {confirmation ? <SubmissionConfirmation now={recoveryNow} plan={confirmation} storeName={store.name} hiddenCount={confirmation.rows.filter(row => !visible.some(candidate => candidate.rowId === row.rowId)).length} unselectedCount={confirmation.rows.filter(row => !selected.includes(row.rowId)).length} busy={busy || !!pending} checking={!active || loadingPlans || !listVerified || currentDecision !== confirmedDecision} onCancel={() => { confirmationPermit.current = undefined; setConfirmation(undefined); }} onConfirm={() => { if (confirmationPermit.current !== confirmation || !active || loadingPlans || !listVerified || listError || busy || pending || dirty || !actionableRows.length || currentDecision !== confirmedDecision) return; const snapshot = confirmation; confirmationPermit.current = undefined; setConfirmation(undefined); void run('submit', { planId: snapshot.planId, expectedRevision: snapshot.revision }, '已取得本次提交结果，请查看各行状态。'); }}/> : null}
      <NewBusinessRow key={`${identity}:${planId || 'new'}`} disabled={newRowDisabled} pricingConfig={pricingConfig} onStateChange={reportNewRow} onAdd={(title, row) => { if (newRowAddPermit.current !== newRowAddToken || owner.current !== identity) return; void run(plan ? 'revise' : 'create', plan ? { planId: plan.planId, expectedRevision: plan.revision, rows: [row] } : { storeId: store.id, title, rows: [row] }, '草稿已保存，尚未提交。'); }}/>
    </>}
  </section>;
}

function priceCurrency(payload: Record<string, unknown>): string | undefined {
  const currency = payload.currency_code;
  return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}
function businessOutcome(plan: BusinessPlan): string {
  return Object.entries(BUSINESS_STATUS_LABELS).map(([status, label]) => {
    const count = plan.rows.filter(row => row.status === status).length;
    return count ? `${label} ${count} 行` : '';
  }).filter(Boolean).join('；');
}
function SubmissionConfirmation({ now, plan, storeName, hiddenCount, unselectedCount, busy, checking, onCancel, onConfirm }: { now: number; plan: BusinessPlan; storeName: string; hiddenCount: number; unselectedCount: number; busy: boolean; checking: boolean; onCancel: () => void; onConfirm: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="apps-business-confirmation" aria-label="提交范围确认"><h3 tabIndex={-1} ref={heading}>确认提交范围</h3><p>{storeName} · {plan.title} · 版本 {plan.revision}</p><p>提交范围为整批 {plan.rows.length} 个动作，其中 {hiddenCount} 个未在当前筛选中显示，{unselectedCount} 个未勾选。勾选和筛选仅用于编辑，不改变提交范围。{businessSubmissionScope(plan.rows, now)}只有可推进的动作进入核查，仍须通过经营规则和所需审核；其余行保留原状态，不会因本次确认而重发。下方为已保存草稿，提交时会重新核实平台值与规则。</p><div className="apps-business-table-wrap"><table className="apps-business-confirmation-table"><thead><tr><th>销售货号 / 动作</th><th>改前</th><th>提交值</th><th>当前状态 / 预计利润</th></tr></thead><tbody>{plan.rows.map(row => { const quote = businessPricingQuote(row); return <tr key={row.rowId}><td><strong>{row.target.offerId}</strong><small>{BUSINESS_ACTION_LABELS[row.action]}</small></td><td><SubmissionValues row={row} payload={row.before ?? {}}/></td><td><SubmissionValues row={row} payload={row.payload}/></td><td><small>{BUSINESS_STATUS_LABELS[row.status]}</small><small>{businessRecoveryMessage(row, now)}</small>{quote ? <small>预计利润：{businessMoney(quote.breakdown.profitMinor, quote.currency)} · {quote.breakdown.marginPpm === null ? '利润率待补充' : `${(quote.breakdown.marginPpm / 10000).toFixed(2)}%`}</small> : null}{row.issues.map((issue, index) => <small key={index}>{issue.message}</small>)}</td></tr>; })}</tbody></table></div><div className="apps-business-actions"><button type="button" disabled={busy} onClick={onCancel}>返回检查</button><button type="button" className="apps-primary" disabled={busy || checking || !plan.rows.some(row => businessRecoveryAction(row, now) === 'submit')} onClick={onConfirm}>{busy ? '正在提交…' : checking ? '正在核对最新批次…' : `确认提交整批 ${plan.rows.length} 个动作`}</button></div></section>;
}

function SubmissionValues({ row, payload }: { row: BusinessRow; payload: Record<string, unknown> }) {
  // Listing corrections include content, assets and packaging, not only price.
  // Show saved values as inert text: confirmation must not fetch image URLs.
  if (row.action === 'listing') return <>{Object.entries(payload).length ? Object.entries(payload).map(([key, value]) => <small key={key}><span className="apps-business-muted">{BUSINESS_FIELD_LABELS[key] ?? key}：</span>{Array.isArray(value) ? JSON.stringify(value) : businessValue(value)}</small>) : <span className="apps-business-muted">—</span>}</>;
  const keys = businessPriceAction(row.action) ? ['price', 'currency_code', 'old_price', 'min_price', 'stock', 'action_id'] : row.action === 'stock' ? ['stock', 'warehouse_id'] : row.action === 'archive' ? ['archived'] : ['action_id', 'member'];
  return <FieldValues limit={keys.length} payload={Object.fromEntries(keys.filter(key => key in payload || key === 'price' || key === 'currency_code').map(key => [key, payload[key]]))}/>;
}

function FieldValues({ payload, limit = 5 }: { payload: Record<string, unknown>; limit?: number }) {
  const fields = Object.entries(payload).filter(([key]) => !['attributes', 'images', 'primary_image', 'description'].includes(key));
  return <>{fields.length ? fields.slice(0, limit).map(([key, value]) => <small key={key}><span className="apps-business-muted">{BUSINESS_FIELD_LABELS[key] ?? key}：</span>{businessValue(value)}</small>) : <span className="apps-business-muted">—</span>}</>;
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
    <small>预计利润：{businessMoney(quote.breakdown.profitMinor, quote.currency)} · 利润率 {quote.breakdown.marginPpm === null ? '待补充' : `${(quote.breakdown.marginPpm / 10000).toFixed(2)}%`}</small>{fields.map(([name, value]) => <small key={name}>{name}：{businessMoney(value, quote.currency)}</small>)}
    <details><summary>费用与利润明细</summary>{([['采购合计', quote.breakdown.purchaseMinor], ['固定费用', quote.breakdown.fixedMinor], ['物流费用', quote.breakdown.logisticsMinor], ['佣金', quote.breakdown.commissionMinor], ['预计利润', quote.breakdown.profitMinor]] as Array<[string, number | null]>).map(([name, value]) => <small key={name}>{name}：{businessMoney(value, quote.currency)}</small>)}<small>预计利润率：{quote.breakdown.marginPpm === null ? '待补充' : `${(quote.breakdown.marginPpm / 10000).toFixed(2)}%`}</small></details>
    {quote.issues.map((issue, index) => <p key={`${issue.code}:${index}`} className="apps-business-issue">{issue.message}</p>)}{quote.warnings.map((warning, index) => <small className="apps-business-muted" key={index}>{warning}</small>)}
  </div>;
}
const BUSINESS_PRICING_STYLES = `.apps-business-selection{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px;background:var(--apps-panel,#f4f8fe);padding:10px;border-radius:6px}.apps-business-selection span{flex:1}.apps-business-confirmation{border:2px solid #2473d5;border-radius:8px;padding:16px;margin:12px 0}.apps-business-confirmation h3{margin-top:0}.apps-business-confirmation p{font-size:12px;line-height:1.6}.apps-business-confirmation-table{width:100%;min-width:600px;text-align:left;font-size:12px;border-collapse:collapse}.apps-business-confirmation-table th,.apps-business-confirmation-table td{padding:10px;vertical-align:top;border-bottom:1px solid var(--apps-line,#e7eef9)}.apps-business-confirmation-table small{display:block;line-height:1.6}.apps-business-confirmation .apps-business-actions{position:static;padding-bottom:0}.apps-business-empty button{margin-left:12px}.apps-business-table{min-width:1180px}.apps-business-table th:nth-child(7){width:210px}.apps-business-table th:nth-child(8){width:200px}.apps-business-pricing-choice{display:grid;gap:8px}.apps-business-pricing-choice label{display:grid;gap:4px;font-size:10px;color:var(--apps-muted,#7086a5)}.apps-business-pricing-choice select{box-sizing:border-box;width:100%;min-width:0;padding:6px;font-size:11px;color:var(--apps-text,#233c61)}.apps-business-quote{margin-top:10px;border-top:1px solid var(--apps-line,#e7eef9);padding-top:6px}.apps-business-quote strong{display:block;margin:4px 0}.apps-business-quote details{margin-top:5px}.apps-business-quote summary{font-size:11px;cursor:pointer;color:#3572bb}.apps-business-add .apps-business-pricing-choice{display:flex;flex-wrap:wrap;gap:10px}.apps-business-add .apps-business-pricing-choice label{min-width:155px}`;
function ContentDetails({ row, payload, disabled, onChange, rawText, onRawChange }: { row: BusinessRow; payload: Record<string, unknown>; disabled: boolean; rawText?: string; onRawChange: (text: string | undefined) => void; onChange: (payload: Record<string, unknown>) => void }) {
  const savedText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const text = rawText ?? savedText, [error, setError] = useState('');
  useEffect(() => { setError(''); }, [savedText]);
  const images = [...new Set([payload.primary_image, ...(Array.isArray(payload.images) ? payload.images : [])].filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url)))];
  return <details className="apps-business-content"><summary>查看 / 编辑完整内容</summary>{images.length ? <div className="apps-business-images">{images.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${row.target.offerId} 商品图`} loading="lazy"/></a>)}</div> : null}<textarea aria-label={`${row.target.offerId} 完整字段`} value={text} disabled={disabled} onChange={event => { setError(''); onRawChange(event.target.value === savedText ? undefined : event.target.value); }} spellCheck={false}/><button type="button" disabled={disabled} onClick={() => { try { onChange(parseBusinessPayload(text)); onRawChange(undefined); setError('已应用到待保存草稿。'); } catch { setError('字段格式有误，请保留完整对象及引号。'); } }}>应用字段修改</button>{text !== savedText ? <button type="button" disabled={disabled} onClick={() => { setError('已放弃未应用的字段修改。'); onRawChange(undefined); }}>放弃字段修改</button> : null}{error ? <small role="status">{error}</small> : null}</details>;
}
function NewBusinessRow({ disabled, pricingConfig, onStateChange, onAdd }: { onStateChange: (snapshot: string, dirty: boolean) => void; disabled: boolean; pricingConfig: BusinessPricingConfig | null; onAdd: (title: string, row: BusinessRowInput) => void }) {
  const [action, setAction] = useState<Exclude<BusinessAction, 'listing'>>('price'), [offerId, setOfferId] = useState(''), [price, setPrice] = useState(''), [stock, setStock] = useState(''), [actionId, setActionId] = useState(''), [warehouseId, setWarehouseId] = useState(''), [error, setError] = useState('');
  const [pricing, setPricing] = useState<NonNullable<BusinessRowInput['pricing']>>({ mode: 'automatic' });
  // Include hidden action fields: switching action does not erase their user input.
  // Config/default pricing is not a user edit and is deliberately outside this snapshot.
  const snapshot = JSON.stringify([action, offerId, price, stock, actionId, warehouseId, pricing.mode, pricing.planId ?? '']);
  const initialSnapshot = useRef(snapshot);
  useLayoutEffect(() => { onStateChange(snapshot, snapshot !== initialSnapshot.current); }, [snapshot, onStateChange]);
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
