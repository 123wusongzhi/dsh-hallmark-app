import React from 'react';
import type { OverviewDto } from '../../contracts/src/overview.ts';
import { AppIcon } from './icons.tsx';

const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
function time(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
export function OverviewCards({ data, loading }: { data?: OverviewDto; loading: boolean }) {
  const cards = [
    { title: '已采集商品', value: data?.collected.count, status: data?.collected.status, icon: 'package' as const, tone: 'green', note: '来自采集箱' },
    { title: '店铺商品', value: data?.products.count, status: data?.products.status, icon: 'table' as const, tone: 'blue', note: '店铺商品快照 · 含已归档' },
    { title: '已接入店铺', value: data?.stores.count, status: data?.stores.status, icon: 'store' as const, tone: 'violet', note: '来自 Hallmark 店铺列表' },
  ];
  return <div className="hm-overview-grid" aria-label="业务数据概览" aria-busy={loading}>
    {cards.map(card => <article className="hm-metric-card" key={card.title}>
      <span className="hm-metric-icon" data-tone={card.tone}><AppIcon name={card.icon} size={23}/></span>
      <div className="hm-metric-content"><p className="hm-metric-label">{card.title}</p><strong className="hm-metric-value">{number(card.value)}</strong><p className="hm-metric-note">{loading ? '正在读取…' : card.status === 'unavailable' || !data ? '暂未取得数据' : card.status === 'stale' ? '上次成功快照 · 待更新' : card.note}</p></div>
    </article>)}
  </div>;
}
export function StoreOverview({ data, loading }: { data?: OverviewDto; loading: boolean }) {
  const rows = data?.stores.rows ?? [];
  return <section className="hm-dashboard-panel hm-store-panel" aria-label="店铺商品概览">
    <header className="hm-panel-heading"><h3>店铺商品概览</h3><span className="hm-panel-icon"><AppIcon name="store" size={18}/></span></header>
    {rows.length ? <div className="hm-store-table-wrap"><table className="hm-store-table"><thead><tr><th>店铺</th><th>商品数</th><th>快照时间</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><span className="hm-store-name" title={row.name}><span className="hm-store-avatar">{row.name.slice(0, 1)}</span>{row.name}</span></td><td>{number(row.productCount)}{row.status === 'stale' ? <span className="hm-stale-tag">待更新</span> : null}</td><td className="hm-muted">{time(row.lastSuccessAt)}</td></tr>)}</tbody></table></div> : <div className="hm-panel-empty"><AppIcon name="store" size={30}/><p>{loading ? '正在读取店铺…' : data?.stores.count === 0 ? '还没有接入店铺' : '店铺数据暂不可用'}</p><span>连接后显示各店铺的商品快照</span></div>}
    <footer className="hm-panel-footnote">来源：Hallmark 现有快照<span>{data ? `读取于 ${time(data.fetchedAt)}` : '尚未读取'}</span></footer>
  </section>;
}
/** Layout illustrations for reusable designs, never charts presented as business data. */
export function DesignPreview({ kind = 'table' }: { kind?: 'table' | 'profit' | 'receipt' | 'line' }) {
  return <div className={`hm-design-preview hm-preview-${kind}`} aria-hidden="true">
    {kind === 'receipt' ? <><span className="hm-preview-check"><AppIcon name="check" size={17}/></span><div className="hm-preview-lines"><i/><i/><i/></div></> : kind === 'line' ? <svg viewBox="0 0 260 48" preserveAspectRatio="none"><path d="M0 38 C20 38 25 15 45 22 S78 36 98 20 S130 34 151 15 S180 27 200 9 S237 17 260 3" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg> : kind === 'profit' ? <><div className="hm-preview-bars"><i/><i/><i/><i/><i/></div><span className="hm-preview-rule"/></> : <div className="hm-preview-table-lines"><div><i/><i/><i/></div><div><i/><i/><i/></div><div><i/><i/><i/></div></div>}
  </div>;
}
