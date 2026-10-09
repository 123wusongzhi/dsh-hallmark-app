export const MATERIAL_STYLES=`
.hm-root .hm-native-product-list,.hm-root .hm-native-sku-detail{min-width:0;color:var(--hm-text,#172033);container-type:inline-size}
.hm-root .hm-material-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.hm-root .hm-material-toolbar form{display:flex;gap:8px;min-width:0;flex:1}
.hm-root .hm-material-toolbar input{min-width:0;width:min(100%,340px);border:1px solid var(--hm-line,#dce6f3);background:var(--hm-surface,#fff);color:inherit;border-radius:8px;padding:9px 12px;font:inherit}
.hm-root .hm-material-example{display:inline-flex;border:1px solid #bdd3ff;background:#edf4ff;color:#2455b7;padding:2px 8px;font-size:12px;border-radius:5px;white-space:nowrap}
.hm-root .hm-material-scope{font-size:12px;color:var(--hm-muted,#66758e);margin:8px 0 12px;overflow-wrap:anywhere}
.hm-root .hm-material-scroll{max-width:100%;overflow:auto;border:1px solid var(--hm-line,#dce6f3);border-radius:10px}
.hm-root .hm-material-table{width:100%;border-collapse:collapse;font-size:13px}
.hm-root .hm-material-table th{background:color-mix(in srgb,var(--hm-accent,#2165ee) 6%,var(--hm-surface,#fff));color:var(--hm-muted,#586b89);padding:11px 14px;white-space:nowrap}
.hm-root .hm-material-table td{padding:12px 14px;vertical-align:middle;border-bottom:1px solid var(--hm-line,#e5ebf5);max-width:360px;white-space:normal;overflow-wrap:anywhere}
.hm-root .hm-material-table td[data-field="product.name"]{min-width:180px}
.hm-root .hm-material-table td[data-field="price.current"]{white-space:nowrap;font-variant-numeric:tabular-nums}
.hm-root .hm-material-table [aria-selected="true"]{background:color-mix(in srgb,var(--hm-accent,#2165ee) 9%,transparent)}
.hm-root .hm-material-selectable{cursor:pointer}.hm-root .hm-material-selectable:hover{background:color-mix(in srgb,var(--hm-accent,#2165ee) 5%,transparent)}
.hm-root .hm-material-image{width:54px;height:54px;object-fit:contain;display:block;border-radius:8px;background:var(--hm-surface,#f4f7fc)}
.hm-root .hm-material-image-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#8da0bd;background:#f0f5fc}.hm-root .hm-material-image-empty small{font-size:9px}
.hm-root [data-density="compact"] .hm-material-table td{padding:7px 10px}.hm-root [data-density="compact"] .hm-material-image{width:40px;height:40px}
.hm-root .hm-widget[data-density="compact"] .hm-data-table td{padding:6px 9px}
.hm-root .hm-material-empty{padding:30px 16px;background:color-mix(in srgb,var(--hm-accent,#2165ee) 3%,transparent);border:1px dashed var(--hm-line,#d3dff1);border-radius:10px;text-align:center;font-size:13px;color:var(--hm-muted,#66758e);display:grid;gap:8px}
.hm-root .hm-material-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;color:var(--hm-muted,#66758e);font-size:12px}
.hm-root .hm-material-pagination>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hm-root .hm-material-pagination button{padding:5px 9px;font-size:12px}
.hm-root .hm-product-procurement .hm-material-pagination label{display:flex;align-items:center;gap:5px}.hm-root .hm-product-procurement .hm-material-pagination select{border:1px solid #d8e4f2;border-radius:6px;padding:5px 7px;background:#fff;color:inherit;font:inherit}
.hm-root .hm-product-procurement .hm-material-toolbar form{position:relative;align-items:center}
.hm-root .hm-product-procurement .hm-material-toolbar input{width:min(100%,410px);padding:11px 14px 11px 38px;border-color:#d5e2f5;border-radius:10px;background:#f9fbff;transition:border-color .15s,box-shadow .15s}
.hm-root .hm-product-procurement .hm-material-toolbar input:focus{outline:none;border-color:#6495ee;box-shadow:0 0 0 3px #eaf1ff;background:#fff}
.hm-root .hm-product-procurement .hm-procurement-search-icon{position:absolute;left:13px;color:#8396b2;pointer-events:none}
.hm-root .hm-product-procurement .hm-material-toolbar button{border:1px solid #2165ee;background:#2165ee;color:#fff;padding:10px 17px;border-radius:9px;white-space:nowrap}
.hm-root .hm-product-procurement .hm-material-toolbar button:disabled{opacity:.55;cursor:wait}
.hm-root .hm-product-procurement .hm-material-scope{margin:8px 0 16px;color:#8491a6;font-size:11px}
.hm-root .hm-product-procurement .hm-material-scroll{border-color:#e0e8f4;border-radius:12px}
.hm-root .hm-product-procurement .hm-material-table th{background:#f5f8fd;color:#60738f;padding:13px 14px;text-align:left;font-weight:500}
.hm-root .hm-product-procurement .hm-material-table td{padding:17px 14px;border-bottom-color:#edf1f7}
.hm-root .hm-product-procurement .hm-material-table tbody tr:last-child td{border-bottom:0}
.hm-root .hm-product-procurement .hm-material-table td[data-field="product.name"]{min-width:245px;max-width:325px}
.hm-root .hm-product-procurement .hm-material-table td[data-field="sku.specification"],.hm-root .hm-product-procurement .hm-material-table td[data-field="purchase.specification"]{min-width:105px;max-width:175px}
.hm-root .hm-product-procurement .hm-material-table td[data-field="purchase.price"],.hm-root .hm-product-procurement .hm-material-table td[data-field="price.current"]{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:550}
.hm-root .hm-product-procurement .hm-material-table td[data-field="metric.margin"]{min-width:136px}
.hm-root .hm-product-procurement .hm-procurement-product{display:flex;align-items:center;gap:12px}
.hm-root .hm-product-procurement .hm-procurement-product>.hm-material-image{flex-shrink:0;width:58px;height:58px;border:1px solid #edf1f7;background:#fff}
.hm-root .hm-product-procurement .hm-procurement-product>div{min-width:0}
.hm-root .hm-product-procurement .hm-procurement-product strong{display:block;font-weight:600;line-height:1.5;color:#24364e;overflow-wrap:anywhere}
.hm-root .hm-product-procurement .hm-procurement-identifiers{display:flex;flex-direction:column;gap:3px;margin-top:6px;color:#8290a4;overflow-wrap:anywhere}
.hm-root .hm-product-procurement .hm-procurement-identifiers small{font-size:10px}
.hm-root .hm-product-procurement .hm-procurement-specification{display:block;line-height:1.6;color:#516780}
.hm-root .hm-product-procurement td[data-field="purchase.specification"] .hm-procurement-specification{border-left:2px solid #c8dcff;padding-left:8px}
.hm-root .hm-product-procurement .hm-procurement-links{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.hm-root .hm-product-procurement .hm-procurement-link-item{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.hm-root .hm-product-procurement .hm-procurement-links a{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;text-decoration:none;background:#f1f6ff;color:#2861b9;border:1px solid #e1ebfc;border-radius:6px;padding:5px 7px;font-size:11px}
.hm-root .hm-product-procurement .hm-procurement-links a:hover{background:#e4eeff;border-color:#bacef1}
.hm-root .hm-product-procurement .hm-procurement-links a:focus-visible,.hm-root .hm-product-procurement summary:focus-visible{outline:2px solid #2165ee;outline-offset:3px}
.hm-root .hm-product-procurement .hm-procurement-link-item small{color:#7b8ca3;font-size:10px;max-width:140px}
.hm-root .hm-product-procurement .hm-procurement-margin{display:flex;flex-direction:column;align-items:flex-start;gap:5px;font-variant-numeric:tabular-nums}
.hm-root .hm-product-procurement .hm-procurement-rate{font-size:22px;line-height:1.25;letter-spacing:-.6px;color:#2861b9;font-weight:650}
.hm-root .hm-product-procurement .hm-procurement-margin[data-negative="true"] .hm-procurement-rate{color:#ba474b}
.hm-root .hm-product-procurement .hm-procurement-margin[data-negative="true"] .hm-procurement-rate:before{content:'!';display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1px solid #d59194;border-radius:50%;margin-right:5px;vertical-align:middle;font-size:10px;letter-spacing:0}
.hm-root .hm-product-procurement .hm-procurement-missing{color:#8c98aa;font-size:12px;font-weight:400}
.hm-root .hm-product-procurement .hm-procurement-reason{max-width:210px;color:#9a825b;font-size:10px;line-height:1.5}
.hm-root .hm-product-procurement .hm-procurement-calculation summary{cursor:pointer;color:#8593a7;font-size:10px;padding:3px 0;white-space:nowrap}
.hm-root .hm-product-procurement .hm-procurement-calculation[open]{width:230px;max-width:100%}
.hm-root .hm-product-procurement .hm-procurement-breakdown{margin-top:7px;padding:10px 12px;border:1px solid #e4ebf6;border-radius:8px;background:#f9fbff;min-width:205px;font-size:11px;font-weight:400}
.hm-root .hm-product-procurement .hm-procurement-breakdown dl{display:flex;flex-direction:column;gap:7px;margin:0}
.hm-root .hm-product-procurement .hm-procurement-breakdown dl>div{display:flex;justify-content:space-between;gap:14px}
.hm-root .hm-product-procurement .hm-procurement-breakdown dt{color:#7c8ca1;white-space:nowrap}
.hm-root .hm-product-procurement .hm-procurement-breakdown dd{margin:0;color:#3e536f;text-align:right;white-space:nowrap}
.hm-root .hm-product-procurement .hm-procurement-breakdown p{font-size:10px;line-height:1.6;color:#8490a1;margin:8px 0 0}
.hm-root .hm-product-procurement .hm-procurement-breakdown .hm-procurement-formula{border-top:1px solid #e6edf7;padding-top:8px;color:#5a7497}
.hm-root .hm-product-procurement[data-density="compact"] .hm-material-table td{padding:10px 12px}
.hm-root .hm-product-procurement[data-density="compact"] .hm-procurement-product>.hm-material-image{width:44px;height:44px}
@container(max-width:460px){.hm-root .hm-material-table td[data-field="product.name"]{min-width:140px}.hm-root .hm-material-table td{padding:8px}.hm-root .hm-material-image{width:40px;height:40px}.hm-root .hm-material-pagination{align-items:flex-start;flex-direction:column}}
`;
