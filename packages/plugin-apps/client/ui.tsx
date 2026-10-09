import React from 'react';

export type AppsIconName='search'|'grid'|'component'|'refresh'|'chat'|'settings'|'note'|'plus'|'box'|'tag'|'warehouse'|'chart'|'truck'|'check'|'chevron'|'back'|'close'|'eye'|'eye-off'|'edit'|'grip'|'link'|'calendar'|'image';
export function AppsIcon({name,className=''}:{name:AppsIconName;className?:string}) {
  const paths:Record<string,React.ReactNode>={
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    component:<><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M9 9v12"/><path d="M13 13h4m-4 4h4"/></>,
    refresh:<><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></>,
    chat:<><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H6l-3 2V5.5A2.5 2.5 0 0 1 5.5 3h7A8.5 8.5 0 0 1 21 11.5Z"/><path d="M8 9h8m-8 4h5"/></>,
    settings:<><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    note:<><path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>,
    plus:<path d="M12 4v16M4 12h16"/>,
    box:<><path d="m12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5M12 13v9M7 5.8l9 5"/></>,
    tag:<><path d="M3 3h9l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/></>,
    warehouse:<><path d="m3 9 9-6 9 6v12H3ZM7 21V11h10v10M7 15h10M7 18h10"/></>,
    chart:<path d="M4 20V11m5 9V4m6 16V8m5 12V2"/>,
    truck:<><path d="M3 5h12v12H3Zm12 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    chevron:<path d="m9 5 7 7-7 7"/>,
    back:<path d="m15 5-7 7 7 7"/>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,
    eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    'eye-off':<><path d="m3 3 18 18M9 5.5A9 9 0 0 1 12 5c6 0 10 7 10 7a20 20 0 0 1-3 4M6 7c-2 2-4 5-4 5s4 7 10 7c2 0 3-.5 4-1"/></>,
    edit:<><path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5"/></>,
    grip:<>{[7,13,19].flatMap(y=>[8,15].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="1"/>))}</>,
    link:<><path d="m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(0 -1) scale(.95)"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
    image:<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 3 3 4-5 5 7"/></>,
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
