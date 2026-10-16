import React, {useEffect, useId, useState} from 'react';
import type {BusinessRow} from '../../app-hallmark/src/operations/types.ts';
import {BUSINESS_STATUS_LABELS, editableBusinessRow} from '../../app-presentation/src/materials/business-operations.ts';

type Payload = Record<string, unknown>;
const textValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? value : '';
const imageLines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

/** Keep line breaks while typing; normalized URLs enter the parent's unsaved draft immediately. */
function ImageListField({label, value, disabled, onChange}: {label: string; value: unknown; disabled: boolean; onChange: (urls: string[]) => void}) {
  const urls = Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string') : [];
  const serialized = JSON.stringify(urls), [text, setText] = useState(() => urls.join('\n'));
  useEffect(() => { if (JSON.stringify(imageLines(text)) !== serialized) setText(urls.join('\n')); }, [serialized]);
  return <textarea aria-label={label} rows={3} value={text} disabled={disabled} spellCheck={false} placeholder="每行一张已发布的图片地址，按展示顺序排列" onChange={event => { setText(event.target.value); onChange(imageLines(event.target.value)); }}/>;
}

export function ListingDraftEditor({rows, row, payload, editedIds, disabled, onSelect, onChange}: {
  rows: BusinessRow[]; row: BusinessRow; payload: Payload; editedIds: ReadonlySet<string>; disabled: boolean;
  onSelect: (rowId: string) => void; onChange: (payload: Payload) => void;
}) {
  const prefix = useId(), locked = disabled || !editableBusinessRow(row), dirty = editedIds.has(row.rowId);
  const change = (field: string, value: unknown) => onChange({...payload, [field]: value});
  const fieldIssues = (field: string) => row.issues.filter(issue => issue.field === field || issue.field?.startsWith(field + '.'));
  const issueText = (field: string) => fieldIssues(field).map(issue => [issue.message, issue.suggestion].filter(Boolean).join(' ')).join(' ');
  const hint = (field: string) => issueText(field) ? <small id={`${prefix}-${field}`} className="apps-listing-field-issue">{issueText(field)}</small> : null;
  const input = (field: string, label: string, numeric = false) => <label key={field}><span>{label}</span><input aria-label={`${row.target.offerId} ${label}`} aria-describedby={issueText(field) ? `${prefix}-${field}` : undefined} type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined} step={numeric ? 'any' : undefined} value={textValue(payload[field])} disabled={locked} onChange={event => change(field, numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value)}/>{hint(field)}</label>;
  const unit = (field: string, label: string, choices: string[]) => <label><span>{label}</span><select aria-label={`${row.target.offerId} ${label}`} value={String(textValue(payload[field]))} disabled={locked} onChange={event => change(field, event.target.value)}><option value="">请选择单位</option>{payload[field] && !choices.includes(String(payload[field])) ? <option value={String(payload[field])}>{String(payload[field])}（原单位）</option> : null}{choices.map(value => <option key={value} value={value}>{value}</option>)}</select>{hint(field)}</label>;
  const images = Array.isArray(payload.images) ? payload.images : [];
  const imageIssue = row.issues.some(issue => /^(images|primary_image|listingAssets)(\.|$)/.test(issue.field ?? ''));
  const packagingIssue = row.issues.some(issue => /^(weight|weight_unit|height|width|depth|dimension_unit)(\.|$)/.test(issue.field ?? ''));
  return <section className="apps-listing-editor" aria-label="上品内容编辑"><style>{STYLES}</style>
    <header><div><h3>上品内容</h3><p>销售货号：<strong>{row.target.offerId}</strong> · {dirty ? '有未保存修改' : BUSINESS_STATUS_LABELS[row.status]}</p></div><label>编辑的上品<select aria-label="编辑的上品" value={row.rowId} disabled={disabled} onChange={event => onSelect(event.target.value)}>{rows.map(item => <option key={item.rowId} value={item.rowId}>{item.target.offerId}{editedIds.has(item.rowId) ? ' · 未保存' : ''}</option>)}</select></label></header>
    <p className="apps-listing-note">{dirty ? '修改已保留在本批次，切换货号不会丢失。点击下方“保存草稿”后再提交；审核问题仍为上次保存结果。' : '补充内容后点击下方“保存草稿”；保存只更新草稿，不会发布。'}</p>
    <div className="apps-listing-main-fields">{input('name', '商品标题')}<label><span>商品说明</span><textarea aria-label={`${row.target.offerId} 商品说明`} aria-describedby={issueText('description') ? `${prefix}-description` : undefined} rows={2} value={String(textValue(payload.description))} disabled={locked} onChange={event => change('description', event.target.value)}/>{hint('description')}</label></div>
    <div className="apps-listing-more-fields">
      <details key={`images:${row.rowId}:${imageIssue}`} open={imageIssue}><summary>图片素材 · {images.length} 张商品图{payload.primary_image ? ' · 已填主图' : ' · 主图待补充'}</summary><p className="apps-listing-note">使用已发布且关联到本商品的素材地址。素材来源、图片审核与类目要求仍由提交前检查确认。</p>{input('primary_image', '主图地址')}<label><span>商品图片（每行一张）</span><ImageListField key={row.rowId} label={`${row.target.offerId} 商品图片`} value={payload.images} disabled={locked} onChange={urls => change('images', urls)}/>{hint('images')}{hint('listingAssets')}</label></details>
      <details key={`packaging:${row.rowId}:${packagingIssue}`} open={packagingIssue}><summary>发货包装 · {payload.weight ? `${payload.weight} ${payload.weight_unit ?? ''}` : '重量待补充'}</summary><p className="apps-listing-note">填写包含商品和包装的总重量、外包装尺寸。保留原单位，不自动换算或猜测。</p><div className="apps-listing-package-fields">{input('weight', '发货总重量', true)}{unit('weight_unit', '重量单位', ['g', 'kg'])}{input('depth', '发货包装长', true)}{input('width', '发货包装宽', true)}{input('height', '发货包装高', true)}{unit('dimension_unit', '尺寸单位', ['mm', 'cm', 'm'])}</div></details>
    </div>
  </section>;
}
const STYLES = `.apps-listing-editor{border:1px solid var(--apps-line,#dce7fa);border-radius:8px;padding:14px 16px;margin:4px 0 16px;background:var(--apps-panel,#f4f8fe)}.apps-listing-editor header{display:flex;align-items:center;justify-content:space-between;gap:12px}.apps-listing-editor h3{margin:0 0 5px;font-size:15px}.apps-listing-editor header p{margin:0;font-size:11px}.apps-listing-editor label{display:flex;flex-direction:column;gap:5px;font-size:11px;min-width:0}.apps-listing-editor header label{min-width:160px}.apps-listing-editor input,.apps-listing-editor select,.apps-listing-editor textarea{box-sizing:border-box;width:100%;min-width:0}.apps-listing-editor textarea{resize:vertical;line-height:1.5}.apps-listing-note{font-size:11px;line-height:1.6;color:var(--apps-muted,#7086a5);margin:8px 0 12px}.apps-listing-main-fields,.apps-listing-more-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.apps-listing-more-fields{margin-top:12px}.apps-listing-more-fields details{min-width:0;border-top:1px solid var(--apps-line,#dce7fa);padding-top:10px}.apps-listing-more-fields summary{font-size:12px;cursor:pointer;color:#3572bb}.apps-listing-more-fields details>label{margin:9px 0}.apps-listing-package-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.apps-listing-field-issue{color:#a0512e;font-size:11px;line-height:1.5}@media(max-width:650px){.apps-listing-editor{padding:12px}.apps-listing-editor header{align-items:flex-start;flex-wrap:wrap}.apps-listing-main-fields,.apps-listing-more-fields{grid-template-columns:1fr}}`;
