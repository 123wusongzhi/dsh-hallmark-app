export const WORKBENCH_CARDS_STYLES=`
.apps-workbench-cards-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:2px 0 26px;flex-wrap:wrap}
.apps-workbench-cards-title,.apps-workbench-cards-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.apps-workbench-cards-title h2{font-size:27px;font-weight:700;letter-spacing:-.6px;margin:0}
.apps-workbench-cards .apps-store-context.is-compact{margin:0;padding:0 0 0 17px;border:0;border-left:1px solid var(--apps-line);border-radius:0;background:transparent}
.apps-workbench-cards .is-compact .apps-config-label{gap:8px;font-size:12px;color:var(--apps-muted)}
.apps-workbench-cards .is-compact select{min-width:120px;max-width:185px;padding:8px 28px 8px 11px;font-size:13px}
.apps-workspace .apps-workbench-cards-tools>button,.apps-workspace .apps-workbench-back{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;font-size:13px}
.apps-workspace .apps-workbench-cards-tools>button:not(.apps-primary){background:transparent;border-color:transparent;color:var(--apps-muted)}
.apps-workspace .apps-workbench-back{padding-left:0;background:transparent;border:0;color:var(--apps-accent,#2166ee)}
.apps-workbench-cards .apps-workbench-status{margin-bottom:16px;font-size:12px}
.apps-workbench-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:stretch}
.apps-workbench-card{position:relative;min-width:0;border:1px solid #dfe8f5;background:var(--apps-bg,#fff);border-radius:12px;transition:border-color .15s,box-shadow .15s;scroll-margin:20px}
.apps-workbench-card:hover{border-color:#86b1f4;box-shadow:0 5px 18px #2c67bf0b}
.apps-workbench-card:focus-within{outline:2px solid #629bf4;outline-offset:3px}
.apps-workbench-card.is-highlighted{border-color:#6099ef;box-shadow:0 0 0 3px #eaf2ff}
.apps-workspace .apps-workbench-card-open{display:flex;flex-direction:column;gap:12px;width:100%;height:194px;text-align:left;white-space:normal;padding:14px;border:0;border-radius:12px;background:transparent;color:var(--apps-text)}
.apps-workbench-card-open>.apps-material-mini{width:100%;height:112px;min-height:112px;box-sizing:border-box;background:#f9fbff;border-color:#e7eef9}
.apps-workbench-saved-thumbnail{display:block;width:100%;height:112px;min-height:112px;object-fit:cover;object-position:top;border:1px solid #e7eef9;border-radius:8px;background:#f9fbff;box-sizing:border-box}
.apps-workbench-card-open .apps-mini-row{padding:5px 0}
.apps-workbench-card-open .apps-mini-copy i{max-width:90px}
.apps-workbench-card-open .apps-mini-head{background:#eef4ff}
.apps-workbench-card-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;font-weight:600;line-height:20px;max-height:40px;padding-right:6px}
.apps-workbench-card-menu{position:absolute;top:20px;right:20px}
.apps-workbench-card-menu summary{display:flex;align-items:center;justify-content:center;width:29px;height:28px;padding:0;background:var(--apps-bg,#fff);border:1px solid #dce7f7;border-radius:6px;color:#5880b4;line-height:1}
.apps-workbench-card-menu details>div{top:33px;width:150px}
.apps-workbench-card-menu summary::-webkit-details-marker{display:none}
.apps-workspace .apps-workbench-card-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;min-height:196px;border:1px dashed #cbdcf4;border-radius:12px;background:#fafcff;color:#6485b3}
.apps-workbench-card-add>span{display:flex;align-items:center;justify-content:center;width:39px;height:39px;background:#edf4ff;border-radius:11px;color:#3478e2}
.apps-workbench-card-add strong{font-size:13px;font-weight:500}
.apps-workbench-detail{min-width:0}
@container(max-width:1060px){.apps-workbench-card-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}}
@container(max-width:760px){.apps-workbench-card-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.apps-workbench-cards-heading{gap:13px;margin-bottom:20px}.apps-workbench-cards-title{gap:10px}.apps-workbench-cards-title h2{font-size:24px}.apps-workbench-cards-tools{gap:7px}.apps-workbench-cards .is-compact .apps-config-label>span{display:none}.apps-workbench-cards .apps-store-context.is-compact{padding-left:10px}.apps-workbench-cards .is-compact select{min-width:98px}}
@container(max-width:410px){.apps-workbench-card-grid{grid-template-columns:minmax(0,1fr)}.apps-workbench-cards-tools{width:100%;justify-content:space-between}.apps-workbench-card-open>.apps-material-mini{height:104px;min-height:104px}.apps-workspace .apps-workbench-card-open{height:186px}.apps-workspace .apps-workbench-card-add{min-height:115px;flex-direction:row}}
@media(prefers-reduced-motion:reduce){.apps-workbench-card{transition:none}}
body[data-ds-dark-theme] .apps-workbench-card,body[data-ds-dark-theme] .apps-workbench-card-menu summary{border-color:var(--apps-line)}
body[data-ds-dark-theme] .apps-workbench-card-open>.apps-material-mini,body[data-ds-dark-theme] .apps-workspace .apps-workbench-card-add{background:var(--apps-bg);border-color:var(--apps-line)}
`;
