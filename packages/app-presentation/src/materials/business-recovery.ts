import type {BusinessPlan, BusinessRow} from '../../../app-hallmark/src/operations/types.ts';
export type BusinessRecoveryAction = 'submit' | 'edit_save' | 'resolve_decision' | 'wait_retry' | 'inspect' | 'completed' | 'wait_review';
/** Guidance only. The server remains authoritative; a clock tick must never send a request. */
export function businessRecoveryAction(row: BusinessRow, now = Date.now()): BusinessRecoveryAction {
  if (['unknown', 'pending', 'dispatching'].includes(row.status)) return 'inspect';
  if (row.status === 'succeeded') return 'completed';
  if (row.status === 'reviewing') return 'wait_review';
  if (row.status === 'needs_user') return 'resolve_decision';
  if (row.status === 'rejected') {
    const codes = row.issues.map(issue => issue.code);
    if (codes.includes('REQUEST_NOT_DISPATCHED')) return 'submit';
    if (codes.includes('OZON_RATE_LIMIT') || row.action === 'stock' && codes.includes('PRODUCT_IS_NOT_CREATED')) return row.retryAt && Date.parse(row.retryAt) <= now ? 'submit' : 'wait_retry';
    return 'edit_save';
  }
  return 'submit';
}
export function businessRecoveryMessage(row: BusinessRow, now = Date.now()): string {
  switch (businessRecoveryAction(row, now)) {
    case 'edit_save': return '本行尚未重试。请修改退回字段并保存草稿，再提交；保存相同内容不会解除退回状态。';
    case 'resolve_decision': return '请先处理本行的经营判断，修改相关内容并保存草稿，再提交。';
    case 'wait_retry': return row.retryAt && Number.isFinite(Date.parse(row.retryAt)) ? `暂不能重试。请在 ${new Date(row.retryAt).toLocaleString('zh-CN')} 后重新确认提交；不会自动重发。` : '重试时间尚未确认，请先核实平台退回原因；不会自动重发。';
    case 'inspect': return '请使用“核查平台状态”确认原请求结果；不会重复发送。';
    case 'completed': return '已完成，不会重复发送。';
    case 'wait_review': return '审核处理中，请等待结果。';
    case 'submit': return '可进入提交前核查；仍须通过经营规则和所需审核。';
  }
}
export function businessSubmissionScope(rows: BusinessRow[], now = Date.now()): string {
  const count = (actions: BusinessRecoveryAction[]) => rows.filter(row => actions.includes(businessRecoveryAction(row, now))).length;
  return `本次可推进 ${count(['submit'])} 行，需先修正或判断 ${count(['edit_save','resolve_decision'])} 行，等待重试 ${count(['wait_retry'])} 行，待核查或审核 ${count(['inspect','wait_review'])} 行，已完成 ${count(['completed'])} 行。`;
}

/** The next meaningful eligibility transition, never a polling cadence. */
export function businessRecoveryDeadline(rows: BusinessRow[], now: number): number | undefined {
  const deadlines = rows.filter(row => businessRecoveryAction(row, now) === 'wait_retry').map(row => Date.parse(row.retryAt ?? '')).filter(at => Number.isFinite(at) && at > now);
  return deadlines.length ? Math.min(...deadlines) : undefined;
}
const stableDecisionJson = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
/** Compare the displayed decision and effective scope, not volatile updatedAt or receipts. */
export function businessConfirmationFingerprint(plan: BusinessPlan | undefined): string {
  if (!plan) return '';
  return stableDecisionJson({planId:plan.planId,storeId:plan.storeId,title:plan.title,revision:plan.revision,rows:plan.rows.map(row => ({rowId:row.rowId,revision:row.revision,action:row.action,target:row.target,payload:row.payload,before:row.before,pricing:row.pricing,pricingQuote:(row as BusinessRow & {pricingQuote?:unknown}).pricingQuote ?? row.context?.pricingQuote,status:row.status,issues:[...row.issues].sort((a,b)=>stableDecisionJson(a).localeCompare(stableDecisionJson(b))),retryAt:row.retryAt}))});
}
