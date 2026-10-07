import React from 'react';

export function AppsIcon({name,className=''}:{name:'search'|'grid'|'component'|'refresh'|'chat'|'settings'|'note'|'plus';className?:string}) {
  const paths:Record<string,React.ReactNode>={
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    component:<><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M9 9v12"/><path d="M13 13h4m-4 4h4"/></>,
    refresh:<><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></>,
    chat:<><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H6l-3 2V5.5A2.5 2.5 0 0 1 5.5 3h7A8.5 8.5 0 0 1 21 11.5Z"/><path d="M8 9h8m-8 4h5"/></>,
    settings:<><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    note:<><path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>,
    plus:<path d="M12 4v16M4 12h16"/>,
  };
  return <svg className={`apps-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AppsAppMark({appId='apps',large=false}:{appId?:string;large?:boolean}) {
  return <span className={`apps-app-mark${large?' is-large':''} ${appId==='hallmark'?'is-hallmark':appId==='notes'?'is-notes':''}`} aria-hidden="true">{appId==='hallmark'?'H':<AppsIcon name={appId==='notes'?'note':'grid'}/>}</span>;
}

/** Display source timestamps without substituting a render time for a data time. */
export function appsDisplayTime(value?:string|null):string {
  if(!value)return '时间未知';
  const time=new Date(value);
  if(!Number.isFinite(time.getTime()))return '时间未知';
  return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(time);
}
