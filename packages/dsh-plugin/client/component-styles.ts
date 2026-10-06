/** Component interiors, shared by agent-created views, saved views and the builder preview.
 * Uses the shadcn data-table composition (toolbar / selection / table / pagination)
 * with local styles and the installed TanStack v8 runtime; no remote template assets.
 */
export const COMPONENT_STYLES = `
.hm-root.hm-snapshot{container-type:inline-size;min-width:0;padding:22px;border:1px solid var(--hm-line);border-radius:12px;background:var(--hm-surface);margin-top:0}
.hm-chat-workspace .hm-chat-detail>.hm-view.hm-snapshot{padding:20px;border-radius:12px}
.hm-root .hm-snapshot-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:22px}
.hm-root .hm-snapshot-heading{display:flex;align-items:center;gap:12px;min-width:0;flex:1 1 250px}
.hm-root .hm-snapshot-heading>div{min-width:0}.hm-root .hm-snapshot-heading h3{font-size:18px;font-weight:650;letter-spacing:-.02em;line-height:1.5;overflow-wrap:anywhere}
.hm-root .hm-snapshot-heading p{font-size:12px;color:var(--hm-muted);line-height:1.65;margin-top:3px;overflow-wrap:anywhere}
.hm-root .hm-snapshot-icon{display:flex;align-items:center;justify-content:center;flex:none;width:42px;height:42px;border-radius:11px;background:var(--hm-soft);color:var(--hm-accent)}
.hm-root .hm-snapshot-actions{gap:7px;flex:none}.hm-root .hm-snapshot-actions>button,.hm-chat-workspace .hm-chat-detail .hm-snapshot-actions>button{height:33px;font-size:12px;padding:6px 10px;background:var(--hm-surface);white-space:nowrap}
.hm-root .hm-snapshot-actions>button.hm-snapshot-reload{padding:0;width:33px;color:var(--hm-muted)}.hm-root .hm-snapshot-reload>span{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.hm-root .hm-snapshot-actions>button.hm-snapshot-refresh{font-weight:500}.hm-root .hm-snapshot-refresh>svg{color:var(--hm-muted)}
.hm-root.hm-snapshot[data-single-widget=true] .hm-widget>h3{display:none}.hm-root.hm-snapshot[data-single-widget=true] .hm-widget{padding:0;border:0;box-shadow:none}
.hm-root .hm-renderer{min-width:0;font-family:inherit}.hm-root .hm-renderer .hm-widget{padding:18px;border:1px solid var(--hm-line);border-radius:var(--hm-radius,10px)}.hm-root .hm-renderer .hm-widget>h3{font-size:var(--hm-title-size,16px);font-weight:600;margin-bottom:16px}
.hm-root .hm-renderer .hm-stat{font-size:32px;font-weight:650;letter-spacing:-.035em;line-height:1.2;padding:8px 0 10px}.hm-root .hm-renderer .hm-badge{background:var(--hm-soft);color:var(--hm-accent);border:0;border-radius:6px;font-size:12px;font-weight:500;padding:5px 9px}
/* Search and selection stay next to the data, including in a narrow native sidebar. */
.hm-root .hm-product-table{min-width:0;container-type:inline-size;font-size:13px}
.hm-root .hm-table-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.hm-root .hm-table-search{display:flex;align-items:center;gap:9px;position:relative;flex:0 1 320px;min-width:0;height:36px;border:1px solid var(--hm-line);border-radius:8px;padding:0 10px;background:var(--hm-surface);color:var(--hm-muted)}
.hm-root .hm-table-search:focus-within{border-color:var(--hm-accent);box-shadow:0 0 0 3px var(--hm-soft)}.hm-root .hm-table-search>svg{flex:none;width:16px;height:16px}
.hm-root .hm-table-search input{width:100%;min-width:0;height:100%;border:0;outline:0;box-shadow:none;border-radius:0;padding:0;background:transparent;color:var(--hm-text);font:inherit;font-size:12px}
.hm-root .hm-table-search input::placeholder{color:var(--hm-muted);opacity:1}.hm-root .hm-table-search:focus-within input:focus-visible{outline:none}
.hm-root button.hm-table-search-clear{flex:none;height:22px;width:22px;padding:2px;border:0;background:transparent;color:var(--hm-muted);border-radius:4px}
.hm-root .hm-table-toolbar-meta{display:flex;gap:5px 10px;align-items:center;flex-wrap:wrap;color:var(--hm-muted);font-size:11px;line-height:1.6}
.hm-root .hm-product-table .hm-selection-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 13px;padding:9px 12px;background:var(--hm-subtle);border:1px solid transparent;border-radius:8px;min-height:50px;font-size:12px}
.hm-root .hm-product-table .hm-selection-toolbar[data-has-selection=true]{background:var(--hm-soft);border-color:color-mix(in srgb,var(--hm-accent) 17%,var(--hm-line))}
.hm-root .hm-selection-count{font-size:12px;white-space:nowrap;color:var(--hm-muted)}.hm-root .hm-selection-count strong{font-size:14px;font-weight:650;color:var(--hm-text)}
.hm-root .hm-selection-hidden{display:block;font-size:11px;color:var(--hm-muted);white-space:normal}.hm-root .hm-table-selection-hint{font-size:11px;color:var(--hm-muted);margin-left:auto}
.hm-root .hm-table-selection-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.hm-root .hm-product-table .hm-selection-toolbar button{height:30px;padding:5px 9px;font-size:12px;border-color:transparent;background:transparent;white-space:nowrap}
.hm-root .hm-product-table button.hm-table-attach{background:var(--hm-accent);border-color:var(--hm-accent);color:var(--hm-on-accent);font-weight:500;gap:6px}
.hm-root .hm-product-table button.hm-table-attach:disabled{background:var(--hm-surface);color:var(--hm-muted);border-color:var(--hm-line);opacity:.75}
.hm-root .hm-product-table button.hm-table-attach:hover:not(:disabled){background:color-mix(in srgb,var(--hm-accent) 90%,#000)}
/* A fixed layout gives long product names real space instead of creating a giant overflow row. */
.hm-root .hm-product-table .hm-table-scroll{border:1px solid var(--hm-line);border-radius:9px;max-width:100%;max-height:clamp(260px,calc(100dvh - 340px),600px);background:var(--hm-surface);scrollbar-width:thin}
.hm-root .hm-product-table .hm-data-table{table-layout:fixed;width:100%;border-collapse:separate;border-spacing:0}
.hm-root .hm-data-table th,.hm-root .hm-data-table td{padding:12px 14px;vertical-align:middle;white-space:normal;font-size:13px;line-height:1.55;border-bottom:1px solid var(--hm-line)}
.hm-root .hm-data-table th{position:sticky;top:0;z-index:1;background:var(--hm-subtle);color:var(--hm-muted);font-weight:500;height:41px;padding-top:9px;padding-bottom:9px;font-size:12px}
.hm-root .hm-data-table .hm-table-check{width:44px;padding-left:14px;padding-right:10px}.hm-root .hm-data-table [data-column-kind=date]{width:140px}.hm-root .hm-data-table [data-column-kind=number]{width:118px;text-align:right}
.hm-root .hm-data-table .hm-row-checkbox{appearance:none;display:inline-block;vertical-align:middle;width:15px;height:15px;border:1px solid color-mix(in srgb,var(--hm-muted) 55%,var(--hm-line));border-radius:4px;background:var(--hm-surface);padding:0;margin:0;cursor:pointer;position:relative;transition:background 120ms,border-color 120ms}
.hm-root .hm-data-table .hm-row-checkbox:checked,.hm-root .hm-data-table .hm-row-checkbox:indeterminate{background:var(--hm-accent);border-color:var(--hm-accent)}
.hm-root .hm-data-table .hm-row-checkbox:checked::after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid var(--hm-on-accent);border-width:0 1.6px 1.6px 0;transform:rotate(45deg)}
.hm-root .hm-data-table .hm-row-checkbox:indeterminate::after{content:'';position:absolute;left:3px;right:3px;top:6px;height:1.6px;background:var(--hm-on-accent)}.hm-root .hm-data-table .hm-row-checkbox:disabled{opacity:.4;cursor:default}
.hm-root .hm-data-table button.hm-table-sort{display:inline-flex;max-width:100%;gap:6px;padding:0;border:0;min-height:22px;border-radius:3px;background:transparent;color:inherit;text-align:left;justify-content:flex-start;font-size:12px;font-weight:500}
.hm-root .hm-data-table button.hm-table-sort:hover{color:var(--hm-text)}.hm-root .hm-table-sort-icon{width:13px;height:13px;flex:none;opacity:.6}.hm-root .hm-data-table th[aria-sort=ascending],.hm-root .hm-data-table th[aria-sort=descending]{color:var(--hm-text)}
.hm-root .hm-table-cell-value{display:block;overflow-wrap:anywhere;min-width:0}.hm-root .hm-cell-title{font-size:13px;font-weight:500;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.hm-root .hm-cell-date{display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--hm-text)}.hm-root .hm-cell-date>span+span{color:var(--hm-muted);font-size:11px}
.hm-root .hm-cell-number{font-variant-numeric:tabular-nums;font-weight:500}.hm-root .hm-cell-missing{color:var(--hm-muted)}.hm-root .hm-cell-text{font-size:12px;overflow-wrap:anywhere}
.hm-root .hm-data-table tbody tr:hover{background:var(--hm-subtle)}.hm-root .hm-data-table tbody tr[data-state=selected]{background:color-mix(in srgb,var(--hm-accent) 6%,var(--hm-surface))}.hm-root .hm-data-table tbody tr[data-state=selected] td:first-child{box-shadow:inset 2px 0 var(--hm-accent)}
.hm-root .hm-data-table .hm-table-filter-empty{text-align:center;padding:35px 15px;color:var(--hm-muted)}
.hm-root .hm-table-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:14px;font-size:11px;color:var(--hm-muted)}
.hm-root .hm-table-range{display:flex;gap:6px 12px;flex-wrap:wrap;margin-right:auto;line-height:1.7}.hm-root .hm-table-range>span{font-size:11px}.hm-root .hm-table-page-size{display:flex;align-items:center;gap:6px;white-space:nowrap}.hm-root .hm-table-page-size select{height:29px;font-size:11px;padding:2px 5px;border-radius:6px;background:var(--hm-surface)}
.hm-root .hm-table-page-controls{display:flex;align-items:center;gap:9px;white-space:nowrap}.hm-root .hm-table-page-controls button{height:29px;padding:4px 9px;font-size:11px;border-radius:6px;background:var(--hm-surface)}
/* Keep provenance available without making metadata compete with the working data. */
.hm-root .hm-footer.hm-data-footer,.hm-chat-workspace .hm-chat-detail .hm-footer.hm-data-footer{display:flex;flex-wrap:wrap;align-items:flex-start;gap:9px 16px;margin-top:18px;padding-top:13px;font-size:11px;line-height:1.7;color:var(--hm-muted)}
.hm-root .hm-data-stamp{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px}.hm-root .hm-data-stamp>svg{width:13px;height:13px;flex:none;color:var(--hm-muted)}.hm-root .hm-data-stamp>time{overflow-wrap:anywhere}
.hm-root .hm-data-footer>details{margin:0 0 0 auto;max-width:100%}.hm-root .hm-data-footer summary{font-size:11px;list-style-position:inside;cursor:pointer;white-space:nowrap}.hm-root .hm-data-footer details[open]{flex-basis:100%}.hm-root .hm-data-footer details[open] summary{margin-bottom:8px}
.hm-root .hm-data-evidence{display:grid;gap:5px;padding:12px 14px;background:var(--hm-subtle);border-radius:7px;overflow-wrap:anywhere}.hm-root .hm-data-footer>[role=status],.hm-root .hm-data-caveat{flex-basis:100%;font-size:11px}
@container(max-width:560px){.hm-root .hm-snapshot-header{gap:12px;margin-bottom:18px}.hm-root .hm-snapshot-heading{flex-basis:100%}.hm-root .hm-snapshot-heading h3{font-size:16px}.hm-root .hm-snapshot-heading p{font-size:11px}.hm-root .hm-snapshot-icon{width:36px;height:36px;border-radius:9px}.hm-root .hm-snapshot-actions{margin-left:auto}.hm-root .hm-table-selection-hint{flex-basis:100%;margin:0}.hm-root .hm-table-toolbar{gap:8px}.hm-root .hm-table-search{flex:1 1 100%}.hm-root .hm-table-toolbar-meta{font-size:10px}.hm-root .hm-data-table th,.hm-root .hm-data-table td{padding:10px}.hm-root .hm-data-table [data-column-kind=date]{width:112px}.hm-root .hm-data-table .hm-table-check{width:34px;padding-left:10px;padding-right:8px}.hm-root .hm-data-table [data-column-kind=number]{width:96px}.hm-root .hm-cell-title{font-size:12px}.hm-root .hm-table-pagination{gap:10px}.hm-root .hm-table-range{flex-basis:100%}.hm-root .hm-table-page-controls{margin-left:auto}.hm-root .hm-cell-date{font-size:11px}}
@container(max-width:340px){.hm-chat-workspace .hm-chat-detail>.hm-view.hm-snapshot{padding:14px}.hm-root .hm-snapshot-heading{gap:9px}.hm-root .hm-snapshot-icon{display:none}.hm-root .hm-data-table [data-column-kind=date]{width:96px}.hm-root .hm-data-table th,.hm-root .hm-data-table td{padding:9px 8px}.hm-root .hm-data-table .hm-table-check{width:30px;padding-left:8px;padding-right:4px}.hm-root .hm-product-table .hm-selection-toolbar{padding:8px;gap:7px}.hm-root .hm-table-page-controls{gap:5px}.hm-root .hm-table-page-controls button{padding:4px 7px}.hm-root .hm-table-page-size{gap:4px}.hm-root .hm-data-footer>details{margin-left:0}.hm-root .hm-data-stamp{flex-basis:100%}}
@media(forced-colors:active){.hm-root .hm-data-table .hm-row-checkbox{appearance:auto}.hm-root .hm-data-table .hm-row-checkbox::after{display:none}}
`;
