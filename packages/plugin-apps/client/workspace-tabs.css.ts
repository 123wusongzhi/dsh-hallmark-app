/** Compact tabs keep a generous, separate close target and a fixed new-tab action. */
export const APPS_WORKSPACE_TABS_STYLES=`
.apps-workspace .apps-local-tabs{gap:8px;padding:0 10px;min-height:54px;overflow:hidden;align-items:stretch}
.apps-tabs-scroll{display:flex;align-items:flex-end;gap:6px;flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;padding-top:8px;scroll-padding-inline:6px}
.apps-workspace .apps-tabs-scroll>.apps-library-tab,.apps-workspace .apps-tabs-scroll>.apps-local-tab{height:44px;min-width:112px;max-width:265px;flex:0 0 auto;scroll-margin-inline:6px}
.apps-workspace .apps-tabs-scroll>.apps-library-tab{padding-inline:18px;min-width:100px}
.apps-workspace .apps-tabs-scroll>.apps-local-tab{gap:2px;padding-right:3px}
.apps-workspace .apps-tabs-scroll>.apps-local-tab>button:not(.apps-tab-close){flex:1 1 auto;min-width:0;max-width:218px;height:42px;padding-inline:14px 8px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
.apps-workspace .apps-tabs-scroll>.apps-local-tab>button.apps-tab-close{display:grid;place-items:center;width:36px;min-width:36px;height:36px;flex:0 0 36px;padding:0;border-radius:7px;color:var(--apps-muted);font-size:22px;line-height:1;transition:background .12s ease,color .12s ease}
.apps-workspace .apps-tabs-scroll>.apps-local-tab>button.apps-tab-close:hover:not(:disabled){color:var(--apps-blue);background:var(--apps-selected,#e8f0ff)}
.apps-workspace .apps-local-tabs button:focus-visible{outline:2px solid var(--apps-blue);outline-offset:-3px}
.apps-workspace .apps-tabs-scroll>.apps-local-tab[aria-busy=true]{opacity:.8}
.apps-workspace .apps-local-tabs>.apps-tab-add{align-self:center;width:36px;min-width:36px;height:36px;flex:0 0 36px;margin:0;border-radius:9px;background:var(--apps-bg);color:var(--apps-blue)}
@media(prefers-reduced-motion:reduce){.apps-workspace .apps-tabs-scroll>.apps-local-tab>button.apps-tab-close{transition:none}}
`;
