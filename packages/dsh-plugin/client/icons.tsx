import React from 'react';
export type AppIconName='apps'|'search'|'plus'|'more'|'settings'|'chat'|'refresh'|'close'|'grid'|'arrow-right'|'package'|'store'|'layers'|'chart'|'table'|'sparkle'|'arrow-up-right'|'check';
/** Small local SVGs share the host text color; no icon font, remote asset or extra runtime. */
export function AppIcon({name,size=18,className=''}:{name:AppIconName;size?:number;className?:string}){
  const paths:Record<AppIconName,React.ReactNode>={
    apps:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    plus:<path d="M12 5v14M5 12h14"/>,
    more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    settings:<><path d="m9 3-.7 2.5-2 .9L4 6l-1.5 2.5 1.9 1.9-.2 2.2L2.5 15 4 17.5l2.6-.4 1.8 1.3L9 21h3l1.2-2.2 2.2-.3 2.1 1.4 2.2-2.1-1.2-2.3.5-2.1 2.5-1V9.5l-2.4-1.1-.9-1.9.5-2.5L16 2.5l-2 1.8-2.1-.1L10.5 3Z"/><circle cx="11.5" cy="11.5" r="3"/></>,
    chat:<><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z"/><path d="M7 10h.01M12 10h.01M17 10h.01" strokeWidth="2.8"/></>,
    refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M19.2 8a8 8 0 0 0-13.4-2L4 8M4.8 16a8 8 0 0 0 13.4 2L20 16"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>,
    grid:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/></>,
    'arrow-right':<path d="M4 12h16m-6-6 6 6-6 6"/>,
    package:<><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7.5 5.5l9 5V15"/></>,
    store:<><path d="m4 3-2 6v2a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2V9l-2-6H4ZM4 14v7h16v-7M9 21v-6h6v6M2 9h20"/></>,
    layers:<><path d="m12 3 10 5-10 5L2 8l10-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    chart:<><path d="M4 3v17h17M8 15l4-5 4 3 5-7"/></>,
    table:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M10 4v16"/></>,
    sparkle:<><path d="m13 2 2.5 6.5L22 11l-6.5 2.5L13 20l-2.5-6.5L4 11l6.5-2.5L13 2ZM4 2v4M2 4h4M5 18v4M3 20h4"/></>,
    'arrow-up-right':<path d="M6 18 18 6M6 6h12v12"/>,
    check:<path d="m5 12 4 4L19 6"/>,
  };
  return <svg className={`hm-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
