import React from 'react';

export function SidebarPreparing({editing=false,retained=false}:{editing?:boolean;retained?:boolean}) {
  return <div className="apps-sidebar-preparing" role="status"><span className="apps-sidebar-breath" aria-hidden="true"/><div><strong>{editing?'正在打磨，请稍候':'正在为您展开，请稍候'}</strong><p>{retained?'您可继续查看上次版本':editing?'新的模样，稍后为您呈现':'片刻之后，便可继续查看'}</p></div></div>;
}
export const SIDEBAR_STATUS_STYLES=`
.apps-sidebar-preparing{display:flex;align-items:center;gap:16px;padding:24px;color:#183458;background:#f7faff;border:1px solid #e6eefb;border-radius:12px;box-sizing:border-box}.apps-sidebar-preparing strong{font:500 19px/1.6 "Noto Serif SC","Songti SC",SimSun,serif;letter-spacing:.05em}.apps-sidebar-preparing p{font:13px/1.7 "Microsoft YaHei UI",sans-serif;color:#7b8da7;margin:5px 0 0}.apps-sidebar-breath{flex:none;width:12px;height:12px;background:#2775ef;border-radius:50%;box-shadow:0 0 0 8px #e8f1ff;animation:apps-sidebar-breathe 2.4s ease-in-out infinite;margin:8px}.apps-sidebar-preparing+*{margin-top:18px}@keyframes apps-sidebar-breathe{50%{opacity:.4;box-shadow:0 0 0 12px #edf4ff}}@media(prefers-reduced-motion:reduce){.apps-sidebar-breath{animation:none}}body[data-ds-dark-theme] .apps-sidebar-preparing{background:#1c2b40;color:#e4edfb;border-color:#34445b}body[data-ds-dark-theme] .apps-sidebar-preparing p{color:#adbbce}
`;
