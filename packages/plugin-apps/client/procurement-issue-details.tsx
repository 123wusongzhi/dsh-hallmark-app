import React from 'react';
import type {BusinessIssue, BusinessRow} from '../../app-hallmark/src/operations/types.ts';

/** Display only: candidates never become selection, reads, or write authority. */
export function ProcurementIssueDetails({row, issue, verified}: {row: BusinessRow; issue: BusinessIssue; verified: boolean}) {
  if (issue.code !== 'PROCUREMENT_SKU_NOT_UNIQUE' || !['draft', 'blocked'].includes(row.status)) return null;
  if (!verified) return <small>当前内容尚未核对，暂不展示上次候选；请保存或放弃修改后核对最新批次。</small>;
  const match = /^procurement\[(0|[1-9]\d*)\]\.sourceSkuId$/.exec(issue.field ?? '');
  const index = match ? Number(match[1]) : -1;
  const selection = Number.isSafeInteger(index) && index >= 0 ? row.procurement?.[index] : undefined;
  if (!selection || issue.sourceReference?.capabilityId !== 'hallmark.collection.read' || issue.sourceReference.itemIdField !== `procurement[${index}].itemId`) return <small>无法核对候选对应的采购关联；请读取原批次与来源商品后修正，不能直接采用上次候选。</small>;
  const candidates = (issue.candidates ?? []).filter(candidate => typeof candidate.sourceSkuId === 'string' && candidate.sourceSkuId.length > 0 && candidate.sourceSkuId.trim() === candidate.sourceSkuId);
  const complete = issue.candidatesComplete === true && candidates.length === issue.candidates?.length;
  return <small aria-label={`${row.target.offerId} 采购关联 ${index + 1} 核对`}>
    <span>采购关联 {index + 1} · 来源商品 {selection.itemId} · 当前来源 SKU {selection.sourceSkuId} · 数量 {selection.quantity}。候选仅供核对，不会自动替换。</span>
    {candidates.map((candidate, position) => <span key={position} style={{display:'block'}}>来源 SKU：{candidate.sourceSkuId}{candidate.spec ? ` · 规格：${candidate.spec}` : ''}</span>)}
    <span style={{display:'block'}}>{!candidates.length ? '暂无可安全使用的候选，请读取同一来源商品核对规格。' : complete ? '以上为本次读取返回的全部可核对候选；请确认实际采购规格后修正原批次采购关联。' : '候选未完整展示；需要更多规格时，只读取此来源商品，核对后修正原批次采购关联。'} 本页上品内容编辑只修改商品内容，不能修改采购关联。修正关联并保存后重新确认提交。</span>
  </small>;
}
